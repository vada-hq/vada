import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { createApp } from '../../../api/src/app.ts'
import { freshDb } from '../../../api/src/db/testing.ts'
import { inMemoryCounter } from '../../../api/src/public/rate-limit.ts'
import { inMemoryAttempts } from '../../../api/src/idempotency.ts'
import {
  documents,
  events,
  meetingAgendas,
  meetings,
  members,
  organizations,
  tasks,
  users,
} from '../../../api/src/db/schema.ts'
import { ScreenRouter } from '../screens/ScreenRouter'
import { readListSource, readObjectSource } from './catalog'
import { loadSources, useServer } from './server'

// **문서 화면 다섯을 끝까지 뚫는다**(EVT-DOC-01 · OPS-MEET-03A/05A/07 · EVT-TASK-02).
//
// 화면 다섯이 한 표를 본다 — 행사 문서·회의 자료·업무 문서가 같은 `documents`이고
// 다른 것은 무엇에 걸려 있느냐뿐이다. 그래서 여기서 재는 것도 화면마다의 값이 아니라
// **한 표에서 나온 값이 화면마다 옳게 갈리는가**다.
//
// | 화면 | 읽기 |
// | --- | --- |
// | EVT-DOC-01 | `event.documents` · `event.documentStats` · `event.documentStatusCounts` |
// | OPS-MEET-03A · 05A · 07 | `meeting.documents` |
// | EVT-TASK-02 | `task.referenceDocuments` · `task.workDocuments` |
//
// **읽기는 `<ScreenRouter>`를 그려서 잰다.** 그릇에 손으로 값을 먹이면 거르개가
// 달린 화면이 서버에 붙는 순간 터지는 것을 못 본다 — EVT-DOC-01이 거르개가 달린
// 화면이고, 그 값은 화면 안의 칸에 산다.
//
// **쓰기는 없다.** 문서를 만들거나 올리는 동작을 명세가 주지 않았다.

const NOW = new Date('2026-07-21T10:00:00+09:00')

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

const at = (text: string) => new Date(`${text}+09:00`)

