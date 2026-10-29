import { and, asc, eq, isNull } from 'drizzle-orm'
import type { HomeOpsPerson } from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { council, councilMembership, department, departmentMembership } from '../db/schema.js'
import type { Db } from '../db/types.js'
import { memberNamesOf } from '../team/display-name.js'

type Reader = Pick<Db, 'select'>

// 얼굴 색 수(화면의 범주 색 여섯). 부서 색이 만든 순으로 범주 색을 돌려 쓰는 것과 같은 원리다(DEC-94).
const FACE_TINTS = 6

export interface OpsPeople {
  // 지금 기수의 운영진 → 얼굴 색 번호(들어온 차례 mod 6). 여기에 없는 사람은 지금 운영진이 아니다.
  tints: Map<string, number>
  // 지금 회장단(학생회 직급이 있는 사람)
  council: Set<string>
  // 이 학생회의 부서(부장이 없을 때 그 부서를 알리려고)
  departments: { id: string; name: string; finance: boolean }[]
  // 부서 → 그 부서의 지금 부장(먼저 맡은 사람 하나)
  heads: Map<string, { memberId: string; department: string; finance: boolean }>
  headTitle: string
  names: Map<string, string>
}

// 이 학생회 지금 기수의 운영진을 들어온 차례로. 같은 때 들어왔으면 소속 번호(uuidv7, 만든 차례) 순이다.
async function membersOf(db: Reader, actor: Actor) {
  return db
    .select({ memberId: councilMembership.memberId, rank: councilMembership.councilRank })
    .from(councilMembership)
    .where(and(eq(councilMembership.cohortId, actor.cohortId), isNull(councilMembership.endsAt)))
    .orderBy(asc(councilMembership.startsAt), asc(councilMembership.id))
}

// 이 학생회 부서의 지금 부장. 부서 소속도 학생회 소속도 끝나지 않은 사람만이다.
async function headsOf(db: Reader, actor: Actor, alive: Map<string, number>) {
  const rows = await db
    .select({
      departmentId: department.id,
      department: department.name,
      role: department.role,
      memberId: departmentMembership.memberId,
    })
    .from(departmentMembership)
    .innerJoin(department, eq(department.id, departmentMembership.departmentId))
    .where(
      and(
        eq(department.councilId, actor.councilId),
        eq(departmentMembership.cohortId, actor.cohortId),
        eq(departmentMembership.departmentRank, 'head'),
        isNull(departmentMembership.endsAt),
      ),
    )
    .orderBy(asc(departmentMembership.startsAt), asc(departmentMembership.id))
  const heads: OpsPeople['heads'] = new Map()
  for (const row of rows)
    if (alive.has(row.memberId) && !heads.has(row.departmentId))
      heads.set(row.departmentId, {
        memberId: row.memberId,
        department: row.department,
        finance: row.role === 'finance',
      })
  return heads
}

// ①의 연락할 사람을 정하는 데 드는 사람 정보를 한 번에 읽는다(부서 수만큼 질의가 돌지 않게).
export async function opsPeopleOf(db: Reader, actor: Actor): Promise<OpsPeople> {
  const members = await membersOf(db, actor)
  const tints = new Map(members.map((row, index) => [row.memberId, index % FACE_TINTS]))
  const presidents = new Set(members.filter(row => row.rank !== null).map(row => row.memberId))
  const heads = await headsOf(db, actor, tints)
  const departments = (
    await db
      .select({ id: department.id, name: department.name, role: department.role })
      .from(department)
      .where(eq(department.councilId, actor.councilId))
      .orderBy(asc(department.id))
  ).map(row => ({ id: row.id, name: row.name, finance: row.role === 'finance' }))
  const [titles] = await db
    .select({ headTitle: council.headTitle })
    .from(council)
    .where(eq(council.id, actor.councilId))
  const names = await memberNamesOf(db, actor.councilId, [...tints.keys()])
  return {
    tints,
    council: presidents,
    departments,
    heads,
    headTitle: titles?.headTitle ?? '',
    names,
  }
}

export function personOf(
  people: OpsPeople,
  memberId: string,
  role: HomeOpsPerson['role'],
): HomeOpsPerson | null {
  const tint = people.tints.get(memberId)
  const name = people.names.get(memberId)
  if (tint === undefined || name === undefined) return null
  return { memberId, name, role, tint }
}

// 부서 업무의 연락할 사람: 그 부서 부장
export function headOf(people: OpsPeople, departmentId: string) {
  const head = people.heads.get(departmentId)
  if (!head) return null
  return personOf(people, head.memberId, {
    kind: 'head',
    department: head.department,
    title: people.headTitle,
  })
}

// 결재의 연락할 사람: 재정 역할 부서의 부장
export function financeHeadOf(people: OpsPeople) {
  const found = financeDepartmentOf(people)
  const head = found && people.heads.get(found.id)
  if (!head) return null
  return personOf(people, head.memberId, {
    kind: 'finance_head',
    department: head.department,
    title: people.headTitle,
  })
}

// 부장이 연락할 사람인데 그 부서에 지금 부장이 없으면 그 부서
const headless = (people: OpsPeople, found: OpsPeople['departments'][number] | undefined) =>
  !found || people.heads.has(found.id) ? null : { id: found.id, name: found.name }

export const headlessOf = (people: OpsPeople, departmentId: string) =>
  headless(
    people,
    people.departments.find(row => row.id === departmentId),
  )

// 결재의 기준 부서: 재정 역할 부서 가운데 지금 부장이 있는 첫 부서, 없으면 첫 재정 역할 부서(부서 번호 차례).
// 연락할 사람과 부장 없음을 이 한 부서로 정해 둘이 서로 다른 부서를 가리키지 않게 한다.
function financeDepartmentOf(people: OpsPeople) {
  const finance = people.departments.filter(row => row.finance)
  return finance.find(row => people.heads.has(row.id)) ?? finance[0]
}

// 결재는 재정 역할 부서를 본다. 그런 부서가 없으면 null이다('재정 담당 없음'이 맡는다).
export const financeHeadlessOf = (people: OpsPeople) =>
  headless(people, financeDepartmentOf(people))
