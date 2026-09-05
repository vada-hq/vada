import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { createApp } from '../../../api/src/app.ts'
import { freshDb } from '../../../api/src/db/testing.ts'
import { inMemoryCounter } from '../../../api/src/public/rate-limit.ts'
import { inMemoryAttempts } from '../../../api/src/idempotency.ts'
import { meetingLookups } from '../../../api/src/meetings/lookups.ts'
import {
  departments,
  events,
  meetingAgendas,
  meetingParticipants,
  meetings,
  members,
  organizations,
  tasks,
  users,
} from '../../../api/src/db/schema.ts'
import { ScreenRouter } from '../screens/ScreenRouter'
import { readListSource, readObjectSource } from './catalog'
import { fetchOptions } from '../option-sources/catalog'
import { runMutation } from '../spec/mutations'
import { forgetSources, loadSources, useServer } from './server'

// **회의의 앞자락을 끝까지 뚫는다.**
//
// 개발용 응답이 오랫동안 회의 일곱 개와 '일반 참가자 화면'을 그렸다. 그 값들은
// 명세가 든 예시라 화면은 늘 예쁘게 그려졌고, **서버가 정말 그 모양을 낼 수 있는지는
// 아무도 재 보지 않았다.** 특히 두 자리가 그랬다: 묶음을 짓는 일과 '누가 보느냐'로
// 값이 갈리는 일 — 둘 다 가짜에서는 그냥 적어 두면 되는 것이다.
//
// 여기서 재는 열넷:
//
// | 읽기 | 쓰기 |
// | --- | --- |
// | `meeting.groups`(OPS-MEET-01A) | `meeting.create`(OPS-MEET-02) |
// | `meeting.attention`(OPS-MEET-01A) | `meeting.saveDraft`(OPS-MEET-02) |
// | `meeting.draft`(OPS-MEET-02) | `meeting.start`(D01) |
// | `meeting.memberCandidates`(OPS-MEET-02) | `meeting.end`(D02) |
// | `event.linkable`(OPS-MEET-02의 고르는 목록) | `meeting.completeAgenda`(05B) |
// | `meeting.detail`(03A~03C · 05A) | `meeting.startNextAgenda`(05B) |
// | `meeting.agendas`(03A · 05A) | |
// | `meeting.participants`(03A · 05A) | |
// | `meeting.startConfirm`(D01) · `meeting.endConfirm`(D02) | |
//
// 그리고 **뒷자락**(2026-09-05): 회의록 정리(06B)의 읽기 둘(`meeting.minutesProgress` ·
// `meeting.agendaPicker`)과 쓰기 넷(`saveMinutes` · `generateSummary` · `completeMinutes` ·
// `acknowledgeSummary`), 회의 관리의 쓰기 셋(`cancel` · `grantHostRole` · `revokeHostRole`).
//
// **쓰기는 화면이 누르는 그 길로 보낸다**(`runMutation`). 그리고 화면이 실제로
// 보내는 꼴로 보낸다 — 초안은 배열이 아니라 줄 이름을 열쇠에 박은 평평한 맵이다
// (`spec/compute.ts`의 itemKey). 계약이 적은 배열 꼴로만 재면 화면과 서버 사이가
// 그대로 빈다.

const NOW = new Date('2026-07-20T10:00:00+09:00')
let made = 0

let app: ReturnType<typeof createApp>
let restore: () => void
let close: () => Promise<void>
/** 검사 도중 사실을 하나 더 심을 때 쓴다(후속 업무 하나). 쓰기는 `runMutation`으로 간다. */
let db: Awaited<ReturnType<typeof freshDb>>['db']

/** 화면이 초안에 담는 꼴 그대로. 되풀이되는 묶음은 줄 이름을 이어 담는다. */
const DRAFT = {
  meetingType: 'event',
  linkedEventId: 'E-01',
  title: '체육대회 최종 점검 회의',
  hostName: '김바다',
  departmentId: 'D-01',
  statusLabel: '예정',
  purpose: '행사 전날 준비 상태를 함께 확인합니다.',
  date: '2026-08-19',
  startTime: '18:00',
  endTime: '19:30',
  mode: '대면',
  place: '학생회실 (A204)',
  onlineLink: '',
  isPrivate: '',
  memberQuery: '',
  participants: 'r0',
  'participants.r0.memberId': 'M-02',
  'participants.r0.name': '박해랑',
  'participants.r0.departmentNote': '운영부',
  'participants.r0.canRemove': 'true',
  agendaItems: 'r0',
  'agendaItems.r0.agendaTitle': '준비물 최종 확인',
  'agendaItems.r0.agendaNote': '',
  'agendaItems.r0.attachmentName': '',
  'agendaItems.r0.duration': '',
}

const groupsNow = async () => {
  await loadSources([{ key: 'meeting.groups', params: { query: '' } }])
  return readListSource('meeting.groups', { query: '' })
}

