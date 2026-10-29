import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isStrictObject } from './input.js'
import {
  AssignDepartmentSchema,
  ChangeRankSchema,
  CreateDepartmentSchema,
  DEPARTMENT_NAME_MAX,
  sortByRank,
  TransferPresidentSchema,
  UpdateDepartmentSchema,
  type TeamMember,
} from './team.js'

const id = '0192F2A0-0000-7000-8000-000000000001'

test('부서 배정: 부서 번호는 uuid(소문자로 맞춤), 직급은 부장·부부장·없음이다', () => {
  assert.deepEqual(AssignDepartmentSchema.parse({ departmentId: id, rank: null }), {
    departmentId: id.toLowerCase(),
    rank: null,
  })
  for (const rank of ['head', 'vice_head'])
    assert.equal(AssignDepartmentSchema.safeParse({ departmentId: id, rank }).success, true)
  const bad: unknown[] = [
    {},
    { departmentId: id },
    { rank: null },
    { departmentId: '', rank: null },
    { departmentId: 'probe', rank: null },
    { departmentId: `${id}0`, rank: null },
    { departmentId: `${id.slice(0, -1)}\u0000`, rank: null },
    { departmentId: id, rank: 'president' },
    { departmentId: id, rank: 'HEAD' },
    { departmentId: id, rank: null, extra: 1 },
  ]
  for (const value of bad)
    assert.equal(AssignDepartmentSchema.safeParse(value).success, false, JSON.stringify(value))
})

test('직급: 부회장 주고 거두기만 받는다. 회장은 넘기기로만 바뀐다', () => {
  assert.deepEqual(ChangeRankSchema.parse({ rank: 'vice_president' }), { rank: 'vice_president' })
  assert.deepEqual(ChangeRankSchema.parse({ rank: null }), { rank: null })
  for (const value of [{}, { rank: 'president' }, { rank: '' }, { rank: null, extra: 1 }]) {
    assert.equal(ChangeRankSchema.safeParse(value).success, false, JSON.stringify(value))
  }
})

test('회장 넘기기: 넘겨받을 운영진 번호 하나만 받는다', () => {
  assert.deepEqual(TransferPresidentSchema.parse({ memberId: id }), { memberId: id.toLowerCase() })
  for (const value of [
    {},
    { memberId: '' },
    { memberId: '😀'.repeat(37) },
    { memberId: '\uD800' },
    { memberId: id, extra: 1 },
  ]) {
    assert.equal(TransferPresidentSchema.safeParse(value).success, false, JSON.stringify(value))
  }
  for (const schema of [AssignDepartmentSchema, ChangeRankSchema, TransferPresidentSchema])
    assert.equal(isStrictObject(schema), true)
})

test('부서 만들기와 고치기: 이름은 20자까지, 역할은 재정이나 없음이다', () => {
  assert.deepEqual(CreateDepartmentSchema.parse({ name: ' 홍보부 ' }), { name: '홍보부' })
  assert.deepEqual(UpdateDepartmentSchema.parse({ name: '사무국', role: 'finance' }), {
    name: '사무국',
    role: 'finance',
  })
  assert.deepEqual(UpdateDepartmentSchema.parse({ name: '사무국', role: null }), {
    name: '사무국',
    role: null,
  })
  assert.equal(
    CreateDepartmentSchema.safeParse({ name: '😀'.repeat(DEPARTMENT_NAME_MAX) }).success,
    true,
  )
  const cases: [{ safeParse: (value: unknown) => { success: boolean } }, unknown][] = [
    [CreateDepartmentSchema, {}],
    [CreateDepartmentSchema, { name: ' ' }],
    [CreateDepartmentSchema, { name: '😀'.repeat(DEPARTMENT_NAME_MAX + 1) }],
    [CreateDepartmentSchema, { name: '부\u0000' }],
    [CreateDepartmentSchema, { name: '\uD800' }],
    [CreateDepartmentSchema, { name: '홍보부', role: 'finance' }],
    [UpdateDepartmentSchema, { name: '사무국' }],
    [UpdateDepartmentSchema, { name: '사무국', role: 'leadership' }],
    [UpdateDepartmentSchema, { name: '', role: null }],
    [UpdateDepartmentSchema, { name: '사무국', role: null, extra: 1 }],
  ]
  for (const [schema, value] of cases)
    assert.equal(schema.safeParse(value).success, false, JSON.stringify(value))
  for (const schema of [CreateDepartmentSchema, UpdateDepartmentSchema])
    assert.equal(isStrictObject(schema), true)
})

