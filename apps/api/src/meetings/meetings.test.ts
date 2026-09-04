import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp, type Deps } from '../app.ts'
import type { Db } from '../db/client.ts'
import { freshDb } from '../db/testing.ts'
import {
  departments,
  documents,
  events,
  meetingAgendas,
  meetingParticipants,
  meetings,
  members,
  organizations,
} from '../db/schema.ts'
import { inMemoryAttempts } from '../idempotency.ts'
import type { Viewer } from '../permissions.ts'
import { inMemoryCounter } from '../public/rate-limit.ts'

// 회의 목록(OPS-MEET-01A)과 회의 만들기(OPS-MEET-02)가 **읽는** 것.
//
// 이 파일이 재는 것이 다섯이다.
//
// 1. **묶음을 서버가 짓는다.** 묶음 하나가 행사 하나이고, 어느 행사에도 안 걸린
//    회의는 '정기·상시 회의'로 온다 — 묶음 수가 데이터에 달려 있어 화면이 미리
//    알 수 없다.
// 2. **완성된 글과 색을 준다.** '예정'·'blue'·'참가자 12명'을 화면이 만들면
//    화면마다 다른 말이 나온다.
// 3. **보는 사람에 따라 통째로 달라진다.** 띠도 줄의 딱지도 누가 보느냐가 정하고,
//    그것은 서버만 안다.
// 4. **울타리가 선다.** 남의 학생회의 회의도 행사도 사람도 섞이지 않는다.
// 5. **임시 저장한 회의는 목록에 없다.** 그것도 회의지만 아직 아무에게도 알리지
//    않은 것이다.

let db: Db
let close: () => Promise<void>
const NOW = new Date('2026-07-20T10:00:00+09:00')

function viewer(memberId = 'M-01', role: 'chair' | 'head' | 'member' = 'chair'): Viewer {
  return {
    userId: `U-${memberId}`,
    membership: {
      orgId: 'ORG-01',
      memberId,
      role,
      departmentId: null,
      inFinanceDepartment: false,
    },
  }
}

function harness(who: Viewer | null = viewer()) {
  const deps: Deps = {
    audit: { async write() {} },
    db,
    who: async () => who,
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
  }
  return createApp(deps)
}

interface Row {
  [key: string]: unknown
}

const get = async (path: string, who: Viewer | null = viewer()) =>
  (await (await harness(who).request(path)).json()) as never

const groups = async (query = '', who: Viewer | null = viewer()) =>
  (await get(`/api/ops/meetings${query}`, who)) as Array<{
    title: string
    nextMeetingNote: string
    meetings: Row[]
  }>

/** 묶음을 헤치고 회의 하나를 집는다. 이름으로 찾는 것은 화면이 보는 것과 같다. */
async function meeting(title: string, who: Viewer | null = viewer()): Promise<Row> {
  const found = (await groups('', who))
    .flatMap((group) => group.meetings)
    .find((row) => row.title === title)
  if (found === undefined) throw new Error(`목록에 '${title}'이 없습니다`)
  return found
}