beforeAll(async () => {
  const fresh = await freshDb()
  close = fresh.close
  db = fresh.db

  await fresh.db.insert(organizations).values([
    { id: 'ORG-01', name: '제12대 학생회' },
    // **옆 학생회를 하나 더 둔다.** 울타리를 재려면 넘어갈 담이 있어야 한다.
    { id: 'ORG-02', name: '옆 학생회' },
  ])
  await fresh.db.insert(departments).values([
    { id: 'D-01', orgId: 'ORG-01', name: '학술체육부' },
    { id: 'D-02', orgId: 'ORG-01', name: '운영부' },
  ])
  await fresh.db.insert(users).values({ id: 'U-01', email: 'bada@example.ac.kr' })
  await fresh.db.insert(members).values([
    {
      id: 'M-01',
      orgId: 'ORG-01',
      name: '김바다',
      role: 'chair',
      departmentId: 'D-01',
      userId: 'U-01',
    },
    { id: 'M-02', orgId: 'ORG-01', name: '박해랑', role: 'member', departmentId: 'D-02' },
    { id: 'M-99', orgId: 'ORG-02', name: '남의사람', role: 'chair' },
  ])
  await fresh.db.insert(events).values([
    { id: 'E-01', orgId: 'ORG-01', title: '2026 소프트웨어융합대학 체육대회' },
    { id: 'E-99', orgId: 'ORG-02', title: '남의 행사' },
  ])

  await fresh.db.insert(meetings).values([
    // 개발용 응답에 없는 이름들이다 — 서버를 거친 증거가 된다.
    {
      id: 'MTG-A',
      orgId: 'ORG-01',
      title: '9월 운영 점검회의',
      status: 'scheduled',
      scheduledAt: new Date('2026-09-02T18:00:00+09:00'),
      place: '학생회실 (A204)',
      creatorMemberId: 'M-01',
      departmentId: 'D-01',
      purpose: '9월 운영 계획을 함께 확인합니다.',
    },
    {
      id: 'MTG-B',
      orgId: 'ORG-01',
      eventId: 'E-01',
      kind: 'event',
      title: '체육대회 종목 배정 회의',
      status: 'inProgress',
      minutesStatus: 'drafting',
      scheduledAt: new Date('2026-08-18T10:00:00+09:00'),
      creatorMemberId: 'M-01',
    },
    // 진행 중인 회의(OPS-MEET-05A). 시작한 지 27분이 지났다.
    {
      id: 'MTG-C',
      orgId: 'ORG-01',
      title: '9월 안전 점검 진행 회의',
      status: 'inProgress',
      minutesStatus: 'drafting',
      purpose: '점검 결과를 함께 확인합니다.',
      scheduledAt: new Date('2026-07-20T09:30:00+09:00'),
      startedAt: new Date('2026-07-20T09:33:00+09:00'),
      place: '학생회관 3층 회의실',
      creatorMemberId: 'M-01',
    },
    // 시작을 기다리는 회의(OPS-MEET-D01). 예정까지 7일 남았다.
    {
      id: 'MTG-D',
      orgId: 'ORG-01',
      title: '9월 예산 심의 준비회의',
      status: 'scheduled',
      scheduledAt: new Date('2026-07-27T15:00:00+09:00'),
      creatorMemberId: 'M-01',
    },
    // 안건을 넘기고 끝낼 회의(OPS-MEET-05B · D02).
    {
      id: 'MTG-E',
      orgId: 'ORG-01',
      title: '9월 회계 마감 회의',
      status: 'inProgress',
      startedAt: new Date('2026-07-20T09:00:00+09:00'),
      creatorMemberId: 'M-01',
    },
    // 회의록을 정리하는 중인 회의(OPS-MEET-06A · 06B). 요약이 초안으로 들어 있다.
    {
      id: 'MTG-F',
      orgId: 'ORG-01',
      title: '9월 신입생 환영 기획회의',
      status: 'wrapUp',
      minutesStatus: 'drafting',
      scheduledAt: new Date('2026-07-15T16:00:00+09:00'),
      startedAt: new Date('2026-07-15T16:00:00+09:00'),
      endedAt: new Date('2026-07-15T17:18:00+09:00'),
      creatorMemberId: 'M-01',
      minutesSummary: '신입생 환영 행사의 프로그램 순서와 부서별 준비 범위를 정했습니다.',
      minutesSummaryDraftedAt: new Date('2026-07-15T17:20:00+09:00'),
    },
    // 정리가 끝난 회의(OPS-MEET-07 · 08). 요약이 확정됐다.
    {
      id: 'MTG-G',
      orgId: 'ORG-01',
      title: '9월 안전 관리 최종 회의',
      status: 'done',
      minutesStatus: 'done',
      scheduledAt: new Date('2026-07-14T15:00:00+09:00'),
      startedAt: new Date('2026-07-14T15:00:00+09:00'),
      endedAt: new Date('2026-07-14T16:12:00+09:00'),
      creatorMemberId: 'M-01',
      minutesSummary: '위험 구간 조치 방안과 비상 연락 순서를 확정했습니다.',
    },
    // 옆 학생회의 회의. 이 목록에 나오면 안 된다.
    { id: 'MTG-99', orgId: 'ORG-02', title: '남의 회의', creatorMemberId: 'M-99' },
  ])
  await fresh.db.insert(meetingParticipants).values([
    { id: 'MP-01', orgId: 'ORG-01', meetingId: 'MTG-A', memberId: 'M-01', isHost: true },
    { id: 'MP-02', orgId: 'ORG-01', meetingId: 'MTG-A', memberId: 'M-02' },
    // 진행 중인 회의에는 둘 다 들어와 있다 — '2명 참가 중'이 여기서 나온다.
    { id: 'MP-03', orgId: 'ORG-01', meetingId: 'MTG-C', memberId: 'M-01', attendance: 'present' },
    { id: 'MP-04', orgId: 'ORG-01', meetingId: 'MTG-C', memberId: 'M-02', attendance: 'present' },
    { id: 'MP-05', orgId: 'ORG-01', meetingId: 'MTG-E', memberId: 'M-01', attendance: 'present' },
    { id: 'MP-06', orgId: 'ORG-01', meetingId: 'MTG-E', memberId: 'M-02' },
    { id: 'MP-07', orgId: 'ORG-01', meetingId: 'MTG-F', memberId: 'M-01', attendance: 'present' },
    { id: 'MP-08', orgId: 'ORG-01', meetingId: 'MTG-F', memberId: 'M-02', attendance: 'absent' },
    // 요약을 이미 확인한 사람. 확인 여부는 회의의 상태가 아니라 **이 사람의 상태**다.
    {
      id: 'MP-09',
      orgId: 'ORG-01',
      meetingId: 'MTG-G',
      memberId: 'M-01',
      attendance: 'present',
      acknowledgedAt: new Date('2026-07-14T17:00:00+09:00'),
    },
    { id: 'MP-10', orgId: 'ORG-01', meetingId: 'MTG-G', memberId: 'M-02', attendance: 'absent' },
  ])
  await fresh.db.insert(meetingAgendas).values([
    { id: 'AG-A-1', orgId: 'ORG-01', meetingId: 'MTG-A', sortOrder: 0, title: '9월 예산 집행 계획' },
    // 진행 중인 회의의 안건 둘: 하나는 마쳤고 하나는 지금 하고 있다.
    {
      id: 'AG-C-1',
      orgId: 'ORG-01',
      meetingId: 'MTG-C',
      sortOrder: 0,
      title: '점검 결과 공유',
      plannedMinutes: 20,
      status: 'done',
      decisionText: '케이블 커버를 설치합니다.',
    },
    {
      id: 'AG-C-2',
      orgId: 'ORG-01',
      meetingId: 'MTG-C',
      sortOrder: 1,
      title: '비상 연락망 확정',
      plannedMinutes: 15,
      status: 'current',
    },
    { id: 'AG-E-1', orgId: 'ORG-01', meetingId: 'MTG-E', sortOrder: 0, title: '집행 잔액 확인', status: 'current' },
    { id: 'AG-E-2', orgId: 'ORG-01', meetingId: 'MTG-E', sortOrder: 1, title: '다음 달 예산 배정' },
    // 정리 중인 회의의 안건 셋: 둘은 정리됐고 하나는 아직이다 — '2 / 3 정리'가 여기서 나온다.
    {
      id: 'AG-F-1',
      orgId: 'ORG-01',
      meetingId: 'MTG-F',
      sortOrder: 0,
      title: '행사 프로그램 구성',
      status: 'done',
      discussionText: '환영 인사와 학과 소개를 먼저 두기로 했습니다.',
      decisionText: '프로그램은 환영 인사 이후 학과 소개 순으로 진행합니다.',
    },
    {
      id: 'AG-F-2',
      orgId: 'ORG-01',
      meetingId: 'MTG-F',
      sortOrder: 1,
      title: '장소와 참가자 동선',
      status: 'done',
      decisionText: '입장과 퇴장 동선을 분리합니다.',
    },
    { id: 'AG-F-3', orgId: 'ORG-01', meetingId: 'MTG-F', sortOrder: 2, title: '부서별 준비 범위' },
    {
      id: 'AG-G-1',
      orgId: 'ORG-01',
      meetingId: 'MTG-G',
      sortOrder: 0,
      title: '행사장 안전 점검 결과',
      status: 'done',
      decisionText: '본부석 뒤편에 케이블 커버를 설치합니다.',
    },
  ])
  // **회의가 만든 업무도 업무 표에 산다.** `from_meeting_id`가 그 이음이다.
  await fresh.db.insert(tasks).values([
    {
      id: 'TSK-C1',
      orgId: 'ORG-01',
      fromMeetingId: 'MTG-C',
      title: '점검 결과 공유 자료 정리',
      status: 'planned',
      assigneeMemberId: 'M-02',
      dueDate: new Date('2026-07-23T18:00:00+09:00'),
    },
    {
      id: 'TSK-G1',
      orgId: 'ORG-01',
      fromMeetingId: 'MTG-G',
      title: '비상 연락망 최종본 배포',
      status: 'planned',
      assigneeMemberId: 'M-01',
      dueDate: new Date('2026-07-24T18:00:00+09:00'),
    },
    // 이미 끝난 업무. **'내 것'에는 오지 않는다** — 08이 '미완료'라 적었다.
    {
      id: 'TSK-G2',
      orgId: 'ORG-01',
      fromMeetingId: 'MTG-G',
      title: '케이블 커버 구매',
      status: 'done',
      assigneeMemberId: 'M-01',
    },
  ])

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
      // **회의 권한은 표가 답한다.** '늘 거짓'으로 두면 시작·종료가 아예 안 열리고,
      // '늘 참'으로 두면 진행 권한이 없는 사람이 보는 화면을 아무도 못 본다.
      ...meetingLookups(fresh.db as never),
    },
    signIn: {
      open: () => ({ google: true, kakao: false }),
      start: async (provider: string) => ({ url: `https://example.test/${provider}` }),
    },
    attempts: inMemoryAttempts(),
    counter: inMemoryCounter(),
    invite: { linkBase: 'https://vada.app/join', now: () => NOW, newCode: () => 'CODE' },
    // **부를 때마다 다른 것을 준다.** 하나로 고정하면 둘째 안건이 같은 열쇠로 들어간다.
    newId: () => `X-${(made += 1)}`,
  })

  // **인자를 그대로 넘긴다.** 주소만 넘기면 쓰기가 전부 GET이 되어 '그 자리는
  // 명세에 없다'로 막힌다.
  restore = useServer({
    baseUrl: 'http://server',
    fetch: async (input, init) => app.request(String(input), init),
  })
}, 60_000)

