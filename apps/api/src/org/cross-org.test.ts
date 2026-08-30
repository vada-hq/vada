import { beforeEach, beforeAll, afterAll, describe, expect, it } from 'vitest'
import { freshDb } from '../db/testing.ts'
import { departments, events, members, organizations } from '../db/schema.ts'
import { departmentTree, unassignedMembers } from './chart.ts'
import { eventList } from '../events/events.ts'
import type { Db } from '../db/client.ts'

// **남의 학생회가 새는가.**
//
// 모든 조회가 `where orgId = ?`를 갖는지가 이 서비스의 가장 기본적인 벽이다.
// 그런데 그 벽은 **뿌리 표에만** 있었다. 이어 붙인 표(join)는 자기 조직을 확인하지
// 않았고, 표가 다른 조직의 줄을 가리키는 것을 막는 것도 없었다.
//
// 2026-08-31 교차검토가 짚었고 여기서 재현한다. 재현되지 않는 지적은 고치지 않는다.

let db: Db
let close: () => Promise<void>

beforeAll(async () => {
  const fresh = await freshDb()
  db = fresh.db as unknown as Db
  close = fresh.close
}, 60_000)

beforeEach(async () => {
  await db.delete(events)
  await db.delete(members)
  await db.delete(departments)
  await db.delete(organizations)

  await db.insert(organizations).values([
    { id: 'ORG-A', name: '우리 학생회' },
    { id: 'ORG-B', name: '옆 학생회' },
  ])
  await db.insert(departments).values([
    { id: 'D-A', orgId: 'ORG-A', name: '기획부' },
    { id: 'D-B', orgId: 'ORG-B', name: '남의 부서' },
  ])
})

afterAll(async () => {
  await close()
})

describe('남의 학생회는 새지 않는다', () => {
  // **벽이 두 겹인지 잰다.**
  //
  // 표가 그 상태를 못 만들게 막지만(아래 검사), 조회도 스스로 자기 조직을 봐야
  // 한다 — 제약이 언젠가 느슨해지거나 다른 길로 값이 들어와도 새지 않게.
  //
  // 두 번째 벽을 재려면 첫 번째 벽을 잠깐 떼야 한다. 떼지 않으면 이 상태를
  // 만들 수조차 없어서 **조회가 정말 거르는지 알 수 없다.**
  it('제약을 떼도 조직도가 남의 조직 사람을 그리지 않는다', async () => {
    await db.execute('alter table members drop constraint members_department_same_org')
    try {
      await db.insert(members).values([
        { id: 'M-A', orgId: 'ORG-A', name: '우리사람', departmentId: 'D-A' },
        { id: 'M-B', orgId: 'ORG-B', name: '남의사람', departmentId: 'D-A' },
      ])
      const rows = await departmentTree(db, 'ORG-A')
      const 기획부 = rows.find((row) => row.id === 'D-A')!
      expect(기획부.members.map((who) => who.name)).toEqual(['우리사람'])
      expect(기획부.memberCountLabel).toBe('부원 1명')
    } finally {
      // 제약을 되돌리려면 그것을 어기는 줄부터 치워야 한다.
      await db.delete(members)
      await db.execute(
        'alter table members add constraint members_department_same_org ' +
          'foreign key (org_id, department_id) references departments(org_id, id) on delete set null',
      )
    }
  })

  it('미배정 목록에도 남의 조직 사람이 오지 않는다', async () => {
    await db.insert(members).values([
      { id: 'M-A', orgId: 'ORG-A', name: '우리사람', departmentId: null },
      { id: 'M-B', orgId: 'ORG-B', name: '남의사람', departmentId: null },
    ])
    const rows = await unassignedMembers(db, 'ORG-A')
    expect(rows.map((who) => who.name)).toEqual(['우리사람'])
  })

  // 행사의 담당 부서·담당자도 같은 구조다.
  it('제약을 떼도 행사가 남의 조직 담당을 그리지 않는다', async () => {
    await db.execute('alter table events drop constraint events_host_department_same_org')
    await db.execute('alter table events drop constraint events_host_member_same_org')
    try {
      await db.insert(members).values({
        id: 'M-B',
        orgId: 'ORG-B',
        name: '남의사람',
        departmentId: 'D-B',
      })
      await db.insert(events).values({
        id: 'E-A',
        orgId: 'ORG-A',
        title: '우리 행사',
        hostDepartmentId: 'D-B',
        hostMemberId: 'M-B',
        updatedAt: new Date('2026-07-18T09:00:00+09:00'),
      })

      const rows = await eventList(
        db,
        'ORG-A',
        {},
        { now: () => new Date('2026-07-18T09:00:00+09:00') },
      )
      expect(rows).toHaveLength(1)
      // 남의 이름이 새지 않는다. 담당이 없는 것으로 보인다.
      expect(rows[0]!.host).toBe('담당 미정')
    } finally {
      await db.delete(events)
      await db.delete(members)
      await db.execute(
        'alter table events add constraint events_host_department_same_org ' +
          'foreign key (org_id, host_department_id) references departments(org_id, id) on delete set null',
      )
      await db.execute(
        'alter table events add constraint events_host_member_same_org ' +
          'foreign key (org_id, host_member_id) references members(org_id, id) on delete set null',
      )
    }
  })

  // **표가 그것을 막아야 한다.** 손으로 거르는 것은 자리마다 잊을 수 있고,
  // 잊은 자리는 조용하다.
  it('구성원이 남의 조직 부서를 가리키는 것을 표가 막는다', async () => {
    await expect(
      db.insert(members).values({
        id: 'M-B2',
        orgId: 'ORG-B',
        name: '남의사람',
        departmentId: 'D-A',
      }),
    ).rejects.toThrow()
  })

  it('행사가 남의 조직 부서를 담당으로 가리키는 것을 표가 막는다', async () => {
    await expect(
      db.insert(events).values({
        id: 'E-A2',
        orgId: 'ORG-A',
        title: '우리 행사',
        hostDepartmentId: 'D-B',
        updatedAt: new Date(),
      }),
    ).rejects.toThrow()
  })
})
