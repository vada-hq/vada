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
import { meetingLookups } from './lookups.ts'

// 회의 상세와 그 곁의 넷(OPS-MEET-03A·03B·03C · 05A · D01 · D02).
//
// 이 파일이 재는 것이 여섯이다.
//
// 1. **한 출처가 여러 단계를 답한다.** 명세가 단계마다 출처를 가르지 않았고,
//    가르면 화면이 '지금 어느 단계인가'를 알아야 한다. 그 단계에 없는 조각은
//    **빈 글로** 오고(칸이 미리 잡힌 자리라 화면이 값을 반드시 읽는다), 붙었다
//    떨어지는 조각만 **없이** 온다(`isCurrent`·`eventId`·줄 단추).
// 2. **완성된 글과 색을 준다.** '1시간 30분'·'진행 27분'·'초대 4명 · 진행 권한
//    2명'을 화면이 만들면 화면마다 다른 말이 나온다.
// 3. **판정이 막는 검사와 같은 곳에서 나온다.** canStart·canEnd는 권한(meeting.run)과
//    단계를 함께 보고, 그 둘이 시작·종료를 막는 그 검사다.
// 4. **보는 사람에 따라 통째로 달라진다.** 생성자·진행 권한자·일반 참가자·미참가자가
//    같은 회의에서 다른 띠와 다른 단추를 받는다.
// 5. **살펴 준 것은 서버만 안다.** 며칠 이른지도 미완료 안건이 몇인지도 그렇다.
// 6. **울타리가 선다.** 남의 학생회의 회의는 없는 것과 같다.

let db: Db
let close: () => Promise<void>
// 진행 중인 회의가 15:00에 시작해 27분이 지난 순간. 예정 회의(07.25)까지는 7일이다.
const NOW = new Date('2026-07-18T15:27:00+09:00')

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
      // **진짜 답을 준다.** '늘 참'으로 두면 진행 권한이 없는 사람이 받는 화면을
      // 아무도 못 보고, '늘 거짓'으로 두면 시작·종료가 아예 안 열린다.
      ...meetingLookups(db),
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

/** 만든 사람 박해랑(M-02). 그림이 그린 생성자다. */
const CREATOR = viewer('M-02', 'member')
/** 권한만 받은 진행 권한자 정하늘(M-03). */
const HOST = viewer('M-03', 'member')
/** 초대만 받은 사람 이수현(M-01). */
const GUEST = viewer('M-01', 'chair')
/** 아무 회의에도 없는 사람. 회장이어도 회의는 못 연다 — 조직 역할이 답하지 않는다. */
const OUTSIDER = viewer('M-05', 'chair')

const detail = async (meetingId: string, who: Viewer = GUEST) =>
  (await get(`/api/ops/meetings/${meetingId}`, who)) as Row

const agendas = async (meetingId: string, who: Viewer = GUEST) =>
  (await get(`/api/ops/meetings/${meetingId}/agendas`, who)) as Row[]