afterAll(async () => {
  restore()
  await close()
})

describe('회의 목록이 저장소에서 온다', () => {
  it('OPS-MEET-01A가 이 학생회의 회의를 묶어서 그린다', async () => {
    render(
      <ScreenRouter
        screenId="OPS-MEET-01A"
        scopes={{}}
        onChangeScope={() => {}}
        onNavigate={() => {}}
      />,
    )
    await waitFor(() => expect(screen.getByText('9월 운영 점검회의')).toBeInTheDocument())
    const drawn = document.body.textContent ?? ''
    // **묶음 하나가 행사 하나다.** 어디에도 안 걸린 회의는 '정기·상시 회의'로 온다.
    expect(drawn).toContain('정기·상시 회의')
    expect(drawn).toContain('2026 소프트웨어융합대학 체육대회')
    // 개발용 응답의 회의도 남의 학생회의 회의도 없다.
    expect(drawn).not.toContain('학생회 정기 운영회의')
    expect(drawn).not.toContain('남의 회의')
  })

  // **완성된 글과 색은 서버가 만든다.** 화면이 '예정'을 만들면 화면마다 다른 말이 나온다.
  it('상태와 세는 말이 완성된 채로 온다', async () => {
    const rows = (await groupsNow()).flatMap((group) => group.meetings as Array<Record<string, unknown>>)
    const one = rows.find((row) => row.title === '9월 운영 점검회의')!
    expect(one.status).toBe('예정')
    expect(one.statusTone).toBe('blue')
    expect(one.attendees).toBe('2명')
    expect(one.agenda).toBe('1개')
    expect(one.startAt).toBe('2026.09.02 18:00')
    // 장소를 안 정한 회의는 완성된 안내로 온다.
    const live = rows.find((row) => row.title === '체육대회 종목 배정 회의')!
    expect(live.place).toBe('미정')
    expect(live.actionEmphasis).toBe('primary')
  })

  // **보는 사람과 이 회의의 관계를 서버가 말한다.** 개발용 응답은 늘 빈 딱지였다.
  it('보는 사람의 자리에 따라 딱지와 띠가 갈린다', async () => {
    const rows = (await groupsNow()).flatMap((group) => group.meetings as Array<Record<string, unknown>>)
    expect(rows.find((row) => row.title === '9월 운영 점검회의')!.viewerChipLabel).toBe('진행 권한')
    expect(rows.find((row) => row.title === '체육대회 종목 배정 회의')!.viewerChipLabel).toBe(
      '미참가',
    )

    await loadSources([{ key: 'meeting.attention', params: {} }])
    const band = readObjectSource('meeting.attention')
    expect(band.viewerTitle).toBe('진행 권한자 화면')
    expect(band.attentionNote).toBe('진행 권한 1건')
    // 회장단은 새 회의를 만들 수 있다 — 판정이 막는 검사와 같은 함수에서 나온다.
    expect(band.canCreateMeeting).toBe(true)
  })

  // 거르는 것도 서버가 한다. 개발용 응답의 회의 이름과 겹치지 않는 말로 찾는다.
  it('회의명으로 거르는 것을 서버가 한다', async () => {
    await loadSources([{ key: 'meeting.groups', params: { query: '종목' } }])
    const found = readListSource('meeting.groups', { query: '종목' })
    expect(found.flatMap((group) => group.meetings as Array<Record<string, unknown>>).map((row) => row.title)).toEqual([
      '체육대회 종목 배정 회의',
    ])
  })
})

