import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { createApp } from '../../../api/src/app.ts'
import { freshDb } from '../../../api/src/db/testing.ts'
import { inMemoryCounter } from '../../../api/src/public/rate-limit.ts'
import { inMemoryAttempts } from '../../../api/src/idempotency.ts'
import {
  departments,
  eventArchives,
  events,
  members,
  organizations,
  tasks,
  users,
} from '../../../api/src/db/schema.ts'
import { ScreenRouter } from '../screens/ScreenRouter'
import { readListSource, readObjectSource } from './catalog'
import { forgetSources, loadSources, useServer } from './server'
import { runMutation } from '../spec/mutations'

// **기록 화면 셋을 끝까지 뚫는다**(REC-01 · REC-02 · REC-02A).
//
// | 화면 | 읽기 |
// | --- | --- |
// | REC-01 | `record.completedEventAlert` · `record.completedEvents` |
// | REC-02 | `record.archive` · `archiveSections` · `archiveDetail` · `archiveTimeline` · `archiveEvidence` · `archiveRetro` · `archiveHandover` |
// | REC-02A | `record.archive` · `archiveSections` · `archiveAutoFilled` · `archiveDraft` · `archiveGate` · `archiveGateConditions` |
//
// **발행된 문서는 굳은 값에서 읽힌다.** 표에는 지금 값이 따로 있고 화면에 그려지는 것은
// 굳은 값이어야 한다 — 그래서 굳은 값에 표에 없는 말을 넣어 두고 그 말을 찾는다.
//
// **자리 하나가 안 붙어도 화면은 열린다.** 체크리스트(REC-02)와 검토 의견(REC-02A)은
// 아직 서버가 답하지 않는다 — 그 블록만 '아직 준비 중'이고 나머지는 그려져야 한다.
//
// **읽기는 `<ScreenRouter>`를 그려서 잰다.** 그릇에 손으로 값을 먹이면 거르개가 달린
// 화면이 서버에 붙는 순간 터지는 것을 못 본다.

const NOW = new Date('2026-06-10T10:00:00+09:00')
const at = (text: string) => new Date(`${text}T00:00:00+09:00`)
const moment = (text: string) => new Date(`${text}+09:00`)

/** 바깥 그물이 화면을 통째로 가렸을 때의 말. 어느 화면에도 있어서는 안 된다. */
const SCREEN_NOT_BUILT = '이 화면은 아직 준비 중입니다.'
/** 그 자리 하나만 가렸을 때의 말. */
const BLOCK_NOT_BUILT = '아직 준비 중입니다'

let restore: () => void
let close: () => Promise<void>

const draw = (screenId: string, screenParams: Record<string, string> = {}) =>
  render(
    <ScreenRouter
      screenId={screenId}
      screenParams={screenParams}
      scopes={{}}
      onChangeScope={() => {}}
      onNavigate={() => {}}
    />,
  )

const drawn = () => document.body.textContent ?? ''