const people = async (meetingId: string, query = '', who: Viewer = GUEST) =>
  (await get(`/api/ops/meetings/${meetingId}/participants${query}`, who)) as Row[]

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
    { id: 'M-05', orgId: 'ORG-01', name: '이윤슬', role: 'chair', departmentId: 'D-01' },
    { id: 'M-99', orgId: 'ORG-02', name: '남의사람', role: 'chair', departmentId: 'D-99' },
  ])
  await db.insert(events).values([
    { id: 'E-01', orgId: 'ORG-01', title: '2026 소프트웨어융합대학 체육대회' },
    { id: 'E-99', orgId: 'ORG-02', title: '남의 행사' },
  ])

  await db.insert(meetings).values([
    // 예정 회의(03A·03B·03C·D01이 읽는다).
    {
      id: 'MTG-05',
      orgId: 'ORG-01',
      eventId: 'E-01',
      kind: 'event',
      title: '체육대회 안전 관리 최종 회의',
      purpose:
        '행사 전 안전 점검 결과를 공유하고 비상 연락망과 현장 안전 인력 배치를 최종 확정합니다.',
      status: 'scheduled',
      scheduledAt: new Date('2026-07-25T15:00:00+09:00'),
      plannedEndAt: new Date('2026-07-25T16:30:00+09:00'),
      place: '학생회실 (A204)',
      creatorMemberId: 'M-02',
      departmentId: 'D-02',
      updatedAt: new Date('2026-07-17T18:42:00+09:00'),
    },
    // 진행 중 회의(05A·05B·D02가 읽는다).
    {
      id: 'MTG-04',
      orgId: 'ORG-01',
      eventId: 'E-01',
      kind: 'event',
      title: '체육대회 운영 점검 회의',
      purpose: '행사 당일 운영 계획을 함께 확인합니다.',
      status: 'inProgress',
      minutesStatus: 'drafting',
      scheduledAt: new Date('2026-07-18T15:00:00+09:00'),
      startedAt: new Date('2026-07-18T15:00:00+09:00'),
      place: '학생회실 (A204)',
      creatorMemberId: 'M-02',
    },
    // 끝나서 정리 중인 회의. 실제 진행 시각과 참석 결과가 여기서 온다.
    {
      id: 'MTG-06',
      orgId: 'ORG-01',
      title: '신입생 환영 행사 기획회의',
      status: 'wrapUp',
      minutesStatus: 'drafting',
      scheduledAt: new Date('2026-07-15T16:00:00+09:00'),
      startedAt: new Date('2026-07-15T16:00:00+09:00'),
      endedAt: new Date('2026-07-15T17:18:00+09:00'),
      creatorMemberId: 'M-02',
    },
    // 오늘 잡힌 회의. **예정 시각에 시작하면 살펴 줄 것이 없다.**
    {
      id: 'MTG-10',
      orgId: 'ORG-01',
      title: '오늘 저녁 운영회의',
      status: 'scheduled',
      scheduledAt: new Date('2026-07-18T18:00:00+09:00'),
      creatorMemberId: 'M-02',
    },
    // 장소도 목적도 안 적힌 회의. 빈 글이 아니라 완성된 안내가 와야 한다.
    {
      id: 'MTG-11',
      orgId: 'ORG-01',
      title: '아직 덜 적은 회의',
      status: 'scheduled',
      creatorMemberId: 'M-02',
    },
    // 옆 학생회의 회의. 상세도 안건도 참가자도 열리면 안 된다.
    {
      id: 'MTG-99',
      orgId: 'ORG-02',
      title: '남의 회의',
      status: 'scheduled',
      creatorMemberId: 'M-99',
    },
  ])

  await db.insert(meetingParticipants).values([
    { id: 'MP-01', orgId: 'ORG-01', meetingId: 'MTG-05', memberId: 'M-02' },
    { id: 'MP-02', orgId: 'ORG-01', meetingId: 'MTG-05', memberId: 'M-03', isHost: true },
    { id: 'MP-03', orgId: 'ORG-01', meetingId: 'MTG-05', memberId: 'M-01' },
    { id: 'MP-04', orgId: 'ORG-01', meetingId: 'MTG-05', memberId: 'M-04' },
    // 진행 중 회의: 넷 중 셋이 들어와 있다.
    {
      id: 'MP-05',
      orgId: 'ORG-01',
      meetingId: 'MTG-04',
      memberId: 'M-02',
      attendance: 'present',
    },
    {
      id: 'MP-06',
      orgId: 'ORG-01',
      meetingId: 'MTG-04',
      memberId: 'M-03',
      isHost: true,
      attendance: 'present',
    },
    {
      id: 'MP-07',
      orgId: 'ORG-01',
      meetingId: 'MTG-04',
      memberId: 'M-01',
      attendance: 'present',
    },
    { id: 'MP-08', orgId: 'ORG-01', meetingId: 'MTG-04', memberId: 'M-04' },
    // 끝난 회의: 참석 셋, 불참 하나.
    {
      id: 'MP-09',
      orgId: 'ORG-01',
      meetingId: 'MTG-06',
      memberId: 'M-02',
      attendance: 'present',
    },
    {
      id: 'MP-10',
      orgId: 'ORG-01',
      meetingId: 'MTG-06',
      memberId: 'M-01',
      attendance: 'present',
    },
    {
      id: 'MP-11',
      orgId: 'ORG-01',
      meetingId: 'MTG-06',
      memberId: 'M-03',
      attendance: 'present',
    },
    {
      id: 'MP-12',
      orgId: 'ORG-01',
      meetingId: 'MTG-06',
      memberId: 'M-04',
      attendance: 'absent',
    },
  ])

  await db.insert(meetingAgendas).values([
    {
      id: 'AG-05-1',
      orgId: 'ORG-01',
      meetingId: 'MTG-05',
      sortOrder: 0,
      title: '행사장 안전 점검 결과',
      description: '점검표를 함께 봅니다.',
      plannedMinutes: 20,
    },
    {
      id: 'AG-05-2',
      orgId: 'ORG-01',
      meetingId: 'MTG-05',
      sortOrder: 1,
      title: '비상 연락망 및 담당자 확정',
      plannedMinutes: 15,
    },
    {
      id: 'AG-05-3',
      orgId: 'ORG-01',
      meetingId: 'MTG-05',
      sortOrder: 2,
      title: '행사 당일 안전 인력 배치',
      plannedMinutes: 25,
    },
    // 진행 중 회의의 안건 셋: 하나는 마쳤고 하나는 진행 중이며 하나는 대기다.
    {
      id: 'AG-04-1',
      orgId: 'ORG-01',
      meetingId: 'MTG-04',
      sortOrder: 0,
      title: '행사장 안전 점검 결과',
      plannedMinutes: 20,
      status: 'done',
      discussionText: '케이블 커버를 추가하기로 했습니다.',
      decisionText: '본부석 뒤편 전선 구간에 케이블 커버를 설치합니다.',
    },
    {
      id: 'AG-04-2',
      orgId: 'ORG-01',
      meetingId: 'MTG-04',
      sortOrder: 1,
      title: '비상 연락망 및 담당자 확정',
      description: '상황별 최초 연락 담당자와 보고 순서를 확정합니다.',
      plannedMinutes: 15,
      status: 'current',
      discussionText: '현장 담당자가 운영본부로 1차 연락합니다.',
    },
    {
      id: 'AG-04-3',
      orgId: 'ORG-01',
      meetingId: 'MTG-04',
      sortOrder: 2,
      title: '행사 당일 안전 인력 배치',
      plannedMinutes: 25,
    },
  ])

  await db.insert(documents).values([
    {
      id: 'DOC-01',
      orgId: 'ORG-01',
      meetingId: 'MTG-05',
      agendaId: 'AG-05-1',
      title: '체육대회_안전점검표.pdf',
    },
    {
      id: 'DOC-02',
      orgId: 'ORG-01',
      meetingId: 'MTG-05',
      agendaId: 'AG-05-2',
      title: '비상연락망_초안.xlsx',
    },
    { id: 'DOC-03', orgId: 'ORG-01', meetingId: 'MTG-05', title: '안전인력_배치초안.xlsx' },
  ])
}, 60_000)

