import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { createApp } from '../../../api/src/app.ts'
import { freshDb } from '../../../api/src/db/testing.ts'
import { inMemoryCounter } from '../../../api/src/public/rate-limit.ts'
import { inMemoryAttempts } from '../../../api/src/idempotency.ts'
import {
  attendanceQrs,
  departments,
  events,
  eventStaffDepartments,
  eventStaffMembers,
  meetingParticipants,
  meetings,
  members,
  organizations,
  surveyApplications,
  surveys,
  tasks,
  users,
} from '../../../api/src/db/schema.ts'
import { hashToken } from '../../../api/src/public/tokens.ts'
import { ScreenRouter } from '../screens/ScreenRouter'
import { readListSource, readObjectSource } from './catalog'
import { fetchOptions } from '../option-sources/catalog'
import { draftValueOf, payloadOf } from '../spec/draft-values'
import { runMutation } from '../spec/mutations'
import { evt02b } from '../spec/screens'
import { loadSources, useServer } from './server'

// **행사의 앞자락을 끝까지 뚫는다.**
//
// 서버는 이 여덟 자리를 이미 답하고 있었다. 그런데 화면은 개발용 응답을 그렸다 —
// 조직 보기에서 겪은 것과 같은 모양이고, 그때 배운 것이 이것이다: **자리를 만든
// 것과 그 자리가 쓰이는 것은 다른 일이다.** 그 사이가 비어 있으면 아무 검사도
// 안 터지고, 사람이 배포된 화면을 눌러 보고서야 안다.
//
// 여기서 재는 여덟:
//
// | 읽기 | 쓰기 |
// | --- | --- |
// | `event.list`(EVT-00A) | `event.create`(EVT-00B) |
// | `event.basics`(EVT-02) | `event.saveBasics`(EVT-02B) |
// | `event.basicsDraft`(EVT-02B) | `event.attendanceQr.regenerate`(EVT-04B) |
// | `event.attendanceQr`(EVT-04B) | `event.attendanceQr.deactivate`(EVT-04B) |
//
// **그리고 행사 공간의 갈피 일곱**(파일 끝). 앞자락이 목록과 기본정보였다면 여기는
// 한 행사를 열어 놓고 도는 자리다 — 운영 조직(EVT-01·EVT-03A) · 끝내는 두 모달
// (EVT-02C·EVT-02E) · 참여 설문(EVT-05B) · 관련 회의(EVT-MEET-01) · 일정
// (EVT-SCHED-01). 자리 열하나가 그 일곱을 세운다.
//
// **쓰기는 화면이 누르는 그 길로 보낸다**(`runMutation`). 서버를 직접 부르면 그
// 사이의 코드가 통째로 빠지고, 앞서 난 결함이 정확히 그 사이에 있었다.

const NOW = new Date('2026-08-15T10:00:00+09:00')
let made = 0

let app: ReturnType<typeof createApp>
let restore: () => void
let close: () => Promise<void>

/** 뿌려 둔 QR의 열쇠. 다시 만들면 이것이 죽어야 한다. */
const POSTER = 'AAAAAAAAAAAAAAAAAAAAAA'

