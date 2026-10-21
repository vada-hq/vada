// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { MEMBER_PERMISSIONS } from '@/test-support/council-fixtures'
import { expenseDetail, expenseSummary } from '@/test-support/expense-fixtures'
import {
  EXPENSES,
  openExpensesTab,
  REQUESTS,
  serveFinance,
  showFinance,
} from '@/test-support/expense-harness'
import { deferredResponse, json } from '@/test-support/mock-api'
import { purchaseDetail, purchaseSummary } from '@/test-support/purchase-fixtures'
import { settle } from '@/test-support/settle'
import { EXPENSE_LOST } from '@/lib/messages'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const list = (expenses = [expenseSummary('e1')], truncated = false) => json({ expenses, truncated })
const card = (name: string) => screen.getByRole('heading', { name }).closest('div')!.parentElement!

test('지출 탭의 카드에 사용처, 내역, 금액, 결제일, 상태 칩이 보인다', async () => {
  const api = serveFinance()
  api.on('GET', EXPENSES, () =>
    list([
      expenseSummary('a', { paidBy: { id: 'm3', name: '박새내' }, evidenceCount: 0 }),
      expenseSummary('b', { paidBy: { id: 'm3', name: '박새내' }, reimbursed: true }),
      expenseSummary('c', {
        cancelled: true,
        evidenceCount: 0,
        paidBy: { id: 'm3', name: '박새내' },
      }),
    ]),
  )
  showFinance()
  openExpensesTab()
  await screen.findByRole('heading', { name: '사용처 a' })
  const first = card('사용처 a')
  expect(first.textContent).toContain('36,000원')
  expect(first.textContent).toContain('10월 20일')
  expect(first.textContent).toContain('포스터 인쇄')
  expect(within(first).getByText('환급 전')).toBeTruthy()
  expect(within(first).getByText('증빙 없음')).toBeTruthy()
  expect(within(card('사용처 b')).getByText('환급함')).toBeTruthy()
  // 취소된 지출은 취소됨만 보인다.
  const cancelled = card('사용처 c')
  expect(within(cancelled).getByText('취소됨')).toBeTruthy()
  expect(within(cancelled).queryByText('증빙 없음')).toBeNull()
  // 긴 사용처가 칸을 밀어내지 않는다.
  expect(screen.getByRole('button', { name: '사용처 a' }).className).toContain('wrap-anywhere')
})

test('빈 목록과 읽기 실패와 넘침', async () => {
  const api = serveFinance()
  let call = 0
  api.on('GET', EXPENSES, () => {
    call += 1
    if (call === 1) return json({}, 500)
    return list([], false)
  })
  showFinance()
  openExpensesTab()
  expect((await screen.findByRole('alert')).textContent).toContain('지출을 불러오지 못했어요')
  fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
  await screen.findByText('적힌 지출이 없어요.')
})

test('[지출 적기]는 재정부에게만, 지출 탭에서만 보인다', async () => {
  const api = serveFinance()
  api.on('GET', EXPENSES, () => list([]))
  showFinance()
  expect(screen.queryByRole('button', { name: '지출 적기' })).toBeNull()
  openExpensesTab()
  expect(screen.getByRole('button', { name: '지출 적기' })).toBeTruthy()
  cleanup()
  showFinance(MEMBER_PERMISSIONS)
  openExpensesTab()
  await screen.findByText('적힌 지출이 없어요.')
  expect(screen.queryByRole('button', { name: '지출 적기' })).toBeNull()
})

function serveDetail(detail = expenseDetail()) {
  const api = serveFinance()
  api.on('GET', EXPENSES, () => list([expenseSummary('e1')]))
  api.on('GET', `${EXPENSES}/e1`, () => json({ expense: detail }))
  return api
}
const openDetail = async () => {
  openExpensesTab()
  fireEvent.click(await screen.findByRole('button', { name: '사용처 e1' }))
  return screen.findByRole('dialog')
}