describe('회의를 만드는 화면이 저장소의 값을 받는다', () => {
  it('OPS-MEET-02가 고치려는 회의를 칸에 그린다', async () => {
    render(
      <ScreenRouter
        screenId="OPS-MEET-02"
        screenParams={{ meetingId: 'MTG-A' }}
        scopes={{}}
        onChangeScope={() => {}}
        onNavigate={() => {}}
      />,
    )
    await waitFor(() => expect(screen.getByDisplayValue('9월 운영 점검회의')).toBeInTheDocument())
    // 주최자와 상태는 읽기 전용 칸이다 — 사람이 정하는 값이 아니다.
    expect(screen.getByDisplayValue('김바다')).toBeInTheDocument()
    expect(screen.getByDisplayValue('예정')).toBeInTheDocument()
    // 날짜와 시각은 칸마다 갈라져서 온다.
    expect(screen.getByDisplayValue('2026-09-02')).toBeInTheDocument()
    expect(screen.getByDisplayValue('18:00')).toBeInTheDocument()
  })

  // **새로 쓰는 것이면 서버가 아는 것만 온다.** 주최자는 지금 만드는 사람이다.
  it('새로 쓰면 주최자와 상태만 채워져 온다', async () => {
    await loadSources([{ key: 'meeting.draft', params: { meetingId: '' } }])
    const row = readObjectSource('meeting.draft', { meetingId: '' })
    expect(row.hostName).toBe('김바다')
    expect(row.statusLabel).toBe('예정')
    expect(Object.hasOwn(row, 'title')).toBe(false)
  })

  it('참가자 후보와 걸 수 있는 행사가 서버에서 온다', async () => {
    await loadSources([{ key: 'meeting.memberCandidates', params: { query: '운영부' } }])
    expect(
      readListSource('meeting.memberCandidates', { query: '운영부' }).map((row) => row.name),
    ).toEqual(['박해랑'])

    // 고르는 목록도 같은 서버를 쓴다 — 두 벌을 두면 표는 진짜인데 목록이 가짜가 된다.
    expect(await fetchOptions('event.linkable', {})).toEqual([
      { value: 'E-01', label: '2026 소프트웨어융합대학 체육대회' },
    ])
  })
})

describe('회의를 만들고 임시 저장한다', () => {
  // **화면이 누르는 그 길로 만든다.** 서버를 직접 부르면 그 사이가 빠진다.
  it('OPS-MEET-02가 누르는 길로 회의가 생긴다', async () => {
    const answer = await runMutation('meeting.create', DRAFT, {})
    // 새 회의의 id는 서버가 만든다 — 화면이 지어낼 수 없다.
    expect(typeof answer.id).toBe('string')

    const rows = (await groupsNow()).flatMap((group) => group.meetings as Array<Record<string, unknown>>)
    const one = rows.find((row) => row.title === '체육대회 최종 점검 회의')!
    expect(one.status).toBe('예정')
    // 보낸 참가자와 안건이 함께 저장됐다 — 세는 말은 서버가 붙인다.
    expect(one.attendees).toBe('1명')
    expect(one.agenda).toBe('1개')

    // 행사에 걸었으므로 그 행사의 묶음으로 온다.
    const groups = await groupsNow()
    const inEvent = groups.find((group) => group.title === '2026 소프트웨어융합대학 체육대회')!
    expect(
      (inEvent.meetings as Array<Record<string, unknown>>).map((row) => row.title),
    ).toContain('체육대회 최종 점검 회의')
  })

  // **임시 저장한 회의는 다른 참가자에게 표시되지 않는다.** 목록에 없되 사라지지도 않는다.
  it('임시 저장한 회의는 목록에 오지 않는다', async () => {
    const answer = await runMutation(
      'meeting.saveDraft',
      { ...DRAFT, title: '아직 쓰는 중인 회의' },
      {},
    )
    const rows = (await groupsNow()).flatMap((group) => group.meetings as Array<Record<string, unknown>>)
    expect(rows.map((row) => row.title)).not.toContain('아직 쓰는 중인 회의')

    // 저장은 됐다 — 그 회의를 열면 적어 둔 것이 그대로 온다.
    const params = { meetingId: String(answer.id) }
    await loadSources([{ key: 'meeting.draft', params }])
    const draft = readObjectSource('meeting.draft', params)
    expect(draft.title).toBe('아직 쓰는 중인 회의')
    expect(draft.place).toBe('학생회실 (A204)')
    expect((draft.agendaItems as Array<Record<string, unknown>>)[0]!.agendaTitle).toBe(
      '준비물 최종 확인',
    )
  })
})

