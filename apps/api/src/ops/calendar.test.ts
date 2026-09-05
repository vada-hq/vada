import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp, type Deps } from '../app.ts'
import type { Db } from '../db/client.ts'
import { freshDb } from '../db/testing.ts'
import { departments, events, meetings, members, organizations, tasks, users } from '../db/schema.ts'
import { inMemoryAttempts } from '../idempotency.ts'
import { meetingLookups } from '../meetings/lookups.ts'
import type { Viewer } from '../permissions.ts'
import { inMemoryCounter } from '../public/rate-limit.ts'

// 운영 캘린더(OPS-CAL-01).
//
// **달력은 원본이 아니라 비친 것이다**(`db/schema.ts` 머리). 표가 없고, 그려지는 것은
// 행사의 일시·회의의 일시·업무의 기한이다. 그래서 이 파일이 재는 것이 다섯이다.
//
// 1. **셋이 한 격자에 모인다.** 행사·회의·마감이 각자 다른 표에서 온다.
// 2. **어느 달인지도 오늘이 언제인지도 서버만 안다.** 화면이 넘길 값이 없다
//    (`ops.calendarMonth`에 인자가 없다).
// 3. **앞뒤 빈칸을 서버가 센다.** 몇 칸이 비는지는 그 달 1일의 요일이 정하고,
//    화면이 그것을 셈하면 달력의 규칙이 화면에 적힌다(명세가 그렇게 적었다).
// 4. **마감은 완료되지 않은 업무 기준이다.** 그림이 격자 곁에 적어 두었다.
// 5. **거르는 일은 서버가 한다.** 받아온 것을 화면이 다시 거르지 않는다.

let db: Db
let close: () => Promise<void>

/** 2026.07.20은 월요일. 이번 주는 07.19(일)~07.25(토)이고 7월 1일은 수요일이다. */
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

