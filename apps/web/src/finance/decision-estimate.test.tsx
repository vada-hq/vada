// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { act, cleanup, render, renderHook, screen, waitFor } from '@testing-library/react'
import type { PurchaseLineItem } from '@vada/contracts'
import { purchaseDetail } from '@/test-support/purchase-fixtures'
import { BUDGET_A, LINE_1, budgetWithPeriod } from '@/test-support/budget-fixtures'
import { DecisionRow } from './DecisionRow'
import { emptyRow } from './decision-form'
import { useDecisionRows } from './use-decision-rows'
import type { DecideResult } from './useDecide'

afterEach(cleanup)

const item: PurchaseLineItem = {
  ...purchaseDetail().items[0]!,
  id: LINE_1,
  quantity: 2,
  estimatedUnitPrice: 100,
  estimatedShippingFee: 30,
}

test('결재자가 고친 금액은 다시 읽은 예상가격에 덮이지 않고 승인 본문에 쓰인다', async () => {
  const decide = vi.fn<(_: unknown[]) => Promise<DecideResult>>().mockResolvedValue({ ok: true })
  const { result, rerender } = renderHook(
    ({ items }) =>
      useDecisionRows({
        councilId: 'c1',
        items,
        budgetItems: budgetWithPeriod().items,
        decide: { decide, saving: false, problem: null, clearProblem: vi.fn() },
        onInvalidItem: vi.fn(),
      }),
    { initialProps: { items: [item] } },
  )
  expect(result.current.rowOf(item.id).amount).toBe('230')
  expect(result.current.rowOf(item.id).choice).toBeNull()
  act(() =>
    result.current.change(item.id, { amount: '777', choice: 'approve', budgetItemId: BUDGET_A }),
  )
  rerender({ items: [{ ...item, estimatedUnitPrice: 500 }] })
  expect(result.current.rowOf(item.id).amount).toBe('777')
  act(() => result.current.submit())
  await waitFor(() =>
    expect(decide).toHaveBeenCalledWith([
      { lineItemId: item.id, outcome: 'approved', amount: 777, budgetItemId: BUDGET_A },
    ]),
  )
})

test('배송비 미확인은 결재 칸에 설명하고 무료배송 0은 그 설명이 없다', () => {
  const unknown = { ...item, estimatedShippingFee: null }
  const props = {
    values: emptyRow(unknown),
    chosen: '',
    budgetItems: [],
    overages: [],
    disabled: false,
    errors: {},
    onChange: vi.fn(),
  }
  const { rerender } = render(<DecisionRow item={unknown} {...props} />)
  expect(
    screen.getByText('배송비 미확인 · 상품 합계만 채웠어요. 승인 전 확인해 주세요.'),
  ).toBeTruthy()
  rerender(<DecisionRow item={{ ...item, estimatedShippingFee: 0 }} {...props} />)
  expect(screen.queryByText(/배송비 미확인/)).toBeNull()
})