describe('회의 상세가 저장소에서 온다', () => {
  // **화면을 그려서 잰다.** 그릇에 손으로 값을 먹이면 거르개가 달린 화면이 서버에
  // 붙는 순간 터지는 것을 못 본다.
  it('OPS-MEET-03A가 예정 회의 한 건을 그린다', async () => {
    render(
      <ScreenRouter
        screenId="OPS-MEET-03A"
        screenParams={{ meetingId: 'MTG-A' }}
        scopes={{}}
        onChangeScope={() => {}}
        onNavigate={() => {}}
      />,
    )
    await waitFor(() =>
      expect(screen.getByText('9월 운영 계획을 함께 확인합니다.')).toBeInTheDocument(),
    )
    const drawn = document.body.textContent ?? ''
    expect(drawn).toContain('2026.09.02 18:00')
    expect(drawn).toContain('학생회실 (A204)')
    // **세는 말은 서버가 붙인다.** 만든 사람은 기본 진행 권한자라 하나로 센다.
    expect(drawn).toContain('초대 2명 · 진행 권한 1명')
    expect(drawn).toContain('총 1개')
    // 안건과 참가자도 같은 서버에서 온다.
    expect(drawn).toContain('9월 예산 집행 계획')
    expect(drawn).toContain('박해랑')
    // 개발용 응답의 회의가 아니라는 증거다.
    expect(drawn).not.toContain('체육대회 안전 관리 최종 회의')
  })

  // **띠는 상태와 보는 사람 둘 다에 매인다.** 시작할 수 있는 사람에게만 오는 말이다.
  it('시작할 수 있는 사람에게 며칠 남았는지를 알린다', async () => {
    const params = { meetingId: 'MTG-A' }
    await loadSources([{ key: 'meeting.detail', params }])
    const row = readObjectSource('meeting.detail', params)
    expect(row.viewerTitle).toBe('회의 생성자 화면')
    expect(row.stateBannerTitle).toBe('시작 전 확인')
    expect(row.stateBannerNote).toBe(
      '현재 예정 시각까지 44일 남았습니다. 안건과 참가자를 확인한 뒤 회의를 시작하세요.',
    )
    // **판정이 막는 검사와 같은 곳에서 나온다.** 만든 사람이므로 넷 다 참이다.
    expect(row.canStart).toBe(true)
    expect(row.canEdit).toBe(true)
    expect(row.canEnd).toBe(false)
  })

  // **후속 업무가 붙으면서 05A가 열렸다.** 한동안 이 화면이 통째로 준비 중이었다 —
  // 읽는 자리 다섯 중 하나(`meeting.followUps`)가 안 지어졌기 때문이다.
  it('OPS-MEET-05A가 진행 중인 회의를 통째로 그린다', async () => {
    render(
      <ScreenRouter
        screenId="OPS-MEET-05A"
        screenParams={{ meetingId: 'MTG-C' }}
        scopes={{}}
        onChangeScope={() => {}}
        onNavigate={() => {}}
      />,
    )
    await waitFor(() =>
      expect(screen.getByText('점검 결과 공유 자료 정리')).toBeInTheDocument(),
    )
    const drawn = document.body.textContent ?? ''
    expect(drawn).not.toContain('이 화면은 아직 준비 중입니다.')
    // 지금 하고 있는 안건과 이 회의가 만든 후속 업무가 한 화면에 함께 온다.
    expect(drawn).toContain('비상 연락망 확정')
    // **누가 언제까지를 서버가 이어 준다.**
    expect(drawn).toContain('박해랑 · 07.23까지')
    // 개발용 응답의 후속 업무가 아니라는 증거다.
    expect(drawn).not.toContain('현수막 시안 최종 확정')
  })

  // 화면은 아직이지만 **상세가 주는 값은 이미 진짜다.** 그 자리를 계속 잰다 —
  // 화면이 열리는 날 그리는 것이 이 값들이다.
  it('진행 중인 회의의 값이 저장소에서 온다', async () => {
    const params = { meetingId: 'MTG-C' }
    await loadSources([{ key: 'meeting.detail', params }])
    const row = readObjectSource('meeting.detail', params)
    // 가만히 있어도 자라는 값이라 서버가 잰다.
    expect(row.elapsedNote).toContain('27분')
    expect(row.startedAt).toContain('09:33')
    expect(row.presentNote).toContain('2명')

    await loadSources([{ key: 'meeting.agendas', params }])
    const agendas = readListSource('meeting.agendas', params)
    // 지금 하고 있는 안건이 무엇인지도 데이터가 안다.
    expect(agendas.find((one) => one.isCurrent === true)?.title).toBe('비상 연락망 확정')
  })

  it('안건이 단계마다 다른 것을 갖는다', async () => {
    const params = { meetingId: 'MTG-C' }
    await loadSources([{ key: 'meeting.agendas', params }])
    const rows = readListSource('meeting.agendas', params)
    expect(rows.map((row) => row.orderLabel)).toEqual(['안건 1', '안건 2'])
    expect(rows[0]!.status).toBe('논의 완료')
    expect(rows[1]!.isCurrent).toBe(true)
    // 지금 하고 있는 안건의 소요만 '예상'이 붙는다.
    expect(rows[1]!.durationNote).toBe('예상 15분')
  })

  it('참가 현황이 같은 사람들에서 온다', async () => {
    const params = { meetingId: 'MTG-C' }
    await loadSources([{ key: 'meeting.participants', params }])
    const rows = readListSource('meeting.participants', params)
    expect(rows.map((row) => row.name)).toEqual(['김바다', '박해랑'])
    expect(rows[0]!.chips).toEqual([
      { label: '회의 생성자', tone: 'gray' },
      { label: '진행 권한', tone: 'blue' },
    ])
    expect(rows[1]!.attendanceLabel).toBe('참가')
    expect(rows[1]!.attendanceTone).toBe('green')
  })
})

/** 화면을 그리는 자리. 인자는 화면마다 다르고 나머지는 같다. */
function draw(screenId: string, screenParams: Record<string, string> = {}) {
  render(
    <ScreenRouter
      screenId={screenId}
      screenParams={screenParams}
      scopes={{}}
      onChangeScope={() => {}}
      onNavigate={() => {}}
    />,
  )
}

describe('진행 권한 관리가 저장소에서 온다', () => {
  // **만든 사람은 목록의 한 줄이 아니라 제 자리를 갖는다.** 04B가 맨 위 칸에 따로
  // 그리고 목록에서는 뺀다.
  it('OPS-MEET-04B가 만든 사람과 권한 안내를 함께 그린다', async () => {
    draw('OPS-MEET-04B', { meetingId: 'MTG-A' })
    await waitFor(() =>
      expect(screen.getByText('이 회의에만 적용되는 권한입니다')).toBeInTheDocument(),
    )
    const drawn = document.body.textContent ?? ''
    expect(drawn).not.toContain('이 화면은 아직 준비 중입니다.')
    // 04B는 만든 사람을 '권한 변경 및 회의 관리 가능'이라 적는다 — 03A와 다른 말이다.
    expect(drawn).toContain('학술체육부 · 권한 변경 및 회의 관리 가능')
    expect(drawn).toContain('필수 권한자')
    // **세는 것은 서버가 한다.** 만든 사람은 isHost가 아니어도 진행 권한자다.
    expect(drawn).toContain('현재 진행 권한자 1명 · 일반 참가자 1명')
    expect(drawn).toContain('최소 1명 유지')
    // 목록에는 만든 사람이 없다(excludeHostOwner). 개발용 응답의 사람도 없다.
    expect(drawn).toContain('박해랑')
    expect(drawn).not.toContain('이수현')
  })

  // **제목에 사람 이름이 박힌다.** 그 문장을 서버가 완성해 준다.
  it('OPS-MEET-D03이 누구에게 주는지를 완성된 문장으로 그린다', async () => {
    draw('OPS-MEET-D03', { meetingId: 'MTG-A', memberId: 'M-02' })
    await waitFor(() =>
      expect(screen.getByText('박해랑에게 진행 권한을 부여할까요?')).toBeInTheDocument(),
    )
    expect(document.body.textContent ?? '').not.toContain('이 화면은 아직 준비 중입니다.')
  })
})

