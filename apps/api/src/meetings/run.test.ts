import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { and, eq } from 'drizzle-orm'
import { createApp, type Deps } from '../app.ts'
import type { Db } from '../db/client.ts'
import { freshDb } from '../db/testing.ts'
import {
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

// 회의를 시작하고 끝내고 안건을 넘긴다(OPS-MEET-D01 · D02 · 05B).
//
// 이 파일이 재는 것이 넷이다.
//
// 1. **끝내면 '완료'가 아니라 '정리 중'이다.** 회의록과 결정을 확인한 뒤에 따로
//    정리 완료한다고 명세가 못 박았다.
// 2. **어느 안건인지를 받지 않는다.** 단추의 뜻이 '이 안건'이고 그것은 지금 진행
//    중인 것이며, 어느 것이 진행 중인지는 서버가 안다.
// 3. **되풀이는 조용히 넘어가지 않는다.** 계약이 넷 다 `conflict`라 적었다 —
//    남이 먼저 시작했는데 아무 일도 안 일어나면 그 사실을 아무도 모른다.
// 4. **울타리가 선다.** 남의 학생회의 회의는 열 수도 끝낼 수도 없다.

let db: Db
let close: () => Promise<void>
const NOW = new Date('2026-07-18T15:00:00+09:00')

function viewer(memberId: string, role: 'chair' | 'head' | 'member' = 'member'): Viewer {
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

function harness(who: Viewer | null) {
  const deps: Deps = {
    audit: { async write() {} },
    db,
    who: async () => who,
    lookups: {
      isEventStaff: async () => false,
      isEventStaffManager: async () => false,
      // 진행 권한을 표에서 읽는다. '늘 참'으로 두면 막는 자리를 아예 안 재게 된다.
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

/** 만든 사람이자 기본 진행 권한자. */
const CREATOR = viewer('M-02')
/** 초대만 받은 사람. 회장이어도 이 회의는 못 연다. */
const GUEST = viewer('M-01', 'chair')

const press = async (path: string, who: Viewer = CREATOR) =>
  harness(who).request(path, { method: 'POST' })

const stageOf = async (meetingId: string) =>
  (await db.select().from(meetings).where(eq(meetings.id, meetingId)))[0]!

const agendasOf = async (meetingId: string) =>
  db
    .select()
    .from(meetingAgendas)
    .where(eq(meetingAgendas.meetingId, meetingId))
    .orderBy(meetingAgendas.sortOrder)

/** 이 회의의 사람 넷. 만든 사람과 초대받은 사람이 늘 함께 있어야 권한을 잰다. */
async function invite(meetingId: string): Promise<void> {
  await db.insert(meetingParticipants).values([
    { id: `MP-${meetingId}-1`, orgId: 'ORG-01', meetingId, memberId: 'M-02' },
    { id: `MP-${meetingId}-2`, orgId: 'ORG-01', meetingId, memberId: 'M-01' },
  ])
}

beforeAll(async () => {
  const fresh = await freshDb()
  db = fresh.db as unknown as Db
  close = fresh.close

  await db.insert(organizations).values([
    { id: 'ORG-01', name: '제12대 학생회', term: '2026' },
    { id: 'ORG-02', name: '옆 학생회' },
  ])
  await db.insert(members).values([
    { id: 'M-01', orgId: 'ORG-01', name: '이수현', role: 'chair' },
    { id: 'M-02', orgId: 'ORG-01', name: '박해랑', role: 'member' },
    { id: 'M-99', orgId: 'ORG-02', name: '남의사람', role: 'chair' },
  ])

  await db.insert(meetings).values([
    // 시작할 회의.
    {
      id: 'MTG-A',
      orgId: 'ORG-01',
      title: '시작을 기다리는 회의',
      status: 'scheduled',
      scheduledAt: new Date('2026-07-18T15:00:00+09:00'),
      creatorMemberId: 'M-02',
    },
    // 끝낼 회의.
    {
      id: 'MTG-B',
      orgId: 'ORG-01',
      title: '끝낼 회의',
      status: 'inProgress',
      startedAt: new Date('2026-07-18T14:00:00+09:00'),
      creatorMemberId: 'M-02',
    },
    // 안건을 마칠 회의.
    {
      id: 'MTG-C',
      orgId: 'ORG-01',
      title: '안건을 마칠 회의',
      status: 'inProgress',
      startedAt: new Date('2026-07-18T14:00:00+09:00'),
      creatorMemberId: 'M-02',
    },
    // 다음 안건을 열 회의.
    {
      id: 'MTG-D',
      orgId: 'ORG-01',
      title: '다음 안건을 열 회의',
      status: 'inProgress',
      startedAt: new Date('2026-07-18T14:00:00+09:00'),
      creatorMemberId: 'M-02',
    },
    // 이미 끝난 회의.
    {
      id: 'MTG-E',
      orgId: 'ORG-01',
      title: '이미 끝난 회의',
      status: 'wrapUp',
      startedAt: new Date('2026-07-17T14:00:00+09:00'),
      endedAt: new Date('2026-07-17T15:00:00+09:00'),
      creatorMemberId: 'M-02',
    },
    // 아직 시작하지 않은 회의. 안건을 넘길 자리가 아니다.
    {
      id: 'MTG-F',
      orgId: 'ORG-01',
      title: '아직 시작하지 않은 회의',
      status: 'scheduled',
      creatorMemberId: 'M-02',
    },
    { id: 'MTG-99', orgId: 'ORG-02', title: '남의 회의', status: 'scheduled', creatorMemberId: 'M-99' },
  ])

  for (const id of ['MTG-A', 'MTG-B', 'MTG-C', 'MTG-D', 'MTG-E', 'MTG-F']) await invite(id)

  await db.insert(meetingAgendas).values([
    // MTG-C: 하나는 마쳤고 하나는 진행 중이며 하나는 대기다.
    { id: 'AG-C-1', orgId: 'ORG-01', meetingId: 'MTG-C', sortOrder: 0, title: '첫 안건', status: 'done' },
    {
      id: 'AG-C-2',
      orgId: 'ORG-01',
      meetingId: 'MTG-C',
      sortOrder: 1,
      title: '지금 하는 안건',
      status: 'current',
    },
    { id: 'AG-C-3', orgId: 'ORG-01', meetingId: 'MTG-C', sortOrder: 2, title: '다음 안건' },
    // MTG-D: 하나는 마쳤고 진행 중인 것이 없다. '다음'은 대기 중 가장 앞이다.
    { id: 'AG-D-1', orgId: 'ORG-01', meetingId: 'MTG-D', sortOrder: 0, title: '마친 안건', status: 'done' },
    { id: 'AG-D-2', orgId: 'ORG-01', meetingId: 'MTG-D', sortOrder: 1, title: '다음에 열릴 안건' },
    { id: 'AG-D-3', orgId: 'ORG-01', meetingId: 'MTG-D', sortOrder: 2, title: '그다음 안건' },
    // MTG-B: 끝낼 때 안건이 남아 있어도 막지 않는다.
    { id: 'AG-B-1', orgId: 'ORG-01', meetingId: 'MTG-B', sortOrder: 0, title: '남은 안건' },
  ])
}, 60_000)

afterAll(async () => {
  await close()
})

describe('회의를 시작한다', () => {
  // **진행 권한이 벽이다.** 조직 역할이 답하지 않는다(permissions.json의 meeting.run).
  it('진행 권한이 없으면 시작할 수 없다', async () => {
    expect((await press('/api/ops/meetings/MTG-A/start', GUEST)).status).toBe(403)
    expect((await stageOf('MTG-A')).status).toBe('scheduled')
  })

  // **울타리.** 남의 학생회의 회의에는 진행 권한이 설 자리가 없다.
  it('남의 학생회의 회의는 시작할 수 없다', async () => {
    expect((await press('/api/ops/meetings/MTG-99/start')).status).toBe(403)
  })

  it('시작하면 진행 중이 되고 실제 시작 때가 남는다', async () => {
    expect((await press('/api/ops/meetings/MTG-A/start')).status).toBe(200)
    const row = await stageOf('MTG-A')
    expect(row.status).toBe('inProgress')
    // **예정 일시와 다른 사실이다.** 그 차이가 곧 '진행 27분'을 만든다.
    expect(row.startedAt?.toISOString()).toBe(NOW.toISOString())
  })

  // **조용히 넘어가지 않는다.** 남이 먼저 시작한 것을 아무도 모르게 된다.
  it('이미 진행 중인 회의를 또 시작할 수 없다', async () => {
    expect((await press('/api/ops/meetings/MTG-A/start')).status).toBe(409)
  })
})

describe('회의를 끝낸다', () => {
  // **명세가 못 박은 자리다.** 끝낸 것과 정리를 마친 것은 다른 사실이다.
  it('끝내면 완료가 아니라 정리 중이 된다', async () => {
    expect((await press('/api/ops/meetings/MTG-B/end')).status).toBe(200)
    const row = await stageOf('MTG-B')
    expect(row.status).toBe('wrapUp')
    expect(row.endedAt?.toISOString()).toBe(NOW.toISOString())
  })

  it('이미 끝난 회의를 또 끝낼 수 없다', async () => {
    expect((await press('/api/ops/meetings/MTG-E/end')).status).toBe(409)
  })
})

describe('안건을 넘긴다', () => {
  // **어느 안건인지를 인자로 받지 않는다.** '이 안건'은 지금 진행 중인 것이다.
  it('지금 진행 중인 안건을 마친다', async () => {
    expect((await press('/api/ops/meetings/MTG-C/agendas/current/complete')).status).toBe(200)
    const rows = await agendasOf('MTG-C')
    expect(rows.map((row) => row.status)).toEqual(['done', 'done', 'pending'])
    expect(rows[1]!.endedAt?.toISOString()).toBe(NOW.toISOString())
  })

  it('진행 중인 안건이 없으면 마칠 것이 없다', async () => {
    expect((await press('/api/ops/meetings/MTG-C/agendas/current/complete')).status).toBe(409)
  })

  it('다음 안건은 대기 중 가장 앞의 것이다', async () => {
    expect((await press('/api/ops/meetings/MTG-D/agendas/next')).status).toBe(200)
    const rows = await agendasOf('MTG-D')
    expect(rows.map((row) => row.status)).toEqual(['done', 'current', 'pending'])
    expect(rows[1]!.startedAt?.toISOString()).toBe(NOW.toISOString())
  })

  // **두 번 넘기면 안건 하나를 건너뛴다.** 넘긴 자리가 지금 어디인지를 보고 막는다.
  it('진행 중인 안건이 있으면 넘기지 않는다', async () => {
    expect((await press('/api/ops/meetings/MTG-D/agendas/next')).status).toBe(409)
    expect((await agendasOf('MTG-D')).map((row) => row.status)).toEqual([
      'done',
      'current',
      'pending',
    ])
  })

  it('넘길 안건이 남지 않으면 막는다', async () => {
    // 지금 것을 마치고 마지막 하나를 연 뒤, 그것마저 마치면 남는 것이 없다.
    await press('/api/ops/meetings/MTG-D/agendas/current/complete')
    await press('/api/ops/meetings/MTG-D/agendas/next')
    await press('/api/ops/meetings/MTG-D/agendas/current/complete')
    expect((await press('/api/ops/meetings/MTG-D/agendas/next')).status).toBe(409)
  })

  // 진행 중인 회의가 아니면 넘길 자리가 없다 — 시작하지 않은 회의의 안건은 대기다.
  it('시작하지 않은 회의에서는 안건을 넘기지 못한다', async () => {
    expect((await press('/api/ops/meetings/MTG-F/agendas/next')).status).toBe(409)
    expect((await press('/api/ops/meetings/MTG-F/agendas/current/complete')).status).toBe(409)
  })

  it('남의 학생회의 안건은 넘길 수 없다', async () => {
    expect((await press('/api/ops/meetings/MTG-99/agendas/next')).status).toBe(403)
  })
})

describe('진행 권한자가 여럿이면 함께 진행한다', () => {
  // **옮기는 것이 아니라 더하는 것이다**(OPS-MEET-D03). 권한을 받은 사람도 시작한다.
  it('권한을 받은 사람도 회의를 시작한다', async () => {
    await db
      .update(meetingParticipants)
      .set({ isHost: true })
      .where(
        and(
          eq(meetingParticipants.meetingId, 'MTG-F'),
          eq(meetingParticipants.memberId, 'M-01'),
        ),
      )
    expect((await press('/api/ops/meetings/MTG-F/start', GUEST)).status).toBe(200)
    expect((await stageOf('MTG-F')).status).toBe('inProgress')
  })
})
