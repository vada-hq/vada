import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isStrictObject } from './input.js'
import {
  AssignDepartmentSchema,
  ChangeRankSchema,
  CreateDepartmentSchema,
  DEPARTMENT_NAME_MAX,
  TransferPresidentSchema,
  UpdateDepartmentSchema,
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
