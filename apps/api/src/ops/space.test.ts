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
  tasks,
} from '../db/schema.ts'
import { inMemoryAttempts } from '../idempotency.ts'
import { meetingLookups } from '../meetings/lookups.ts'
import type { Viewer } from '../permissions.ts'
import { inMemoryCounter } from '../public/rate-limit.ts'

// 운영 공간의 첫 화면(OPS-00).
//
// 이 파일이 재는 것이 넷이다.
//
// 1. **안내 문장에 보는 사람의 이름이 들어간다.** 서버가 완성해서 준다.
// 2. **네 공간의 건수가 서로 다른 표에서 온다.** 업무·회의·행사·마감을 가로질러
//    세는 자리라 회의가 아니라 운영 공간의 것이다.
// 3. **'상시 업무'는 행사에 안 걸린 업무다.** 행사 업무를 함께 세면 두 공간이
//    같은 수를 그린다.
// 4. **마감은 완료되지 않은 업무 기준이다.** OPS-CAL-01이 그 규칙을 적어 두었다.

let db: Db
let close: () => Promise<void>
/** 2026.07.20은 월요일. 이번 주는 07.19(일)~07.25(토)다. */
const NOW = new Date('2026-07-20T10:00:00+09:00')

const VIEWER: Viewer = {
  userId: 'U-02',
  membership: {
    orgId: 'ORG-01',
    memberId: 'M-02',
    role: 'member',
    departmentId: 'D-02',
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

const body = async (path: string) => (await (await harness().request(path)).json()) as Row

beforeAll(async () => {
  const fresh = await freshDb()
  db = fresh.db as unknown as Db
  close = fresh.close

  await db.insert(organizations).values([
    { id: 'ORG-01', name: '제12대 학생회' },
    // **옆 학생회를 하나 더 둔다.** 세는 자리마다 담이 서는지 봐야 한다.
    { id: 'ORG-02', name: '옆 학생회' },
  ])
  await db.insert(departments).values([{ id: 'D-02', orgId: 'ORG-01', name: '운영부' }])
  await db.insert(members).values([
    { id: 'M-02', orgId: 'ORG-01', name: '박해랑', role: 'member', departmentId: 'D-02' },
    { id: 'M-99', orgId: 'ORG-02', name: '남의사람', role: 'chair' },
  ])

  await db.insert(events).values([
    { id: 'E-01', orgId: 'ORG-01', title: '체육대회', status: 'inProgress' },
    { id: 'E-02', orgId: 'ORG-01', title: '신입생 환영회', status: 'planning' },
    { id: 'E-03', orgId: 'ORG-01', title: '학술제', status: 'planning' },
    { id: 'E-04', orgId: 'ORG-01', title: '지난 행사', status: 'done' },
    { id: 'E-99', orgId: 'ORG-02', title: '남의 행사', status: 'inProgress' },
  ])

  await db.insert(meetings).values([
    // 오늘 잡힌 회의 하나.
    {
      id: 'MTG-A',
      orgId: 'ORG-01',
      title: '오늘 운영회의',
      status: 'scheduled',
      scheduledAt: new Date('2026-07-20T18:00:00+09:00'),
    },
    { id: 'MTG-B', orgId: 'ORG-01', title: '내일 회의', status: 'scheduled', scheduledAt: new Date('2026-07-21T18:00:00+09:00') },
    // 정리가 필요한 회의 하나.
    { id: 'MTG-C', orgId: 'ORG-01', title: '정리 중인 회의', status: 'wrapUp' },
    // **아직 아무에게도 알리지 않은 회의는 세지 않는다.**
    {
      id: 'MTG-D',
      orgId: 'ORG-01',
      title: '임시 저장한 회의',
      status: 'draft',
      scheduledAt: new Date('2026-07-20T20:00:00+09:00'),
    },
    // 취소된 회의도 오늘 예정이 아니다.
    {
      id: 'MTG-E',
      orgId: 'ORG-01',
      title: '취소된 회의',
      status: 'cancelled',
      scheduledAt: new Date('2026-07-20T09:00:00+09:00'),
    },
    { id: 'MTG-99', orgId: 'ORG-02', title: '남의 회의', status: 'wrapUp' },
  ])

  await db.insert(tasks).values([
    // 상시 업무(행사에 안 걸린 것).
    {
      id: 'T-01',
      orgId: 'ORG-01',
      title: '학생 건의함 확인',
      status: 'inProgress',
      dueDate: new Date('2026-07-22T18:00:00+09:00'),
    },
    { id: 'T-02', orgId: 'ORG-01', title: '회계 장부 주간 정리', status: 'inProgress' },
    {
      id: 'T-03',
      orgId: 'ORG-01',
      title: '게시판 공지물 정리',
      status: 'review',
      dueDate: new Date('2026-07-25T18:00:00+09:00'),
    },
    // 행사 업무. **상시 업무로 세면 안 되지만 마감으로는 센다.**
    {
      id: 'T-04',
      orgId: 'ORG-01',
      eventId: 'E-01',
      title: '현수막 디자인 수정 반영',
      status: 'inProgress',
      dueDate: new Date('2026-07-23T18:00:00+09:00'),
    },
    // 끝난 업무의 기한은 마감이 아니다.
    {
      id: 'T-05',
      orgId: 'ORG-01',
      title: '끝난 업무',
      status: 'done',
      dueDate: new Date('2026-07-21T18:00:00+09:00'),
    },
    // 다음 주 마감.
    {
      id: 'T-06',
      orgId: 'ORG-01',
      title: '다음 달 예산안 초안',
      status: 'planned',
      dueDate: new Date('2026-08-03T18:00:00+09:00'),
    },
    // 이미 지난 기한. 이번 주도 다가오는 것도 아니다.
    {
      id: 'T-07',
      orgId: 'ORG-01',
      title: '지난 주에 끝났어야 할 업무',
      status: 'planned',
      dueDate: new Date('2026-07-10T18:00:00+09:00'),
    },
    { id: 'T-99', orgId: 'ORG-02', title: '남의 업무', status: 'inProgress' },
  ])
}, 60_000)

afterAll(async () => {
  await close()
})

describe('운영 허브의 안내 문장이 보는 사람의 이름을 든다', () => {
  it('서버가 완성한 한 줄이 온다', async () => {
    const row = await body('/api/ops/intro')
    expect(row.description).toBe(
      '박해랑님이 확인할 업무·회의·행사·일정을 선택하세요. 각 공간에서 역할과 참여 관계에 맞는 다음 행동을 제공합니다.',
    )
  })
})

describe('네 공간의 건수가 여러 표를 가로질러 온다', () => {
  it('업무·회의·행사·마감을 서버가 센다', async () => {
    expect(await body('/api/ops/space-stats')).toEqual({
      // 상시 업무만 센다 — 행사 업무(T-04)는 행사 공간의 것이다.
      taskInProgress: 2,
      taskReview: 1,
      meetingToday: 1,
      meetingCleanup: 1,
      eventInProgress: 1,
      eventPlanning: 2,
      // 마감은 **완료되지 않은 업무**의 기한이고 행사 업무도 함께 센다.
      calendarThisWeek: 3,
      calendarUpcoming: 1,
    })
  })
})