beforeAll(async () => {
  const fresh = await freshDb()
  db = fresh.db as unknown as Db
  close = fresh.close

  await db.insert(organizations).values([
    { id: 'ORG-01', name: '제12대 학생회', term: '2026' },
    // **옆 학생회를 하나 더 둔다.** 울타리를 재려면 넘어갈 담이 있어야 한다.
    { id: 'ORG-02', name: '옆 학생회' },
  ])
  await db.insert(departments).values([
    { id: 'D-01', orgId: 'ORG-01', name: '기획부' },
    { id: 'D-02', orgId: 'ORG-01', name: '운영부' },
    { id: 'D-99', orgId: 'ORG-02', name: '남의 부서' },
  ])
  await db.insert(members).values([
    { id: 'M-01', orgId: 'ORG-01', name: '이수현', role: 'chair', departmentId: 'D-01' },
    { id: 'M-02', orgId: 'ORG-01', name: '박해랑', role: 'member', departmentId: 'D-02' },
    // 부서에 아직 안 든 사람. 소속이 없을 때 무엇이 그려지는지를 이 사람이 잰다.
    { id: 'M-03', orgId: 'ORG-01', name: '정하늘', role: 'member' },
    { id: 'M-04', orgId: 'ORG-01', name: '김민준', role: 'head', departmentId: 'D-02' },
    { id: 'M-99', orgId: 'ORG-02', name: '남의사람', role: 'chair', departmentId: 'D-99' },
  ])
  await db.insert(events).values([
    { id: 'E-01', orgId: 'ORG-01', title: '2026 소프트웨어융합대학 체육대회' },
    { id: 'E-02', orgId: 'ORG-01', title: '신입생 환영 행사' },
    { id: 'E-03', orgId: 'ORG-01', title: '가을 축제' },
    { id: 'E-99', orgId: 'ORG-02', title: '남의 행사' },
  ])

  await db.insert(meetings).values([
    {
      id: 'MTG-01',
      orgId: 'ORG-01',
      title: '7월 예산 검토회의',
      status: 'done',
      minutesStatus: 'done',
      scheduledAt: new Date('2026-07-10T14:00:00+09:00'),
      place: '온라인 (Zoom)',
      creatorMemberId: 'M-02',
    },
    {
      id: 'MTG-02',
      orgId: 'ORG-01',
      title: '학생회 정기 운영회의',
      status: 'scheduled',
      scheduledAt: new Date('2026-07-22T18:00:00+09:00'),
      place: '학생회실 (A204)',
      creatorMemberId: 'M-01',
    },
    // 비공개 회의. 딱지가 붙되 목록에서 사라지지는 않는다 — 그림의 안내가
    // '모든 구성원의 전체 회의 목록에 표시됩니다'라고 적었다.
    {
      id: 'MTG-03',
      orgId: 'ORG-01',
      title: '회장단 비공개 안건 조율',
      status: 'scheduled',
      scheduledAt: new Date('2026-07-24T17:00:00+09:00'),
      place: '회장실',
      isPrivate: true,
      creatorMemberId: 'M-01',
    },
    // 장소를 아직 안 정한 회의. 빈 글이 아니라 완성된 안내가 와야 한다.
    {
      id: 'MTG-04',
      orgId: 'ORG-01',
      eventId: 'E-01',
      kind: 'event',
      title: '체육대회 운영 점검 회의',
      status: 'inProgress',
      minutesStatus: 'drafting',
      scheduledAt: new Date('2026-07-18T10:00:00+09:00'),
      creatorMemberId: 'M-02',
    },
    {
      id: 'MTG-05',
      orgId: 'ORG-01',
      eventId: 'E-01',
      kind: 'event',
      title: '안전 관리 최종 회의',
      purpose: '행사 당일 안전 관리 계획을 최종 확인합니다.',
      status: 'scheduled',
      scheduledAt: new Date('2026-07-25T15:00:00+09:00'),
      plannedEndAt: new Date('2026-07-25T16:30:00+09:00'),
      mode: '대면',
      place: '학생회실 (A204)',
      creatorMemberId: 'M-01',
      departmentId: 'D-01',
    },
    {
      id: 'MTG-06',
      orgId: 'ORG-01',
      eventId: 'E-02',
      kind: 'event',
      title: '신입생 환영 행사 기획회의',
      status: 'wrapUp',
      minutesStatus: 'drafting',
      scheduledAt: new Date('2026-07-15T16:00:00+09:00'),
      place: '온라인 (Discord)',
      creatorMemberId: 'M-02',
    },
    {
      id: 'MTG-07',
      orgId: 'ORG-01',
      eventId: 'E-03',
      kind: 'event',
      title: '가을 축제 1차 준비회의',
      status: 'cancelled',
      scheduledAt: new Date('2026-08-05T13:00:00+09:00'),
      cancelReason: '행사 일정이 밀렸습니다',
      creatorMemberId: 'M-01',
    },
    // **임시 저장한 회의.** 목록에 나오면 안 된다.
    {
      id: 'MTG-08',
      orgId: 'ORG-01',
      title: '아직 쓰는 중인 회의',
      status: 'draft',
      creatorMemberId: 'M-01',
    },
    // 옆 학생회의 회의. 이 목록에도 그 행사 묶음에도 나오면 안 된다.
    { id: 'MTG-99', orgId: 'ORG-02', eventId: 'E-99', title: '남의 회의', creatorMemberId: 'M-99' },
  ])

  await db.insert(meetingParticipants).values([
    // 정리 완료됐는데 아직 확인하지 않은 회의. 띠가 이것을 센다.
    { id: 'MP-01', orgId: 'ORG-01', meetingId: 'MTG-01', memberId: 'M-01' },
    { id: 'MP-02', orgId: 'ORG-01', meetingId: 'MTG-01', memberId: 'M-02' },
    { id: 'MP-03', orgId: 'ORG-01', meetingId: 'MTG-02', memberId: 'M-01', isHost: true },
    { id: 'MP-04', orgId: 'ORG-01', meetingId: 'MTG-04', memberId: 'M-01' },
    { id: 'MP-05', orgId: 'ORG-01', meetingId: 'MTG-04', memberId: 'M-02' },
    { id: 'MP-06', orgId: 'ORG-01', meetingId: 'MTG-05', memberId: 'M-01', isHost: true },
    { id: 'MP-07', orgId: 'ORG-01', meetingId: 'MTG-05', memberId: 'M-02' },
  ])

  await db.insert(meetingAgendas).values([
    { id: 'AG-02-1', orgId: 'ORG-01', meetingId: 'MTG-02', sortOrder: 0, title: '예산 집행 보고' },
    { id: 'AG-02-2', orgId: 'ORG-01', meetingId: 'MTG-02', sortOrder: 1, title: '행사 일정 조율' },
    {
      id: 'AG-05-1',
      orgId: 'ORG-01',
      meetingId: 'MTG-05',
      sortOrder: 0,
      title: '행사장 안전 점검 결과',
      description: '점검표를 함께 봅니다.',
    },
    {
      id: 'AG-05-2',
      orgId: 'ORG-01',
      meetingId: 'MTG-05',
      sortOrder: 1,
      title: '비상 연락망 및 담당자 확정',
    },
  ])

  await db.insert(documents).values({
    id: 'DOC-01',
    orgId: 'ORG-01',
    meetingId: 'MTG-05',
    agendaId: 'AG-05-1',
    title: '체육대회_안전점검표.pdf',
  })
}, 60_000)