beforeAll(async () => {
  const fresh = await freshDb()
  close = fresh.close

  await fresh.db.insert(organizations).values([
    { id: 'ORG-01', name: '제12대 학생회' },
    // **옆 학생회를 하나 더 둔다.** 울타리를 재려면 넘어갈 담이 있어야 한다.
    { id: 'ORG-02', name: '옆 학생회' },
  ])
  await fresh.db.insert(departments).values([
    { id: 'D-01', orgId: 'ORG-01', name: '학술체육부' },
    { id: 'D-02', orgId: 'ORG-01', name: '기획부' },
  ])
  await fresh.db.insert(users).values({ id: 'U-01', email: 'bada@example.ac.kr' })
  await fresh.db.insert(members).values([
    {
      id: 'M-01',
      orgId: 'ORG-01',
      name: '김바다',
      role: 'chair',
      major: '컴퓨터학부',
      grade: '3학년',
      departmentId: 'D-01',
      userId: 'U-01',
    },
    {
      id: 'M-02',
      orgId: 'ORG-01',
      name: '이윤슬',
      role: 'head',
      major: 'ICT융합학부',
      grade: '4학년',
      departmentId: 'D-02',
      isDepartmentLeader: true,
    },
  ])

  await fresh.db.insert(events).values([
    // 다 채워진 행사. 개발용 응답에 없는 이름이라 서버를 거친 증거가 된다.
    {
      id: 'E-01',
      orgId: 'ORG-01',
      title: '2026 소프트웨어융합대학 체육대회',
      status: 'inProgress',
      startAt: new Date('2026-08-20T10:00:00+09:00'),
      place: 'ERICA 체육관',
      // **참거짓 칸을 켜 둔다.** 서버는 참거짓을 주고 화면의 체크 상자는 글을
      // 다루므로 그 사이가 어긋날 수 있는 자리다 — 켜 두지 않으면 어긋나도 안 보인다.
      endUnset: true,
      hostDepartmentId: 'D-01',
      updatedAt: new Date('2026-08-15T09:30:00+09:00'),
    },
    // **아직 아무것도 안 채운 행사.** 무엇이 비었는지를 서버가 말해야 한다.
    {
      id: 'E-02',
      orgId: 'ORG-01',
      title: '2026 신입생 환영회',
      status: 'planning',
      updatedAt: new Date('2026-08-13T09:00:00+09:00'),
    },
    // **끝난 행사는 목록에 오지 않는다** — 머리의 별도 이동이 그것을 본다.
    {
      id: 'E-03',
      orgId: 'ORG-01',
      title: '2026 새내기 배움터',
      status: 'done',
      updatedAt: new Date('2026-08-01T09:00:00+09:00'),
    },
    // **행사 공간의 갈피 일곱이 보는 행사.** 앞의 것들과 갈라 둔다 — 아래의 쓰기
    // 검사가 E-01의 기본정보를 고치므로, 같은 행사를 보면 무엇을 재는지 흐려진다.
    {
      id: 'E-04',
      orgId: 'ORG-01',
      title: '2026 가을 한마당',
      status: 'inProgress',
      startAt: new Date('2026-09-12T13:00:00+09:00'),
      endAt: new Date('2026-09-12T17:00:00+09:00'),
      place: '대학극장',
      hostDepartmentId: 'D-02',
      hostMemberId: 'M-02',
      updatedAt: NOW,
    },
    // 옆 학생회의 행사. 이 목록에 나오면 안 된다.
    { id: 'E-99', orgId: 'ORG-02', title: '남의 행사', updatedAt: NOW },
  ])

  // 행사 운영 조직. **학생회의 기본 조직과 다른 물건이다.**
  await fresh.db.insert(eventStaffDepartments).values({
    id: 'ED-01',
    orgId: 'ORG-01',
    eventId: 'E-04',
    name: '운영팀',
  })
  await fresh.db.insert(eventStaffMembers).values([
    { id: 'ES-01', orgId: 'ORG-01', eventId: 'E-04', memberId: 'M-02', isEventLeader: true },
    { id: 'ES-02', orgId: 'ORG-01', eventId: 'E-04', memberId: 'M-01', staffDepartmentId: 'ED-01' },
  ])

  // 참여 설문과 낸 신청. 여파를 세는 자리가 이 둘을 읽는다.
  await fresh.db.insert(surveys).values({
    id: 'S-01',
    orgId: 'ORG-01',
    eventId: 'E-04',
    linkToken: 'SURVEY-TOKEN',
    active: true,
  })
  await fresh.db.insert(surveyApplications).values(
    ['SA-01', 'SA-02'].map((id, at) => ({
      id,
      surveyId: 'S-01',
      name: `신청자${at}`,
      studentNumber: `20260${at}`,
      receiptHash: `HASH-${id}`,
      receiptExpiresAt: NOW,
      privacyConsentAt: NOW,
    })),
  )

  // 행사에 걸린 회의 하나.
  await fresh.db.insert(meetings).values({
    id: 'MTG-01',
    orgId: 'ORG-01',
    eventId: 'E-04',
    kind: 'event',
    title: '한마당 운영 점검 회의',
    purpose: '세부 안건 확인',
    status: 'inProgress',
    scheduledAt: new Date('2026-07-18T10:00:00+09:00'),
    place: '제1회의실',
    creatorMemberId: 'M-02',
  })
  await fresh.db.insert(meetingParticipants).values([
    { id: 'MP-01', orgId: 'ORG-01', meetingId: 'MTG-01', memberId: 'M-01' },
    { id: 'MP-02', orgId: 'ORG-01', meetingId: 'MTG-01', memberId: 'M-02' },
  ])

  // 업무. 완료 처리 확인이 남은 것을 세고, 일정이 그 마감을 줄로 만든다.
  await fresh.db.insert(tasks).values([
    {
      id: 'T-11',
      orgId: 'ORG-01',
      eventId: 'E-04',
      title: '참가자 모집 공지 작성',
      status: 'planned',
      dueDate: new Date('2026-08-28T18:00:00+09:00'),
      assigneeMemberId: 'M-02',
    },
    {
      id: 'T-12',
      orgId: 'ORG-01',
      eventId: 'E-04',
      title: '운영 계획 확정',
      status: 'done',
      dueDate: new Date('2026-07-10T18:00:00+09:00'),
      assigneeMemberId: 'M-01',
    },
  ])

  // **표에는 해시만 있다.** 원문을 담으면 저장소가 새는 날 QR도 함께 샌다.
  await fresh.db.insert(attendanceQrs).values({
    id: 'QR-01',
    orgId: 'ORG-01',
    eventId: 'E-01',
    tokenHash: hashToken(POSTER),
    active: true,
    opensAt: new Date('2026-08-20T09:00:00+09:00'),
    closesAt: new Date('2026-08-20T18:00:00+09:00'),
  })

  app = createApp({
    audit: { async write() {} },
    db: fresh.db as never,
    who: async () => ({
      userId: 'U-01',
      membership: {
        orgId: 'ORG-01',
        memberId: 'M-01',
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
    },
    signIn: {
      open: () => ({ google: true, kakao: false }),
      start: async (provider: string) => ({ url: `https://example.test/${provider}` }),
    },
    attempts: inMemoryAttempts(),
    counter: inMemoryCounter(),
    invite: { linkBase: 'https://vada.app/join', now: () => NOW, newCode: () => 'CODE' },
    // **부를 때마다 다른 것을 준다.** 하나로 고정하면 둘째가 같은 열쇠로 들어가
    // 충돌한다 — 이 저장소에서 두 번 겪은 일이다.
    newId: () => `X-${(made += 1)}`,
  })

  // **인자를 그대로 넘긴다.** 주소만 넘기면 쓰기가 전부 GET이 되어 '그 자리는
  // 명세에 없다'로 막힌다 — 검사 쪽 그물이 성기면 진짜 결함이 안 보인다.
  restore = useServer({
    baseUrl: 'http://server',
    fetch: async (input, init) => app.request(String(input), init),
  })
}, 60_000)

afterAll(async () => {
  restore()
  await close()
})

describe('행사 목록이 저장소에서 온다', () => {
  it('EVT-00A가 이 학생회의 행사를 그린다', async () => {
    render(
      <ScreenRouter screenId="EVT-00A" scopes={{}} onChangeScope={() => {}} onNavigate={() => {}} />,
    )
    await waitFor(() =>
      expect(screen.getByText('2026 소프트웨어융합대학 체육대회')).toBeInTheDocument(),
    )
    const drawn = document.body.textContent ?? ''
    // **끝난 행사도 남의 행사도 없다.** 둘 중 하나라도 보이면 개발용 응답이거나
    // 울타리가 없는 것이다.
    expect(drawn).not.toContain('2026 새내기 배움터')
    expect(drawn).not.toContain('남의 행사')
  })

  // **무엇이 비었는지는 서버가 말한다.** 화면이 빈 칸을 세면 화면마다 답이 갈린다.
  it('아직 안 채운 것을 완성된 문구로 준다', async () => {
    await loadSources([{ key: 'event.list', params: { query: '', status: '' } }])
    const rows = readListSource('event.list', { query: '', status: '' })
    const empty = rows.find((row) => row.title === '2026 신입생 환영회')!
    expect((empty.highlights as Array<{ label: string }>).map((one) => one.label)).toEqual([
      '일시가 아직 없습니다',
      '장소가 아직 없습니다',
      '담당이 아직 없습니다',
    ])
    // 다 채운 행사에는 아무것도 안 뜬다. 맡은 곳도 이어 붙인 글로 온다.
    const full = rows.find((row) => row.title === '2026 소프트웨어융합대학 체육대회')!
    expect(full.highlights).toEqual([])
    expect(full.host).toBe('학술체육부')
  })

  // 거르는 것도 서버가 한다. 개발용 응답의 행사 이름과 겹치지 않는 말로 찾는다.
  it('행사명으로 거르는 것을 서버가 한다', async () => {
    await loadSources([{ key: 'event.list', params: { query: '환영회', status: '' } }])
    expect(readListSource('event.list', { query: '환영회', status: '' }).map((row) => row.title)).toEqual([
      '2026 신입생 환영회',
    ])
  })
})

describe('행사를 만든다', () => {
  // **화면이 누르는 그 길로 만든다.** 서버를 직접 부르면 그 사이가 빠진다.
  it('EVT-00B가 누르는 길로 행사가 생긴다', async () => {
    const answer = await runMutation('event.create', { title: '2026 가을 축제' }, {})
    // 새 행사의 id는 서버가 만든다 — 화면이 지어낼 수 없다.
    expect(typeof answer.id).toBe('string')

    await loadSources([{ key: 'event.list', params: { query: '가을 축제', status: '' } }])
    expect(
      readListSource('event.list', { query: '가을 축제', status: '' }).map((row) => row.title),
    ).toEqual(['2026 가을 축제'])
  })
})

describe('기본정보를 읽고 고친다', () => {
  // **EVT-02B는 아직 못 연다 — 뒤에 남는 화면이 안 지어졌다.**
  //
  // 이 패널 자신의 자리는 다 붙었다(`event.basicsDraft`·`event.saveBasics`). 그런데
  // 명세가 이것을 EVT-02 위에 겹쳐 뜨는 것으로 적었고(`overlay.screenId`), 그 뒤
  // 화면이 읽는 여섯이 아직 없다. 사람도 EVT-02를 지나지 않고는 여기 못 온다.
  //
  // **한동안 이 검사가 통과했다.** 개발용 응답이 그 여섯을 채워 주고 있었기 때문이다 —
  // 검사도 배포와 같은 거짓말을 하고 있었다(2026-09-05).
  it('EVT-02B는 뒤 화면이 아직이라 준비 중을 그린다', async () => {
    render(
      <ScreenRouter
        screenId="EVT-02B"
        screenParams={{ eventId: 'E-01' }}
        scopes={{}}
        onChangeScope={() => {}}
        onNavigate={() => {}}
      />,
    )
    await waitFor(() =>
      expect(screen.getByText('이 화면은 아직 준비 중입니다.')).toBeInTheDocument(),
    )
  })

  // **켜져 있는 것이 켜져 보여야 한다.**
  //
  // 아무도 옮겨 주지 않으면 서버의 `true`가 초안에서 `'true'`가 되고 체크 상자는
  // `'y'`를 보므로 **꺼져 보인다** — 그리고 그대로 저장하면 켜져 있던 것이 꺼진다.
  // 회의 쪽에서 같은 자리가 드러났고(비공개 회의가 공개가 된다) 이 화면이 이미
  // 그러고 있었다(2026-09-04).
  //
  // 화면을 그려서 재던 자리인데 위의 까닭으로 못 그린다. 그래서 **화면이 쓰는 그
  // 두 함수**를 진짜 서버의 답에 대고 잰다 — 읽을 때 옮기는 것과 보낼 때 되돌리는 것.
  it('서버의 참거짓이 체크 상자가 읽는 꼴로 오간다', async () => {
    await loadSources([{ key: 'event.basicsDraft', params: { eventId: 'E-01' } }])
    const fromDb = readObjectSource('event.basicsDraft', { eventId: 'E-01' })
    // 서버는 참거짓을 준다.
    expect(fromDb.endUnset).toBe(true)
    // 초안은 체크 상자가 아는 꼴로 담는다. `String(true)`였다면 'true'다.
    expect(draftValueOf(fromDb.endUnset)).toBe('y')

    // 보낼 때 되돌린다. 'y'를 그대로 보내면 서버가 422로 막는다.
    const body = payloadOf(evt02b, { title: '체크 확인용', endUnset: 'y', placeUnset: '' })
    expect(body).toMatchObject({ endUnset: true, placeUnset: false })
    await runMutation('event.saveBasics', body, { eventId: 'E-01' })

    await loadSources([{ key: 'event.basicsDraft', params: { eventId: 'E-01' } }])
    expect(readObjectSource('event.basicsDraft', { eventId: 'E-01' }).endUnset).toBe(true)
  })

  // **화면이 누르는 그 길로 저장한다.**
  it('저장이 저장소에 남는다', async () => {
    await runMutation(
      'event.saveBasics',
      { title: '2026 소프트웨어융합대학 한마당', place: '학생회관 대강당' },
      { eventId: 'E-01' },
    )
    await loadSources([{ key: 'event.basics', params: { eventId: 'E-01' } }])
    expect(readObjectSource('event.basics', { eventId: 'E-01' }).title).toBe(
      '2026 소프트웨어융합대학 한마당',
    )
  })
})

describe('참석 확인 QR을 만들고 끈다', () => {
  it('EVT-04B가 저장소의 QR 상태를 그린다', async () => {
    await loadSources([{ key: 'event.attendanceQr', params: { eventId: 'E-01' } }])
    // 8월 15일에는 아직 열리기 전이다 — 상태는 시각이 정한다.
    expect(readObjectSource('event.attendanceQr', { eventId: 'E-01' }).statusLabel).toBe('시작 전')
  })

  // **되돌릴 수 없다.** 뿌린 포스터의 QR이 전부 죽는다 — 그것이 이 자리의 값이므로
  // 표의 해시가 아니라 **밖에서 오는 사람의 문**으로 잰다. 열쇠만 바꾸고 문이 그대로
  // 열려 있으면 바뀐 것이 아니다.
  it('다시 만들면 뿌려 둔 QR이 죽는다', async () => {
    const opens = async () =>
      (await app.request(`/api/public/attendance/check-in-form?checkInToken=${POSTER}`)).status

    expect(await opens()).toBe(200)
    await runMutation('event.attendanceQr.regenerate', {}, { eventId: 'E-01' })
    expect(await opens()).toBe(404)
  })

  it('끄면 상태가 저장소에서 바뀐다', async () => {
    await runMutation('event.attendanceQr.deactivate', {}, { eventId: 'E-01' })
    await loadSources([{ key: 'event.attendanceQr', params: { eventId: 'E-01' } }])
    expect(readObjectSource('event.attendanceQr', { eventId: 'E-01' }).statusLabel).toBe('비활성화됨')
  })
})

// **행사 공간의 갈피 일곱.** 여기부터가 이번에 붙인 자리다.
//
// 화면마다 `<ScreenRouter>`를 그린다 — 그릇에 손으로 값을 먹이면 거르개가 달린
// 화면이 서버에 붙는 순간 터지는 것을 못 본다(ORG-07A가 그렇게 붙어 있었다).
//
// 재는 것은 **그 값이 서버에서 왔다는 것**이다. 그래서 개발용 응답에 없는 말로
// 고른다(행사 이름·부서 이름·회의 이름). 그리고 어느 화면도 '준비 중'이 아니어야
// 한다 — 자리 하나가 안 붙으면 바깥 그물이 화면을 통째로 가리기 때문이다.

const NOT_BUILT = '이 화면은 아직 준비 중입니다.'

function draw(screenId: string) {
  render(
    <ScreenRouter
      screenId={screenId}
      screenParams={{ eventId: 'E-04' }}
      scopes={{}}
      onChangeScope={() => {}}
      onNavigate={() => {}}
    />,
  )
}

describe('행사 운영 조직이 저장소에서 온다', () => {
  // **기본 조직에서 온다.** 아직 만들어지지 않은 것을 미리 보는 자리다.
  it('EVT-01이 학생회 부서를 미리보기로 그린다', async () => {
    draw('EVT-01')
    await waitFor(() => expect(screen.getByText('기획부')).toBeInTheDocument())
    expect(screen.getByText('학술체육부')).toBeInTheDocument()
    // **행사 조직이 섞여 오면 안 된다** — 미리보기는 아직 만들어지지 않은 것이라
    // 기본 조직에서 오고, '운영팀'은 이미 만들어진 행사 조직의 부서다.
    expect(document.body.textContent).not.toContain('운영팀')
    expect(document.body.textContent).not.toContain(NOT_BUILT)
  })

  // **고르는 목록도 같은 서버에서 온다.** 표는 진짜인데 고를 것이 가짜면 사람은
  // 없는 사람을 고르고 저장할 때 터진다. 이 칸은 메뉴를 열어야 부르므로
  // (`loadOn: open`) 화면을 그리는 것으로는 지나지 않는다 — 그 길을 따로 지난다.
  it('책임자 후보가 저장소에서 온다', async () => {
    expect(await fetchOptions('event.staffLeaderCandidates', { eventId: 'E-04' })).toEqual([
      { value: 'M-01', label: '김바다', description: '학술체육부' },
      { value: 'M-02', label: '이윤슬', description: '기획부' },
    ])
  })

  // **행사 조직은 기본 조직과 다른 물건이다.** 여기 그려지는 것은 '운영팀'이지
  // '기획부'가 아니다 — 섞이면 두 표를 나눈 뜻이 없다.
  it('EVT-03A가 행사 조직을 그린다', async () => {
    draw('EVT-03A')
    await waitFor(() => expect(screen.getByText('운영팀')).toBeInTheDocument())
    expect(screen.getByText('책임자')).toBeInTheDocument()
    expect(screen.getByText('부원 1명')).toBeInTheDocument()
    // 나무에 그려지는 사람은 행사 조직에 든 둘뿐이다 — 학생회의 부서 이름이
    // 나무에 나타나면 두 표를 나눈 뜻이 없다(머리의 '담당 기획부'는 행사의 값이다).
    expect(screen.queryByText('학술체육부')).not.toBeInTheDocument()
    expect(document.body.textContent).not.toContain(NOT_BUILT)
  })
})

describe('행사를 끝내는 두 모달이 권한 행렬에서 온다', () => {
  // **역할 이름을 화면이 들지 않는다.** 이 글은 permissions.json에서 만들어진다.
  it('EVT-02C가 누가 종료할 수 있는지를 그린다', async () => {
    draw('EVT-02C')
    await waitFor(() =>
      expect(screen.getByText('이 행사를 종료할 권한이 없습니다')).toBeInTheDocument(),
    )
    expect(
      screen.getByText('행사 종료는 회장단 또는 부서장·부원(행사 조직만)만 할 수 있습니다.'),
    ).toBeInTheDocument()
    expect(document.body.textContent).not.toContain(NOT_BUILT)
  })

  // **막지 않는다** — 남은 것이 있어도 알려 줄 뿐이다.
  it('EVT-02E가 남은 업무를 세어 알린다', async () => {
    draw('EVT-02E')
    await waitFor(() => expect(screen.getByText('미완료 업무 1건')).toBeInTheDocument())
    expect(screen.getByText('행사 완료 처리는 회장단만 할 수 있습니다.')).toBeInTheDocument()
    expect(document.body.textContent).not.toContain(NOT_BUILT)
  })
})

describe('참여 설문과 그 여파가 저장소에서 온다', () => {
  it('EVT-05B가 설문 상태와 응답자 수를 그린다', async () => {
    draw('EVT-05B')
    await waitFor(() =>
      expect(screen.getByText('새 설문으로 교체하시겠어요?')).toBeInTheDocument(),
    )
    expect(screen.getByText('활성')).toBeInTheDocument()
    expect(screen.getByText('2명')).toBeInTheDocument()
    expect(screen.getByText('2명 (재응답 필요)')).toBeInTheDocument()
    expect(document.body.textContent).not.toContain(NOT_BUILT)
  })
})

describe('행사에 걸린 회의와 일정이 저장소에서 온다', () => {
  // 세는 말이 단계마다 다르다 — 화면이 유도할 수 없어 서버가 완성한 문구로 온다.
  it('EVT-MEET-01이 건수와 회의 줄을 그린다', async () => {
    draw('EVT-MEET-01')
    await waitFor(() => expect(screen.getByText('한마당 운영 점검 회의')).toBeInTheDocument())
    expect(screen.getByText('진행 중 1건 · 예정 0건 · 정리 중 0건 · 완료 0건')).toBeInTheDocument()
    expect(screen.getByText('2026. 07. 18 (토) 10:00')).toBeInTheDocument()
    expect(screen.getByText('참가 2명')).toBeInTheDocument()
    expect(document.body.textContent).not.toContain(NOT_BUILT)
  })

  // **원본이 아니라 비친 것이다.** 줄마다 어디가 원본인지를 서버가 말한다.
  it('EVT-SCHED-01이 세 원본을 한 줄씩 그린다', async () => {
    draw('EVT-SCHED-01')
    await waitFor(() => expect(screen.getByText('참가자 모집 공지 작성')).toBeInTheDocument())
    const drawn = document.body.textContent ?? ''
    expect(drawn).toContain('담당 · 이윤슬')
    for (const origin of ['원본 · 행사 업무', '원본 · 관련 회의', '원본 · 행사 기본정보']) {
      expect(drawn).toContain(origin)
    }
    expect(drawn).not.toContain(NOT_BUILT)
  })
})
