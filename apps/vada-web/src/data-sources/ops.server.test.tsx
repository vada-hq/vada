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
  meetings,
  members,
  organizations,
  tasks,
  users,
} from '../../../api/src/db/schema.ts'
import { ScreenRouter } from '../screens/ScreenRouter'
import { readListSource, readObjectSource } from './catalog'
import { loadSources, useServer } from './server'

// **운영 공간 둘이 서버에 붙었다**(OPS-00 · OPS-CAL-01).
//
// 이 둘이 읽는 것은 회의의 것이 아니다 — 업무·회의·행사·마감을 **가로질러** 센다.
// 그래서 서버 쪽도 `handlers/ops.ts`가 답하고, 여기서 그 자리를 잰다.
//
// 재는 것 여섯:
//
// 1. **안내 문장에 보는 사람의 이름이 들어간다.** 개발용 응답은 늘 '박해랑님'이었고
//    그것이 정말 저장소에서 오는지는 아무도 재 보지 않았다.
// 2. **네 공간의 건수가 서로 다른 표에서 온다.**
// 3. **'상시 업무'는 행사에 안 걸린 업무다.** 행사 업무를 함께 세면 두 공간이 같은
//    수를 그린다.
// 4. **'마감'은 완료되지 않은 업무의 기한이다**(OPS-CAL-01이 그 규칙을 적었다).
// 5. **달력은 원본이 아니라 비친 것이다.** 격자에 그려지는 것은 행사의 일시·회의의
//    일시·업무의 기한이고, 셋이 각자 다른 표에서 온다.
// 6. **어느 달인지도 오늘이 언제인지도 서버만 안다.** 화면이 넘길 값이 없다.

/** 2026.07.20은 월요일. 이번 주는 07.19(일)~07.25(토)다. */
const NOW = new Date('2026-07-20T10:00:00+09:00')

let app: ReturnType<typeof createApp>
let restore: () => void
let close: () => Promise<void>

