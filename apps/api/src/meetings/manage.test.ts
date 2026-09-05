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

// 회의를 관리한다 — 취소(OPS-MEET-D04)와 진행 권한 부여·해제(OPS-MEET-04B · D03).
//
// 이 파일이 재는 것이 넷이다.
//
// 1. **만든 사람만 한다**(meeting.own). 진행 권한자도 회장도 아니다.
// 2. **취소는 지우는 것이 아니다.** 사유와 함께 기록으로 남고 안건·참가자는 그대로다.
//    예정에서만 가고(D04가 03B 위에만 뜬다), 되풀이는 409다.
// 3. **진행 권한은 옮기는 것이 아니라 더하는 것이다.** 참가자에게만 주고, 이미 가진
//    사람에게 또 줘도 가진 채다.
// 4. **만든 사람의 진행 권한은 뺄 수 없다.** 만든 사실에서 따라오는 권한이라 뺄 자리가
//    없다 — 그래서 진행 권한자가 0명이 되는 길도 없다.

let db: Db
let close: () => Promise<void>
const NOW = new Date('2026-07-20T10:00:00+09:00')

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

/** 만든 사람. */
const CREATOR = viewer('M-02')
/** 진행 권한을 받은 참가자. 진행은 해도 관리는 못 한다. */
const HOST = viewer('M-03')
/** 초대받지 않은 회장. 조직 역할은 답하지 않는다. */
const CHAIR = viewer('M-01', 'chair')

const send = async (
  method: 'POST' | 'DELETE',
  path: string,
  who: Viewer = CREATOR,
  body?: Record<string, unknown>,
) =>
  harness(who).request(path, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  })

const cancel = (meetingId: string, body: Record<string, unknown>, who: Viewer = CREATOR) =>
  send('POST', `/api/ops/meetings/${meetingId}/cancel`, who, body)
const grant = (meetingId: string, memberId: string, who: Viewer = CREATOR) =>
  send('POST', `/api/ops/meetings/${meetingId}/hosts/${memberId}`, who)
const revoke = (meetingId: string, memberId: string, who: Viewer = CREATOR) =>
  send('DELETE', `/api/ops/meetings/${meetingId}/hosts/${memberId}`, who)

const meetingRow = async (meetingId: string) =>
  (await db.select().from(meetings).where(eq(meetings.id, meetingId)))[0]!
const participantRow = async (meetingId: string, memberId: string) =>
  (
    await db
      .select()
      .from(meetingParticipants)
      .where(
        and(eq(meetingParticipants.meetingId, meetingId), eq(meetingParticipants.memberId, memberId)),
      )
  )[0]

