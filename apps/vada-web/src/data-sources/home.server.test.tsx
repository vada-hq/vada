import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { createApp } from '../../../api/src/app.ts'
import { freshDb } from '../../../api/src/db/testing.ts'
import { inMemoryCounter } from '../../../api/src/public/rate-limit.ts'
import { inMemoryAttempts } from '../../../api/src/idempotency.ts'
import { meetingLookups } from '../../../api/src/meetings/lookups.ts'
import { hashToken } from '../../../api/src/public/tokens.ts'
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
} from '../../../api/src/db/schema.ts'
import { ScreenRouter } from '../screens/ScreenRouter'
import { readListSource, readObjectSource } from './catalog'
import { loadSources, useServer } from './server'

// **홈(HOME-01K)의 여섯 자리가 서버에 붙었다.**
//
// 이 화면은 사람이 로그인하면 가장 먼저 보는 자리인데 일곱을 읽는 동안 하나도
// 지어지지 않아 여섯 칸이 '아직 준비 중'으로 그려졌다. 실제로 사람이 그것을 보고
// 물었다.
//
// 재는 것 다섯:
//
// 1. **인사에 보는 사람의 이름이 들어간다.** 개발용 응답은 늘 '박해랑님'이었다.
// 2. **브리핑이 짚는 문장의 개수가 데이터에 달렸다.**
// 3. **행사 카드의 준비율과 지연이 그 행사의 업무에서 나온다.**
// 4. **다가오는 일정은 캘린더와 같은 흐름이다** — 행사·회의·마감 셋을 모은다.
// 5. **예산 자리는 그대로 가려져 있다.** `home.financeSummary`는 예산을 정하는
//    화면이 명세에 없어 붙지 않았고, 그 자리만 `Built`가 가린다 — 화면이 통째로
//    닫히지 않는다는 것이 이 회차에서 확인해야 하는 것이다.

/** 2026.07.20은 월요일. 이번 주는 07.19(일)~07.25(토)다. */
const NOW = new Date('2026-07-20T10:00:00+09:00')

let restore: () => void
let close: () => Promise<void>

const drawn = () => document.body.textContent ?? ''

