import { and, asc, eq, ilike, isNull, or } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import { departments, members, organizations } from '../db/schema.ts'

// 조직도(ORG-03A · ORG-03B)가 읽는 것.
//
// **세는 말도 서버가 만든다.** '부원 2명'은 저장하는 값이 아니라 세어서 말로 만든
// 것이고, 화면이 세면 세는 규칙이 화면에 박힌다.

interface Person {
  id: string
  name: string
  major: string
  grade: string
}

/** 사람 한 줄. 없는 것을 빈 글로 대신하지 않는다. */
function person(row: { id: string; name: string; major: string | null; grade: string | null }): Person {
  return {
    id: row.id,
    name: row.name,
    major: row.major ?? '학부 미등록',
    grade: row.grade ?? '학년 미등록',
  }
}

export async function chartTitle(db: Db, orgId: string): Promise<{ name: string } | null> {
  const rows = await db
    .select({ name: organizations.name })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1)
  return rows[0] ?? null
}

/**
 * 회장단.
 *
 * **자리 이름은 사람마다 다르다** — 회장과 부회장은 권한이 같고 이름만 다르다.
 * 그림이 둘을 다른 색으로 갈라 그리므로 색도 서버가 고른다.
 */
export async function executives(db: Db, orgId: string) {
  const rows = await db
    .select({
      id: members.id,
      name: members.name,
      major: members.major,
      grade: members.grade,
      title: members.executiveTitle,
    })
    .from(members)
    .where(and(eq(members.orgId, orgId), eq(members.role, 'chair')))
    .orderBy(asc(members.name))

  // **자리 이름이 유일한 신호다.** 명세가 회장단 안의 차례를 따로 갖고 있지 않고,
  // 그림은 회장을 먼저 그리며 다른 색을 준다. 차례와 색이 같은 사실에서 나오므로
  // 한 자리에 둔다 — 흩으면 한쪽만 고쳐진다.
  const isChairperson = (title: string | null) => title === '회장'
  return rows
    .sort((a, b) => Number(isChairperson(b.title)) - Number(isChairperson(a.title)))
    .map((row) => ({
      ...person(row),
      roleLabel: row.title ?? '회장단',
      roleTone: isChairperson(row.title) ? 'yellow' : 'blue',
    }))
}

/** 부서와 그 안의 사람들. 부서장은 0명이거나 1명이다. */
export async function departmentTree(db: Db, orgId: string, query?: string) {
  const rows = await db
    .select({
      departmentId: departments.id,
      departmentName: departments.name,
      sortOrder: departments.sortOrder,
      memberId: members.id,
      name: members.name,
      major: members.major,
      grade: members.grade,
      isLeader: members.isDepartmentLeader,
    })
    .from(departments)
    .leftJoin(members, eq(members.departmentId, departments.id))
    .where(eq(departments.orgId, orgId))
    .orderBy(asc(departments.sortOrder), asc(departments.name), asc(members.name))

  const wanted = (query ?? '').trim().toLowerCase()
  const byId = new Map<
    string,
    { id: string; name: string; sortOrder: number; leaders: Person[]; members: Person[] }
  >()
  for (const row of rows) {
    const entry = byId.get(row.departmentId) ?? {
      id: row.departmentId,
      name: row.departmentName,
      sortOrder: row.sortOrder,
      leaders: [],
      members: [],
    }
    byId.set(row.departmentId, entry)
    if (row.memberId === null || row.name === null) continue
    // **거르는 것은 서버가 한다.** 받아온 것을 화면에서 거르면 '몇 명인지'가
    // 걸러지기 전 수가 된다.
    if (wanted !== '' && !row.name.toLowerCase().includes(wanted)) continue
    const who = person({ id: row.memberId, name: row.name, major: row.major, grade: row.grade })
    if (row.isLeader === true) entry.leaders.push(who)
    else entry.members.push(who)
  }

  return [...byId.values()].map((entry) => ({
    id: entry.id,
    name: entry.name,
    memberCountLabel: `부원 ${entry.members.length}명`,
    leaders: entry.leaders,
    members: entry.members,
  }))
}

/**
 * 아직 어느 자리에도 배정되지 않은 구성원.
 *
 * **조직에서 지운 사람이 아니다** — 가입은 했는데 부서가 정해지지 않은 상태다.
 */
export async function unassignedMembers(db: Db, orgId: string, query?: string) {
  const wanted = (query ?? '').trim()
  const rows = await db
    .select({
      id: members.id,
      name: members.name,
      major: members.major,
      grade: members.grade,
    })
    .from(members)
    .where(
      and(
        eq(members.orgId, orgId),
        isNull(members.departmentId),
        // 회장단은 부서에 들지 않아도 배정된 것이다. 자리가 따로 있다.
        or(eq(members.role, 'head'), eq(members.role, 'member')),
        wanted === '' ? undefined : ilike(members.name, `%${wanted}%`),
      ),
    )
    .orderBy(asc(members.name))
  return rows.map(person)
}

/** 미배정 패널의 안내 한 줄. 몇 명인지와 어떻게 옮기는지가 한 글자다. */
export async function unassignedHint(db: Db, orgId: string): Promise<{ hint: string }> {
  const rows = await unassignedMembers(db, orgId)
  return { hint: `${rows.length}명 · 드래그해서 부서로 이동` }
}