beforeAll(async () => {
  const fresh = await freshDb()
  close = fresh.close

  await fresh.db.insert(organizations).values({ id: 'ORG-01', name: '제12대 학생회' })
  await fresh.db.insert(departments).values({ id: 'D-01', orgId: 'ORG-01', name: '대외협력부' })
  await fresh.db.insert(users).values({ id: 'U-01', email: 'haerang@example.ac.kr' })
  await fresh.db.insert(members).values({
    id: 'M-01',
    // 보는 사람과 같은 사람이다 — 회장단이어야 검토자로 골라지고 쓰기가 열린다.
    role: 'chair',
    orgId: 'ORG-01',
    name: '박해랑',
    departmentId: 'D-01',
    userId: 'U-01',
  })

  // **개발용 응답에 없는 이름으로 둔다** — 그래야 서버를 거친 증거가 된다.
  await fresh.db.insert(events).values([
    {
      id: 'E-R1',
      orgId: 'ORG-01',
      title: '가을 한마당 부스',
      status: 'done',
      startAt: moment('2026-05-28T11:00:00'),
      endAt: moment('2026-05-28T17:00:00'),
      hostDepartmentId: 'D-01',
      hostMemberId: 'M-01',
      updatedAt: NOW,
    },
    {
      id: 'E-R2',
      orgId: 'ORG-01',
      title: '겨울 나눔 행사',
      status: 'done',
      startAt: at('2025-12-19'),
      hostDepartmentId: 'D-01',
      updatedAt: NOW,
    },
    // 쓰다 만 아카이브가 걸린 행사. 날짜가 가장 이르므로 목록 맨 뒤다.
    {
      id: 'E-R4',
      orgId: 'ORG-01',
      title: '봄 나들이',
      status: 'done',
      startAt: at('2025-06-01'),
      hostDepartmentId: 'D-01',
      updatedAt: NOW,
    },
    // 아직 안 끝난 행사. 이 목록에 오지 않는다.
    { id: 'E-R3', orgId: 'ORG-01', title: '봄 신입생 환영전', status: 'planning', updatedAt: NOW },
  ])
  await fresh.db.insert(eventArchives).values([
    // 발행된 문서. **굳은 값에 표에 없는 말을 넣어 둔다.**
    {
      id: 'AR-R1',
      orgId: 'ORG-01',
      eventId: 'E-R1',
      status: 'published',
      retroGood: '부스별 담당자를 두 명씩 두었다',
      handover: '[재사용 자산]\n부스 배치도 원본\n[주의사항]\n잔디밭은 사전 승인이 필요하다',
      nextOwner: '대외협력부 부서장',
      authorMemberId: 'M-01',
      publishedAt: moment('2026-06-04T09:00:00'),
      publishedByMemberId: 'M-01',
      frozen: {
        detail: {
          goal: '굳은 목표 · 화면 증거',
          audience: '굳은 대상',
          scheduleAndPlace: '굳은 일정',
          owner: '굳은 담당',
          scale: '굳은 규모',
          attendance: '굳은 참석',
          satisfaction: '굳은 만족도',
          budget: '굳은 예산',
          taskCompletion: '굳은 업무',
          runOrder: '굳은 순서',
          staffing: '굳은 배치',
          incident: '굳은 돌발',
          operationChange: '굳은 변경',
        },
        timeline: [{ id: 'frozen-1', date: '05. 28', title: '굳은 마디', description: '굳은 설명' }],
        evidence: [
          { id: 'tasks', title: '행사 업무', detail: '99건 (완료 99)', actionLabel: '원본 보기 →', targetKind: 'tasks' },
        ],
        autoFilled: { overview: '굳은 개요', outcome: '굳은 성과', timeline: '굳은 타임라인', evidence: '굳은 근거' },
      },
    },
    // 쓰다 만 초안. 현장 운영·잘된 점·인수인계는 썼고 나머지는 아직이다.
    {
      id: 'AR-R4',
      orgId: 'ORG-01',
      eventId: 'E-R4',
      status: 'draft',
      onSiteOperation: '10:00 집결 → 11:00 출발',
      retroGood: '벚꽃 길 안내가 좋았다',
      handover: '도시락 업체 재이용 가능',
    },
  ])
  await fresh.db.insert(tasks).values([
    { id: 'T-R1', orgId: 'ORG-01', eventId: 'E-R1', title: '부스 정리', status: 'done' },
    { id: 'T-R2', orgId: 'ORG-01', eventId: 'E-R1', title: '후기 작성', status: 'done' },
  ])

  const app = createApp({
    audit: { async write() {} },
    db: fresh.db as never,
    who: async () => ({
      userId: 'U-01',
      membership: {
        orgId: 'ORG-01',
        memberId: 'M-01',
        // **회장단으로 본다.** 읽기는 구성원 누구나지만 쓰기는 회장단·부서장만이다
        // (`record.write`, 사람이 정함 2026-09-05). 아래 쓰기 검사가 그 길을 탄다.
        role: 'chair',
        departmentId: 'D-01',
        inFinanceDepartment: false,
      },
    }),
    lookups: {
      isEventStaff: async () => false,
      isEventStaffManager: async () => false,
      isMeetingHost: async () => false,
      isMeetingCreator: async () => false,
      isMeetingParticipant: async () => false,
    },
    signIn: {
      open: () => ({ google: true, kakao: false }),
      start: async (provider: string) => ({ url: `https://example.test/${provider}` }),
    },
    attempts: inMemoryAttempts(),
    counter: inMemoryCounter(),
    invite: { linkBase: 'https://vada.app/join', now: () => NOW, newCode: () => 'CODE' },
    newId: () => 'X-01',
  })

  restore = useServer({
    baseUrl: 'http://server',
    fetch: async (input, init) => app.request(String(input), init),
  })
}, 60_000)

