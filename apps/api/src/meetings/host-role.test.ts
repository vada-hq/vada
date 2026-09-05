import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp, type Deps } from '../app.ts'
import type { Db } from '../db/client.ts'
import { freshDb } from '../db/testing.ts'
import {
  departments,
  meetingParticipants,
  meetings,
  members,
  organizations,
} from '../db/schema.ts'
import { inMemoryAttempts } from '../idempotency.ts'
import type { Viewer } from '../permissions.ts'
import { inMemoryCounter } from '../public/rate-limit.ts'
import { meetingLookups } from './lookups.ts'

// 진행 권한(OPS-MEET-04B · D03).
//
// 이 파일이 재는 것이 넷이다.
//
// 1. **회의를 만든 사람은 목록의 한 줄이 아니라 제 자리를 갖는다.** 04B가 맨 위
//    칸에 따로 그리고, 같은 사람을 03A와 다른 말로 적는다.
// 2. **권한이 무엇을 주고 무엇을 안 주는지는 서버의 글이다.** 명세가 이 글을 들면
//    권한이 하나 늘 때마다 명세가 틀린다.
// 3. **지금 몇 명인지는 세어서 온다.** 화면이 목록을 받아 세면 그 규칙이 화면에 박힌다.
// 4. **확인 글에 사람 이름이 박힌다.** 그 문장을 서버가 완성해 준다.

let db: Db
let close: () => Promise<void>
const NOW = new Date('2026-07-20T10:00:00+09:00')