function harness(who: Viewer | null = VIEWER) {
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

const one = async (path: string) => (await (await harness().request(path)).json()) as Row
const many = async (path: string) => (await (await harness().request(path)).json()) as Row[]

beforeAll(async () => {
  const fresh = await freshDb()
  db = fresh.db as unknown as Db
  close = fresh.close

  await db.insert(organizations).values([
    { id: 'ORG-01', name: '제12대 학생회' },
    // **옆 학생회를 하나 더 둔다.** 모으는 자리마다 담이 서는지 봐야 한다.
    { id: 'ORG-02', name: '옆 학생회' },
  ])
  await db.insert(departments).values([{ id: 'D-01', orgId: 'ORG-01', name: '기획부' }])
  await db.insert(users).values({ id: 'U-01', email: 'maru@example.ac.kr' })
  await db.insert(members).values([
    { id: 'M-01', orgId: 'ORG-01', name: '한마루', role: 'member', departmentId: 'D-01', userId: 'U-01' },
    { id: 'M-99', orgId: 'ORG-02', name: '남의사람', role: 'chair' },
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
    // 일시가 없는 행사는 달력에 걸릴 날이 없다.
    { id: 'E-02', orgId: 'ORG-01', title: '신입생 환영회', status: 'planning' },
    // 지난 행사도 그날에 있었다. 격자는 '언제 무엇이 있었나'를 그린다.
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
    // 행사에 걸린 회의. **그 행사의 일정으로 갈 수 있다.**
    {
      id: 'MTG-B',
      orgId: 'ORG-01',
      eventId: 'E-01',
      kind: 'event',
      title: '체육대회 준비 회의',
      status: 'scheduled',
      scheduledAt: new Date('2026-07-23T14:00:00+09:00'),
    },
    // 임시 저장한 회의는 아직 아무에게도 알리지 않은 것이다.
    {
      id: 'MTG-C',
      orgId: 'ORG-01',
      title: '초안 회의',
      status: 'draft',
      scheduledAt: new Date('2026-07-21T10:00:00+09:00'),
    },
    // 취소한 회의는 예정이 아니다.
    {
      id: 'MTG-D',
      orgId: 'ORG-01',
      title: '취소된 회의',
      status: 'cancelled',
      scheduledAt: new Date('2026-07-24T10:00:00+09:00'),
    },
    {
      id: 'MTG-99',
      orgId: 'ORG-02',
      title: '남의 회의',
      status: 'scheduled',
      scheduledAt: new Date('2026-07-22T18:00:00+09:00'),
    },
  ])

  await db.insert(tasks).values([
    // 행사에 걸린 마감. **그 행사의 일정으로 갈 수 있다.**
    {
      id: 'T-01',
      orgId: 'ORG-01',
      eventId: 'E-01',
      title: '체육대회 참가 신청 마감',
      status: 'inProgress',
      dueDate: new Date('2026-07-20T18:00:00+09:00'),
    },
    // 상시 업무의 마감. 열 행사가 없다.
    {
      id: 'T-02',
      orgId: 'ORG-01',
      title: '주간 운영회의 자료 준비',
      status: 'planned',
      dueDate: new Date('2026-07-21T18:00:00+09:00'),
    },
    // 끝난 업무의 기한은 마감이 아니다.
    {
      id: 'T-03',
      orgId: 'ORG-01',
      title: '끝난 업무',
      status: 'done',
      dueDate: new Date('2026-07-22T18:00:00+09:00'),
    },
    {
      id: 'T-04',
      orgId: 'ORG-01',
      title: '다음 달 예산안 초안',
      status: 'planned',
      dueDate: new Date('2026-08-03T18:00:00+09:00'),
    },
    {
      id: 'T-05',
      orgId: 'ORG-01',
      eventId: 'E-01',
      title: '현수막 시안',
      status: 'inProgress',
      dueDate: new Date('2026-07-18T18:00:00+09:00'),
    },
    { id: 'T-99', orgId: 'ORG-02', title: '남의 업무', dueDate: new Date('2026-07-22T18:00:00+09:00') },
  ])
}, 60_000)

afterAll(async () => {
  await close()
})

describe('지금 보고 있는 달과 이번 주를 서버가 정한다', () => {
  it('달의 이름이 오늘에서 온다', async () => {
    expect(await one('/api/ops/calendar/month')).toEqual({ monthLabel: '2026년 7월' })
  })

  // 화면이 날짜를 셈해 문장을 만들면 그 셈이 화면에 적힌다.
  it('이번 주의 범위와 오늘이 완성된 한 줄로 온다', async () => {
    expect(await one('/api/ops/calendar/week-range')).toEqual({
      rangeNote: '07.19 (일) – 07.25 (토) · 오늘 07.20',
    })
  })
})

describe('월 격자가 세 표를 한곳에 모은다', () => {
  it('앞의 빈칸을 서버가 센다 — 7월 1일이 수요일이라 셋이다', async () => {
    const days = await many('/api/ops/calendar/days?type=all')
    expect(days).toHaveLength(3 + 31)
    expect(days[0]).toEqual({ id: '2026-06-28', dayLabel: '', dayTone: 'gray', schedules: [] })
    expect(days[3]).toMatchObject({ id: '2026-07-01', dayLabel: '1' })
    expect(days[33]).toMatchObject({ id: '2026-07-31', dayLabel: '31' })
  })

  it('토·일이 갈리고 오늘이 따로 있다', async () => {
    const days = await many('/api/ops/calendar/days?type=all')
    const toneOf = (id: string) => days.find((day) => day.id === id)?.dayTone
    expect(toneOf('2026-07-20')).toBe('today')
    expect(toneOf('2026-07-19')).toBe('red')
    expect(toneOf('2026-07-18')).toBe('blue')
    expect(toneOf('2026-07-21')).toBe('gray')
  })

  it('행사·회의·마감이 저마다의 표에서 그날 칸에 온다', async () => {
    const days = await many('/api/ops/calendar/days?type=all')
    const at = (id: string) => days.find((day) => day.id === id)?.schedules
    expect(at('2026-07-31')).toEqual([
      { id: 'event:E-01', title: '체육대회', typeTone: 'event' },
    ])
    expect(at('2026-07-22')).toEqual([
      { id: 'meeting:MTG-A', title: '정기 운영회의', typeTone: 'meeting' },
    ])
    expect(at('2026-07-20')).toEqual([
      { id: 'deadline:T-01', title: '체육대회 참가 신청 마감', typeTone: 'deadline' },
    ])
    // 지난 행사도 그날에 있었다.
    expect(at('2026-07-03')).toEqual([{ id: 'event:E-03', title: '지난 행사', typeTone: 'event' }])
  })

  it('초안·취소된 회의와 끝난 업무는 걸리지 않는다', async () => {
    const days = await many('/api/ops/calendar/days?type=all')
    const at = (id: string) => days.find((day) => day.id === id)?.schedules
    // 07.22의 끝난 업무(T-03)는 마감이 아니라 회의 하나만 남는다.
    expect(at('2026-07-22')).toHaveLength(1)
    expect(at('2026-07-21')).toEqual([
      { id: 'deadline:T-02', title: '주간 운영회의 자료 준비', typeTone: 'deadline' },
    ])
    expect(at('2026-07-24')).toEqual([])
  })

  it('옆 학생회의 것은 오지 않는다', async () => {
    const days = await many('/api/ops/calendar/days?type=all')
    const drawn = JSON.stringify(days)
    expect(drawn).not.toContain('남의')
  })

  it('유형으로 좁히는 일을 서버가 한다', async () => {
    const days = await many('/api/ops/calendar/days?type=meeting')
    const all = days.flatMap((day) => day.schedules as Row[])
    expect(all.map((row) => row.id)).toEqual(['meeting:MTG-A', 'meeting:MTG-B'])
  })

  // 그대로 넘기면 아무것도 안 걸러진 격자가 그려지고, 아무도 그것을 못 본다.
  it('명세에 없는 유형은 막는다', async () => {
    const res = await harness().request('/api/ops/calendar/days?type=없는유형')
    expect(res.status).toBe(422)
  })
})

describe('이번 주 줄이 격자와 같은 일정을 세로로 세운다', () => {
  it('이번 주에 걸린 것만 날짜 차례로 온다', async () => {
    const rows = await many('/api/ops/calendar/week?type=all')
    expect(rows.map((row) => row.id)).toEqual([
      'deadline:T-01',
      'deadline:T-02',
      'meeting:MTG-A',
      'meeting:MTG-B',
      'event:E-04',
    ])
    expect(rows[0]).toEqual({
      id: 'deadline:T-01',
      typeLabel: '마감',
      typeTone: 'deadline',
      dateLabel: '07.20',
      title: '체육대회 참가 신청 마감',
      actionLabel: '행사 일정 보기',
      eventId: 'E-01',
    })
  })

  // **행사에 딸리지 않은 줄에는 오지 않는다** — 명세가 그렇게 적었다.
  it('열 행사가 없는 줄에는 갈 곳이 오지 않는다', async () => {
    const rows = await many('/api/ops/calendar/week?type=all')
    const regular = rows.find((row) => row.id === 'meeting:MTG-A')!
    expect(regular).toEqual({
      id: 'meeting:MTG-A',
      typeLabel: '회의',
      typeTone: 'meeting',
      dateLabel: '07.22',
      title: '정기 운영회의',
    })
    expect(rows.find((row) => row.id === 'deadline:T-02')).not.toHaveProperty('actionLabel')
    // 행사에 걸린 회의는 그 행사의 일정으로 간다.
    expect(rows.find((row) => row.id === 'meeting:MTG-B')).toMatchObject({
      actionLabel: '행사 일정 보기',
      eventId: 'E-01',
    })
  })

  it('유형으로 좁히는 일을 서버가 한다', async () => {
    const rows = await many('/api/ops/calendar/week?type=deadline')
    expect(rows.map((row) => row.id)).toEqual(['deadline:T-01', 'deadline:T-02'])
  })
})
