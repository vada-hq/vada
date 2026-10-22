import { eq } from 'drizzle-orm'
import type { CouncilRank, DepartmentRank } from '@vada/contracts'
import { actorOfMember, type Actor } from '../src/access/actor.js'
import { syncRooms } from '../src/chat/rooms.js'
import { department } from '../src/db/schema.js'
import type { Tx } from '../src/db/types.js'
import { clockNow, createRecord } from '../src/records/records.js'
import { assignDepartment, createDepartment } from '../src/team/service.js'

// 시연 학생회의 가상 운영진 7명. 로그인 계정이 없고(member_login 없음) 이메일은 .invalid라 실제 로그인이 이어 붙을 수 없다.
// 이름은 지어낸 것이다. 회장은 명령에 준 계정이라 여기 없다.
type DemoDepartment = 'planning' | 'finance' | 'publicity'
const DEPARTMENT_NAMES = { planning: '기획부', finance: '재정부', publicity: '홍보부' } as const
type Person = {
  name: string
  councilRank: CouncilRank | null
  department: DemoDepartment | null
  rank: DepartmentRank | null
}
const PEOPLE = {
  vice: { name: '김서연', councilRank: 'vice_president', department: null, rank: null },
  planningHead: { name: '박민준', councilRank: null, department: 'planning', rank: 'head' },
  planningMember: { name: '이하은', councilRank: null, department: 'planning', rank: null },
  financeHead: { name: '최지우', councilRank: null, department: 'finance', rank: 'head' },
  financeMember: { name: '정도윤', councilRank: null, department: 'finance', rank: null },
  publicityHead: { name: '한유진', councilRank: null, department: 'publicity', rank: 'head' },
  publicityMember: { name: '오세린', councilRank: null, department: 'publicity', rank: null },
} as const satisfies Record<string, Person>
type PersonKey = keyof typeof PEOPLE

// 회장과 가상 운영진을 한 손에 쥐는 모양. 서비스 함수는 모두 이 Actor로 부른다.
export type DemoCast = Record<'president' | PersonKey, Actor>

const keysOf = Object.keys(PEOPLE) as PersonKey[]

// 재정부는 학생회를 만들 때 생기고, 나머지 둘은 여기서 만든다. 번호는 이름으로 찾는다.
async function departmentIds(tx: Tx, president: Actor) {
  await createDepartment(tx, president, DEPARTMENT_NAMES.planning)
  await createDepartment(tx, president, DEPARTMENT_NAMES.publicity)
  const rows = await tx
    .select({ id: department.id, name: department.name })
    .from(department)
    .where(eq(department.councilId, president.councilId))
  const idOf = (name: string) => {
    const found = rows.find(row => row.name === name)
    if (!found) throw new Error('Demo department is missing')
    return found.id
  }
  return {
    planning: idOf(DEPARTMENT_NAMES.planning),
    finance: idOf(DEPARTMENT_NAMES.finance),
    publicity: idOf(DEPARTMENT_NAMES.publicity),
  }
}

async function addPerson(tx: Tx, president: Actor, person: Person, order: number) {
  const memberId = await createRecord(tx, {
    kind: 'member',
    councilId: null,
    actor: null,
    values: { name: person.name, email: `demo-${order}@demo.vada.invalid` },
  })
  await createRecord(tx, {
    kind: 'council_membership',
    councilId: president.councilId,
    actor: president.memberId,
    values: {
      memberId,
      cohortId: president.cohortId,
      councilRank: person.councilRank,
      startsAt: clockNow,
    },
  })
  return memberId
}

// 운영진을 들이고 부서를 나눈 뒤 방을 맞추고, 각자의 Actor를 읽어 돌려준다.
export async function createCast(tx: Tx, president: Actor, now: Date): Promise<DemoCast> {
  const departments = await departmentIds(tx, president)
  const memberIds = {} as Record<PersonKey, string>
  for (const [order, key] of keysOf.entries()) {
    const person: Person = PEOPLE[key]
    memberIds[key] = await addPerson(tx, president, person, order)
    if (person.department)
      await assignDepartment(tx, president, {
        memberId: memberIds[key],
        departmentId: departments[person.department],
        rank: person.rank,
      })
  }
  await syncRooms(tx, president)
  const cast = { president } as DemoCast
  for (const key of keysOf) {
    const actor = await actorOfMember(tx, memberIds[key], president.councilId, now)
    if (!actor) throw new Error('Demo member has no current membership')
    cast[key] = actor
  }
  return cast
}