test('상세에 칸, 결제한 품목, 결재, 이력이 보이고 환급함을 확인 뒤에 표시한다', async () => {
  const api = serveDetail(
    expenseDetail('e1', {
      lines: [
        {
          lineItemId: 'i1',
          name: 'A2 포스터',
          amount: 36000,
          requestId: 'r1',
          requestTitle: '행사 포스터',
          budgetPurpose: '행사 홍보',
        },
      ],
      reason: '급해서 먼저 결제',
    }),
  )
  api.on('POST', `${EXPENSES}/e1/reimburse`, () =>
    json({ expense: expenseDetail('e1', { reimbursed: true, actions: ['expense.cancel'] }) }),
  )
  const handlers = showFinance()
  const dialog = await openDetail()
  expect(dialog.textContent).toContain('먼저 낸 사람 박새내')
  expect(dialog.textContent).toContain('A2 포스터 · 36,000원')
  expect(dialog.textContent).toContain('행사 포스터')
  expect(dialog.textContent).toContain('사유 급해서 먼저 결제')
  expect(dialog.textContent).toContain('이재정 · 10월 20일 14:03 · 승인')
  expect(dialog.textContent).toContain('이재정 · 10월 20일 14:03 · 적음')
  fireEvent.click(within(dialog).getByRole('button', { name: '환급함' }))
  expect(api.calls.some(call => call.path.endsWith('/reimburse'))).toBe(false)
  const confirm = screen.getByText('환급했다고 표시할까요?').closest('[role="dialog"]')!
  fireEvent.click(within(confirm as HTMLElement).getByRole('button', { name: '환급함' }))
  await waitFor(() => expect(screen.queryByText('환급했다고 표시할까요?')).toBeNull())
  expect(api.calls.filter(call => call.path.endsWith('/reimburse'))).toHaveLength(1)
  // 환급을 표시하면 [환급함]이 사라지고 목록을 다시 읽는다.
  expect(within(screen.getByRole('dialog')).queryByRole('button', { name: '환급함' })).toBeNull()
  expect(within(screen.getByRole('dialog')).getByText('환급함')).toBeTruthy()
  expect(handlers.onChanged).not.toHaveBeenCalled()
})

test('동작이 없으면 [환급함]과 [취소]가 보이지 않는다', async () => {
  serveDetail(expenseDetail('e1', { actions: [], cancelled: true }))
  showFinance(MEMBER_PERMISSIONS)
  const dialog = await openDetail()
  expect(within(dialog).queryByRole('button', { name: '환급함' })).toBeNull()
  expect(within(dialog).queryByRole('button', { name: '취소' })).toBeNull()
})

test('이미 환급한 지출을 환급하면 409 문구가 버튼 옆에 보이고 다시 읽는다', async () => {
  const api = serveDetail()
  api.on('POST', `${EXPENSES}/e1/reimburse`, () => json({ error: 'NOT_REIMBURSABLE' }, 409))
  showFinance()
  const dialog = await openDetail()
  fireEvent.click(within(dialog).getByRole('button', { name: '환급함' }))
  const confirm = screen.getByText('환급했다고 표시할까요?').closest('[role="dialog"]')!
  fireEvent.click(within(confirm as HTMLElement).getByRole('button', { name: '환급함' }))
  expect((await screen.findByRole('alert')).textContent).toContain('환급할 수 없는 지출이에요')
  expect(screen.queryByText('환급했다고 표시할까요?')).toBeNull()
  expect(api.calls.filter(call => call.path === `${EXPENSES}/e1`).length).toBeGreaterThan(1)
})

