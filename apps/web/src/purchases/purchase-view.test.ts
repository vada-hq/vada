import { expect, test } from 'vitest'
import type { PurchaseItemHistoryEntry } from '@vada/contracts'
import { item, shipment } from './purchase-fixtures'
import { actionText, addDays, groupBySubmission, missingFields, neededByText, progressOf, sectionOf, todayInSeoul, totalOf } from './purchase-view'

test('진행 단계는 상태와 구매함·배송·수령 표시로 정한다', () => {
  expect(progressOf(item({ status: 'pending' }))).toEqual({ label: '대기', tone: 'info' })
  expect(progressOf(item({ status: 'approved' })).label).toBe('승인')
  expect(progressOf(item({ status: 'approved', purchasedAt: 'x' })).label).toBe('구매함')
  expect(progressOf(item({ status: 'approved', purchasedAt: 'x', shipments: [shipment({ status: 'delivered' }), shipment({ linkId: 'l2', status: 'in_transit' })] })).label).toBe('배송 중')
  expect(progressOf(item({ status: 'approved', purchasedAt: 'x', shipments: [shipment({ status: 'delivered' })] })).label).toBe('배송 완료')
  expect(progressOf(item({ status: 'approved', purchasedAt: 'x', receivedAt: 'y', shipments: [shipment()] })).label).toBe('수령 완료')
  expect(progressOf(item({ status: 'rejected' }))).toEqual({ label: '반려', tone: 'danger' })
})

test('묶음: 작성 중, 진행 중(대기·수령 전 승인), 끝남(수령 완료·반려·요청 취소)', () => {
  expect((['draft', 'pending', 'approved', 'rejected', 'cancelled'] as const).map(status => sectionOf(item({ status }))))
    .toEqual(['draft', 'active', 'active', 'ended', 'ended'])
  expect(sectionOf(item({ status: 'approved', receivedAt: 'x' }))).toBe('ended')
})

test('제출 전 확인 칸과 합계', () => {
  expect(missingFields(item({ productName: null, quantity: null, optionRequired: true, selectedOption: null }))).toEqual(['상품명', '수량', '선택 옵션'])
  expect(missingFields(item({ optionRequired: null }))).toEqual(['옵션 필요 여부'])
  expect(missingFields(item())).toEqual([])
  expect(totalOf([item({ quantity: 2, estimatedUnitPrice: 1000 }), item({ quantity: 1, estimatedUnitPrice: null })])).toEqual({ known: 2000, complete: false })
})

test('받을 날짜: 한국 날짜 기준 빠른 버튼과 표시 문구', () => {
  expect(todayInSeoul(new Date('2026-10-08T15:30:00Z'))).toBe('2026-10-09')
  expect(addDays('2026-10-30', 3)).toBe('2026-11-02')
  expect(addDays('2026-12-25', 7)).toBe('2027-01-01')
  expect(neededByText(null)).toBe('상관없음')
  expect(neededByText('2026-10-09')).toBe('10월 9일까지')
})

test('같이 제출한 품목끼리 처음 나온 순서대로 묶는다', () => {
  const groups = groupBySubmission([item({ id: 'a', submissionId: 's1' }), item({ id: 'b', submissionId: 's2' }), item({ id: 'c', submissionId: 's1' })])
  expect(groups.map(group => [group.id, group.items.map(entry => entry.id)])).toEqual([['s1', ['a', 'c']], ['s2', ['b']]])
})

test('요청자가 직접 결정한 기록은 본인 승인·본인 반려로 보인다', () => {
  const entry = (action: PurchaseItemHistoryEntry['action'], actor: string): PurchaseItemHistoryEntry =>
    ({ id: 'h', action, actor: { id: actor, name: '' }, reason: null, changes: {}, createdAt: '' })
  expect(actionText(entry('approved', 'u'), 'u')).toBe('본인 승인')
  expect(actionText(entry('rejected', 'u'), 'u')).toBe('본인 반려')
  expect(actionText(entry('approved', 'f'), 'u')).toBe('승인')
  expect(actionText(entry('needed_by_changed', 'u'), 'u')).toBe('받을 날짜 변경')
})