beforeAll(async () => {
  const fresh = await freshDb()
  db = fresh.db as unknown as Db
  close = fresh.close

  await db.insert(organizations).values([
    { id: 'ORG-01', name: '제12대 학생회' },
    { id: 'ORG-02', name: '옆 학생회' },
  ])
  await db.insert(members).values([
    { id: 'M-01', orgId: 'ORG-01', name: '이수현', role: 'chair' },
    { id: 'M-02', orgId: 'ORG-01', name: '박해랑', role: 'member' },
    { id: 'M-03', orgId: 'ORG-01', name: '정하늘', role: 'member' },
    { id: 'M-04', orgId: 'ORG-01', name: '김민준', role: 'member' },
    { id: 'M-05', orgId: 'ORG-01', name: '이윤슬', role: 'member' },
    { id: 'M-99', orgId: 'ORG-02', name: '남의사람', role: 'chair' },
  ])

  await db.insert(meetings).values([
    // 취소할 예정 회의. 안건과 참가자가 있고, 취소해도 남아야 한다.
    {
      id: 'MTG-C1',
      orgId: 'ORG-01',
      title: '취소될 회의',
      status: 'scheduled',
      scheduledAt: new Date('2026-07-25T15:00:00+09:00'),
      creatorMemberId: 'M-02',
    },
    // 진행 중인 회의. 취소할 자리가 아니다.
    {
      id: 'MTG-C2',
      orgId: 'ORG-01',
      title: '진행 중인 회의',
      status: 'inProgress',
      startedAt: new Date('2026-07-20T09:00:00+09:00'),
      creatorMemberId: 'M-02',
    },
    // 임시 저장한 회의. 아직 아무에게도 안 보였다.
    { id: 'MTG-C3', orgId: 'ORG-01', title: '쓰다 만 회의', status: 'draft', creatorMemberId: 'M-02' },
    // 진행 권한을 주고 뺄 회의.
    {
      id: 'MTG-C4',
      orgId: 'ORG-01',
      title: '권한을 나눌 회의',
      status: 'scheduled',
      scheduledAt: new Date('2026-07-26T15:00:00+09:00'),
      creatorMemberId: 'M-02',
    },
    { id: 'MTG-99', orgId: 'ORG-02', title: '남의 회의', status: 'scheduled', creatorMemberId: 'M-99' },
  ])
  await db.insert(meetingParticipants).values([
    { id: 'MP-01', orgId: 'ORG-01', meetingId: 'MTG-C1', memberId: 'M-02' },
    { id: 'MP-02', orgId: 'ORG-01', meetingId: 'MTG-C1', memberId: 'M-03', isHost: true },
    { id: 'MP-03', orgId: 'ORG-01', meetingId: 'MTG-C1', memberId: 'M-04' },
    { id: 'MP-04', orgId: 'ORG-01', meetingId: 'MTG-C2', memberId: 'M-03', isHost: true },
    // 권한을 나눌 회의: 아직 아무도 진행 권한이 없다. 만든 사람은 줄 없이 진행 권한자다.
    { id: 'MP-05', orgId: 'ORG-01', meetingId: 'MTG-C4', memberId: 'M-03', isHost: true },
    { id: 'MP-06', orgId: 'ORG-01', meetingId: 'MTG-C4', memberId: 'M-04' },
  ])
  await db.insert(meetingAgendas).values([
    { id: 'AG-C1-1', orgId: 'ORG-01', meetingId: 'MTG-C1', sortOrder: 0, title: '남아야 할 안건' },
  ])
}, 60_000)

afterAll(async () => {
  await close()
})

describe('회의를 취소한다', () => {
  // **만든 사람만 한다.** 진행 권한자도 회장도 아니다(permissions.json의 meeting.own).
  it('만든 사람만 취소한다', async () => {
    expect((await cancel('MTG-C1', { cancelReason: '남의 사유' }, HOST)).status).toBe(403)
    expect((await cancel('MTG-C1', { cancelReason: '남의 사유' }, CHAIR)).status).toBe(403)
    expect((await meetingRow('MTG-C1')).status).toBe('scheduled')
  })

  // 사유가 필수다(D04). 빈 글도 사유가 아니다.
  it('사유가 없으면 막는다', async () => {
    expect((await cancel('MTG-C1', {})).status).toBe(422)
    expect((await cancel('MTG-C1', { cancelReason: '   ' })).status).toBe(422)
    expect((await meetingRow('MTG-C1')).status).toBe('scheduled')
  })

  // **취소는 지우는 것이 아니다.** 사유와 누가 언제가 남고, 안건과 참가자도 그대로다.
  it('취소하면 기록으로 남고 안건은 지워지지 않는다', async () => {
    expect((await cancel('MTG-C1', { cancelReason: ' 행사 일정이 바뀌었습니다. ' })).status).toBe(200)
    const row = await meetingRow('MTG-C1')
    expect(row.status).toBe('cancelled')
    expect(row.cancelReason).toBe('행사 일정이 바뀌었습니다.')
    expect(row.cancelledByMemberId).toBe('M-02')
    expect(row.cancelledAt?.toISOString()).toBe(NOW.toISOString())
    expect(
      await db.select().from(meetingAgendas).where(eq(meetingAgendas.meetingId, 'MTG-C1')),
    ).toHaveLength(1)
    expect(
      await db
        .select()
        .from(meetingParticipants)
        .where(eq(meetingParticipants.meetingId, 'MTG-C1')),
    ).toHaveLength(3)
  })

  // **되풀이는 조용히 넘어가지 않는다**(계약의 repeat: conflict).
  it('이미 취소된 회의는 또 취소할 수 없다', async () => {
    expect((await cancel('MTG-C1', { cancelReason: '다시' })).status).toBe(409)
    expect((await meetingRow('MTG-C1')).cancelReason).toBe('행사 일정이 바뀌었습니다.')
  })

  // **취소는 예정에서만 간다**(D04가 03B 위에만 뜬다). 도는 회의는 끝내는 것이다.
  it('예정된 회의만 취소한다', async () => {
    expect((await cancel('MTG-C2', { cancelReason: '사유' })).status).toBe(422)
    expect((await cancel('MTG-C3', { cancelReason: '사유' })).status).toBe(422)
    expect((await meetingRow('MTG-C2')).status).toBe('inProgress')
  })

  it('남의 학생회의 회의는 취소할 수 없다', async () => {
    expect((await cancel('MTG-99', { cancelReason: '사유' })).status).toBe(403)
  })
})