const member = (
  id: string,
  name: string,
  councilRank: TeamMember['councilRank'],
  departments: Omit<TeamMember['departments'][number], 'actions'>[] = [],
): TeamMember => ({
  id,
  name,
  councilRank,
  departments: departments.map(item => ({ ...item, actions: [] })),
  actions: [],
  joinedAt: '2026-10-01T01:00:00.000Z',
})
const namesOf = (list: TeamMember[]) => list.map(item => item.name)

test('묶음 안 차례: 회장, 부회장, 그 부서의 부장, 부부장, 직급 없음 순이다(시연 학생회의 재정부·기획부)', () => {
  // 들어온 순서로 받은 그대로다. 김바다는 회장이면서 재정부 소속이다.
  const finance = [
    member('m1', '김바다', 'president', [{ id: 'f', rank: null }]),
    member('m2', '황성욱', null, [{ id: 'f', rank: 'head' }]),
    member('m3', '김민준', null, [{ id: 'f', rank: null }]),
    member('m4', '정수빈', null, [{ id: 'f', rank: null }]),
    member('m5', '오현우', null, [{ id: 'f', rank: null }]),
  ]
  assert.deepEqual(namesOf(sortByRank(finance, 'f')), ['김바다', '황성욱', '김민준', '오현우', '정수빈'])
  const planning = [
    member('p1', '이지우', null, [{ id: 'p', rank: null }]),
    member('p2', '강도윤', null, [{ id: 'p', rank: null }]),
    member('p3', '윤채원', null, [{ id: 'p', rank: null }]),
    member('p4', '백승훈', null, [{ id: 'p', rank: 'head' }]),
  ]
  assert.deepEqual(namesOf(sortByRank(planning, 'p')), ['백승훈', '강도윤', '윤채원', '이지우'])
  const council = [
    member('c2', '이서연', 'vice_president'),
    member('c1', '김바다', 'president', [{ id: 'f', rank: null }]),
  ]
  assert.deepEqual(namesOf(sortByRank(council, null)), ['김바다', '이서연'])
})

test('묶음 안 차례: 부회장은 부장보다, 부장은 부부장보다 앞이고 직급은 그 부서의 것을 본다', () => {
  const list = [
    member('a', '가람', null, [{ id: 'p', rank: null }]),
    member('b', '나래', null, [{ id: 'p', rank: 'vice_head' }]),
    // 다른 부서의 부장이어도 이 부서에서는 직급이 없다.
    member('c', '다솜', null, [
      { id: 'p', rank: null },
      { id: 'x', rank: 'head' },
    ]),
    member('d', '라온', null, [{ id: 'p', rank: 'head' }]),
    member('e', '마루', 'vice_president', [{ id: 'p', rank: null }]),
  ]
  assert.deepEqual(namesOf(sortByRank(list, 'p')), ['마루', '라온', '나래', '가람', '다솜'])
})

test('묶음 안 차례: 부장이 없는 부서는 부부장부터, 직급 없는 사람은 맨 뒤다', () => {
  const list = [
    member('a', '하늘', null, [{ id: 'p', rank: null }]),
    member('b', '보라', null, [{ id: 'p', rank: 'vice_head' }]),
    member('c', '가람', null, [{ id: 'p', rank: null }]),
  ]
  assert.deepEqual(namesOf(sortByRank(list, 'p')), ['보라', '가람', '하늘'])
})

test('같은 직급은 이름 가나다순(한국어 비교)이고, 이름도 같으면 번호순이다', () => {
  const list = [
    member('id-2', '김민수', null),
    member('id-9', 'Bob', null),
    member('id-1', '김민수', null),
    member('id-3', 'alice', null),
    member('id-4', '가람', null),
  ]
  const sorted = sortByRank(list, null)
  // 한국어 비교라 한글이 로마자보다 앞이고 대소문자를 차례로 보지 않는다(코드 값 비교면 'Bob', 'alice', '가람' 순이다).
  assert.deepEqual(namesOf(sorted), ['가람', '김민수', '김민수', 'alice', 'Bob'])
  assert.deepEqual(
    sorted.slice(1, 3).map(item => item.id),
    ['id-1', 'id-2'],
  )
  // 받은 목록은 바꾸지 않는다.
  assert.equal(list[0]?.id, 'id-2')
})