afterAll(async () => {
  restore()
  await close()
})

describe('완료된 행사가 저장소에서 온다(REC-01)', () => {
  it('완료된 것만 그리고 아직 안 끝난 행사는 없다', async () => {
    draw('REC-01')
    await waitFor(() => expect(screen.getByText('가을 한마당 부스')).toBeInTheDocument())
    const page = drawn()
    expect(page).toContain('겨울 나눔 행사')
    expect(page).not.toContain('봄 신입생 환영전')
    // 개발용 응답의 행사가 아니라는 증거.
    expect(page).not.toContain('봄 축제 학생회 부스')
  })

  // **머리의 건수는 검색으로 걸러지지 않는다.** 서버가 세고 화면은 그 문구만 그린다.
  // 문서가 없는 것 하나와 쓰다 만 것 하나 — 둘 다 미발행이다.
  it('미발행 건수를 서버가 세어 말로 만든다', async () => {
    draw('REC-01')
    await waitFor(() =>
      expect(screen.getByText('인수인계 문서 미발행 2건')).toBeInTheDocument(),
    )
  })

  // **없는 것이 표현이 아니라 뜻이다.** 열 곳이 없으면 그 까닭이 대신 온다.
  it('문서가 있으면 단추, 없으면 그 까닭이 온다', async () => {
    await loadSources([
      { key: 'record.completedEvents', params: {} },
      { key: 'record.completedEventAlert', params: {} },
    ])
    const rows = readListSource('record.completedEvents')
    expect(rows[0]).toMatchObject({
      id: 'E-R1',
      statusLabel: '완료',
      archiveStatus: '발행 완료',
      archiveStatusTone: 'green',
      date: '2026. 05. 28',
      host: '대외협력부',
      actionLabel: '상세 보기 →',
      targetKind: 'published',
    })
    expect(rows[0]!.highlights).toEqual([{ label: '완료 업무 2건' }])
    expect(rows[1]).toMatchObject({
      archiveStatus: '인수인계 문서 미발행',
      archiveStatusTone: 'gray',
      blockedNote: '인수인계 문서가 아직 발행되지 않았습니다',
    })
    // 쓰다 만 문서는 쓰고 검토받는 화면으로 간다.
    expect(rows[2]).toMatchObject({ id: 'E-R4', targetKind: 'draft' })
    expect(readObjectSource('record.completedEventAlert')).toEqual({
      unpublishedNote: '인수인계 문서 미발행 2건',
    })
  })

  it('행사명으로 서버가 거른다', async () => {
    const params = { query: '겨울' }
    await loadSources([{ key: 'record.completedEvents', params }])
    expect(readListSource('record.completedEvents', params).map((row) => row.title)).toEqual([
      '겨울 나눔 행사',
    ])
  })
})