test('취소는 사유가 있어야 켜지고 사유를 보내며 두 번 누르면 한 번만 나간다', async () => {
  const api = serveDetail()
  const pending = deferredResponse()
  api.on('POST', `${EXPENSES}/e1/cancel`, () => pending.promise)
  showFinance()
  const dialog = await openDetail()
  fireEvent.click(within(dialog).getByRole('button', { name: '취소' }))
  const ask = screen.getByText('이 지출을 취소할까요?').closest('[role="dialog"]') as HTMLElement
  const submit = () => within(ask).getByRole<HTMLButtonElement>('button', { name: '취소하기' })
  expect(submit().disabled).toBe(true)
  fireEvent.change(within(ask).getByLabelText('취소 사유'), { target: { value: '   ' } })
  expect(submit().disabled).toBe(true)
  fireEvent.change(within(ask).getByLabelText('취소 사유'), { target: { value: '중복 결제' } })
  fireEvent.click(submit())
  fireEvent.click(submit())
  await settle()
  expect(api.calls.filter(call => call.path.endsWith('/cancel'))).toHaveLength(1)
  expect(api.calls.find(call => call.path.endsWith('/cancel'))?.body).toEqual({
    reason: '중복 결제',
  })
  pending.resolve(
    json({ expense: expenseDetail('e1', { cancelled: true, actions: [], evidenceCount: 0 }) }),
  )
  await waitFor(() => expect(screen.queryByText('이 지출을 취소할까요?')).toBeNull())
  expect(within(screen.getByRole('dialog')).getByText('취소됨')).toBeTruthy()
})

test('이미 취소된 지출을 취소하면 409 문구를 보이고 다시 읽는다', async () => {
  const api = serveDetail()
  api.on('POST', `${EXPENSES}/e1/cancel`, () => json({ error: 'EXPENSE_CANCELLED' }, 409))
  showFinance()
  const dialog = await openDetail()
  fireEvent.click(within(dialog).getByRole('button', { name: '취소' }))
  const ask = screen.getByText('이 지출을 취소할까요?').closest('[role="dialog"]') as HTMLElement
  fireEvent.change(within(ask).getByLabelText('취소 사유'), { target: { value: '사유' } })
  fireEvent.click(within(ask).getByRole('button', { name: '취소하기' }))
  // 이미 바뀐 상태라 확인을 닫고, 이유는 버튼 옆에 남는다.
  expect((await screen.findByRole('alert')).textContent).toContain('이미 취소된 지출')
  expect(screen.queryByText('이 지출을 취소할까요?')).toBeNull()
})

test('열 때 지출이 없으면(404) 대화상자를 닫고 이유를 보인다', async () => {
  const api = serveDetail()
  api.on('GET', `${EXPENSES}/e1`, () => json({ error: 'NOT_FOUND' }, 404))
  showFinance()
  openExpensesTab()
  fireEvent.click(await screen.findByRole('button', { name: '사용처 e1' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect((await screen.findByRole('alert')).textContent).toBe(EXPENSE_LOST)
})

test('권한을 잃으면(403) 학생회를 다시 읽게 하고 닫는다', async () => {
  const api = serveFinance()
  api.on('GET', EXPENSES, () => list([expenseSummary('e1')]))
  api.on('GET', `${EXPENSES}/e1`, () => json({ error: 'FORBIDDEN' }, 403))
  const handlers = showFinance()
  openExpensesTab()
  fireEvent.click(await screen.findByRole('button', { name: '사용처 e1' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(handlers.onForbidden).toHaveBeenCalled()
  expect(screen.getByText(/권한이 바뀌었어요/)).toBeTruthy()
})

test('요청 상세의 결제한 지출을 누르면 그 지출이 열린다', async () => {
  const api = serveFinance()
  api.on('GET', `${REQUESTS}?view=mine`, () =>
    json({ requests: [purchaseSummary('r1')], truncated: false }),
  )
  api.on('GET', `${REQUESTS}/r1`, () =>
    json({
      request: purchaseDetail('r1', {
        expenses: [
          {
            id: 'e1',
            vendor: '인쇄소',
            amount: 36000,
            paidAt: '2026-10-19T15:00:00.000Z',
            cancelled: true,
          },
        ],
      }),
    }),
  )
  api.on('GET', `${EXPENSES}/e1`, () => json({ expense: expenseDetail() }))
  showFinance()
  fireEvent.click(await screen.findByRole('button', { name: '요청 r1' }))
  const link = await screen.findByRole('button', { name: /인쇄소 · 36,000원 · 10월 20일/ })
  expect(screen.getByText('취소됨')).toBeTruthy()
  fireEvent.click(link)
  await screen.findByText('먼저 낸 사람 박새내')
  expect(screen.queryByText('행사 포스터 인쇄')).toBeNull()
  expect(screen.getAllByRole('dialog')).toHaveLength(1)
})
