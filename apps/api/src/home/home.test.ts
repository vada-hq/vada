import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp, type Deps } from '../app.ts'
import type { Db } from '../db/client.ts'
import { freshDb } from '../db/testing.ts'
import {
  departments,
  events,
  meetings,
  members,
  organizations,
  paymentDocuments,
  payments,
  purchaseRequests,
  students,
  surveyApplications,
  surveys,
  tasks,
  users,
} from '../db/schema.ts'
import { inMemoryAttempts } from '../idempotency.ts'
import { meetingLookups } from '../meetings/lookups.ts'
import type { Viewer } from '../permissions.ts'
import { inMemoryCounter } from '../public/rate-limit.ts'
import { hashToken } from '../public/tokens.ts'

// 홈(HOME-01K).
//
// **홈은 어느 영역도 아니다.** 행사도 회의도 업무도 아닌 그 전부의 요약이라, 세는
// 자리마다 표가 갈린다. 이 파일이 재는 것이 여섯이다.
//
// 1. **인사에 보는 사람의 이름이 들어간다.** 서버가 완성해서 준다.
// 2. **짚을 것이 없으면 짚지 않는다.** 브리핑 문장의 개수가 데이터에 달렸고,
//    없을 때는 인사도 '확인이 필요해요'라고 말하지 않는다.
// 3. **건수가 서로 다른 표에서 온다.**
// 4. **행사 카드의 준비율과 지연은 그 행사의 업무에서 나온다.**
// 5. **다가오는 일정은 캘린더와 같은 흐름이다** — 행사·회의·마감 셋을 모은다.
// 6. **조직 알림은 셀 수 있는 사실만 온다.** 없으면 그 줄이 아예 오지 않는다.

let db: Db
let close: () => Promise<void>

/** 2026.07.20은 월요일. 이번 주는 07.19(일)~07.25(토)다. */
const NOW = new Date('2026-07-20T10:00:00+09:00')

const VIEWER: Viewer = {
  userId: 'U-01',
  membership: {
    orgId: 'ORG-01',
    memberId: 'M-01',
    role: 'member',
    departmentId: 'D-01',
    inFinanceDepartment: false,
  },
}

/** 옆 학생회를 보는 사람. **담이 서는지는 저쪽에서 봐야 보인다.** */
const NEIGHBOUR: Viewer = {
  userId: 'U-02',
  membership: {
    orgId: 'ORG-02',
    memberId: 'M-99',
    role: 'chair',
    departmentId: null,
    inFinanceDepartment: false,
  },
}

