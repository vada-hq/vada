// @vitest-environment jsdom
import { afterEach, expect, test } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { purchaseDetail } from '@/test-support/purchase-fixtures'
import { ItemEstimate } from './ItemEstimate'

afterEach(cleanup)

test.each([0, 2500])('단가 미확인이어도 알려진 배송비 %i원을 보인다', shipping => {
  const item = {
    ...purchaseDetail().items[0]!,
    estimatedUnitPrice: null,
    estimatedShippingFee: shipping,
  }
  render(<ItemEstimate item={item} />)
  expect(
    screen.getByText(`예상 배송비 ${shipping.toLocaleString('ko-KR')}원 · 단가 미확인`),
  ).toBeTruthy()
})

test('배송비 미확인일 때 상품 합계가 예상 금액임을 보인다', () => {
  const item = { ...purchaseDetail().items[0]!, estimatedUnitPrice: 1000 }
  render(<ItemEstimate item={item} />)
  expect(screen.getByText('예상 상품 합계 3,000원 · 배송비 미확인')).toBeTruthy()
})

test('예상값이 없으면 숨기고, 둘 다 알면 예상 합계를 보인다', () => {
  const item = purchaseDetail().items[0]!
  const { container, rerender } = render(<ItemEstimate item={item} />)
  expect(container.textContent).toBe('')
  rerender(<ItemEstimate item={{ ...item, estimatedUnitPrice: 1000, estimatedShippingFee: 0 }} />)
  expect(screen.getByText('예상 3,000원')).toBeTruthy()
  rerender(<ItemEstimate item={{ ...item, estimatedUnitPrice: 0, estimatedShippingFee: 0 }} />)
  expect(screen.getByText('예상 0원')).toBeTruthy()
})
