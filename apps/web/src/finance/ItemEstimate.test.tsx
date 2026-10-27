// @vitest-environment jsdom
import { afterEach, expect, test } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { purchaseDetail } from '@/test-support/purchase-fixtures'
import { ItemEstimate } from './ItemEstimate'

afterEach(cleanup)

test('예상값이 없으면 숨기고, 배송비가 없으면 상품 합계만 보인다', () => {
  const item = purchaseDetail().items[0]!
  const { container, rerender } = render(<ItemEstimate item={item} />)
  expect(container.textContent).toBe('')
  rerender(<ItemEstimate item={{ ...item, estimatedUnitPrice: 1000 }} />)
  expect(screen.getByText('상품 3,000원 · 배송비 미확인')).toBeTruthy()
  expect(screen.queryByText('미확인')).toBeNull()
  rerender(<ItemEstimate item={{ ...item, estimatedUnitPrice: 1000, estimatedShippingFee: 0 }} />)
  expect(screen.getByText('예상 3,000원')).toBeTruthy()
  rerender(<ItemEstimate item={{ ...item, estimatedUnitPrice: 0, estimatedShippingFee: 0 }} />)
  expect(screen.getByText('예상 0원')).toBeTruthy()
})
