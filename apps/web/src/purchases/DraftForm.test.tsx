// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import DraftForm from './DraftForm'
import { draft } from './purchase-test-fixtures'

afterEach(cleanup)
const props = { busy: false, stale: false, dirty: false, readOnly: false, onDirty: vi.fn(),
  onSave: vi.fn(), onDiscard: vi.fn(), onSubmit: vi.fn() }
test('calculates costs only when confirmed and saves editable fields without source metadata', () => {
  render(<DraftForm {...props} request={draft()} />)
  expect(screen.getByText('예상 합계: 확인 필요')).toBeTruthy()
  fireEvent.change(screen.getByLabelText('예상 배송비 (원)'), { target: { value: '0' } })
  expect(screen.getByText('예상 합계: 23,180원')).toBeTruthy()
  fireEvent.submit(screen.getByRole('form', { name: '초안 수정' }))
  expect(props.onSave).toHaveBeenCalledWith(expect.objectContaining({ version: 1, estimatedShippingCost: 0 }))
  expect(props.onSave.mock.calls[0]?.[0].items[0].productSnapshot).toBeUndefined()
})
test('dirty, invalid or stale drafts cannot be submitted', () => {
  const view = render(<DraftForm {...props} request={draft()} dirty />)
  expect(screen.getByRole('button', { name: '요청서 제출' }).hasAttribute('disabled')).toBe(true)
  view.rerender(<DraftForm {...props} request={draft()} stale />)
  expect(screen.getByRole('button', { name: '초안 저장' }).hasAttribute('disabled')).toBe(true)
  view.rerender(<DraftForm {...props} request={draft()} />)
  fireEvent.change(screen.getByLabelText('주문 수량'), { target: { value: '-1' } })
  expect(screen.getByRole('button', { name: '초안 저장' }).hasAttribute('disabled')).toBe(true)
})