afterAll(async () => {
  await close()
})

describe('묶음을 서버가 짓는다', () => {
  it('묶음 하나가 행사 하나이고 나머지는 정기·상시 회의다', async () => {
    expect((await groups()).map((group) => group.title)).toEqual([
      '정기·상시 회의',
      '신입생 환영 행사',
      '2026 소프트웨어융합대학 체육대회',
      '가을 축제',
    ])
  })

  // **울타리.** 남의 학생회의 회의도 그 행사 묶음도 없다.
  it('내 학생회의 것만 온다', async () => {
    const all = await groups()
    expect(all.map((group) => group.title)).not.toContain('남의 행사')
    expect(all.flatMap((group) => group.meetings).map((row) => row.title)).not.toContain('남의 회의')
  })

  // **임시 저장한 회의는 아직 아무에게도 알리지 않은 것이다.** 그리고 명세가
  // 이 목록에 그릴 상태 이름도 갈 곳(detailKind)도 주지 않았다.
  it('임시 저장한 회의는 목록에 없다', async () => {
    const titles = (await groups()).flatMap((group) => group.meetings).map((row) => row.title)
    expect(titles).not.toContain('아직 쓰는 중인 회의')
  })

  // **완료는 빼고 취소는 넣는다.** 명세가 그림을 보고 그렇게 적었다.
  it('가장 가까운 회의는 완료를 빼고 취소를 넣는다', async () => {
    const all = await groups()
    const regular = all.find((group) => group.title === '정기·상시 회의')!
    // 07.10은 완료라 빠지고 07.22가 가장 가깝다.
    expect(regular.nextMeetingNote).toBe('가장 가까운 회의: 07.22 (수) 18:00')
    const autumn = all.find((group) => group.title === '가을 축제')!
    expect(autumn.nextMeetingNote).toBe('가장 가까운 회의: 08.05 (수) 13:00')
  })

  it('묶음 안의 회의는 이른 것부터 온다', async () => {
    const regular = (await groups()).find((group) => group.title === '정기·상시 회의')!
    expect(regular.meetings.map((row) => row.title)).toEqual([
      '7월 예산 검토회의',
      '학생회 정기 운영회의',
      '회장단 비공개 안건 조율',
    ])
  })

  // 거르는 것도 서버가 한다. 화면의 칸 이름이 '회의명 검색'이다.
  it('회의명으로 거르는 것을 서버가 한다', async () => {
    const found = await groups('?query=안전')
    expect(found.flatMap((group) => group.meetings).map((row) => row.title)).toEqual([
      '안전 관리 최종 회의',
    ])
    // 걸러 낸 뒤 빈 묶음은 오지 않는다 — 빈 묶음의 머리만 남으면 화면이 빈 칸을 그린다.
    expect(found.map((group) => group.title)).toEqual(['2026 소프트웨어융합대학 체육대회'])
  })
})

