import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { createApp } from '../../../api/src/app.ts'
import { freshDb } from '../../../api/src/db/testing.ts'
import { inMemoryCounter } from '../../../api/src/public/rate-limit.ts'
import { inMemoryAttempts } from '../../../api/src/idempotency.ts'
import {
  departments,
  events,
  meetingAgendas,
  meetingParticipants,
  meetings,
  members,
  organizations,
  users,
} from '../../../api/src/db/schema.ts'
import { ScreenRouter } from '../screens/ScreenRouter'
import { readListSource, readObjectSource } from './catalog'
import { fetchOptions } from '../option-sources/catalog'
import { runMutation } from '../spec/mutations'
import { loadSources, useServer } from './server'

// **회의의 앞자락을 끝까지 뚫는다.**
//
// 개발용 응답이 오랫동안 회의 일곱 개와 '일반 참가자 화면'을 그렸다. 그 값들은
// 명세가 든 예시라 화면은 늘 예쁘게 그려졌고, **서버가 정말 그 모양을 낼 수 있는지는
// 아무도 재 보지 않았다.** 특히 두 자리가 그랬다: 묶음을 짓는 일과 '누가 보느냐'로
// 값이 갈리는 일 — 둘 다 가짜에서는 그냥 적어 두면 되는 것이다.
//
// 여기서 재는 일곱:
//
// | 읽기 | 쓰기 |
// | --- | --- |
// | `meeting.groups`(OPS-MEET-01A) | `meeting.create`(OPS-MEET-02) |
// | `meeting.attention`(OPS-MEET-01A) | `meeting.saveDraft`(OPS-MEET-02) |
// | `meeting.draft`(OPS-MEET-02) | |
// | `meeting.memberCandidates`(OPS-MEET-02) | |
// | `event.linkable`(OPS-MEET-02의 고르는 목록) | |
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
    // 옆 학생회의 회의. 이 목록에 나오면 안 된다.
    { id: 'MTG-99', orgId: 'ORG-02', title: '남의 회의', creatorMemberId: 'M-99' },
  ])
  await fresh.db.insert(meetingParticipants).values([
    { id: 'MP-01', orgId: 'ORG-01', meetingId: 'MTG-A', memberId: 'M-01', isHost: true },
    { id: 'MP-02', orgId: 'ORG-01', meetingId: 'MTG-A', memberId: 'M-02' },
  ])
  await fresh.db.insert(meetingAgendas).values({
    id: 'AG-A-1',
    orgId: 'ORG-01',
    meetingId: 'MTG-A',
    sortOrder: 0,
    title: '9월 예산 집행 계획',
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
