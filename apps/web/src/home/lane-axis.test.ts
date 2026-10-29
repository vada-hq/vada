import { expect, test } from 'vitest'
import { alphaAt, axisDays, axisOf } from './lane-axis'

test('축은 넓으면 14일, 좁으면 7일이고 오늘 선은 행사 네모 칸 끝, 마지막 날은 반 칸을 남긴다', () => {
  const wide = axisOf(960)
  expect([wide.days, wide.gutter, wide.x(0)]).toEqual([14, 32, 32])
  expect(wide.x(13) + wide.step / 2).toBeCloseTo(960)
  const narrow = axisOf(320)
  expect([narrow.days, narrow.gutter]).toEqual([7, 28])
})

test('막대 진하기는 오늘 쪽이 진하고 축 끝으로 옅어진다', () => {
  const axis = axisOf(960)
  expect(alphaAt(axis, axis.x(0))).toBeCloseTo(0.85)
  expect(alphaAt(axis, axis.width)).toBeCloseTo(0.06)
  expect(alphaAt(axis, axis.x(3))).toBeGreaterThan(alphaAt(axis, axis.x(10)))
})

test('축 머리 날짜는 서버가 준 오늘부터이고 달이 바뀌는 날을 안다', () => {
  const days = axisDays('2026-10-30', 3)
  expect(days.map(day => [day.date, day.month, day.weekday])).toEqual([
    [30, 10, '금'],
    [31, 10, '토'],
    [1, 11, '일'],
  ])
})
