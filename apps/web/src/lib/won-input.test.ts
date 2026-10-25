import { expect, test } from 'vitest'
import { wonOf } from './won-input'

test('금액 칸은 쉼표와 공백을 받고, 숫자 입력이 아닌 글(빈 칸, 지수, 16진수, 소수, 음수)은 NaN이다', () => {
  expect(wonOf('4,000')).toBe(4000)
  expect(wonOf(' 5 000 ')).toBe(5000)
  expect(wonOf('0')).toBe(0)
  for (const text of ['', ' ', '1e3', '0x10', '1.5', '-1', '오천']) expect(wonOf(text)).toBeNaN()
})