afterAll(async () => {
  await close()
})

describe('회의 한 건이 완성된 글로 온다', () => {
  it('예정 회의가 그림이 그린 값을 그대로 낸다', async () => {
    const row = await detail('MTG-05')
    expect(row.title).toBe('체육대회 안전 관리 최종 회의')
    expect(row.description).toBe(
      '행사 전 안전 점검 결과를 공유하고 비상 연락망과 현장 안전 인력 배치를 최종 확정합니다.',
    )
    expect(row.status).toBe('예정')
    expect(row.statusTone).toBe('blue')
    expect(row.kindLabel).toBe('행사 관련 회의')
    expect(row.kindTone).toBe('gray')
    expect(row.eventTitle).toBe('2026 소프트웨어융합대학 체육대회')
    expect(row.eventId).toBe('E-01')
    // 이름과 소속을 이은 **한 줄**로 온다 — 화면이 이으면 잇는 방법이 명세의 일이 된다.
    expect(row.creatorNote).toBe('박해랑 · 운영부')
    expect(row.updatedNote).toBe('2026.07.17 18:42 수정')
    expect(row.scheduledAt).toBe('2026.07.25 15:00')
    expect(row.place).toBe('학생회실 (A204)')
  })

  // **세는 말과 재는 말까지 서버가 붙인다.**
  it('예상 시간과 세는 말이 완성된 채로 온다', async () => {
    const row = await detail('MTG-05')
    expect(row.plannedDurationNote).toBe('1시간 30분')
    expect(row.inviteeCountNote).toBe('4명')
    expect(row.agendaCountNote).toBe('총 3개 · 예상 60분')
    expect(row.materialCountNote).toBe('등록 자료 3개')
    // 만든 사람은 **기본 진행 권한자**다(ORG-04). 그래서 둘이다.
    expect(row.participantCountNote).toBe('초대 4명 · 진행 권한 2명')
  })

  // **정해지지 않은 것은 그 사실을 말로 준다.** 빈 글을 주면 화면이 빈 자리를 그린다.
  it('안 적힌 칸은 완성된 안내로 온다', async () => {
    const row = await detail('MTG-11', CREATOR)
    expect(row.place).toBe('미정')
    expect(row.scheduledAt).toBe('일시 미정')
    expect(row.description).toBe('회의 목적이 적히지 않았습니다')
    // **칸은 있는데 값이 없는 자리는 빈 글이다.** 없이 보내면 그 칸을 그리는 화면이
    // 그 자리에서 터진다 — 상세를 읽는 열한 장이 다 그렇다.
    expect(row.plannedDurationNote).toBe('')
    // 셀 수 있는 것은 빈 글이 아니라 센 값이다. 안건이 없으면 '총 0개'다.
    expect(row.agendaCountNote).toBe('총 0개')
    expect(row.materialCountNote).toBe('등록 자료 0개')
  })

  // **그 단계에 없는 조각은 비어서 온다.** 명세가 단계마다 출처를 가르지 않은 값이다.
  it('예정 회의에는 진행 중과 끝난 뒤의 조각이 비어 온다', async () => {
    const row = await detail('MTG-05')
    for (const key of [
      'startedAt',
      'elapsedNote',
      'presentNote',
      'actualTimeNote',
      'attendanceResultNote',
      'cancelReason',
    ]) {
      expect(row[key]).toBe('')
    }
  })

  // **셀 근거가 없는 것만 빈 글이다.** 0으로 채우면 없는 것처럼 보인다.
  it('셀 근거가 없는 자리는 수를 지어내지 않는다', async () => {
    const row = await detail('MTG-04')
    expect(row.closedByNote).toBe('')
    expect(row.followUpCountLabel).toBe('')
    expect(row.myFollowUpCountLabel).toBe('')
    // 결정은 안건 표가 갖고 있어 셀 수 있다 — MTG-04의 마친 안건 하나에 결정이 있다.
    expect(row.decisionCountNote).toBe('1건')
  })

  it('진행 중인 회의는 가만히 있어도 자라는 값을 준다', async () => {
    const row = await detail('MTG-04')
    expect(row.status).toBe('진행 중')
    expect(row.statusTone).toBe('green')
    expect(row.startedAt).toBe('15:00 시작')
    expect(row.elapsedNote).toBe('진행 27분')
    expect(row.presentNote).toBe('3명 참가 중')
    expect(row.inviteeCountNote).toBe('4명')
  })

  it('끝난 회의는 실제 진행 시각과 참석 결과를 준다', async () => {
    const row = await detail('MTG-06')
    expect(row.status).toBe('정리 중')
    expect(row.statusTone).toBe('yellow')
    expect(row.actualTimeNote).toBe('16:00–17:18')
    // 확인하지 않은 사람은 참석으로 세지 않는다 — '모름'과 '참석'은 다른 사실이다.
    expect(row.attendanceResultNote).toBe('3명 참석 · 1명 불참')
    expect(row.minutesStatus).toBe('작성 중')
    expect(row.minutesStatusTone).toBe('yellow')
  })

  // **울타리.** 남의 학생회의 회의는 없는 것과 같다.
  it('남의 학생회의 회의는 열리지 않는다', async () => {
    expect((await harness().request('/api/ops/meetings/MTG-99')).status).toBe(404)
    expect((await harness().request('/api/ops/meetings/MTG-99/agendas')).status).toBe(404)
    expect((await harness().request('/api/ops/meetings/MTG-99/participants')).status).toBe(404)
  })
})

