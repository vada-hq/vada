import { expect, test } from 'vitest'
import { emptyIncome, receivedRange } from './income-form'

const period = { startsOn: '2026-03-01', endsOn: '2026-08-31' }

test('지금 기간이면 받은 날은 오늘까지다', () => {
  expect(receivedRange(period, '2026-05-10')).toEqual({ min: '2026-03-01', max: '2026-05-10' })
  expect(emptyIncome(period, '2026-05-10').receivedOn).toBe('2026-05-10')
})

test('지난 기간이면 받은 날의 최대와 기본값은 끝일이다', () => {
  expect(receivedRange(period, '2026-10-23')).toEqual({ min: '2026-03-01', max: '2026-08-31' })
  expect(emptyIncome(period, '2026-10-23').receivedOn).toBe('2026-08-31')
})

test('끝일 당일과 시작일 당일은 고를 수 있다', () => {
  expect(receivedRange(period, '2026-08-31').max).toBe('2026-08-31')
  const { min, max } = receivedRange(period, '2026-03-01')
  expect(min).toBe(max)
})

test('시작 전 기간이면 고를 수 있는 날이 없다(min이 max보다 늦다)', () => {
  const { min, max } = receivedRange(period, '2026-02-01')
  expect(min > max).toBe(true)
})