function viewer(memberId = 'M-02'): Viewer {
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

function harness(who: Viewer | null = viewer()) {
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

const get = (path: string) => harness().request(path)
const body = async (path: string) => (await (await get(path)).json()) as Row

beforeAll(async () => {
  const fresh = await freshDb()
  db = fresh.db as unknown as Db
  close = fresh.close

  await db.insert(organizations).values([
    { id: 'ORG-01', name: '제12대 학생회' },
    { id: 'ORG-02', name: '옆 학생회' },
  ])
  await db.insert(departments).values([
    { id: 'D-01', orgId: 'ORG-01', name: '기획부' },
    { id: 'D-02', orgId: 'ORG-01', name: '운영부' },
  ])
  await db.insert(members).values([
    { id: 'M-01', orgId: 'ORG-01', name: '이수현', role: 'member', departmentId: 'D-01' },
    { id: 'M-02', orgId: 'ORG-01', name: '박해랑', role: 'member', departmentId: 'D-02' },
    // 부서에 아직 안 든 사람. 소속이 없을 때 무엇이 그려지는지를 이 사람이 잰다.
    { id: 'M-03', orgId: 'ORG-01', name: '정하늘', role: 'member' },
    { id: 'M-04', orgId: 'ORG-01', name: '김민준', role: 'head', departmentId: 'D-02' },
    // 이 학생회 사람이지만 이 회의에는 없다.
    { id: 'M-05', orgId: 'ORG-01', name: '이윤슬', role: 'member', departmentId: 'D-01' },
    { id: 'M-99', orgId: 'ORG-02', name: '남의사람', role: 'chair' },
  ])
  await db.insert(meetings).values([
    {
      id: 'MTG-05',
      orgId: 'ORG-01',
      title: '체육대회 안전 관리 최종 회의',
      status: 'scheduled',
      creatorMemberId: 'M-02',
    },
    // 부서 없는 사람이 만든 회의.
    {
      id: 'MTG-08',
      orgId: 'ORG-01',
      title: '부서 없는 사람이 만든 회의',
      status: 'scheduled',
      creatorMemberId: 'M-03',
    },
    // 만든 사람이 이 학생회를 떠난 회의. **없는 사람을 지어내지 않는다.**
    { id: 'MTG-11', orgId: 'ORG-01', title: '만든 사람이 없는 회의', status: 'scheduled' },
    { id: 'MTG-99', orgId: 'ORG-02', title: '남의 회의', creatorMemberId: 'M-99' },
  ])
  await db.insert(meetingParticipants).values([
    // 만든 사람도 참가자다. **진행 권한은 만든 사실에서 온다** — isHost가 아니다.
    { id: 'MP-01', orgId: 'ORG-01', meetingId: 'MTG-05', memberId: 'M-02' },
    { id: 'MP-02', orgId: 'ORG-01', meetingId: 'MTG-05', memberId: 'M-03', isHost: true },
    { id: 'MP-03', orgId: 'ORG-01', meetingId: 'MTG-05', memberId: 'M-01' },
    { id: 'MP-04', orgId: 'ORG-01', meetingId: 'MTG-05', memberId: 'M-04' },
  ])
}, 60_000)

afterAll(async () => {
  await close()
})

describe('회의를 만든 사람이 제 자리로 온다', () => {
  it('04B의 맨 위 칸이 저장소에서 온다', async () => {
    const row = await body('/api/ops/meetings/MTG-05/host-owner')
    expect(row.name).toBe('박해랑')
    // 03A는 같은 사람을 '시작·종료 가능'이라 적는다. 무엇을 보여주는 자리냐가 다르다.
    expect(row.departmentNote).toBe('운영부 · 권한 변경 및 회의 관리 가능')
    expect(row.chips).toEqual([
      { label: '회의 생성자', tone: 'gray' },
      { label: '진행 권한', tone: 'blue' },
    ])
    // 이 사람은 뺄 수 없다. 04B가 줄 단추도 안 그린다.
    expect(row.capabilityNote).toBe('필수 권한자')
  })

  it('부서가 없으면 가운뎃점만 남은 글을 주지 않는다', async () => {
    const row = await body('/api/ops/meetings/MTG-08/host-owner')
    expect(row.departmentNote).toBe('부서 미배정 · 권한 변경 및 회의 관리 가능')
  })

  it('만든 사람이 없으면 없다고 말한다', async () => {
    expect((await get('/api/ops/meetings/MTG-11/host-owner')).status).toBe(404)
  })

  it('남의 학생회의 회의는 열리지 않는다', async () => {
    expect((await get('/api/ops/meetings/MTG-99/host-owner')).status).toBe(404)
  })
})

describe('진행 권한이 무엇을 주고 무엇을 안 주는지', () => {
  it('04B의 안내와 규칙 딱지가 온다', async () => {
    const row = await body('/api/ops/meetings/MTG-05/permission-notice')
    expect(row.title).toBe('이 회의에만 적용되는 권한입니다')
    expect(String(row.grantNote)).toContain('회의 시작·종료')
    expect(String(row.limitNote)).toContain('회의 생성자만')
    // **최소 한 명은 남는다.** 그 규칙을 화면이 아니라 서버가 말한다.
    expect(row.ruleChipLabel).toBe('최소 1명 유지')
    expect(row.ruleChipTone).toBe('yellow')
  })

  // **세는 것은 서버의 일이다.** 만든 사람은 isHost가 아니어도 진행 권한자다.
  it('지금 몇 명인지 세어서 온다', async () => {
    const row = await body('/api/ops/meetings/MTG-05/permission-notice')
    expect(row.summaryNote).toBe('현재 진행 권한자 2명 · 일반 참가자 2명')
  })

  it('남의 학생회의 회의는 열리지 않는다', async () => {
    expect((await get('/api/ops/meetings/MTG-99/permission-notice')).status).toBe(404)
  })
})

describe('누구에게 권한을 주려는지 서버가 문장을 완성한다', () => {
  it('D03의 제목에 그 사람의 이름이 박혀 온다', async () => {
    const row = await body('/api/ops/meetings/MTG-05/host-grant-confirm?memberId=M-01')
    expect(row.title).toBe('이수현에게 진행 권한을 부여할까요?')
    expect(String(row.grantNote)).toContain('이 회의에서')
    expect(String(row.limitNote)).toContain('할 수 없습니다')
  })

  it('이 회의의 참가자가 아니면 없다고 말한다', async () => {
    const res = await get('/api/ops/meetings/MTG-05/host-grant-confirm?memberId=M-05')
    expect(res.status).toBe(404)
  })

  it('누구인지 안 넘기면 없다고 말한다', async () => {
    expect((await get('/api/ops/meetings/MTG-05/host-grant-confirm')).status).toBe(404)
  })

  it('남의 학생회의 회의는 열리지 않는다', async () => {
    const res = await get('/api/ops/meetings/MTG-99/host-grant-confirm?memberId=M-99')
    expect(res.status).toBe(404)
  })
})
