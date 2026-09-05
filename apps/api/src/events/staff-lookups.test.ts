import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp, type Deps } from '../app.ts'
import type { Db } from '../db/client.ts'
import { freshDb } from '../db/testing.ts'
import {
  events,
  eventStaffDepartments,
  eventStaffMembers,
  members,
  organizations,
} from '../db/schema.ts'
import { inMemoryAttempts } from '../idempotency.ts'
import { can, type Role, type Viewer } from '../permissions.ts'
import { inMemoryCounter } from '../public/rate-limit.ts'
import { eventStaffLookups } from './staff-lookups.ts'

// 행사 운영 조직에 매인 권한 둘을 **표가 답한다**.
//
// 표가 비어 있던 동안 `serve.ts`가 둘 다 `async () => false`를 주었고 그것은 참이었다.
// 이제 조직을 세우고 고치는 자리가 표를 채우므로 그 거짓은 거짓말이 된다 —
// 배포된 서버에서 행사 조직의 부원이 기본정보를 못 고치고, 관리자가 조직을 못
// 고친다(`serve-lookups.test.ts`가 그것을 잰다).
//
// **관리자는 행사 책임자다.** ORG-04가 '행사 조직 관리자만은 그 조직의 관리자인
// 경우'라고 적었고, 이 조직에서 뿌리에 있는 사람이 책임자다(EVT-01이 고르고 EVT-03A가
// 뿌리에 그린다). 부서장은 자기 부서를 맡지 조직을 맡지 않는다.

let db: Db
let close: () => Promise<void>
const NOW = new Date('2026-08-15T10:00:00+09:00')

function viewer(memberId: string, role: Role): Viewer {
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

function harness(who: Viewer) {
  const deps: Deps = {
    audit: { async write() {} },
    db,
    who: async () => who,
    lookups: {
      isMeetingHost: async () => false,
      isMeetingCreator: async () => false,
      isMeetingParticipant: async () => false,
      // 행사 조직 둘은 표가 답한다. '늘 거짓'이면 막는 자리만 재고 여는 자리는 못 잰다.
      ...eventStaffLookups(db),
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

beforeAll(async () => {
  const fresh = await freshDb()
  db = fresh.db as unknown as Db
  close = fresh.close

  await db.insert(organizations).values({ id: 'ORG-01', name: '제12대 학생회' })
  await db.insert(members).values([
    { id: 'M-01', orgId: 'ORG-01', name: '김바다', role: 'member' },
    { id: 'M-02', orgId: 'ORG-01', name: '이윤슬', role: 'head' },
    { id: 'M-03', orgId: 'ORG-01', name: '박해랑', role: 'member' },
    { id: 'M-04', orgId: 'ORG-01', name: '정하늘', role: 'member' },
    { id: 'M-05', orgId: 'ORG-01', name: '한소리', role: 'chair' },
  ])
  await db.insert(events).values([
    { id: 'E-01', orgId: 'ORG-01', title: '2026 체육대회' },
    { id: 'E-02', orgId: 'ORG-01', title: '2026 신입생 환영회' },
  ])
  await db
    .insert(eventStaffDepartments)
    .values({ id: 'ED-01', orgId: 'ORG-01', eventId: 'E-01', name: '운영팀' })
  await db.insert(eventStaffMembers).values([
    // 책임자 — 학생회에서는 부원이지만 이 행사에서는 관리자다.
    { id: 'ES-01', orgId: 'ORG-01', eventId: 'E-01', memberId: 'M-01', isEventLeader: true },
    // 부서장 — 조직원이지만 관리자는 아니다.
    {
      id: 'ES-02',
      orgId: 'ORG-01',
      eventId: 'E-01',
      memberId: 'M-02',
      staffDepartmentId: 'ED-01',
      isDepartmentLeader: true,
    },
    { id: 'ES-03', orgId: 'ORG-01', eventId: 'E-01', memberId: 'M-03', staffDepartmentId: 'ED-01' },
  ])
})

afterAll(async () => {
  await close()
})

const lookups = () => eventStaffLookups(db)

describe('그 행사의 운영 조직에 속했는가(isEventStaff)', () => {
  it('책임자도 부서장도 부원도 조직원이다', async () => {
    const at = lookups()
    expect(await at.isEventStaff('M-01', 'E-01')).toBe(true)
    expect(await at.isEventStaff('M-02', 'E-01')).toBe(true)
    expect(await at.isEventStaff('M-03', 'E-01')).toBe(true)
  })

  it('조직에 없는 사람도, 다른 행사도 아니다', async () => {
    const at = lookups()
    expect(await at.isEventStaff('M-04', 'E-01')).toBe(false)
    expect(await at.isEventStaff('M-01', 'E-02')).toBe(false)
  })
})

describe('그 행사 조직의 관리자인가(isEventStaffManager)', () => {
  it('책임자만 관리자다', async () => {
    const at = lookups()
    expect(await at.isEventStaffManager('M-01', 'E-01')).toBe(true)
    expect(await at.isEventStaffManager('M-02', 'E-01')).toBe(false)
    expect(await at.isEventStaffManager('M-03', 'E-01')).toBe(false)
    expect(await at.isEventStaffManager('M-04', 'E-01')).toBe(false)
  })
})

describe('판정 함수와 서버가 이 답을 쓴다', () => {
  const full = () => ({
    isMeetingHost: async () => false,
    isMeetingCreator: async () => false,
    isMeetingParticipant: async () => false,
    ...lookups(),
  })

  it('event.staff는 회장단이 아니면 책임자에게만 열린다', async () => {
    expect(await can(viewer('M-01', 'member'), 'event.staff', 'E-01', full())).toBe(true)
    expect(await can(viewer('M-02', 'head'), 'event.staff', 'E-01', full())).toBe(false)
    expect(await can(viewer('M-05', 'chair'), 'event.staff', 'E-01', full())).toBe(true)
  })

  it('event.manage는 조직원이면 열린다', async () => {
    expect(await can(viewer('M-03', 'member'), 'event.manage', 'E-01', full())).toBe(true)
    expect(await can(viewer('M-04', 'member'), 'event.manage', 'E-01', full())).toBe(false)
  })

  // 붙이는 자리와 여는 자리가 다른 파일이라 생기는 구멍을 여기서 한 번 닫아 본다 —
  // 진짜 요청이 미들웨어를 지나 이 답으로 열리고 막힌다.
  it('조직을 고치는 자리가 책임자에게 열리고 부서장에게 막힌다', async () => {
    const put = {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ leaderId: 'M-01' }),
    }
    expect(
      (await harness(viewer('M-01', 'member')).request('/api/ops/events/E-01/staff', put)).status,
    ).toBe(200)
    expect(
      (await harness(viewer('M-02', 'head')).request('/api/ops/events/E-01/staff', put)).status,
    ).toBe(403)
  })

  it('기본정보를 고치는 자리가 조직원에게 열리고 밖의 사람에게 막힌다', async () => {
    const put = {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    }
    expect(
      (await harness(viewer('M-03', 'member')).request('/api/ops/events/E-01/basics', put)).status,
    ).toBe(200)
    expect(
      (await harness(viewer('M-04', 'member')).request('/api/ops/events/E-01/basics', put)).status,
    ).toBe(403)
  })
})