describe('발행된 아카이브가 저장소에서 온다(REC-02)', () => {
  it('문서의 머리를 서버가 완성한 문장으로 그린다', async () => {
    draw('REC-02', { eventId: 'E-R1' })
    await waitFor(() => expect(screen.getByText('발행 2026. 06. 04')).toBeInTheDocument())
    const page = drawn()
    expect(page).toContain('가을 한마당 부스')
    expect(page).toContain('발행 완료')
    expect(page).toContain('2026. 05. 28 (목) 11:00–17:00')
    expect(page).toContain('대외협력부 · 책임자 박해랑')
    expect(page).toContain('작성 박해랑')
    expect(page).toContain('다음 담당: 대외협력부 부서장')
    // 검토 단계가 없다 — 검토자 줄이 없다.
    expect(page).not.toContain('검토 ')
    expect(page).not.toContain(SCREEN_NOT_BUILT)
  })

  // **발행 뒤에는 원본이 바뀌어도 이 문서는 바뀌지 않는다.** 표에는 완료 업무가 둘
  // 있지만 화면에 그려지는 것은 굳은 값이다.
  it('본문·타임라인·근거를 굳은 값에서 그린다', async () => {
    draw('REC-02', { eventId: 'E-R1' })
    await waitFor(() => expect(screen.getByText('굳은 목표 · 화면 증거')).toBeInTheDocument())
    const page = drawn()
    expect(page).toContain('굳은 마디')
    expect(page).toContain('99건 (완료 99)')
    expect(page).not.toContain('2건 (완료 2)')
    expect(screen.getByRole('button', { name: '원본 보기 →' })).toBeInTheDocument()
  })

  it('회고와 인수인계를 글에서 편 줄로 그린다', async () => {
    draw('REC-02', { eventId: 'E-R1' })
    await waitFor(() =>
      expect(screen.getByText('부스별 담당자를 두 명씩 두었다')).toBeInTheDocument(),
    )
    const page = drawn()
    expect(page).toContain('잘된 점')
    expect(page).toContain('재사용 자산')
    expect(page).toContain('부스 배치도 원본')
    expect(page).toContain('주의사항')
    expect(page).toContain('잔디밭은 사전 승인이 필요하다')
  })

  // **자리 하나가 안 붙어도 화면은 열린다.** 체크리스트는 항목이 어디서 오는지 명세가
  // 말하지 않아 아직 없다 — 그 블록만 준비 중이고 나머지는 위에서 그려졌다.
  it('체크리스트 자리만 준비 중이다', async () => {
    draw('REC-02', { eventId: 'E-R1' })
    // 머리글과 준비 중 표시가 같은 이름을 든다 — 그래서 둘이다.
    await waitFor(() => expect(screen.getAllByText('인수인계 체크리스트')).toHaveLength(2))
    expect(screen.getAllByText(BLOCK_NOT_BUILT)).toHaveLength(1)
    expect(drawn()).not.toContain(SCREEN_NOT_BUILT)
  })
})

describe('쓰는 중인 아카이브가 저장소에서 온다(REC-02A)', () => {
  it('상태와 자동 채움 네 줄과 AI 계약 문장이 서버에서 온다', async () => {
    draw('REC-02A', { eventId: 'E-R4' })
    await waitFor(() => expect(screen.getByText('인수인계 문서 미발행')).toBeInTheDocument())
    const page = drawn()
    expect(page).toContain('봄 나들이 · 2025. 06. 01 · 담당 대외협력부')
    expect(page).toContain('참석·예산·업무 기록 없음')
    expect(page).toContain('업무·회의·문서·구매 연결 데이터 없음')
    expect(page).toContain(
      'AI 초안은 이 행사의 업무·회의·문서·정산 기록만 재구성하며, 기록에 없는 자산·연락처·담당자를 새로 만들지 않습니다.',
    )
    expect(page).not.toContain(SCREEN_NOT_BUILT)
  })

  // 읽어 온 초안이 화면의 칸으로 들어간다(draftFrom).
  it('적어 둔 글이 칸에 들어간다', async () => {
    draw('REC-02A', { eventId: 'E-R4' })
    // 칸의 이름으로 찾는다 — 절(section)도 같은 이름을 aria-label로 들어서 글로 찾으면 둘이 잡힌다.
    const box = (name: string) => screen.getByRole('textbox', { name })
    await waitFor(() => expect(box('잘된 점')).toHaveValue('벚꽃 길 안내가 좋았다'))
    expect(box('현장 운영')).toHaveValue('10:00 집결 → 11:00 출발')
    expect(box('인수인계')).toHaveValue('도시락 업체 재이용 가능')
    expect(box('미흡했던 점과 원인')).toHaveValue('')
  })

  // **막는 것은 서버다.** 조건 여섯 줄과 채운 수가 한 셈에서 온다.
  it('발행 조건과 채운 수가 서버에서 온다', async () => {
    draw('REC-02A', { eventId: 'E-R4' })
    await waitFor(() => expect(screen.getByText('3 / 6')).toBeInTheDocument())
    const page = drawn()
    expect(page).toContain('현장 운영 기록')
    expect(page).toContain('회고 · 미흡했던 점과 원인')
    expect(page).toContain('다음 담당자 지정')
    // 목차의 진행 상태도 같은 셈이다.
    expect(page).toContain('작성 완료')
    expect(page).toContain('작성 중')
  })

  // 검토 단계는 명세에서 빠진다 — 검토 의견 자리만 준비 중이고 나머지는 위에서 그려졌다.
  // 검토는 그림에 있다 — 검토자 고르기와 검토 의견까지 서버에서 온다. 없는 것은
  // 승인 단추 하나이고 그것은 이 화면의 자리가 아니다. 그래서 가려진 자리가 없다.
  it('검토 의견 자리까지 서버에서 와서 가려진 자리가 없다', async () => {
    draw('REC-02A', { eventId: 'E-R4' })
    await waitFor(() => expect(screen.getAllByText('검토 의견').length).toBeGreaterThan(0))
    expect(drawn()).not.toContain(BLOCK_NOT_BUILT)
    expect(drawn()).not.toContain(SCREEN_NOT_BUILT)
  })
})

