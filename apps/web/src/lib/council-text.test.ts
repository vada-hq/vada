import { expect, test } from 'vitest'
import { operatingYearText, scopeText } from './council-text'

test('대표 범위 글은 있는 칸만 잇는다(지금은 학교)', () => {
  expect(scopeText({ schoolName: '한양대학교 ERICA' })).toBe('한양대학교 ERICA')
  expect(scopeText({ schoolName: ' ' })).toBe('')
})

test('운영 연도 글은 네 자리 숫자 기수 이름에 년을 붙이고, 다른 이름은 그대로, 없으면 빈 글이다', () => {
  expect(operatingYearText('2026')).toBe('2026년')
  expect(operatingYearText('제12대')).toBe('제12대')
  expect(operatingYearText('20261')).toBe('20261')
  expect(operatingYearText(null)).toBe('')
})