describe('완성된 글과 색을 준다', () => {
  it('상태를 말과 색으로 준다', async () => {
    const scheduled = await meeting('학생회 정기 운영회의')
    expect(scheduled.status).toBe('예정')
    expect(scheduled.statusTone).toBe('blue')
    const live = await meeting('체육대회 운영 점검 회의')
    expect(live.status).toBe('진행 중')
    expect(live.statusTone).toBe('green')
    const cancelled = await meeting('가을 축제 1차 준비회의')
    expect(cancelled.status).toBe('취소')
    expect(cancelled.statusTone).toBe('red')
  })

  it('회의록이 어디까지 왔는지 말한다', async () => {
    expect((await meeting('학생회 정기 운영회의')).minutesStatus).toBe('작성 전')
    expect((await meeting('체육대회 운영 점검 회의')).minutesStatus).toBe('작성 중')
    expect((await meeting('7월 예산 검토회의')).minutesStatus).toBe('정리 완료')
    expect((await meeting('신입생 환영 행사 기획회의')).minutesStatus).toBe('내용 열람 가능')
    expect((await meeting('가을 축제 1차 준비회의')).minutesStatus).toBe('취소 사유 등록')
  })

  it('세는 말까지 붙여서 준다', async () => {
    const row = await meeting('학생회 정기 운영회의')
    expect(row.attendees).toBe('1명')
    expect(row.agenda).toBe('2개')
    expect(row.startAt).toBe('2026.07.22 18:00')
    expect(row.host).toBe('이수현')
  })

  // **정해지지 않은 것은 그 사실을 말로 준다.** 빈 글을 주면 화면이 빈 자리를 그린다.
  it('장소가 없으면 완성된 안내로 온다', async () => {
    expect((await meeting('체육대회 운영 점검 회의')).place).toBe('미정')
  })

  // **없으면 오지 않는다.** 빈 글을 주면 화면이 빈 딱지를 그린다.
  it('비공개 회의에만 딱지가 붙는다', async () => {
    expect((await meeting('회장단 비공개 안건 조율')).badge).toBe('비공개')
    expect(Object.hasOwn(await meeting('학생회 정기 운영회의'), 'badge')).toBe(false)
  })

  it('어느 종류의 상세로 가는지를 상태가 정한다', async () => {
    expect((await meeting('학생회 정기 운영회의')).detailKind).toBe('scheduled')
    expect((await meeting('체육대회 운영 점검 회의')).detailKind).toBe('live')
    expect((await meeting('신입생 환영 행사 기획회의')).detailKind).toBe('tidying')
    expect((await meeting('7월 예산 검토회의')).detailKind).toBe('done')
    expect((await meeting('가을 축제 1차 준비회의')).detailKind).toBe('cancelled')
  })

  // **지금 진행 중인 회의만 앞세운다.** 명세가 그렇게 적었다.
  it('진행 중인 회의만 앞세운다', async () => {
    const live = await meeting('체육대회 운영 점검 회의')
    expect(live.actionLabel).toBe('회의로 돌아가기')
    expect(live.actionEmphasis).toBe('primary')
    expect((await meeting('학생회 정기 운영회의')).actionEmphasis).toBe('secondary')
    expect((await meeting('7월 예산 검토회의')).actionLabel).toBe('회의록 보기')
  })
})