describe('회의록이 저장소에서 온다', () => {
  it('OPS-MEET-06A가 요약과 정리 현황을 함께 그린다', async () => {
    draw('OPS-MEET-06A', { meetingId: 'MTG-F' })
    await waitFor(() =>
      expect(
        screen.getByText('신입생 환영 행사의 프로그램 순서와 부서별 준비 범위를 정했습니다.'),
      ).toBeInTheDocument(),
    )
    const drawn = document.body.textContent ?? ''
    expect(drawn).not.toContain('이 화면은 아직 준비 중입니다.')
    // 아직 확정되지 않은 요약이라 딱지가 붙는다.
    expect(drawn).toContain('정리 중 · 변경될 수 있음')
    // **부분마다 세는 단위가 다르다.** 안건은 몇 개 중 몇, 결정은 몇 건이다.
    expect(drawn).toContain('2 / 3 정리')
    expect(drawn).toContain('2건 확인')
    expect(drawn).toContain('0건 연결')
    expect(drawn).toContain('초안 작성')
  })

  it('정리 현황의 부분 목록을 서버가 든다', async () => {
    const params = { meetingId: 'MTG-F' }
    await loadSources([{ key: 'meeting.minutesStatus', params }])
    expect(readObjectSource('meeting.minutesStatus', params).parts).toEqual([
      { label: '안건 내용', stateNote: '2 / 3 정리' },
      { label: '의사결정', stateNote: '2건 확인' },
      { label: '후속 업무', stateNote: '0건 연결' },
      { label: '전체 요약', stateNote: '초안 작성' },
    ])
  })

  // **정리가 끝나면 요약은 확정된 것이다.** 그 자리에 딱지가 붙지 않는다.
  it('OPS-MEET-07이 완료된 회의록과 후속 업무를 그린다', async () => {
    draw('OPS-MEET-07', { meetingId: 'MTG-G' })
    await waitFor(() =>
      expect(screen.getByText('비상 연락망 최종본 배포')).toBeInTheDocument(),
    )
    const drawn = document.body.textContent ?? ''
    expect(drawn).not.toContain('이 화면은 아직 준비 중입니다.')
    expect(drawn).toContain('위험 구간 조치 방안과 비상 연락 순서를 확정했습니다.')
    expect(drawn).toContain('김바다 · 07.24까지')
    expect(drawn).not.toContain('정리 중 · 변경될 수 있음')
  })

  // **'이 회의가 만든 것'과 '그중 내 것'은 다른 물음이다.** 끝난 업무는 내 것이 아니다.
  it('OPS-MEET-08이 나에게 배정된 미완료 업무만 따로 그린다', async () => {
    draw('OPS-MEET-08', { meetingId: 'MTG-G' })
    await waitFor(() =>
      expect(screen.getAllByText('비상 연락망 최종본 배포').length).toBeGreaterThan(1),
    )
    const drawn = document.body.textContent ?? ''
    expect(drawn).not.toContain('이 화면은 아직 준비 중입니다.')
    // 이미 끝낸 업무는 '이 회의가 만든 것'에는 있고 '내 것'에는 없다.
    expect(drawn).toContain('케이블 커버 구매')
  })

  it('내 것만 묻는 자리는 끝난 업무를 빼고 답한다', async () => {
    const params = { meetingId: 'MTG-G' }
    await loadSources([
      { key: 'meeting.followUps', params },
      { key: 'meeting.myFollowUps', params },
    ])
    expect(readListSource('meeting.followUps', params).map((row) => row.title)).toEqual([
      '비상 연락망 최종본 배포',
      '케이블 커버 구매',
    ])
    expect(readListSource('meeting.myFollowUps', params).map((row) => row.title)).toEqual([
      '비상 연락망 최종본 배포',
    ])
  })

  // **06B가 통째로 열렸다.** 정리 완료 조건과 안건 고르기까지 서버에서 온다 — 조건
  // 줄은 그림이 그린 다섯이고, 딱지의 수와 목록과 머리의 막는 말이 한 셈이다.
  it('OPS-MEET-06B가 회의록과 정리 완료 조건을 통째로 그린다', async () => {
    draw('OPS-MEET-06B', { meetingId: 'MTG-F' })
    await waitFor(() =>
      expect(
        screen.getByText('신입생 환영 행사의 프로그램 순서와 부서별 준비 범위를 정했습니다.'),
      ).toBeInTheDocument(),
    )
    await waitFor(() => expect(screen.getByText('필수 2 / 4')).toBeInTheDocument())
    // 고르는 목록도 서버에서 온다 — 결정이 없는 셋째에만 '확인 필요'가 붙는다.
    await waitFor(() =>
      expect(screen.getByRole('radio', { name: /안건 3/ })).toBeInTheDocument(),
    )
    const drawn = document.body.textContent ?? ''
    // 아무 자리도 가려지지 않았다.
    expect(drawn).not.toContain('이 화면은 아직 준비 중입니다.')
    expect(drawn).not.toContain('아직 준비 중입니다')
    expect(drawn).toContain('행사 프로그램 구성')
    expect(drawn).toContain('입장과 퇴장 동선을 분리합니다.')
    // AI 초안이 무엇을 하지 않는지도 서버가 준다.
    expect(drawn).toContain('기록에 없는 결정·담당자·기한을 새로 만들지 않습니다')
    // 그림이 그린 다섯 줄. 셋째 안건에 결정이 없고 후속 업무가 없어 필수 둘이 비었다.
    for (const label of [
      '안건별 논의 내용',
      '결정사항 또는 없음 표시',
      '후속 업무 또는 없음 표시',
      '참가 결과',
      '회의 전체 요약 (선택)',
    ]) {
      expect(drawn).toContain(label)
    }
    // 머리의 막는 말은 그림이 그린 그 문장이다.
    expect(drawn).toContain('안건별 필수 정리를 완료해 주세요')
    expect(screen.getAllByText('확인 필요')).toHaveLength(1)
  })
})

