import { expect, test } from 'vitest'
import { eventDayText, factStats, ownerText, recordChips } from './record-view'
import { facts } from './record-fixtures'

test('숫자 넷을 읽는 글로 바꾼다. 비율은 반올림한다', () => {
  expect(factStats(facts()).map(stat => [stat.label, stat.value, stat.note])).toEqual([
    ['신청 → 참석', '26명 → 22명', '참석률 85%'], ['예산 → 집행', '700,000원 → 512,700원', '집행률 73%'],
    ['업무', '완료 3/3건', '지연 1건'], ['구매', '요청 4건 · 승인 3건', undefined]])
})

test('신청을 받지 않았거나 예산이 없거나 업무가 없을 때', () => {
  const stats = factStats(facts({ registrations: null, finance: { budget: null, spent: 64000 }, tasks: { total: 0, done: 0, late: 0 } }))
  expect(stats.map(stat => [stat.value, stat.note])).toEqual([['신청 안 받음', undefined], ['집행 64,000원', '예산 미정'], ['업무 없음', undefined],
    ['요청 4건 · 승인 3건', undefined]])
  expect(factStats(facts({ finance: { budget: 0, spent: 0 } }))[1]!.note).toBeUndefined()
  expect(factStats(facts({ registrations: { registered: 0, attended: 0 } }))[0]!.note).toBeUndefined()
  expect(factStats(facts({ tasks: { total: 2, done: 2, late: 0 } }))[2]!.note).toBe('지연 없음')
})

test('기록 목록 칩과 담당·날짜 글', () => {
  expect(recordChips(facts())).toEqual(['참석 22명 (신청 26명)', '예산 집행 73%', '완료 업무 3건'])
  expect(recordChips(facts({ finance: { budget: null, spent: 64000 } }))).toContain('집행 64,000원')
  expect(recordChips(facts({ registrations: null, finance: { budget: null, spent: 0 }, tasks: { total: 0, done: 0, late: 0 } }))).toEqual([])
  expect(ownerText({ department: '기획부', person: '정민재' })).toBe('담당 기획부 · 책임자 정민재')
  expect(ownerText({ department: null, person: '정민재' })).toBe('책임자 정민재')
  expect(ownerText({ department: null, person: null })).toBeNull()
  expect(eventDayText('2026-03-06T10:00')).toBe('2026. 3. 6.')
  // 한국 시각 자정 직후도 그날이다(기기 시간대와 상관없다).
  expect(eventDayText('2026-03-06T00:30')).toBe('2026. 3. 6.')
  expect(eventDayText(null)).toBe('날짜 미정')
})
