import { expect, test } from 'vitest'
import { entry, feeEntries, feeForm, registrationForm } from './registration-fixtures'
import { applyUrl, countText, feeText, findRegistrants, hasFees, paymentChip, paymentFilter, stateTone } from './registration-view'

test('공개 링크는 이 사이트 주소에 코드를 붙인다', () => {
  expect(applyUrl('ABCD2345', 'https://vada-m1.onrender.com')).toBe('https://vada-m1.onrender.com/apply/ABCD2345')
})

test('신청 수: 정원이 있으면 신청 수/정원, 없으면 신청 수만', () => {
  expect(countText(2, 200)).toBe('2/200명')
  expect(countText(7, null)).toBe('7명')
})

test('명단 찾기: 이름의 일부나 학번의 일부로 찾고, 하이픈·공백은 무시한다', () => {
  const list = [entry('r1', '김바다', '2022123456'), entry('r2', '이수강', '2023222222'), entry('r3', '김하늘', '2021333333')]
  expect(findRegistrants(list, '').map(item => item.id)).toEqual(['r1', 'r2', 'r3'])
  expect(findRegistrants(list, ' 김 ').map(item => item.id)).toEqual(['r1', 'r3'])
  expect(findRegistrants(list, '2023').map(item => item.id)).toEqual(['r2'])
  expect(findRegistrants(list, '2022-1234').map(item => item.id)).toEqual(['r1'])
  expect(findRegistrants(list, '박')).toEqual([])
})

test('상태 칩 색: 받는 중 초록, 시작 전 파랑, 정원 참 노랑, 멈춤 빨강, 마감 회색', () => {
  expect((['open', 'upcoming', 'full', 'paused', 'closed'] as const).map(stateTone)).toEqual(['success', 'info', 'warning', 'danger', 'neutral'])
})

test('참가비 줄: 없음, 정액, 학생회비 납부자 금액', () => {
  expect(feeText(registrationForm())).toBe('없음')
  expect(feeText(registrationForm({ fee: 5000 }))).toBe('5,000원')
  expect(feeText(registrationForm({ fee: 7000, memberFee: 0 }))).toBe('7,000원 · 학생회비 납부자 0원')
})

test('참가비를 다루는 참가 신청: 참가비나 납부자 참가비가 있거나, 받은 참가비가 남아 있다', () => {
  expect(hasFees(registrationForm())).toBe(false)
  expect(hasFees(registrationForm({ fee: 5000 }))).toBe(true)
  expect(hasFees(registrationForm({ payments: { count: 1, total: 5000 } }))).toBe(true)
})

test('입금 거르기와 칩: 입금 전은 낼 돈이 있고 확인 전인 신청이고, 참가비가 없으면 회색 칩이다', () => {
  const list = feeEntries()
  expect(paymentFilter(list, 'all').map(item => item.id)).toEqual(['r1', 'r2', 'r3'])
  expect(paymentFilter(list, 'unpaid').map(item => item.id)).toEqual(['r3'])
  expect(paymentFilter(list, 'paid').map(item => item.id)).toEqual(['r2'])
  expect(list.map(paymentChip)).toEqual([{ text: '참가비 없음', tone: 'neutral' }, { text: '7,000원 · 입금 확인', tone: 'success' },
    { text: '7,000원 · 입금 전', tone: 'warning' }])
  expect(feeForm().fee).toBe(7000)
})
