import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isStrictObject } from './input.js'
import {
  DEPARTMENT_COLORS,
  defaultDepartmentColor,
  UpdateDepartmentColorSchema,
} from './department-colors.js'

test('부서의 기본색은 같은 식별자에 고정되고 제한된 팔레트 안에 있다', () => {
  const id = '0192f2a0-0000-7000-8000-000000000001'
  assert.equal(defaultDepartmentColor(id), defaultDepartmentColor(id.toUpperCase()))
  for (let index = 0; index < 100; index++) {
    const color = defaultDepartmentColor(`${id}${index}`)
    assert.ok(DEPARTMENT_COLORS.includes(color))
    assert.equal(color, defaultDepartmentColor(`${id}${index}`))
  }
})

test('부서 색 변경은 팔레트 키 하나만 받으며 임의 CSS·누락·모르는 키를 거절한다', () => {
  assert.equal(isStrictObject(UpdateDepartmentColorSchema), true)
  for (const color of DEPARTMENT_COLORS)
    assert.deepEqual(UpdateDepartmentColorSchema.parse({ color }), { color })
  for (const value of [
    {},
    { color: null },
    { color: '' },
    { color: ' ' },
    { color: '#ff0000' },
    { color: 'teal\u0000' },
    { color: '\uD800' },
    { color: '😀'.repeat(100) },
    { color: 'teal', name: '다른 이름' },
  ])
    assert.equal(UpdateDepartmentColorSchema.safeParse(value).success, false)
})
