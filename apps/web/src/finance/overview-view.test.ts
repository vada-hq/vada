import { expect, test } from 'vitest'
import { overviewFixture } from '@/test-support/overview-fixtures'
import { placeOf, rateOf, sourcesLabel, wholeRateOf } from './overview-view'

test('맨 위 집행률은 소수 한 자리, 행사 줄은 정수이고 예산이 0이면 없다', () => {
  expect(rateOf(413_000, 1_000_000)).toBe(41.3)
  expect(rateOf(1, 3)).toBe(33.3)
  expect(rateOf(150, 100)).toBe(150)
  expect(rateOf(10, 0)).toBeNull()
  expect(wholeRateOf(270_000, 500_000)).toBe(54)
  expect(wholeRateOf(0, 0)).toBeNull()
})

test('재원 이름은 첫 이름과 나머지 수다', () => {
  expect(sourcesLabel([])).toBeNull()
  expect(sourcesLabel(['학생회비'])).toBe('학생회비')
  expect(sourcesLabel(['학생회비', '지원금', '이월금'])).toBe('학생회비 외 2건')
})

test('최근 지출의 자리는 행사가 있으면 행사, 없으면 사용처다', () => {
  const [withEvent, withoutEvent] = overviewFixture().recent
  expect(withEvent && placeOf(withEvent)).toBe('체육대회')
  expect(withoutEvent && placeOf(withoutEvent)).toBe('편의점')
})