describe('진행 권한을 준다', () => {
  it('만든 사람만 준다', async () => {
    expect((await grant('MTG-C4', 'M-04', HOST)).status).toBe(403)
    expect((await grant('MTG-C4', 'M-04', CHAIR)).status).toBe(403)
    expect((await participantRow('MTG-C4', 'M-04'))?.isHost).toBe(false)
  })

  // **더하는 것이다.** 먼저 가진 사람은 그대로 가진 채다.
  it('참가자에게 주면 진행 권한자가 된다', async () => {
    expect((await grant('MTG-C4', 'M-04')).status).toBe(200)
    expect((await participantRow('MTG-C4', 'M-04'))?.isHost).toBe(true)
    expect((await participantRow('MTG-C4', 'M-03'))?.isHost).toBe(true)
  })

  // 계약의 repeat: naturalKey — 이미 가진 사람에게 또 줘도 가진 채다.
  it('이미 가진 사람에게 또 줘도 가진 채다', async () => {
    expect((await grant('MTG-C4', 'M-04')).status).toBe(200)
    expect((await participantRow('MTG-C4', 'M-04'))?.isHost).toBe(true)
  })

  // D03은 04B의 참가자 줄에서 열린다. 그 목록에 없는 사람에게 줄 권한이 없다.
  it('참가자가 아닌 사람에게는 줄 수 없다', async () => {
    expect((await grant('MTG-C4', 'M-05')).status).toBe(422)
    expect((await grant('MTG-C4', 'M-01')).status).toBe(422)
    expect(await participantRow('MTG-C4', 'M-05')).toBeUndefined()
  })

  // 만든 사람은 줄이 없어도 진행 권한자다. 줄 것이 없으니 가진 채로 답한다.
  it('만든 사람은 이미 진행 권한자다', async () => {
    expect((await grant('MTG-C4', 'M-02')).status).toBe(200)
    expect(await participantRow('MTG-C4', 'M-02')).toBeUndefined()
  })

  it('남의 학생회의 회의에는 줄 수 없다', async () => {
    expect((await grant('MTG-99', 'M-99')).status).toBe(403)
  })
})

describe('진행 권한을 뺀다', () => {
  it('만든 사람만 뺀다', async () => {
    expect((await revoke('MTG-C4', 'M-04', HOST)).status).toBe(403)
    expect((await participantRow('MTG-C4', 'M-04'))?.isHost).toBe(true)
  })

  it('빼면 일반 참가자로 돌아간다', async () => {
    expect((await revoke('MTG-C4', 'M-04')).status).toBe(200)
    expect((await participantRow('MTG-C4', 'M-04'))?.isHost).toBe(false)
    // 참가자 줄 자체는 남는다 — 권한을 뺀 것이지 회의에서 뺀 것이 아니다.
    expect(await participantRow('MTG-C4', 'M-04')).toBeDefined()
  })

  // 계약의 repeat: overwrite — 이미 없는 사람에게서 또 빼도 없는 채로다.
  it('이미 없는 사람에게서 또 빼도 없는 채로다', async () => {
    expect((await revoke('MTG-C4', 'M-04')).status).toBe(200)
    expect((await participantRow('MTG-C4', 'M-04'))?.isHost).toBe(false)
  })

  // **만든 사람은 늘 진행 권한자다**(ORG-04). 뺄 자리가 없고, 그래서 0명이 되는 길도 없다.
  it('만든 사람의 진행 권한은 뺄 수 없다', async () => {
    expect((await revoke('MTG-C4', 'M-02')).status).toBe(422)
  })

  it('참가자가 아닌 사람은 뺄 것이 없다', async () => {
    expect((await revoke('MTG-C4', 'M-05')).status).toBe(422)
  })

  it('남의 학생회의 회의에서는 뺄 수 없다', async () => {
    expect((await revoke('MTG-99', 'M-99')).status).toBe(403)
  })
})
