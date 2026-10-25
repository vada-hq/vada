import { expect, test } from 'vitest'
import { departmentColorOf } from './department-color'

const departments = Array.from({ length: 9 }, (_, index) => ({ id: `d${index + 1}` }))

test('부서를 만든 순으로 범주 색 여덟을 돌려 쓰고, 아홉째 부서는 다시 처음 색이다', () => {
  const colors = departments.map(item => departmentColorOf(item.id, departments))
  expect(new Set(colors.slice(0, 8).map(color => color.line)).size).toBe(8)
  expect(colors[8]).toEqual(colors[0])
  expect(colors[0]?.line).toBe('border-l-category-1')
  expect(colors[0]?.chip).toContain('bg-category-1-soft')
})

test('학생회 업무(부서 없음)와 목록에 없는 부서는 회색이다', () => {
  const gray = departmentColorOf(null, departments)
  expect(gray.line).toBe('border-l-gray-400')
  expect(departmentColorOf('d99', departments)).toEqual(gray)
})
