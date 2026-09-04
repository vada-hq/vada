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

  it('OPS-MEET-05A가 진행 중인 회의를 그린다', async () => {
    render(
      <ScreenRouter
        screenId="OPS-MEET-05A"
        screenParams={{ meetingId: 'MTG-C' }}
        scopes={{}}
        onChangeScope={() => {}}
        onNavigate={() => {}}
      />,
    )
    await waitFor(() => expect(screen.getByText('진행 27분')).toBeInTheDocument())
    const drawn = document.body.textContent ?? ''
    // 가만히 있어도 자라는 값이라 서버가 잰다.
    expect(drawn).toContain('09:33 시작')
    expect(drawn).toContain('2명 참가 중')
    // 지금 하고 있는 안건이 무엇인지도 데이터가 안다(isCurrent).
    expect(drawn).toContain('비상 연락망 확정')
    expect(drawn).toContain('진행 중')
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