// **쓰기는 화면이 쓰는 그 길로 보낸다.** 서버를 직접 부르면 그 사이의 코드가 통째로
// 빠지고, 이 저장소에서 두 번 값을 치른 결함이 정확히 그 사이에 있었다.
describe('아카이브를 쓰는 길이 저장소까지 닿는다(REC-02A)', () => {
  it('임시 저장이 남고 다시 읽힌다', async () => {
    const answer = await runMutation(
      'record.archive.saveDraft',
      { retroGood: '부스 배치가 좋았다', nextOwner: '다음 대 대외협력부' },
      { eventId: 'E-R4' },
    )
    expect(answer).toEqual({})
    // 쓰고 나면 읽은 것이 낡는다 — 화면과 같은 규칙으로 비운다.
    forgetSources()
    await loadSources([{ key: 'record.archiveDraft', params: { eventId: 'E-R4' } }])
    const draft = readObjectSource('record.archiveDraft', { eventId: 'E-R4' })
    expect(draft.retroGood).toBe('부스 배치가 좋았다')
    expect(draft.nextOwner).toBe('다음 대 대외협력부')
  })

  it('검토 요청이 문서를 검토 중으로 옮기고 두 번은 못 넘긴다', async () => {
    // 검토자는 회장단·부서장 중에서 고른다. M-01은 회장단이다.
    await runMutation(
      'record.archive.requestReview',
      { retroGood: '넘긴다', reviewer: 'M-01' },
      { eventId: 'E-R4' },
    )
    forgetSources()
    await loadSources([
      { key: 'record.archive', params: { eventId: 'E-R4' } },
      { key: 'record.archiveDraft', params: { eventId: 'E-R4' } },
    ])
    expect(readObjectSource('record.archive', { eventId: 'E-R4' }).statusLabel).toBe('검토 중')
    expect(readObjectSource('record.archiveDraft', { eventId: 'E-R4' }).reviewer).toBe('M-01')
    // 이미 넘어간 문서는 또 못 넘긴다 — 서버가 409로 막고 화면 쪽 길이 그것을 던진다.
    await expect(
      runMutation('record.archive.requestReview', { reviewer: 'M-01' }, { eventId: 'E-R4' }),
    ).rejects.toThrow()
  })

  it('인수인계 초안이 기록에서 만들어진다', async () => {
    await runMutation('record.archive.generateHandoverDraft', {}, { eventId: 'E-R4' })
    forgetSources()
    await loadSources([{ key: 'record.archiveDraft', params: { eventId: 'E-R4' } }])
    const draft = readObjectSource('record.archiveDraft', { eventId: 'E-R4' })
    // 기록에 없는 것을 지어내지 않는다 — 다만 초안은 비어 오지 않는다.
    expect(typeof draft.handover).toBe('string')
    expect((draft.handover as string).length).toBeGreaterThan(0)
  })
})
