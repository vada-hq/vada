import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp, type Deps } from '../app.ts'
import type { Db } from '../db/client.ts'
import { freshDb } from '../db/testing.ts'
import { departments, meetings, members, organizations, tasks } from '../db/schema.ts'
import { inMemoryAttempts } from '../idempotency.ts'
import type { Viewer } from '../permissions.ts'
import { inMemoryCounter } from '../public/rate-limit.ts'
import { meetingLookups } from './lookups.ts'

// 회의에서 나온 후속 업무(OPS-MEET-05A · 06B · 07 · 08).
//
// 이 파일이 재는 것이 넷이다.
//
// 1. **회의가 만든 업무는 업무 표에 있다.** `tasks.from_meeting_id`가 그 이음이고,
//    회의마다 따로 세지 않는다.
// 2. **'이 회의가 만든 것'과 '그중 내 것'은 다른 물음이다.** 07과 08이 비었을 때
//    다르게 말하므로 자리도 둘이다.
// 3. **누가 언제까지를 서버가 이어 준다.** 화면이 이름과 날짜를 이으면 잇는 방법이
//    화면마다 갈린다.
// 4. **울타리가 선다.** 남의 학생회의 회의는 없는 것과 같다.

let db: Db
let close: () => Promise<void>
const NOW = new Date('2026-07-20T10:00:00+09:00')

function viewer(memberId: string): Viewer {
  return {
    userId: `U-${memberId}`,
    membership: {
      orgId: 'ORG-01',
      memberId,
      role: 'member',
      departmentId: null,
      inFinanceDepartment: false,
    },
  }
}

/** 후속 업무를 받은 사람 정하늘. 08이 이 사람의 화면이다. */
const MINE = viewer('M-03')
/** 아무것도 못 받은 사람 박해랑. 같은 회의에서 08이 비어 보인다. */
const OTHER = viewer('M-02')

function harness(who: Viewer) {
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

const followUps = async (meetingId: string, who: Viewer = MINE) =>
  (await (await harness(who).request(`/api/ops/meetings/${meetingId}/follow-ups`)).json()) as Row[]

const mine = async (meetingId: string, who: Viewer = MINE) =>
  (await (
    await harness(who).request(`/api/ops/meetings/${meetingId}/follow-ups/mine`)
  ).json()) as Row[]

beforeAll(async () => {
  const fresh = await freshDb()
  db = fresh.db as unknown as Db
  close = fresh.close

  await db.insert(organizations).values([
    { id: 'ORG-01', name: '제12대 학생회' },
    { id: 'ORG-02', name: '옆 학생회' },
  ])
  await db.insert(departments).values([{ id: 'D-02', orgId: 'ORG-01', name: '운영부' }])
  await db.insert(members).values([
    { id: 'M-02', orgId: 'ORG-01', name: '박해랑', role: 'member', departmentId: 'D-02' },
    { id: 'M-03', orgId: 'ORG-01', name: '정하늘', role: 'member' },
    { id: 'M-99', orgId: 'ORG-02', name: '남의사람', role: 'chair' },
  ])
  await db.insert(meetings).values([
    {
      id: 'MTG-06',
      orgId: 'ORG-01',
      title: '체육대회 안전 관리 최종 회의',
      status: 'wrapUp',
      creatorMemberId: 'M-02',
    },
    // 후속 업무가 하나도 없는 회의. 07이 빈 상태를 그렸다.
    { id: 'MTG-07', orgId: 'ORG-01', title: '후속 업무가 없는 회의', creatorMemberId: 'M-02' },
    { id: 'MTG-99', orgId: 'ORG-02', title: '남의 회의', creatorMemberId: 'M-99' },
  ])
  await db.insert(tasks).values([
    {
      id: 'T-01',
      orgId: 'ORG-01',
      fromMeetingId: 'MTG-06',
      title: '비상 연락망 최종본 배포',
      status: 'planned',
      assigneeMemberId: 'M-03',
      dueDate: new Date('2026-07-23T18:00:00+09:00'),
    },
    // 이미 끝난 업무. **'내 것'에는 오지 않는다** — 08이 '미완료'라 적었다.
    {
      id: 'T-02',
      orgId: 'ORG-01',
      fromMeetingId: 'MTG-06',
      title: '케이블 커버 구매',
      status: 'done',
      assigneeMemberId: 'M-03',
      dueDate: new Date('2026-07-22T18:00:00+09:00'),
    },
    // 담당자도 기한도 안 정한 업무. 붙일 말이 없으면 그 조각이 오지 않는다.
    {
      id: 'T-03',
      orgId: 'ORG-01',
      fromMeetingId: 'MTG-06',
      title: '안전 인력 배치안 확정',
      status: 'planned',
    },
    // 어느 회의에서도 나오지 않은 상시 업무. 이 목록에 오면 안 된다.
    { id: 'T-04', orgId: 'ORG-01', title: '학생 건의함 확인', status: 'planned' },
  ])
}, 60_000)

afterAll(async () => {
  await close()
})

describe('이 회의가 만든 후속 업무가 업무 표에서 온다', () => {
  it('회의에 걸린 업무만 오고 누가 언제까지가 이어져 온다', async () => {
    const rows = await followUps('MTG-06')
    expect(rows.map((row) => row.title)).toEqual([
      '케이블 커버 구매',
      '비상 연락망 최종본 배포',
      '안전 인력 배치안 확정',
    ])
    expect(rows[1]!.taskId).toBe('T-01')
    expect(rows[1]!.assigneeNote).toBe('정하늘 · 07.23까지')
  })

  // **붙었다 떨어지는 조각은 없이 온다.** 빈 글을 주면 화면이 빈 자리를 그린다.
  it('담당자도 기한도 없으면 그 조각이 오지 않는다', async () => {
    const rows = await followUps('MTG-06')
    const row = rows.find((one) => one.taskId === 'T-03')!
    expect('assigneeNote' in row).toBe(false)
  })

  it('업무가 없는 회의는 빈 목록이다', async () => {
    expect(await followUps('MTG-07')).toEqual([])
  })

  it('남의 학생회의 회의는 열리지 않는다', async () => {
    const res = await harness(MINE).request('/api/ops/meetings/MTG-99/follow-ups')
    expect(res.status).toBe(404)
  })
})

describe('그중 내 것만 따로 묻는다', () => {
  // **다른 물음이라 답도 다르다.** 끝난 것은 '미완료 후속 업무'가 아니다.
  it('나에게 배정된 미완료 업무만 온다', async () => {
    const rows = await mine('MTG-06')
    expect(rows.map((row) => row.title)).toEqual(['비상 연락망 최종본 배포'])
  })

  it('나에게 배정된 것이 없으면 빈 목록이다', async () => {
    expect(await mine('MTG-06', OTHER)).toEqual([])
  })

  it('남의 학생회의 회의는 열리지 않는다', async () => {
    const res = await harness(MINE).request('/api/ops/meetings/MTG-99/follow-ups/mine')
    expect(res.status).toBe(404)
  })
})
