import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { freshDb } from '../db/testing.ts'
import { departments, members, organizations, permissionChanges, users } from '../db/schema.ts'
import type { Db } from '../db/client.ts'
import { memberToRemove, removeMember } from './removal.ts'
import { changeRole } from './role-change.ts'
import { unassignedMembers } from './chart.ts'

// 구성원을 학생회에서 내보낸다(ORG-03B → ORG-03D).
//
// **되돌릴 수 없는 일이라 이 파일이 재는 것은 '했는가'가 아니라 '못 하게 막는가'다.**
// 자기 자신, 마지막 회장, 이미 나간 사람 — 셋이 막히지 않으면 학생회 하나가 열리지
// 않는 채로 남거나, 두 사람의 서로 다른 일이 같은 답을 받는다.

let db: Db
let close: () => Promise<void>
const NOW = new Date('2026-09-06T10:00:00+09:00')
const now = () => NOW

beforeAll(async () => {
  const fresh = await freshDb()
  db = fresh.db as unknown as Db
  close = fresh.close
}, 60_000)

afterAll(async () => {
  await close()
})

beforeEach(async () => {
  await db.delete(permissionChanges)
  await db.delete(members)
  await db.delete(departments)
  await db.delete(organizations)
  await db.delete(users)

  await db.insert(users).values({ id: 'U-CHAIR', email: 'chair@example.com' })
  await db.insert(organizations).values({ id: 'ORG-01', name: '우리 학생회' })
  await db.insert(departments).values({ id: 'D-01', orgId: 'ORG-01', name: '기획부' })
  await db.insert(members).values([
    { id: 'M-CHAIR', orgId: 'ORG-01', userId: 'U-CHAIR', name: '김바다', role: 'chair' },
    { id: 'M-CHAIR2', orgId: 'ORG-01', name: '이윤슬', role: 'chair' },
    {
      id: 'M-01',
      orgId: 'ORG-01',
      name: '박하늘',
      role: 'head',
      departmentId: 'D-01',
      isDepartmentLeader: true,
    },
  ])
})

const remove = (memberId: string, actorMemberId = 'M-CHAIR') =>
  removeMember(db, 'ORG-01', { memberId, actorMemberId, actorUserId: 'U-CHAIR', now })

describe('확인 화면이 누구인지 말한다', () => {
  it('묻는 말에 이름이 든다 — 화면이 문장을 잇지 않는다', async () => {
    expect(await memberToRemove(db, 'ORG-01', 'M-01')).toEqual({
      question: '박하늘 님을 내보낼까요?',
      name: '박하늘',
    })
  })

  it('이미 나간 사람에게는 물을 것이 없다', async () => {
    await remove('M-01')
    expect(await memberToRemove(db, 'ORG-01', 'M-01')).toBeNull()
  })

  it('남의 학생회 사람은 없는 것이다', async () => {
    expect(await memberToRemove(db, 'ORG-02', 'M-01')).toBeNull()
  })
})

describe('내보내면 나가고, 줄은 남는다', () => {
  it('명단에서 빠지지만 표에는 남는다', async () => {
    await remove('M-01')
    expect(await unassignedMembers(db, 'ORG-01')).toEqual([])
    const rows = await db.select().from(members).where(eq(members.id, 'M-01'))
    expect(rows[0]?.name).toBe('박하늘')
    expect(rows[0]?.leftAt).toEqual(NOW)
  })

  it('자리를 비운다 — 다시 들여도 옛 부서에 앉아 있지 않는다', async () => {
    await remove('M-01')
    const rows = await db.select().from(members).where(eq(members.id, 'M-01'))
    expect(rows[0]?.departmentId).toBeNull()
    expect(rows[0]?.isDepartmentLeader).toBe(false)
  })

  it('권한을 없앤 기록이 3년 남는 표에 적힌다', async () => {
    await remove('M-01')
    const rows = await db.select().from(permissionChanges)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.subjectName).toBe('박하늘')
    expect(rows[0]?.before).toBe('head')
    expect(rows[0]?.after).toBe('나감')
    expect(rows[0]?.actorUserId).toBe('U-CHAIR')
  })
})

describe('막는 것 셋', () => {
  it('이미 나간 사람을 또 내보내면 409다 — 남이 먼저 한 것과 두 번 누른 것은 다르다', async () => {
    await remove('M-01')
    await expect(remove('M-01')).rejects.toThrow('이미 나간 구성원입니다')
  })

  it('자기 자신은 못 내보낸다', async () => {
    await expect(remove('M-CHAIR')).rejects.toThrow('자기 자신을 내보낼 수 없습니다')
  })

  it('마지막 회장은 못 내보낸다 — 아무도 못 여는 학생회가 된다', async () => {
    await remove('M-CHAIR2')
    await expect(remove('M-CHAIR', 'M-CHAIR2')).rejects.toThrow('마지막 회장은 내보낼 수 없습니다')
  })

  it('같은 순간에 역할을 바꾸고 내보내도 기록 둘이 다 남는다', async () => {
    // 열쇠가 `사람:시각`뿐이던 동안 뒤엣것이 500으로 죽었다 — 3년 남겨야 하는
    // 기록이 조용히 하나 사라지는 자리였다.
    await changeRole(db, 'ORG-01', {
      memberId: 'M-01',
      baseRole: 'member',
      actorUserId: 'U-CHAIR',
      now,
    })
    await remove('M-01')
    const rows = await db.select().from(permissionChanges)
    expect(rows.map((row) => row.change).sort()).toEqual(['기본 역할 변경', '학생회에서 내보냄'])
  })

  it('없는 사람은 없다고 한다', async () => {
    await expect(remove('M-없음')).rejects.toThrow('그 구성원을 찾지 못했습니다')
  })
})