describe('보는 사람에 따라 줄의 딱지가 달라진다', () => {
  it('진행 권한자에게는 진행 권한이 붙는다', async () => {
    const row = await meeting('학생회 정기 운영회의')
    expect(row.viewerChipLabel).toBe('진행 권한')
    expect(row.viewerChipTone).toBe('blue')
  })

  it('일반 참가자에게는 아무것도 안 붙는다', async () => {
    const row = await meeting('체육대회 운영 점검 회의')
    expect(row.viewerChipLabel).toBe('')
    expect(row.viewerChipTone).toBe('')
  })

  it('초대되지 않은 사람에게는 미참가가 붙는다', async () => {
    const row = await meeting('회장단 비공개 안건 조율')
    expect(row.viewerChipLabel).toBe('미참가')
  })

  // 같은 회의를 다른 사람이 보면 다른 딱지가 붙는다 — 그것이 이 자리의 값이다.
  it('같은 회의도 보는 사람이 바뀌면 딱지가 바뀐다', async () => {
    const mine = await meeting('학생회 정기 운영회의')
    const theirs = await meeting('학생회 정기 운영회의', viewer('M-03', 'member'))
    expect(mine.viewerChipLabel).toBe('진행 권한')
    expect(theirs.viewerChipLabel).toBe('미참가')
  })
})

describe('회의 목록 위의 띠', () => {
  const attention = async (who: Viewer) =>
    (await get('/api/ops/meetings/attention', who)) as {
      viewerTitle: string
      viewerNote: string
      attentionNote: string
      canCreateMeeting: boolean
    }

  it('진행 권한을 가진 사람에게는 그 자리를 말한다', async () => {
    const band = await attention(viewer('M-01', 'chair'))
    expect(band.viewerTitle).toBe('진행 권한자 화면')
    // 확인 필요 하나(MTG-01)와 진행 권한 하나(MTG-02). 끝난 회의의 진행 권한은 안 센다.
    expect(band.attentionNote).toBe('확인 필요한 회의 1건 · 진행 권한 2건')
  })

  it('초대만 받은 사람에게는 일반 참가자 화면이 온다', async () => {
    const band = await attention(viewer('M-02', 'member'))
    expect(band.viewerTitle).toBe('일반 참가자 화면')
    expect(band.attentionNote).toBe('확인 필요한 회의 1건')
  })

  // **회의 생성 가능·미참가자 화면에는 곁의 한 줄이 그려지지 않는다.**
  it('아무 회의에도 없고 만들 수 있으면 이름과 자리로 말한다', async () => {
    const band = await attention(viewer('M-04', 'head'))
    expect(band.viewerTitle).toBe('김민준 (운영부 부서장)')
    expect(band.attentionNote).toBe('')
    expect(band.canCreateMeeting).toBe(true)
  })

  it('아무 회의에도 없고 만들 수도 없으면 미참가자 화면이다', async () => {
    const band = await attention(viewer('M-03', 'member'))
    expect(band.viewerTitle).toBe('미참가자 화면')
    expect(band.attentionNote).toBe('')
    expect(band.canCreateMeeting).toBe(false)
  })

  // **판정은 막는 검사와 같은 함수에서 나온다.** 부원에게는 만들기 단추가 안 그려진다.
  it('만들 수 있는가는 권한이 정한다', async () => {
    expect((await attention(viewer('M-01', 'chair'))).canCreateMeeting).toBe(true)
    expect((await attention(viewer('M-02', 'member'))).canCreateMeeting).toBe(false)
  })
})