describe('판정이 막는 검사와 같은 곳에서 나온다', () => {
  it('만든 사람은 넷을 다 할 수 있다', async () => {
    const row = await detail('MTG-05', CREATOR)
    expect(row.canStart).toBe(true)
    expect(row.canEdit).toBe(true)
    expect(row.canCancel).toBe(true)
    expect(row.canManageHostRole).toBe(true)
    // 아직 시작하지 않은 회의는 끝낼 수 없다.
    expect(row.canEnd).toBe(false)
  })

  // 03C가 가른 자리. **시작은 되고 고치는 것은 안 된다.**
  it('진행 권한만 받은 사람은 시작만 할 수 있다', async () => {
    const row = await detail('MTG-05', HOST)
    expect(row.canStart).toBe(true)
    expect(row.canEdit).toBe(false)
    expect(row.canCancel).toBe(false)
    expect(row.canManageHostRole).toBe(false)
  })

  it('초대만 받은 사람은 아무것도 못 한다', async () => {
    const row = await detail('MTG-05', GUEST)
    expect(row.canStart).toBe(false)
    expect(row.canEdit).toBe(false)
  })

  // **조직 역할이 답하지 않는다**(permissions.json의 meeting.run).
  it('회장이어도 그 회의의 진행 권한자가 아니면 못 연다', async () => {
    const row = await detail('MTG-05', OUTSIDER)
    expect(row.canStart).toBe(false)
    expect(row.canManageHostRole).toBe(false)
  })

  // **단계가 함께 정한다.** 권한만 보면 진행 중인 회의에 '회의 시작'이 그려지고,
  // 누르면 막힌다(그 자리가 409를 낸다).
  it('시작·종료는 단계가 함께 정한다', async () => {
    const live = await detail('MTG-04', CREATOR)
    expect(live.canStart).toBe(false)
    expect(live.canEnd).toBe(true)
    const ended = await detail('MTG-06', CREATOR)
    expect(ended.canStart).toBe(false)
    expect(ended.canEnd).toBe(false)
  })

  // **회의록은 그 회의의 참가자가 정리한다**(사람이 정함 2026-09-05, meeting.minutes).
  // 만든 사람과 진행 권한자도 참가자다. 초대받지 않은 사람은 회장이라도 아니다.
  it('회의록 정리 권한은 그 회의의 참가자에게 있다', async () => {
    expect((await detail('MTG-06', CREATOR)).canEditMinutes).toBe(true)
    expect((await detail('MTG-06', GUEST)).canEditMinutes).toBe(true)
    expect((await detail('MTG-06', OUTSIDER)).canEditMinutes).toBe(false)
  })

  // **취소는 예정에서만 간다**(D04가 03B 위에만 뜬다). 권한만 보면 진행 중인 회의에도
  // '회의 취소'가 그려지고, 누르면 막힌다(그 자리가 422를 낸다).
  it('취소는 단계가 함께 정한다', async () => {
    expect((await detail('MTG-04', CREATOR)).canCancel).toBe(false)
    expect((await detail('MTG-06', CREATOR)).canCancel).toBe(false)
  })
})