function harness(who: Viewer = VIEWER) {
  const deps: Deps = {
    audit: { async write() {} },
    db,
    who: async () => who,
    lookups: {
      isEventStaff: async () => false,
      isEventStaffManager: async () => false,
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

const one = async (path: string, who: Viewer = VIEWER) =>
  (await (await harness(who).request(path)).json()) as Row
const many = async (path: string, who: Viewer = VIEWER) =>
  (await (await harness(who).request(path)).json()) as Row[]

beforeAll(async () => {
  const fresh = await freshDb()
  db = fresh.db as unknown as Db
  close = fresh.close

  await db.insert(organizations).values([
    { id: 'ORG-01', name: '제12대 학생회' },
    { id: 'ORG-02', name: '옆 학생회' },
  ])
  await db.insert(departments).values([{ id: 'D-01', orgId: 'ORG-01', name: '기획부' }])
  await db.insert(users).values([
    { id: 'U-01', email: 'maru@example.ac.kr' },
    { id: 'U-02', email: 'other@example.ac.kr' },
  ])
  await db.insert(members).values([
    {
      id: 'M-01',
      orgId: 'ORG-01',
      // 개발용 응답과 다른 이름이다 — 서버를 거친 증거가 된다.
      name: '한마루',
      role: 'member',
      departmentId: 'D-01',
      userId: 'U-01',
    },
    { id: 'M-99', orgId: 'ORG-02', name: '남의사람', role: 'chair', userId: 'U-02' },
  ])

  await db.insert(events).values([
    {
      id: 'E-01',
      orgId: 'ORG-01',
      title: '체육대회',
      status: 'inProgress',
      startAt: new Date('2026-07-31T10:00:00+09:00'),
      place: 'ERICA 체육관',
      hostDepartmentId: 'D-01',
    },
    // 행사명 하나로 만들어진 행사. **정해지지 않은 것은 그 사실을 말로 준다.**
    { id: 'E-02', orgId: 'ORG-01', title: '신입생 환영회', status: 'planning' },
    // 끝난 행사는 '진행 중이거나 예정된' 것이 아니다.
    {
      id: 'E-03',
      orgId: 'ORG-01',
      title: '지난 행사',
      status: 'done',
      startAt: new Date('2026-07-03T10:00:00+09:00'),
    },
    {
      id: 'E-04',
      orgId: 'ORG-01',
      title: '행사장 사전 답사',
      status: 'inProgress',
      startAt: new Date('2026-07-25T09:00:00+09:00'),
    },
    {
      id: 'E-99',
      orgId: 'ORG-02',
      title: '남의 행사',
      status: 'inProgress',
      startAt: new Date('2026-07-22T10:00:00+09:00'),
    },
  ])

  await db.insert(meetings).values([
    {
      id: 'MTG-A',
      orgId: 'ORG-01',
      title: '정기 운영회의',
      status: 'scheduled',
      scheduledAt: new Date('2026-07-22T18:00:00+09:00'),
    },
    {
      id: 'MTG-B',
      orgId: 'ORG-01',
      eventId: 'E-01',
      kind: 'event',
      title: '체육대회 준비 회의',
      status: 'scheduled',
      scheduledAt: new Date('2026-07-23T14:00:00+09:00'),
    },
  ])

  await db.insert(tasks).values([
    {
      id: 'T-01',
      orgId: 'ORG-01',
      eventId: 'E-01',
      title: '체육대회 참가 신청 마감',
      status: 'inProgress',
      dueDate: new Date('2026-07-20T18:00:00+09:00'),
      assigneeMemberId: 'M-01',
    },
    {
      id: 'T-02',
      orgId: 'ORG-01',
      title: '주간 운영회의 자료 준비',
      status: 'planned',
      dueDate: new Date('2026-07-21T18:00:00+09:00'),
    },
    { id: 'T-03', orgId: 'ORG-01', title: '끝난 업무', status: 'done', assigneeMemberId: 'M-01' },
    {
      id: 'T-04',
      orgId: 'ORG-01',
      title: '다음 달 예산안 초안',
      status: 'planned',
      dueDate: new Date('2026-08-03T18:00:00+09:00'),
    },
    // 기한이 지났고 아직 안 끝났다 — 이것이 '지연'이다.
    {
      id: 'T-05',
      orgId: 'ORG-01',
      eventId: 'E-01',
      title: '현수막 시안',
      status: 'inProgress',
      dueDate: new Date('2026-07-18T18:00:00+09:00'),
      assigneeMemberId: 'M-01',
    },
    // 끝난 업무는 담당자가 없어도 배정할 일이 없다.
    { id: 'T-06', orgId: 'ORG-01', eventId: 'E-01', title: '포스터 인쇄', status: 'done' },
    { id: 'T-99', orgId: 'ORG-02', title: '남의 업무', status: 'inProgress', assigneeMemberId: 'M-99' },
  ])

  // 증빙 — 붙어야 하는데 안 붙은 서류가 '누락'이다(`registeredAt`이 비어 있다).
  await db.insert(purchaseRequests).values([
    { id: 'PR-01', orgId: 'ORG-01', title: '현수막 제작', stage: 'proof' },
    { id: 'PR-99', orgId: 'ORG-02', title: '남의 요청', stage: 'proof' },
  ])
  await db.insert(payments).values([
    { id: 'PAY-01', orgId: 'ORG-01', requestId: 'PR-01', vendor: '인쇄소', paidAmount: 120_000 },
    { id: 'PAY-99', orgId: 'ORG-02', requestId: 'PR-99', vendor: '남의 업체', paidAmount: 1_000 },
  ])
  await db.insert(paymentDocuments).values([
    { id: 'PD-01', orgId: 'ORG-01', paymentId: 'PAY-01', label: '영수증' },
    {
      id: 'PD-02',
      orgId: 'ORG-01',
      paymentId: 'PAY-01',
      label: '거래명세서',
      registeredAt: NOW,
    },
    { id: 'PD-03', orgId: 'ORG-01', paymentId: 'PAY-01', label: '견적서' },
    // 옆 학생회의 것은 붙어 있다 — 저쪽 홈에는 알림이 없어야 한다.
    { id: 'PD-99', orgId: 'ORG-02', paymentId: 'PAY-99', label: '영수증', registeredAt: NOW },
  ])

  // 명단 — 신청자가 학생 명단에 없거나 학번·이름이 어긋나면 확인이 필요하다.
  await db.insert(students).values([
    { id: 'S-01', orgId: 'ORG-01', name: '최바람', studentNumber: '2021567890' },
    { id: 'S-99', orgId: 'ORG-02', name: '남의학생', studentNumber: '2020000000' },
  ])
  await db.insert(surveys).values([
    { id: 'SV-01', orgId: 'ORG-01', eventId: 'E-01', linkToken: 'L'.repeat(22) },
    { id: 'SV-99', orgId: 'ORG-02', eventId: 'E-99', linkToken: 'M'.repeat(22) },
  ])
  await db.insert(surveyApplications).values([
    {
      id: 'SA-01',
      surveyId: 'SV-01',
      name: '최바람',
      studentNumber: '2021567890',
      receiptHash: hashToken('A'.repeat(22)),
      receiptExpiresAt: new Date('2026-10-01T00:00:00+09:00'),
      privacyConsentAt: NOW,
    },
    // 명단에 없는 학번이다.
    {
      id: 'SA-02',
      surveyId: 'SV-01',
      name: '홍길동',
      studentNumber: '2099999999',
      receiptHash: hashToken('B'.repeat(22)),
      receiptExpiresAt: new Date('2026-10-01T00:00:00+09:00'),
      privacyConsentAt: NOW,
    },
    {
      id: 'SA-99',
      surveyId: 'SV-99',
      name: '남의학생',
      studentNumber: '2020000000',
      receiptHash: hashToken('C'.repeat(22)),
      receiptExpiresAt: new Date('2026-10-01T00:00:00+09:00'),
      privacyConsentAt: NOW,
    },
  ])
}, 60_000)

afterAll(async () => {
  await close()
})

describe('브리핑이 보는 사람의 이름을 들고 짚을 것만 짚는다', () => {
  it('인사에 이름이 들어간다', async () => {
    expect(await one('/api/home/briefing')).toEqual({ title: '한마루님, 확인이 필요해요' })
  })

  it('짚는 문장이 지연과 미배정에서 온다', async () => {
    expect(await many('/api/home/briefing/notices')).toEqual([
      { message: '지연된 업무가 1건 있습니다.' },
      { message: '담당자가 없는 업무가 2건 있습니다.' },
    ])
  })

  // **짚을 것이 없으면 빈 목록이다**(명세가 그렇게 적었다). 그때 인사가 '확인이
  // 필요해요'라고 말하면 화면이 없는 일을 알린다.
  it('짚을 것이 없으면 인사도 그렇게 말한다', async () => {
    expect(await many('/api/home/briefing/notices', NEIGHBOUR)).toEqual([])
    expect(await one('/api/home/briefing', NEIGHBOUR)).toEqual({
      title: '남의사람님, 지금은 확인할 내용이 없어요',
    })
  })
})

describe('머리의 건수가 여러 표를 가로질러 온다', () => {
  it('진행 중·예정 행사와 이번 주 일정을 서버가 센다', async () => {
    expect(await one('/api/home/event-counts')).toEqual({
      activeEvents: 2,
      upcomingEvents: 1,
      // 07.19~07.25에 걸린 마감 둘·회의 둘·행사 하나.
      weeklySchedules: 5,
    })
  })
})

describe('행사 카드가 그 행사의 업무에서 준비율과 지연을 얻는다', () => {
  it('진행 중이거나 예정된 행사만 이른 차례로 온다', async () => {
    const rows = await many('/api/home/events')
    expect(rows.map((row) => row.title)).toEqual(['행사장 사전 답사', '체육대회', '신입생 환영회'])
  })

  it('준비율은 그 행사의 업무가 얼마나 끝났는가다', async () => {
    const rows = await many('/api/home/events')
    expect(rows.find((row) => row.title === '체육대회')).toEqual({
      status: '진행 중',
      title: '체육대회',
      date: '2026-07-31',
      place: 'ERICA 체육관',
      team: '기획부',
      // 셋 중 하나가 끝났다(T-01·T-05·T-06).
      progressPercent: 33,
      delayedTaskCount: 1,
    })
  })

  // **정해지지 않은 것은 그 사실을 말로 준다.** 빈 글을 주면 화면이 그 자리에
  // 무엇이든 그린다.
  it('일시·장소·부서가 없으면 미정이라고 말하고 지연은 오지 않는다', async () => {
    const rows = await many('/api/home/events')
    expect(rows.find((row) => row.title === '신입생 환영회')).toEqual({
      status: '기획 중',
      title: '신입생 환영회',
      date: '미정',
      place: '미정',
      team: '미정',
      progressPercent: 0,
    })
  })
})

describe('다가오는 일정이 캘린더와 같은 흐름에서 온다', () => {
  it('오늘부터의 행사·회의·마감이 날짜 차례로 온다', async () => {
    expect(await many('/api/home/schedules')).toEqual([
      { date: '07.20', title: '체육대회 참가 신청 마감', badge: '마감' },
      { date: '07.21', title: '주간 운영회의 자료 준비', badge: '마감' },
      { date: '07.22', title: '정기 운영회의', badge: '회의' },
      { date: '07.23', title: '체육대회 준비 회의', badge: '회의' },
      { date: '07.25', title: '행사장 사전 답사', badge: '행사' },
      { date: '07.31', title: '체육대회', badge: '행사' },
      { date: '08.03', title: '다음 달 예산안 초안', badge: '마감' },
    ])
  })
})

describe('조직 알림이 셀 수 있는 사실만 든다', () => {
  it('증빙 누락과 명단 확인이 각자의 표에서 온다', async () => {
    expect(await many('/api/home/org-alerts')).toEqual([
      { kind: 'document', label: '증빙 서류 누락', count: 2 },
      { kind: 'members', label: '참가자 명단 확인 필요', count: 1 },
    ])
  })

  // **없는 것은 0건으로 그리지 않는다.** '확인이 필요한 항목'에 0이 오면 그것은
  // 확인할 것이 있다는 말이 된다.
  it('셀 것이 없으면 그 줄이 아예 오지 않는다', async () => {
    expect(await many('/api/home/org-alerts', NEIGHBOUR)).toEqual([])
  })
})