describe('회의를 만들거나 고칠 때 처음 받는 값', () => {
  const draft = async (query = '', who: Viewer = viewer()) =>
    (await get(`/api/ops/meetings/draft${query}`, who)) as Row

  // **meetingId가 없으면 새로 쓰는 것이다.** 서버가 아는 것만 채워 온다.
  it('새로 쓰면 주최자와 상태만 온다', async () => {
    const row = await draft()
    expect(row.hostName).toBe('이수현')
    expect(row.statusLabel).toBe('예정')
    // 안 적은 칸은 아예 오지 않는다 — 빈 칸에 '미정'을 넣으면 그대로 저장된다.
    expect(Object.hasOwn(row, 'title')).toBe(false)
    expect(Object.hasOwn(row, 'place')).toBe(false)
  })

  it('고치러 들어오면 그 회의를 통째로 준다', async () => {
    const row = await draft('?meetingId=MTG-05')
    expect(row.title).toBe('안전 관리 최종 회의')
    expect(row.meetingType).toBe('event')
    expect(row.linkedEventId).toBe('E-01')
    expect(row.departmentId).toBe('D-01')
    expect(row.purpose).toBe('행사 당일 안전 관리 계획을 최종 확인합니다.')
    expect(row.place).toBe('학생회실 (A204)')
    expect(row.mode).toBe('대면')
    expect(row.isPrivate).toBe(false)
    expect(row.statusLabel).toBe('예정')
  })

  // **칸의 꼴로 준다.** 날짜 칸과 시각 칸이 따로이므로 서버가 갈라서 보낸다.
  it('날짜와 시각을 칸이 읽는 꼴로 가른다', async () => {
    const row = await draft('?meetingId=MTG-05')
    expect(row.date).toBe('2026-07-25')
    expect(row.startTime).toBe('15:00')
    expect(row.endTime).toBe('16:30')
  })

  it('참가자에 딱지와 줄 단추가 붙어서 온다', async () => {
    const people = (await draft('?meetingId=MTG-05')).participants as Row[]
    expect(people.map((one) => one.name)).toEqual(['이수현', '박해랑'])
    // 만든 사람이 먼저. 진행 권한도 함께 갖는다.
    expect(people[0]!.chips).toEqual([
      { label: '회의 생성자', tone: 'gray' },
      { label: '진행 권한', tone: 'blue' },
    ])
    expect(people[0]!.departmentNote).toBe('기획부')
    // 만든 사람은 뺄 수 없다 — 줄 단추가 아예 오지 않는다.
    expect(Object.hasOwn(people[0]!, 'canRemove')).toBe(false)
    expect(people[1]!.chips).toEqual([])
    expect(people[1]!.actionLabel).toBe('진행 권한 부여')
    expect(people[1]!.actionEmphasis).toBe('primary')
    expect(people[1]!.canRemove).toBe(true)
  })

  // **권한을 다루는 것은 회의 생성자만 한다**(permissions.json의 meeting.own).
  it('생성자가 아니면 줄 단추가 오지 않는다', async () => {
    const people = (await draft('?meetingId=MTG-05', viewer('M-02', 'member')))
      .participants as Row[]
    expect(people.every((one) => !Object.hasOwn(one, 'actionLabel'))).toBe(true)
  })

  it('안건이 차례대로 오고 사전 자료 이름이 붙는다', async () => {
    const agenda = (await draft('?meetingId=MTG-05')).agendaItems as Row[]
    expect(agenda.map((one) => one.agendaTitle)).toEqual([
      '행사장 안전 점검 결과',
      '비상 연락망 및 담당자 확정',
    ])
    expect(agenda[0]!.agendaNote).toBe('점검표를 함께 봅니다.')
    expect(agenda[0]!.attachmentName).toBe('체육대회_안전점검표.pdf')
    expect(Object.hasOwn(agenda[1]!, 'attachmentName')).toBe(false)
  })

  // **울타리.** 남의 학생회의 회의는 없는 것과 같다.
  it('남의 학생회의 회의는 열리지 않는다', async () => {
    const res = await harness().request('/api/ops/meetings/draft?meetingId=MTG-99')
    expect(res.status).toBe(404)
  })
})

describe('참가자로 넣을 수 있는 사람', () => {
  const candidates = async (query = '') =>
    (await get(`/api/org/members${query}`)) as Array<{
      memberId: string
      name: string
      departmentNote: string
    }>

  it('내 학생회의 사람만 온다', async () => {
    expect((await candidates()).map((row) => row.name)).toEqual([
      '김민준',
      '박해랑',
      '이수현',
      '정하늘',
    ])
  })

  // 화면의 칸 이름이 '이름 또는 부서로 구성원 검색'이다. 둘 다 찾는다.
  it('이름으로도 부서로도 찾는다', async () => {
    expect((await candidates('?query=박해')).map((row) => row.name)).toEqual(['박해랑'])
    expect((await candidates('?query=운영부')).map((row) => row.name)).toEqual(['김민준', '박해랑'])
  })

  it('소속이 없으면 그 사실을 말한다', async () => {
    const found = await candidates('?query=정하늘')
    expect(found[0]!.departmentNote).toBe('부서 미배정')
  })
})

describe('회의를 걸 수 있는 행사', () => {
  it('내 학생회의 행사만 고를 수 있다', async () => {
    const found = (await get('/api/ops/events/linkable')) as Array<{
      value: string
      label: string
    }>
    expect(found.map((row) => row.label)).not.toContain('남의 행사')
    expect(found.find((row) => row.label === '가을 축제')!.value).toBe('E-03')
  })
})