describe('보는 사람에 따라 띠가 달라진다', () => {
  it('만든 사람에게는 회의 생성자 화면이 온다', async () => {
    const row = await detail('MTG-05', CREATOR)
    expect(row.viewerTitle).toBe('회의 생성자 화면')
    expect(row.viewerNote).toBe('회의 수정·취소와 진행 권한 관리, 회의 시작을 할 수 있습니다.')
  })

  it('진행 권한자와 일반 참가자와 미참가자가 저마다 다른 자리를 받는다', async () => {
    expect((await detail('MTG-05', HOST)).viewerTitle).toBe('진행 권한자 화면')
    expect((await detail('MTG-05', GUEST)).viewerTitle).toBe('일반 참가자 화면')
    expect((await detail('MTG-05', OUTSIDER)).viewerTitle).toBe('미참가자 화면')
  })

  // 같은 자리라도 **단계가 바뀌면 할 수 있는 일이 바뀐다.**
  it('일반 참가자의 설명은 단계가 정한다', async () => {
    expect((await detail('MTG-05', GUEST)).viewerNote).toBe(
      '회의 정보를 확인할 수 있지만 회의를 시작하거나 설정을 변경할 수 없습니다.',
    )
    expect((await detail('MTG-04', GUEST)).viewerNote).toBe(
      '회의록을 함께 작성할 수 있지만 회의를 끝내거나 안건을 넘길 수 없습니다.',
    )
  })

  // **띠는 상태와 보는 사람 둘 다에 매인다.** 시작할 수 있는 사람에게는 며칠
  // 남았는지가 오고, 그럴 수 없는 사람에게는 무엇이 바뀌는지가 온다.
  it('시작할 수 있는 사람에게는 시작 전 확인이 온다', async () => {
    const row = await detail('MTG-05', CREATOR)
    expect(row.stateBannerTitle).toBe('시작 전 확인')
    expect(row.stateBannerNote).toBe(
      '현재 예정 시각까지 7일 남았습니다. 안건과 참가자를 확인한 뒤 회의를 시작하세요.',
    )
    // 그림이 이 자리만 흰 카드로 그렸다. 띠의 색표에 없는 이름이라 무채색으로 그려진다.
    expect(row.stateBannerTone).toBe('gray')
  })

  it('시작할 수 없는 사람에게는 아직 시작되지 않았다고 알린다', async () => {
    const row = await detail('MTG-05', GUEST)
    expect(row.stateBannerTitle).toBe('아직 회의가 시작되지 않았습니다')
    expect(row.stateBannerTone).toBe('blue')
  })

  // 오늘 잡힌 회의에는 셀 날이 없다. 남은 날만 빠지고 할 일은 그대로 온다.
  it('오늘 잡힌 회의에는 남은 날을 말하지 않는다', async () => {
    const row = await detail('MTG-10', CREATOR)
    expect(row.stateBannerNote).toBe('안건과 참가자를 확인한 뒤 회의를 시작하세요.')
  })

  it('보는 사람과 이 회의의 관계를 딱지로 말한다', async () => {
    expect((await detail('MTG-05', GUEST)).viewerChipLabel).toBe('예정 회의')
    expect((await detail('MTG-04', GUEST)).viewerChipLabel).toBe('참석 처리됨')
    expect((await detail('MTG-04', GUEST)).viewerChipTone).toBe('green')
  })
})

