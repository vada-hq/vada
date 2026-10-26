import { expect, test } from 'vitest'
import { departmentColorOf } from './department-color'

const departments = Array.from({ length: 9 }, (_, index) => ({ id: `d${index + 1}` }))

test('기본색은 목록 순서·다른 부서의 삭제·추가와 관계없이 같은 부서에 고정된다', () => {
  const colors = departments.map(item => departmentColorOf(item.id, departments))
  for (const [index, department] of departments.entries()) {
    expect(departmentColorOf(department.id, [department])).toEqual(colors[index])
    expect(departmentColorOf(department.id, [...departments].reverse())).toEqual(colors[index])
  }
})

test('저장된 선택색은 기본색보다 우선하고 조직/업무가 동일한 토큰을 쓴다', () => {
  const color = departmentColorOf('d1', [{ id: 'd1', color: 'orange' }])
  expect(color.line).toBe('border-l-category-6')
  expect(color.chip).toBe('bg-category-6-soft text-category-6-strong')
})

test('학생회 업무(부서 없음)와 목록에 없는 부서는 회색이다', () => {
  const gray = departmentColorOf(null, departments)
  expect(gray.line).toBe('border-l-gray-400')
  expect(departmentColorOf('d99', departments)).toEqual(gray)
})
