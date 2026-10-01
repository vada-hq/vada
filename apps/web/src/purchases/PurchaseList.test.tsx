// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import PurchaseList from './PurchaseList'
import { draft } from './purchase-test-fixtures'

afterEach(cleanup)
test('filters loaded rows only, keeps pagination available and distinguishes filtered empty from load errors', () => {
  const base = { finance: false, loading: false, error: '', disabled: false, onSelect: vi.fn(), hasMore: true, onOlder: vi.fn() }
  const rows = [draft(), { ...draft(), id: 'approved', status: 'approved' as const }]
  const view = render(<PurchaseList {...base} rows={rows} />)
  fireEvent.change(screen.getByLabelText('상태 필터'), { target: { value: 'rejected' } })
  expect(screen.getByText('불러온 요청서 중 해당 상태가 없어요.')).toBeTruthy()
  expect(screen.getByText('불러온 요청서에만 필터가 적용돼요. 이전 요청서를 더 불러올 수 있어요.')).toBeTruthy()
  expect(screen.getByRole('button', { name: '이전 요청서' })).toBeTruthy()
  fireEvent.change(screen.getByLabelText('상태 필터'), { target: { value: 'approved' } })
  expect(screen.getByRole('button', { name: /접수용 승인/ })).toBeTruthy()
  expect(screen.queryByRole('button', { name: /접수용 검토 대기/ })).toBeNull()
  view.rerender(<PurchaseList {...base} rows={[]} error="조회 실패" />)
  expect(screen.queryByText('아직 내 요청서가 없어요.')).toBeNull()
})
test('uses shared state labels and delegates selection and paging', () => {
  const select = vi.fn(), older = vi.fn()
  render(<PurchaseList rows={[{ ...draft(), status: 'approved' }]} finance={false} loading={false} error=""
    disabled={false} onSelect={select} hasMore onOlder={older} />)
  fireEvent.click(screen.getByRole('button', { name: /접수용 승인/ }))
  expect(select).toHaveBeenCalledWith('r')
  fireEvent.click(screen.getByRole('button', { name: '이전 요청서' }))
  expect(older).toHaveBeenCalledOnce()
})