describe('안건이 단계마다 다른 것을 갖는다', () => {
  it('예정 회의의 안건은 차례와 예상 소요를 갖는다', async () => {
    const rows = await agendas('MTG-05')
    expect(rows.map((row) => row.orderLabel)).toEqual(['안건 1', '안건 2', '안건 3'])
    expect(rows.map((row) => row.title)).toEqual([
      '행사장 안전 점검 결과',
      '비상 연락망 및 담당자 확정',
      '행사 당일 안전 인력 배치',
    ])
    expect(rows[0]!.agendaId).toBe('AG-05-1')
    expect(rows[0]!.description).toBe('점검표를 함께 봅니다.')
    expect(rows[0]!.durationNote).toBe('20분')
    expect(rows[0]!.status).toBe('대기')
    // 적히지 않은 설명은 빈 글이다 — 그 칸을 그리는 화면이 값을 반드시 읽는다.
    expect(rows[1]!.description).toBe('')
    // 아직 아무것도 논의하지 않았다.
    expect(rows[0]!.discussionText).toBe('')
    // **붙었다 떨어지는 조각은 없이 온다.** 거짓을 실으면 화면이 빈 표시를 그린다.
    expect(Object.hasOwn(rows[0]!, 'isCurrent')).toBe(false)
    // 안건마다의 업무 수는 담을 열이 없어 **수를 지어내지 않는다.**
    expect(rows[0]!.taskCountNote).toBe('')
  })

  it('진행 중인 회의의 안건은 어느 것이 지금인지를 말한다', async () => {
    const rows = await agendas('MTG-04')
    expect(rows.map((row) => row.status)).toEqual(['논의 완료', '진행 중', '대기'])
    expect(rows.map((row) => row.statusTone)).toEqual(['gray', 'green', 'yellow'])
    // **없으면 오지 않는다.** 거짓을 실어 보내면 화면이 빈 표시를 그린다.
    expect(rows[1]!.isCurrent).toBe(true)
    expect(Object.hasOwn(rows[0]!, 'isCurrent')).toBe(false)
    // 지금 하고 있는 안건의 소요만 '예상'이 붙는다 — 그림이 그 자리만 그렇게 그렸다.
    expect(rows[1]!.durationNote).toBe('예상 15분')
    expect(rows[0]!.durationNote).toBe('20분')
  })

  it('논의와 결정은 적힌 것만 온다', async () => {
    const rows = await agendas('MTG-04')
    expect(rows[0]!.discussionText).toBe('케이블 커버를 추가하기로 했습니다.')
    expect(rows[0]!.decisionText).toBe('본부석 뒤편 전선 구간에 케이블 커버를 설치합니다.')
    expect(rows[0]!.decisionCountNote).toBe('결정 1')
    expect(rows[0]!.decisionEmptyNote).toBe('')
    expect(rows[1]!.decisionText).toBe('')
    // **없다는 말도 서버가 준다.** 무엇을 하라고 이르는 문장이라 조직의 것이다.
    expect(rows[1]!.decisionEmptyNote).toContain('아직 결정사항이 정리되지 않았습니다')
    expect(rows[2]!.decisionCountNote).toBe('결정 0')
  })
})