describe('회의를 시작하고 끝내고 안건을 넘긴다', () => {
  const detailOf = async (meetingId: string) => {
    const params = { meetingId }
    await loadSources([{ key: 'meeting.detail', params }])
    return readObjectSource('meeting.detail', params)
  }

  // **며칠 이른지는 서버만 안다.** D01이 그 한 줄을 그린다.
  it('OPS-MEET-D01이 살펴 준 것을 받고 회의를 시작한다', async () => {
    const params = { meetingId: 'MTG-D' }
    await loadSources([{ key: 'meeting.startConfirm', params }])
    expect(readObjectSource('meeting.startConfirm', params).warningNote).toBe(
      '예정 시간보다 7일 이른 시각입니다. 잘못 시작한 것은 아닌지 확인해 주세요.',
    )

    // **화면이 누르는 그 길로 보낸다.** 서버를 직접 부르면 그 사이가 통째로 빠진다.
    await runMutation('meeting.start', {}, { meetingId: 'MTG-D' })
    const row = await detailOf('MTG-D')
    expect(row.status).toBe('진행 중')
    // 시작한 뒤에는 끝낼 수 있다. 판정이 단계를 함께 본다.
    expect(row.canStart).toBe(false)
    expect(row.canEnd).toBe(true)
  })

  // **조용히 넘어가지 않는다.** 남이 먼저 시작한 것을 아무도 모르게 된다.
  it('이미 진행 중인 회의를 또 시작하면 막힌다', async () => {
    await expect(runMutation('meeting.start', {}, { meetingId: 'MTG-D' })).rejects.toThrow(
      '(409)',
    )
  })

  it('OPS-MEET-05B가 이 안건을 마치고 다음 안건을 연다', async () => {
    await runMutation('meeting.completeAgenda', {}, { meetingId: 'MTG-E' })
    await runMutation('meeting.startNextAgenda', {}, { meetingId: 'MTG-E' })
    const params = { meetingId: 'MTG-E' }
    await loadSources([{ key: 'meeting.agendas', params }])
    const rows = readListSource('meeting.agendas', params)
    expect(rows.map((row) => row.status)).toEqual(['논의 완료', '진행 중'])
    expect(rows[1]!.isCurrent).toBe(true)
  })

  // **막지는 않는다.** 미완료 안건이 남아도 종료 단추는 살아 있다.
  it('OPS-MEET-D02가 남은 것을 알리고 회의를 끝낸다', async () => {
    const params = { meetingId: 'MTG-E' }
    await loadSources([{ key: 'meeting.endConfirm', params }])
    expect(readObjectSource('meeting.endConfirm', params).warningNote).toBe(
      '미완료 안건 0개 · 참석 1명 · 미참가 1명',
    )

    await runMutation('meeting.end', {}, { meetingId: 'MTG-E' })
    // **'완료'가 아니라 '정리 중'이다.** 회의록을 확인한 뒤에 따로 정리 완료한다.
    expect((await detailOf('MTG-E')).status).toBe('정리 중')
  })
})

describe('회의록을 정리하고 마친다', () => {
  const params = { meetingId: 'MTG-F' }
  const progressNow = async () => {
    await loadSources([{ key: 'meeting.minutesProgress', params }])
    return readObjectSource('meeting.minutesProgress', params)
  }

  // **곁말도 열려 있을 것도 서버가 표시한다.** 결정이 없는 셋째가 '확인 필요'이고 그것이 열린다.
  it('정리할 안건을 고르는 목록이 표시해서 온다', async () => {
    expect(await fetchOptions('meeting.agendaPicker', params)).toEqual([
      { value: 'AG-F-1', label: '안건 1' },
      { value: 'AG-F-2', label: '안건 2' },
      { value: 'AG-F-3', label: '안건 3', description: '확인 필요', initiallySelected: true },
    ])
  })

  // **기록에 없는 결정을 만들지 않는다.** 안건별 논의·결정을 옮겨 적고, 없으면 없다고 적는다.
  it('OPS-MEET-06B가 누르는 길로 요약 초안이 기록에서 만들어진다', async () => {
    await runMutation('meeting.generateSummary', {}, params)
    await loadSources([{ key: 'meeting.minutes', params }])
    expect(readObjectSource('meeting.minutes', params).summaryText).toBe(
      "안건 1 '행사 프로그램 구성' — 논의: 환영 인사와 학과 소개를 먼저 두기로 했습니다. / 결정: 프로그램은 환영 인사 이후 학과 소개 순으로 진행합니다.\n" +
        "안건 2 '장소와 참가자 동선' — 논의: 기록 없음 / 결정: 입장과 퇴장 동선을 분리합니다.\n" +
        "안건 3 '부서별 준비 범위' — 논의: 기록 없음 / 결정: 기록 없음",
    )
  })

  // **조건이 남았으면 서버가 막는다.** 화면이 세지 않는다 — 세면 조직의 규칙이 화면에 적힌다.
  it('조건이 남은 동안은 마칠 수 없다', async () => {
    await expect(runMutation('meeting.completeMinutes', {}, params)).rejects.toThrow('(422)')
    expect((await progressNow()).canComplete).toBe(false)
  })

  // 결정을 적으면 둘째 줄이 차고 곁말이 떨어진다 — 조건과 곁말이 한 셈에서 나온다.
  it('결정사항을 저장하면 조건과 곁말이 함께 움직인다', async () => {
    await runMutation(
      'meeting.saveMinutes',
      { agendaId: 'AG-F-3', decisionText: '부서별 준비 범위는 다음 회의에서 확정합니다.' },
      params,
    )
    await loadSources([{ key: 'meeting.agendas', params }])
    expect(readListSource('meeting.agendas', params)[2]!.decisionText).toBe(
      '부서별 준비 범위는 다음 회의에서 확정합니다.',
    )
    const progress = await progressNow()
    expect(progress.requiredDoneNote).toBe('필수 3 / 4')
    expect(
      (progress.conditions as Array<Record<string, unknown>>).map((one) => one.done),
    ).toEqual(['y', 'y', '', 'y', 'y'])
    expect(await fetchOptions('meeting.agendaPicker', params)).toEqual([
      { value: 'AG-F-1', label: '안건 1', initiallySelected: true },
      { value: 'AG-F-2', label: '안건 2' },
      { value: 'AG-F-3', label: '안건 3' },
    ])
  })

  // **후속 업무는 업무 표의 것이다.** 하나 걸리면 셋째 줄이 찬다 — 06B의 '업무 연결'은
  // 아직 갈 곳이 없어(pending) 여기서는 사실을 심는다.
  it('후속 업무가 걸리면 마칠 수 있고, 마치면 회의도 완료가 된다', async () => {
    await db.insert(tasks).values({
      id: 'TSK-F1',
      orgId: 'ORG-01',
      fromMeetingId: 'MTG-F',
      title: '부서별 준비 범위 정리',
      status: 'planned',
      assigneeMemberId: 'M-02',
    })
    forgetSources()
    const before = await progressNow()
    expect(before.requiredDoneNote).toBe('필수 4 / 4')
    expect(before.canComplete).toBe(true)
    expect(Object.hasOwn(before, 'blockedNote')).toBe(false)

    await runMutation('meeting.completeMinutes', {}, params)
    await loadSources([
      { key: 'meeting.detail', params },
      { key: 'meeting.minutes', params },
    ])
    const detail = readObjectSource('meeting.detail', params)
    // **종료는 '정리 중'이었고 정리를 마쳐야 '완료'다.** 두 축이 함께 닫힌다.
    expect(detail.status).toBe('완료')
    expect(detail.minutesStatus).toBe('정리 완료')
    // 확정된 요약이라 '변경될 수 있음'이 떨어진다.
    expect(readObjectSource('meeting.minutes', params).statusLabel).toBe('')
  })

  // **되풀이는 조용히 넘어가지 않는다**(계약의 repeat: conflict).
  it('이미 마친 회의록을 또 마치면 막힌다', async () => {
    await expect(runMutation('meeting.completeMinutes', {}, params)).rejects.toThrow('(409)')
  })

  // **회의의 상태가 아니라 그 사람의 확인 상태다.** 목록 위의 띠가 세는 수가 그 증거다.
  it('OPS-MEET-08이 누르는 길로 요약 확인이 기록된다', async () => {
    await loadSources([{ key: 'meeting.attention', params: {} }])
    expect(readObjectSource('meeting.attention').attentionNote).toContain('확인 필요한 회의 1건')

    await runMutation('meeting.acknowledgeSummary', {}, params)
    await loadSources([{ key: 'meeting.attention', params: {} }])
    expect(readObjectSource('meeting.attention').attentionNote).not.toContain('확인 필요한 회의')
  })
})