beforeAll(async () => {
  const fresh = await freshDb()
  close = fresh.close

  await fresh.db.insert(organizations).values([
    { id: 'ORG-01', name: '제12대 학생회' },
    // **옆 학생회를 하나 더 둔다.** 울타리를 재려면 넘어갈 담이 있어야 한다.
    { id: 'ORG-02', name: '옆 학생회' },
  ])
  await fresh.db.insert(users).values({ id: 'U-01', email: 'haerang@example.ac.kr' })
  await fresh.db.insert(members).values([
    { id: 'M-01', orgId: 'ORG-01', name: '박해랑', userId: 'U-01' },
    { id: 'M-02', orgId: 'ORG-01', name: '이윤슬' },
    { id: 'M-99', orgId: 'ORG-02', name: '남의 사람' },
  ])
  await fresh.db.insert(events).values([
    // 개발용 응답도 아는 id다(행사 작업 공간의 머리가 아직 가짜에서 온다).
    // **이름은 개발용 응답에 없는 것으로 둔다** — 그래야 서버를 거친 증거가 된다.
    {
      id: 'E-01',
      orgId: 'ORG-01',
      title: '2026 소프트웨어융합대학 가을 한마당',
      updatedAt: NOW,
    },
    { id: 'E-99', orgId: 'ORG-02', title: '남의 행사', updatedAt: NOW },
  ])
  await fresh.db.insert(meetings).values([
    { id: 'MTG-01', orgId: 'ORG-01', eventId: 'E-01', title: '한마당 준비 회의' },
    { id: 'MTG-99', orgId: 'ORG-02', title: '남의 회의' },
  ])
  await fresh.db.insert(meetingAgendas).values([
    { id: 'AG-01', orgId: 'ORG-01', meetingId: 'MTG-01', sortOrder: 0, title: '안전 계획' },
  ])
  await fresh.db.insert(tasks).values([
    {
      id: 'ET-01',
      orgId: 'ORG-01',
      eventId: 'E-01',
      code: 'T-11',
      title: '한마당 현수막 디자인 확정',
      status: 'inProgress',
      assigneeMemberId: 'M-01',
    },
    { id: 'XT-01', orgId: 'ORG-02', title: '남의 업무' },
  ])

  await fresh.db.insert(documents).values([
    // ── 행사의 공용 문서. EVT-DOC-01의 표이자 EVT-TASK-02의 참고 문서다. ──
    {
      id: 'DOC-01',
      orgId: 'ORG-01',
      eventId: 'E-01',
      category: '기획',
      title: '한마당 운영 계획서',
      description: '운영 목표와 당일 진행 순서',
      status: 'confirmed',
      updatedByMemberId: 'M-02',
      updatedAt: at('2026-07-12T09:30:00'),
    },
    {
      id: 'DOC-02',
      orgId: 'ORG-01',
      eventId: 'E-01',
      category: '운영',
      title: '한마당 안전 점검표',
      description: '현장 안전 점검 항목',
      status: 'reviewing',
      updatedByMemberId: 'M-01',
      updatedAt: at('2026-07-18T14:00:00'),
    },
    {
      id: 'DOC-03',
      orgId: 'ORG-01',
      eventId: 'E-01',
      category: '참가자',
      title: '한마당 참가자 명단',
      status: 'drafting',
      updatedByMemberId: 'M-02',
      updatedAt: at('2026-07-19T11:00:00'),
    },
    // **개발용 응답과 수가 다르다.** 같은 수로 두면 타일과 개수가 가짜에서 와도
    // 검사가 통과한다 — 그러면 그 자리는 재는 것이 없다.
    {
      id: 'DOC-09',
      orgId: 'ORG-01',
      eventId: 'E-01',
      category: '후속 정리',
      title: '한마당 정산 근거 모음',
      status: 'drafting',
      updatedByMemberId: 'M-01',
      updatedAt: at('2026-07-20T09:00:00'),
    },
    // 아직 아무도 손대지 않은 문서. 손댄 때 대신 언제 쓸 것인지가 온다.
    {
      id: 'DOC-04',
      orgId: 'ORG-01',
      eventId: 'E-01',
      category: '후속 정리',
      title: '한마당 결과 보고서',
      status: 'notStarted',
      updatedAt: at('2026-07-01T09:00:00'),
    },

    // ── 업무가 내놓은 문서. 행사의 공용 원본이 아니다. ────────────────────
    {
      id: 'DOC-05',
      orgId: 'ORG-01',
      eventId: 'E-01',
      taskId: 'ET-01',
      title: '한마당 현수막 시안.png',
      status: 'reviewing',
      updatedAt: at('2026-07-20T10:00:00'),
    },
    {
      id: 'DOC-06',
      orgId: 'ORG-01',
      taskId: 'ET-01',
      title: '한마당 현수막 작업 노트',
      status: 'drafting',
      updatedAt: at('2026-07-20T11:00:00'),
    },

    // ── 회의에 붙은 자료. 안건의 것과 회의 전체의 것이 같은 표다. ─────────
    {
      id: 'DOC-07',
      orgId: 'ORG-01',
      meetingId: 'MTG-01',
      agendaId: 'AG-01',
      title: '한마당_안전인력배치.xlsx',
      status: 'drafting',
      updatedAt: at('2026-07-15T09:00:00'),
    },
    {
      id: 'DOC-08',
      orgId: 'ORG-01',
      meetingId: 'MTG-01',
      title: '한마당_지난회의요약.docx',
      status: 'confirmed',
      updatedAt: at('2026-07-14T09:00:00'),
    },

    // ── 옆 학생회의 것. 어느 화면에도 나오면 안 된다. ─────────────────────
    { id: 'DOC-91', orgId: 'ORG-02', eventId: 'E-99', category: '기획', title: '남의 행사 문서' },
    { id: 'DOC-92', orgId: 'ORG-02', meetingId: 'MTG-99', title: '남의 회의 자료.pdf' },
    { id: 'DOC-93', orgId: 'ORG-02', taskId: 'XT-01', title: '남의 업무 문서' },
  ])

  const app = createApp({
    audit: { async write() {} },
    db: fresh.db as never,
    who: async () => ({
      userId: 'U-01',
      membership: {
        orgId: 'ORG-01',
        memberId: 'M-01',
        role: 'member',
        departmentId: null,
        inFinanceDepartment: false,
      },
    }),
    lookups: {
      isEventStaff: async () => false,
      isEventStaffManager: async () => false,
      isMeetingHost: async () => false,
      isMeetingCreator: async () => false,
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

  // **인자를 그대로 넘긴다.** 주소만 넘기면 인자가 통째로 빠진다.
  restore = useServer({
    baseUrl: 'http://server',
    fetch: async (input, init) => app.request(String(input), init),
  })
}, 60_000)

afterAll(async () => {
  restore()
  await close()
})

describe('행사 문서 표가 저장소에서 온다(EVT-DOC-01)', () => {
  it('이 행사의 공용 문서만 국면 차례로 그린다', async () => {
    draw('EVT-DOC-01', { eventId: 'E-01' })
    await waitFor(() => expect(screen.getByText('한마당 운영 계획서')).toBeInTheDocument())
    const page = drawn()
    // 업무가 내놓은 문서도 회의에 붙은 자료도 행사의 공용 원본이 아니다.
    expect(page).not.toContain('한마당 현수막 시안.png')
    expect(page).not.toContain('한마당_지난회의요약.docx')
    // 남의 학생회 문서는 어느 자리에도 없다.
    expect(page).not.toContain('남의 행사 문서')
    // 개발용 응답의 표가 아니라는 증거.
    expect(page).not.toContain('행사 운영 계획서')
    expect(page).not.toContain('안전 관리 체크리스트')
  })

  // **화면이 숫자에 단위를 붙이지 않는다.** 타일의 값이 완성된 글로 온다.
  it('머리의 타일이 단위까지 붙은 값으로 그려진다', async () => {
    draw('EVT-DOC-01', { eventId: 'E-01' })
    await waitFor(() => expect(screen.getByText('행사 공용 문서')).toBeInTheDocument())
    expect(drawn()).toContain('계속 확인이 필요해요')

    const params = { eventId: 'E-01' }
    await loadSources([{ key: 'event.documentStats', params }])
    expect(readObjectSource('event.documentStats', params)).toEqual({
      total: '5개',
      totalNote: '행사 공용 문서',
      drafting: '2개',
      draftingNote: '계속 확인이 필요해요',
      reviewing: '1개',
      reviewingNote: '의견 확인이 필요해요',
    })
  })

  // **거르는 것도 세는 것도 서버가 한다.** 개수는 고른 상태와 무관하게 전체를 센다.
  it('거르개 옆의 개수가 저장소에서 온다', async () => {
    const params = { eventId: 'E-01' }
    await loadSources([{ key: 'event.documentStatusCounts', params }])
    expect(readObjectSource('event.documentStatusCounts', params)).toEqual({
      all: 5,
      drafting: 2,
      reviewing: 1,
      confirmed: 1,
      notStarted: 1,
    })
  })

  it('고른 상태로 서버가 거른다', async () => {
    const params = { eventId: 'E-01', status: 'reviewing' }
    await loadSources([{ key: 'event.documents', params }])
    expect(readListSource('event.documents', params).map((row) => row.title)).toEqual([
      '한마당 안전 점검표',
    ])
  })

  it('완성된 글과 색이 서버에서 온다', async () => {
    const params = { eventId: 'E-01', status: 'all' }
    await loadSources([{ key: 'event.documents', params }])
    const rows = readListSource('event.documents', params)
    expect(rows[1]).toMatchObject({
      id: 'DOC-02',
      category: '운영',
      status: '검토 중',
      statusTone: 'yellow',
      tone: 'amber',
      updatedNote: '07. 18 · 박해랑',
    })
    // 아직 시작하지 않은 문서는 손댄 때 대신 언제 쓸 것인지가 온다.
    expect(rows[3]).toMatchObject({ title: '한마당 결과 보고서', updatedNote: '행사 종료 후' })
  })
})

describe('회의 자료가 저장소에서 온다(OPS-MEET-07)', () => {
  // **OPS-MEET-07은 아직 못 연다** — 이 화면이 읽는 `meeting.minutes`와
  // `meeting.followUps`가 안 지어졌다. 자료 목록 자체는 이미 진짜라 출처로 잰다.
  //
  // 한동안 이 검사가 화면을 그려서 통과했는데, 그 둘을 개발용 응답이 채우고
  // 있었다 — 검사도 배포와 같은 거짓말을 하고 있었다(2026-09-05).
  it('OPS-MEET-07은 회의록이 아직이라 준비 중을 그린다', async () => {
    draw('OPS-MEET-07', { meetingId: 'MTG-01' })
    await waitFor(() =>
      expect(screen.getByText('이 화면은 아직 준비 중입니다.')).toBeInTheDocument(),
    )
  })

  it('이 회의에 붙은 자료가 저장소에서 온다', async () => {
    const params = { meetingId: 'MTG-01' }
    await loadSources([{ key: 'meeting.documents', params }])
    const names = readListSource('meeting.documents', params).map((row) => row.name)
    expect(names).toContain('한마당_지난회의요약.docx')
    expect(names).toContain('한마당_안전인력배치.xlsx')
    // 개발용 응답의 자료가 아니라는 증거이자, 남의 학생회 자료가 없다는 증거다.
    expect(names).not.toContain('체육대회_안전점검표.pdf')
    expect(names).not.toContain('남의 회의 자료.pdf')
  })

  // **안건의 사전 자료와 회의록의 관련 자료가 같은 물건이다.** 어느 안건의 것인지는
  // 조각이 알리고, 회의 전체에 붙은 것이면 그 조각이 오지 않는다.
  it('안건의 자료면 agendaId가 함께 온다', async () => {
    const params = { meetingId: 'MTG-01' }
    await loadSources([{ key: 'meeting.documents', params }])
    const rows = readListSource('meeting.documents', params)
    expect(rows[0]).toEqual({ documentId: 'DOC-08', name: '한마당_지난회의요약.docx' })
    expect(rows[1]).toMatchObject({ documentId: 'DOC-07', agendaId: 'AG-01' })
  })
})

describe('업무의 문서 둘이 저장소에서 온다(EVT-TASK-02)', () => {
  // **참고 문서는 업무의 것이 아니라 행사의 공용 원본이다** — EVT-DOC-01의 표에
  // 그려지는 그 줄이 여기에도 그려진다.
  it('행사의 공용 원본과 이 업무가 내놓은 것을 갈라 그린다', async () => {
    draw('EVT-TASK-02', { taskId: 'ET-01' })
    await waitFor(() => expect(screen.getByText('한마당 운영 계획서')).toBeInTheDocument())
    const page = drawn()
    // 이 업무가 내놓은 것.
    expect(page).toContain('한마당 현수막 시안.png')
    // 개발용 응답의 문서가 아니라는 증거.
    expect(page).not.toContain('2026 체육대회 홍보 가이드라인')
    expect(page).not.toContain('현수막 시안 v2.png')
    expect(page).not.toContain('남의 업무 문서')
  })

  it('참고 문서가 완성된 글과 색으로 온다', async () => {
    const params = { taskId: 'ET-01' }
    await loadSources([{ key: 'task.referenceDocuments', params }])
    expect(readListSource('task.referenceDocuments', params)[0]).toEqual({
      title: '한마당 운영 계획서',
      description: '운영 목표와 당일 진행 순서',
      lastModifiedNote: '최종 수정일 2026-07-12',
      status: '확정',
      statusTone: 'green',
    })
  })

  // 표가 든 것은 이름과 상태뿐이라, 파일인지 문서인지는 이름이 말한다.
  it('작업 문서의 갈래와 상태가 서버에서 온다', async () => {
    const params = { taskId: 'ET-01' }
    await loadSources([{ key: 'task.workDocuments', params }])
    expect(readListSource('task.workDocuments', params)).toEqual([
      {
        title: '한마당 현수막 시안.png',
        kind: '파일',
        status: '검토 중',
        statusTone: 'yellow',
        officialReflection: '미반영',
      },
      {
        title: '한마당 현수막 작업 노트',
        kind: '문서',
        status: '작성 중',
        statusTone: 'blue',
        officialReflection: '미반영',
      },
    ])
  })
})