describe('회의의 사람들이 한 목록에서 온다', () => {
  it('만든 사람이 먼저 오고 딱지와 할 수 있는 일이 붙는다', async () => {
    const rows = await people('MTG-05')
    expect(rows.map((row) => row.name)).toEqual(['박해랑', '정하늘', '김민준', '이수현'])
    expect(rows[0]!.chips).toEqual([
      { label: '회의 생성자', tone: 'gray' },
      { label: '진행 권한', tone: 'blue' },
    ])
    expect(rows[0]!.capabilityNote).toBe('시작·종료 가능')
    expect(rows[1]!.chips).toEqual([{ label: '진행 권한', tone: 'blue' }])
    expect(rows[2]!.capabilityNote).toBe('일반 참가자')
  })

  // **조각이 둘 필요하다.** 03 계열은 소속만 그리고 04B는 그 자리를 이어 그린다.
  it('소속을 두 꼴로 준다', async () => {
    const rows = await people('MTG-05')
    expect(rows[0]!.department).toBe('운영부')
    expect(rows[0]!.departmentNote).toBe('운영부 · 회의 참가자')
    // 부서에 안 든 사람도 빈 글이 아니라 완성된 안내로 온다.
    expect(rows[1]!.department).toBe('부서 미배정')
  })

  it('참석 딱지는 회의가 시작된 뒤에만 온다', async () => {
    const before = await people('MTG-05')
    expect(before[0]!.attendanceLabel).toBe('')
    expect(before[0]!.attendanceTone).toBe('')

    const live = await people('MTG-04')
    const joined = live.find((row) => row.name === '이수현')!
    expect(joined.attendanceLabel).toBe('참가')
    expect(joined.attendanceTone).toBe('green')
    expect(joined.isPresent).toBe(true)
    const missing = live.find((row) => row.name === '김민준')!
    expect(missing.attendanceLabel).toBe('미참석')
    expect(missing.attendanceTone).toBe('gray')
    expect(Object.hasOwn(missing, 'isPresent')).toBe(false)
  })

  it('끝난 회의의 참석 결과는 다른 말로 온다', async () => {
    const rows = await people('MTG-06')
    expect(rows.find((row) => row.name === '이수현')!.attendanceLabel).toBe('참석')
    expect(rows.find((row) => row.name === '김민준')!.attendanceLabel).toBe('불참')
  })

  // **권한을 다루는 것은 회의 생성자만 한다**(permissions.json의 meeting.own).
  it('줄 단추는 만든 사람에게만 온다', async () => {
    const mine = await people('MTG-05', '', CREATOR)
    expect(Object.hasOwn(mine[0]!, 'actionLabel')).toBe(false)
    expect(mine[1]!.actionLabel).toBe('권한 해제')
    expect(mine[1]!.actionEmphasis).toBe('secondary')
    expect(mine[1]!.actionEnabled).toBe(true)
    expect(mine[2]!.actionLabel).toBe('진행 권한 부여')
    expect(mine[2]!.actionEmphasis).toBe('primary')

    const theirs = await people('MTG-05', '', HOST)
    expect(theirs.every((row) => !Object.hasOwn(row, 'actionLabel'))).toBe(true)
  })

  // 04B는 만든 사람을 위 칸에 따로 그린다. **거르는 것은 조회의 일이다.**
  it('빼 달라고 하면 만든 사람을 빼고 준다', async () => {
    const rows = await people('MTG-05', '?excludeHostOwner=true', CREATOR)
    expect(rows.map((row) => row.name)).toEqual(['정하늘', '김민준', '이수현'])
  })

  it('이름으로도 부서로도 찾는다', async () => {
    expect((await people('MTG-05', '?query=김민')).map((row) => row.name)).toEqual(['김민준'])
    expect((await people('MTG-05', '?query=운영부')).map((row) => row.name)).toEqual([
      '박해랑',
      '김민준',
    ])
  })
})