describe('진행 권한을 주고 뺀다', () => {
  const params = { meetingId: 'MTG-A' }
  const noticeNow = async () => {
    await loadSources([{ key: 'meeting.permissionNotice', params }])
    return readObjectSource('meeting.permissionNotice', params)
  }
  const personNow = async (name: string) => {
    await loadSources([{ key: 'meeting.participants', params }])
    return readListSource('meeting.participants', params).find((row) => row.name === name)!
  }

  // **옮기는 것이 아니라 더하는 것이다**(D03). 세는 말과 줄의 딱지·단추가 함께 바뀐다.
  it('OPS-MEET-D03이 누르는 길로 진행 권한이 더해진다', async () => {
    await runMutation('meeting.grantHostRole', {}, { meetingId: 'MTG-A', memberId: 'M-02' })
    expect((await noticeNow()).summaryNote).toBe('현재 진행 권한자 2명 · 일반 참가자 0명')
    const person = await personNow('박해랑')
    expect(person.chips).toEqual([{ label: '진행 권한', tone: 'blue' }])
    expect(person.actionLabel).toBe('권한 해제')

    draw('OPS-MEET-04B', params)
    await waitFor(() =>
      expect(screen.getByText('현재 진행 권한자 2명 · 일반 참가자 0명')).toBeInTheDocument(),
    )
  })

  it('빼면 일반 참가자로 돌아간다', async () => {
    await runMutation('meeting.revokeHostRole', {}, { meetingId: 'MTG-A', memberId: 'M-02' })
    expect((await noticeNow()).summaryNote).toBe('현재 진행 권한자 1명 · 일반 참가자 1명')
    expect((await personNow('박해랑')).actionLabel).toBe('진행 권한 부여')
  })

  // **만든 사람은 늘 진행 권한자다.** 뺄 자리가 없다.
  it('만든 사람의 진행 권한은 뺄 수 없다', async () => {
    await expect(
      runMutation('meeting.revokeHostRole', {}, { meetingId: 'MTG-A', memberId: 'M-01' }),
    ).rejects.toThrow('(422)')
  })
})

describe('회의를 취소한다', () => {
  const params = { meetingId: 'MTG-A' }

  // **지우는 것이 아니다.** 취소된 기록으로 남고 09가 그것을 그린다 — 사유도 누가 언제도.
  it('OPS-MEET-D04가 누르는 길로 취소되고 OPS-MEET-09가 그 기록을 그린다', async () => {
    await runMutation('meeting.cancel', { cancelReason: '행사 일정이 바뀌어 다시 잡습니다.' }, params)

    draw('OPS-MEET-09', params)
    await waitFor(() => expect(screen.getByText('이 회의는 취소되었습니다')).toBeInTheDocument())
    const drawn = document.body.textContent ?? ''
    expect(drawn).toContain('9월 운영 점검회의')
    expect(drawn).toContain('행사 일정이 바뀌어 다시 잡습니다.')
    // 누가 취소했는지는 서버가 안다 — 보낸 사람이다.
    expect(drawn).toContain('김바다 · 학술체육부')
    expect(drawn).toContain('2026.07.20 10:00')
    // 안건은 지워지지 않았다.
    await loadSources([{ key: 'meeting.agendas', params }])
    expect(readListSource('meeting.agendas', params).map((row) => row.title)).toEqual([
      '9월 예산 집행 계획',
    ])
  })

  // **되풀이는 409다.** 취소된 회의는 더 취소할 것도, 취소 단추를 그릴 자리도 없다.
  it('이미 취소된 회의는 또 취소할 수 없다', async () => {
    await expect(
      runMutation('meeting.cancel', { cancelReason: '다시' }, params),
    ).rejects.toThrow('(409)')
    await loadSources([{ key: 'meeting.detail', params }])
    expect(readObjectSource('meeting.detail', params).canCancel).toBe(false)
  })
})