beforeAll(async () => {
  const fresh = await freshDb()
  close = fresh.close

  await fresh.db.insert(organizations).values([
    { id: 'ORG-01', name: '제12대 학생회' },
    // **옆 학생회를 하나 더 둔다.** 세는 자리마다 담이 서는지 봐야 한다.
    { id: 'ORG-02', name: '옆 학생회' },
  ])
  await fresh.db.insert(departments).values([{ id: 'D-01', orgId: 'ORG-01', name: '기획부' }])
  await fresh.db.insert(users).values({ id: 'U-01', email: 'maru@example.ac.kr' })
  await fresh.db.insert(members).values([
    {
      id: 'M-01',
      orgId: 'ORG-01',
      // 개발용 응답과 다른 이름이다 — 서버를 거친 증거가 된다.
      name: '한마루',
      role: 'member',
      departmentId: 'D-01',
      userId: 'U-01',
    },
    { id: 'M-99', orgId: 'ORG-02', name: '남의사람', role: 'chair' },
  ])

  await fresh.db.insert(events).values([
    {
      id: 'E-01',
      orgId: 'ORG-01',
      title: '가을 체육대회',
      status: 'inProgress',
      startAt: new Date('2026-07-31T10:00:00+09:00'),
      place: 'ERICA 체육관',
      hostDepartmentId: 'D-01',
    },
    // 행사명 하나로 만들어진 행사. 나머지는 나중에 채운다.
    { id: 'E-02', orgId: 'ORG-01', title: '신입생 환영회', status: 'planning' },
    { id: 'E-99', orgId: 'ORG-02', title: '남의 행사', status: 'inProgress' },
  ])

  await fresh.db.insert(meetings).values([
    {
      id: 'MTG-A',
      orgId: 'ORG-01',
      title: '주간 운영회의',
      status: 'scheduled',
      scheduledAt: new Date('2026-07-22T18:00:00+09:00'),
    },
  ])

  await fresh.db.insert(tasks).values([
    {
      id: 'T-01',
      orgId: 'ORG-01',
      eventId: 'E-01',
      title: '체육대회 물품 대여 확정',
      status: 'inProgress',
      dueDate: new Date('2026-07-21T18:00:00+09:00'),
      assigneeMemberId: 'M-01',
    },
    // 기한이 지났고 아직 안 끝났다 — 이것이 '지연'이다.
    {
      id: 'T-02',
      orgId: 'ORG-01',
      eventId: 'E-01',
      title: '현수막 시안 확정',
      status: 'inProgress',
      dueDate: new Date('2026-07-17T18:00:00+09:00'),
      assigneeMemberId: 'M-01',
    },
    { id: 'T-03', orgId: 'ORG-01', eventId: 'E-01', title: '포스터 인쇄', status: 'done' },
    // 담당자가 없는 상시 업무. 배정해야 하는 것이 브리핑에 짚인다.
    {
      id: 'T-04',
      orgId: 'ORG-01',
      title: '학생 건의함 확인',
      status: 'planned',
      dueDate: new Date('2026-07-23T18:00:00+09:00'),
    },
    // 기한도 담당자도 없는 상시 업무. 배정은 짚이되 일정에는 걸리지 않는다.
    { id: 'T-05', orgId: 'ORG-01', title: '동아리방 정리 당번 배정', status: 'planned' },
    { id: 'T-99', orgId: 'ORG-02', title: '남의 업무', status: 'inProgress' },
  ])

  // 증빙 — 붙어야 하는데 안 붙은 서류가 '누락'이다.
  await fresh.db
    .insert(purchaseRequests)
    .values({ id: 'PR-01', orgId: 'ORG-01', title: '현수막 제작', stage: 'proof' })
  await fresh.db
    .insert(payments)
    .values({ id: 'PAY-01', orgId: 'ORG-01', requestId: 'PR-01', vendor: '인쇄소', paidAmount: 120_000 })
  await fresh.db.insert(paymentDocuments).values([
    { id: 'PD-01', orgId: 'ORG-01', paymentId: 'PAY-01', label: '영수증' },
    { id: 'PD-02', orgId: 'ORG-01', paymentId: 'PAY-01', label: '거래명세서', registeredAt: NOW },
  ])

  // 명단 — 학생 명단에서 찾지 못한 신청자가 확인 대상이다.
  await fresh.db
    .insert(students)
    .values({ id: 'S-01', orgId: 'ORG-01', name: '최바람', studentNumber: '2021567890' })
  await fresh.db
    .insert(surveys)
    .values({ id: 'SV-01', orgId: 'ORG-01', eventId: 'E-01', linkToken: 'L'.repeat(22) })
  await fresh.db.insert(surveyApplications).values([
    {
      id: 'SA-01',
      surveyId: 'SV-01',
      name: '최바람',
      studentNumber: '2021567890',
      receiptHash: hashToken('A'.repeat(22)),
      receiptExpiresAt: new Date('2026-10-01T00:00:00+09:00'),
      privacyConsentAt: NOW,
    },
    {
      id: 'SA-02',
      surveyId: 'SV-01',
      name: '홍길동',
      studentNumber: '2099999999',
      receiptHash: hashToken('B'.repeat(22)),
      receiptExpiresAt: new Date('2026-10-01T00:00:00+09:00'),
      privacyConsentAt: NOW,
    },
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
        departmentId: 'D-01',
        inFinanceDepartment: false,
      },
    }),
    lookups: {
      isEventStaff: async () => false,
      isEventStaffManager: async () => false,
      ...meetingLookups(fresh.db as never),
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

describe('홈이 저장소에서 온다(HOME-01K)', () => {
  it('여섯 자리가 그려지고 예산 자리만 가려진다', async () => {
    render(<ScreenRouter screenId="HOME-01K" scopes={{}} onChangeScope={() => {}} onNavigate={() => {}} />)
    await waitFor(() =>
      expect(screen.getByText('한마루님, 확인이 필요해요')).toBeInTheDocument(),
    )
    const page = drawn()
    // **화면이 통째로 닫히지 않는다.** 자리마다 두른 `Built`가 하는 일이다.
    expect(page).not.toContain('이 화면은 아직 준비 중입니다.')
    expect(page).toContain('가을 체육대회')
    expect(page).toContain('주간 운영회의')
    expect(page).toContain('증빙 서류 누락')
    // **아직 안 지은 자리 하나만 가린다.** 예산을 정하는 화면이 명세에 없다.
    expect(screen.getByText('전체 재정 요약')).toBeInTheDocument()
    expect(page).toContain('아직 준비 중입니다')
    // 개발용 응답의 값이 아니라는 증거다.
    expect(page).not.toContain('박해랑님')
    expect(page).not.toContain('2026 소프트웨어융합대학 체육대회')
    expect(page).not.toContain('남의')
  })

  // **짚을 것이 없으면 빈 목록이다.** 개수가 데이터에 달렸으므로 서버가 센다.
  it('브리핑이 지연과 미배정을 짚는다', async () => {
    await loadSources([
      { key: 'home.briefing', params: {} },
      { key: 'home.briefingNotices', params: {} },
    ])
    expect(readObjectSource('home.briefing')).toEqual({ title: '한마루님, 확인이 필요해요' })
    expect(readListSource('home.briefingNotices')).toEqual([
      { message: '지연된 업무가 1건 있습니다.' },
      { message: '담당자가 없는 업무가 2건 있습니다.' },
    ])
  })

  it('머리의 건수가 행사 단계와 이번 주 일정에서 온다', async () => {
    await loadSources([{ key: 'home.eventCounts', params: {} }])
    expect(readObjectSource('home.eventCounts')).toEqual({
      activeEvents: 1,
      upcomingEvents: 1,
      // 07.19~07.25에 걸린 마감 둘과 회의 하나. 지난주 마감(T-02)도 다음 달
      // 행사(E-01)도 이번 주가 아니다.
      weeklySchedules: 3,
    })
  })

  // **준비율과 지연은 그 행사의 업무에서 나온다.** 개발용 응답은 62%를 그냥 적어
  // 두면 됐다.
  it('행사 카드가 그 행사의 업무를 센다', async () => {
    await loadSources([{ key: 'home.events', params: {} }])
    const rows = readListSource('home.events')
    expect(rows).toEqual([
      {
        status: '진행 중',
        title: '가을 체육대회',
        date: '2026-07-31',
        place: 'ERICA 체육관',
        team: '기획부',
        // 셋 중 하나가 끝났다.
        progressPercent: 33,
        delayedTaskCount: 1,
      },
      {
        status: '기획 중',
        title: '신입생 환영회',
        // **정해지지 않은 것은 그 사실을 말로 준다.**
        date: '미정',
        place: '미정',
        team: '미정',
        progressPercent: 0,
      },
    ])
  })

  // **캘린더와 같은 흐름이다** — 곁의 단추가 OPS-CAL-01로 간다.
  it('다가오는 일정이 행사·회의·마감을 함께 든다', async () => {
    await loadSources([{ key: 'home.schedules', params: {} }])
    expect(readListSource('home.schedules')).toEqual([
      { date: '07.21', title: '체육대회 물품 대여 확정', badge: '마감' },
      { date: '07.22', title: '주간 운영회의', badge: '회의' },
      { date: '07.23', title: '학생 건의함 확인', badge: '마감' },
      { date: '07.31', title: '가을 체육대회', badge: '행사' },
    ])
  })

  it('조직 알림이 증빙과 명단에서 온다', async () => {
    await loadSources([{ key: 'home.orgAlerts', params: {} }])
    expect(readListSource('home.orgAlerts')).toEqual([
      { kind: 'document', label: '증빙 서류 누락', count: 1 },
      { kind: 'members', label: '참가자 명단 확인 필요', count: 1 },
    ])
  })
})