describe('시작과 종료 전에 살펴 준 것', () => {
  const confirm = async (path: string, who: Viewer = CREATOR) =>
    (await get(path, who)) as Row

  // **며칠 이른지는 서버만 안다.**
  it('예정보다 이르면 며칠 이른지를 말한다', async () => {
    const row = await confirm('/api/ops/meetings/MTG-05/start-confirm')
    expect(row.warningNote).toBe(
      '예정 시간보다 7일 이른 시각입니다. 잘못 시작한 것은 아닌지 확인해 주세요.',
    )
  })

  it('예정 시각에 시작하면 살펴볼 것이 없다', async () => {
    const row = await confirm('/api/ops/meetings/MTG-10/start-confirm')
    expect(Object.hasOwn(row, 'warningNote')).toBe(false)
  })

  // **막지는 않는다.** 미완료 안건이 남아도 종료 단추는 살아 있다 — 알려 줄 뿐이다.
  it('종료 전에 남은 것을 한 줄로 이어 준다', async () => {
    const row = await confirm('/api/ops/meetings/MTG-04/end-confirm')
    expect(row.warningNote).toBe('미완료 안건 1개 · 참석 3명 · 미참가 1명')
  })

  it('남의 학생회의 회의는 살펴 주지도 않는다', async () => {
    expect((await harness().request('/api/ops/meetings/MTG-99/start-confirm')).status).toBe(404)
    expect((await harness().request('/api/ops/meetings/MTG-99/end-confirm')).status).toBe(404)
  })
})