beforeAll(async () => {
  const fresh = await freshDb()
  close = fresh.close

  await fresh.db.insert(organizations).values([
    { id: 'ORG-01', name: '제12대 학생회' },
    // **옆 학생회를 하나 더 둔다.** 세는 자리마다 담이 서는지 봐야 한다.
    { id: 'ORG-02', name: '옆 학생회' },
  ])
  await fresh.db.insert(departments).values([{ id: 'D-02', orgId: 'ORG-01', name: '운영부' }])
  await fresh.db.insert(users).values({ id: 'U-01', email: 'haerang@example.ac.kr' })
  await fresh.db.insert(members).values([
    {
      id: 'M-02',
      orgId: 'ORG-01',
      // 개발용 응답과 다른 이름이다 — 서버를 거친 증거가 된다.
      name: '한마루',
      role: 'member',
      departmentId: 'D-02',
      userId: 'U-01',
    },
    { id: 'M-99', orgId: 'ORG-02', name: '남의사람', role: 'chair' },
  ])

  await fresh.db.insert(events).values([
    // 일시가 잡힌 행사만 달력에 걸릴 날이 있다.
    {
      id: 'E-01',
      orgId: 'ORG-01',
      title: '체육대회',
      status: 'inProgress',
      startAt: new Date('2026-07-24T10:00:00+09:00'),
    },
    { id: 'E-02', orgId: 'ORG-01', title: '신입생 환영회', status: 'planning' },
    { id: 'E-03', orgId: 'ORG-01', title: '지난 행사', status: 'done' },
    { id: 'E-99', orgId: 'ORG-02', title: '남의 행사', status: 'inProgress' },
  ])
  await fresh.db.insert(meetings).values([
    {
      id: 'MTG-A',
      orgId: 'ORG-01',
      title: '오늘 운영회의',
      status: 'scheduled',
      scheduledAt: new Date('2026-07-20T18:00:00+09:00'),
    },
    {
      id: 'MTG-B',
      orgId: 'ORG-01',
      title: '내일 회의',
      status: 'scheduled',
      scheduledAt: new Date('2026-07-21T18:00:00+09:00'),
    },
    { id: 'MTG-C', orgId: 'ORG-01', title: '정리 중인 회의', status: 'wrapUp' },
    { id: 'MTG-99', orgId: 'ORG-02', title: '남의 회의', status: 'wrapUp' },
  ])
  await fresh.db.insert(tasks).values([
    {
      id: 'T-01',
      orgId: 'ORG-01',
      title: '학생 건의함 확인',
      status: 'inProgress',
      dueDate: new Date('2026-07-22T18:00:00+09:00'),
    },
    { id: 'T-02', orgId: 'ORG-01', title: '회계 장부 주간 정리', status: 'review' },
    // 행사 업무. **상시 업무로 세면 안 되지만 마감으로는 센다.**
    {
      id: 'T-03',
      orgId: 'ORG-01',
      eventId: 'E-01',
      title: '현수막 디자인 수정 반영',
      status: 'inProgress',
      dueDate: new Date('2026-07-23T18:00:00+09:00'),
    },
    // 끝난 업무의 기한은 마감이 아니다.
    {
      id: 'T-04',
      orgId: 'ORG-01',
      title: '끝난 업무',
      status: 'done',
      dueDate: new Date('2026-07-24T18:00:00+09:00'),
    },
    {
      id: 'T-05',
      orgId: 'ORG-01',
      title: '다음 달 예산안 초안',
      status: 'planned',
      dueDate: new Date('2026-08-03T18:00:00+09:00'),
    },
    { id: 'T-99', orgId: 'ORG-02', title: '남의 업무', status: 'inProgress' },
  ])

  app = createApp({
    audit: { async write() {} },
    db: fresh.db as never,
    who: async () => ({
      userId: 'U-01',
      membership: {
        orgId: 'ORG-01',
        memberId: 'M-02',
        role: 'member',
        departmentId: 'D-02',
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

describe('운영 허브가 저장소에서 온다', () => {
  it('OPS-00이 안내 문장과 네 공간의 건수를 그린다', async () => {
    render(<ScreenRouter screenId="OPS-00" scopes={{}} onChangeScope={() => {}} onNavigate={() => {}} />)
    await waitFor(() => expect(screen.getByText('운영 메뉴')).toBeInTheDocument())
    const drawn = document.body.textContent ?? ''
    expect(drawn).not.toContain('이 화면은 아직 준비 중입니다.')
    // **보는 사람의 이름이 서버에서 온다.** 개발용 응답의 이름이 아니라는 증거다.
    expect(drawn).toContain('한마루님이 확인할 업무·회의·행사·일정을 선택하세요.')
    expect(drawn).not.toContain('박해랑님이 확인할')
  })

  // **네 공간이 서로 다른 표를 센다.** 개발용 응답은 여덟 수를 그냥 적어 두면 됐다.
  it('공간마다의 건수를 서버가 센다', async () => {
    await loadSources([{ key: 'ops.spaceStats', params: {} }])
    expect(readObjectSource('ops.spaceStats')).toEqual({
      // 상시 업무만 센다 — 행사 업무(T-03)는 행사 공간의 것이다.
      taskInProgress: 1,
      taskReview: 1,
      meetingToday: 1,
      meetingCleanup: 1,
      eventInProgress: 1,
      eventPlanning: 1,
      // 마감은 **완료되지 않은 업무**의 기한이고 행사 업무도 함께 센다.
      calendarThisWeek: 2,
      calendarUpcoming: 1,
    })
  })
})

describe('캘린더가 저장소에서 온다(OPS-CAL-01)', () => {
  // **표가 없는 화면이다.** 격자에 그려지는 것은 행사·회의·업무의 날짜이고,
  // 개발용 응답은 그 셋을 이미 합쳐 둔 한 벌을 손으로 적어 두면 됐다.
  it('행사·회의·마감이 한 격자에 모인다', async () => {
    render(
      <ScreenRouter screenId="OPS-CAL-01" scopes={{}} onChangeScope={() => {}} onNavigate={() => {}} />,
    )
    await waitFor(() => expect(screen.getByText('2026년 7월')).toBeInTheDocument())
    const drawn = document.body.textContent ?? ''
    expect(drawn).not.toContain('이 화면은 아직 준비 중입니다.')
    // 셋이 각자 다른 표에서 왔다.
    expect(drawn).toContain('체육대회')
    expect(drawn).toContain('오늘 운영회의')
    expect(drawn).toContain('학생 건의함 확인')
    // **이번 주의 범위와 오늘을 서버가 문장으로 완성한다.**
    expect(drawn).toContain('07.19 (일) – 07.25 (토) · 오늘 07.20')
    // 개발용 응답의 일정이 아니라는 증거다.
    expect(drawn).not.toContain('체육대회 참가 신청 마감')
    expect(drawn).not.toContain('비상 연락망 최종본 배포')
  })

  // **앞의 빈칸을 서버가 센다.** 몇 칸이 비는지는 그 달 1일의 요일이 정하고,
  // 화면이 그것을 셈하면 달력의 규칙이 화면에 적힌다.
  it('월 격자의 칸과 오늘 표시가 저장소에서 온다', async () => {
    const params = { type: 'all' }
    await loadSources([{ key: 'ops.calendarDays', params }])
    const days = readListSource('ops.calendarDays', params)
    // 2026년 7월 1일은 수요일이라 앞이 셋 빈다.
    expect(days).toHaveLength(3 + 31)
    expect(days[0]).toEqual({ id: '2026-06-28', dayLabel: '', dayTone: 'gray', schedules: [] })
    expect(days.find((day) => day.id === '2026-07-20')?.dayTone).toBe('today')
    expect(days.find((day) => day.id === '2026-07-24')?.schedules).toEqual([
      { id: 'event:E-01', title: '체육대회', typeTone: 'event' },
    ])
  })

  // **거르는 일은 서버가 한다.** 받아온 것을 화면이 다시 거르면 그린 것과 걸러진
  // 것이 갈린다.
  it('이번 주 줄이 유형으로 좁혀 온다', async () => {
    const params = { type: 'meeting' }
    await loadSources([{ key: 'ops.calendarWeek', params }])
    expect(readListSource('ops.calendarWeek', params)).toEqual([
      {
        id: 'meeting:MTG-A',
        typeLabel: '회의',
        typeTone: 'meeting',
        dateLabel: '07.20',
        title: '오늘 운영회의',
      },
      {
        id: 'meeting:MTG-B',
        typeLabel: '회의',
        typeTone: 'meeting',
        dateLabel: '07.21',
        title: '내일 회의',
      },
    ])
  })

  // **행사에 딸린 줄만 그 행사의 일정으로 간다** — 명세가 그렇게 적었다.
  it('열 행사가 있는 줄에만 갈 곳이 온다', async () => {
    const params = { type: 'all' }
    await loadSources([{ key: 'ops.calendarWeek', params }])
    const rows = readListSource('ops.calendarWeek', params)
    expect(rows.find((row) => row.id === 'deadline:T-03')).toMatchObject({
      title: '현수막 디자인 수정 반영',
      actionLabel: '행사 일정 보기',
      eventId: 'E-01',
    })
    expect(rows.find((row) => row.id === 'deadline:T-01')).not.toHaveProperty('actionLabel')
  })
})
