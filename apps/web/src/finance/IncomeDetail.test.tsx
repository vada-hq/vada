// @vitest-environment jsdom
import { PURCHASE_REASON_MAX } from '@vada/contracts'
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { asElement } from '@/test-support/elements'
import {
  councilView,
  FINANCE_PERMISSIONS,
  MEMBER_PERMISSIONS,
} from '@/test-support/council-fixtures'
import { ME } from '@/test-support/expense-harness'
import { incomeDetail, incomeSummary } from '@/test-support/income-fixtures'
import { INCOMES, openIncomesTab, serveIncomes } from '@/test-support/income-harness'
import { deferredResponse, json } from '@/test-support/mock-api'
import { ACTION_GONE, INCOME_ERRORS, INCOME_LOST, PERMISSION_CHANGED } from '@/lib/messages'
import FinancePage from './FinancePage'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function serve(detail = incomeDetail()) {
  const api = serveIncomes([incomeSummary('i1')])
  api.on('GET', `${INCOMES}/i1`, () => json({ income: detail }))
  return api
}
const show = (permissions = FINANCE_PERMISSIONS) => {
  const handlers = { onForbidden: vi.fn(), onChanged: vi.fn(), onOpenEvent: vi.fn() }
  const view = (granted: typeof permissions) => (
    <FinancePage view={councilView('c1', { permissions: granted, memberId: ME })} {...handlers} />
  )
  const result = render(view(permissions))
  return { ...handlers, rerender: (granted: typeof permissions) => result.rerender(view(granted)) }
}
const openDetail = async () => {
  openIncomesTab()
  fireEvent.click(await screen.findByRole('button', { name: '지원금' }))
  return screen.findByRole('dialog')
}
const askCancel = async () => {
  const dialog = await openDetail()
  fireEvent.click(await within(dialog).findByRole('button', { name: '수입 취소' }))
  const ask = screen.getByText('이 수입을 취소할까요?').closest('[role="dialog"]') as HTMLElement
  return ask
}

test('상세에 칸과 이력이 보이고 이력은 오래된 판부터다', async () => {
  serve(
    incomeDetail('i1', {
      budgetItem: { id: 'b1', purpose: '지원금 예산' },
      history: [
        {
          versionNo: 1,
          at: '2026-10-20T05:03:00.000Z',
          by: { id: 'm2', name: '이재정' },
          changes: [{ field: 'created' }],
          reason: null,
        },
        {
          versionNo: 2,
          at: '2026-10-21T05:03:00.000Z',
          by: { id: 'm1', name: '김회장' },
          changes: [{ field: 'cancelled' }],
          reason: '중복 입력',
        },
      ],
      cancelled: true,
      actions: [],
    }),
  )
  show()
  const dialog = await openDetail()
  await within(dialog).findByText(/이재정 · 10월 20일 14:03 · 적음/)
  expect(dialog.textContent).toContain('500,000원')
  expect(dialog.textContent).toContain('내용 i1')
  expect(dialog.textContent).toContain('회계 기간 2026년 2학기')
  expect(dialog.textContent).toContain('계좌 학생회비 통장')
  expect(dialog.textContent).toContain('예산 항목 지원금 예산')
  expect(dialog.textContent).toContain('적은 사람 이재정')
  expect(within(dialog).getByText('취소됨')).toBeTruthy()
  const lines = within(dialog)
    .getAllByRole('listitem')
    .map(item => item.textContent)
  expect(lines).toEqual([
    '이재정 · 10월 20일 14:03 · 적음',
    '김회장 · 10월 21일 14:03 · 취소함: 중복 입력',
  ])
  // 서버가 준 동작이 없으면 [취소]가 없다.
  expect(within(dialog).queryByRole('button', { name: '수입 취소' })).toBeNull()
})

test('운영진에게는 서버가 동작을 주지 않으면 [취소]가 없다', async () => {
  serve(incomeDetail('i1', { actions: [] }))
  show(MEMBER_PERMISSIONS)
  const dialog = await openDetail()
  await within(dialog).findByText(/적음/)
  expect(within(dialog).queryByRole('button', { name: '수입 취소' })).toBeNull()
})

test('취소는 늘 켜져 있고 사유가 없거나 길면 칸 아래에 알리며 한 번만 보내고 끝나면 목록을 다시 읽는다', async () => {
  const api = serve()
  const pending = deferredResponse()
  api.on('POST', `${INCOMES}/i1/cancel`, () => pending.promise)
  show()
  const ask = await askCancel()
  const confirm = () =>
    asElement(within(ask).getByRole('button', { name: '수입 취소' }), HTMLButtonElement)
  expect(confirm().disabled).toBe(false)
  fireEvent.click(confirm())
  expect(within(ask).getByText('취소 사유를 입력해 주세요')).toBeTruthy()
  fireEvent.change(within(ask).getByLabelText('취소 사유'), {
    target: { value: '가'.repeat(PURCHASE_REASON_MAX + 1) },
  })
  fireEvent.click(confirm())
  expect(within(ask).getByText('더 짧게 입력해 주세요')).toBeTruthy()
  expect(api.calls.some(call => call.method === 'POST')).toBe(false)
  fireEvent.change(within(ask).getByLabelText('취소 사유'), { target: { value: '중복 입력' } })
  fireEvent.click(confirm())
  fireEvent.click(confirm())
  await waitFor(() => expect(api.calls.filter(call => call.method === 'POST')).toHaveLength(1))
  expect(api.calls.find(call => call.method === 'POST')?.body).toEqual({ reason: '중복 입력' })
  const before = api.calls.filter(call => call.path.includes('period=')).length
  pending.resolve(json({ income: incomeDetail('i1', { cancelled: true, actions: [] }) }))
  await waitFor(() => expect(screen.queryByText('이 수입을 취소할까요?')).toBeNull())
  // 취소한 수입은 상세에 취소됨으로 보이고 [취소]가 사라진다.
  const dialog = screen.getByRole('dialog')
  expect(within(dialog).getByText('취소됨')).toBeTruthy()
  expect(within(dialog).queryByRole('button', { name: '수입 취소' })).toBeNull()
  // 성공한 취소 뒤에는 '할 수 없는 동작' 같은 알림이 없다.
  expect(within(dialog).queryByRole('alert')).toBeNull()
  await waitFor(() =>
    expect(api.calls.filter(call => call.path.includes('period=')).length).toBeGreaterThan(before),
  )
})

test.each([['INCOME_CANCELLED'], ['INCOME_AUTOMATIC'], ['EVENT_COMPLETED'], ['PERIOD_CLOSED']])(
  '%s 거절이면 확인을 닫고 그 문구를 버튼 옆에 보이고 수입을 다시 읽는다',
  async code => {
    const api = serve()
    let reads = 0
    api.on('GET', `${INCOMES}/i1`, () => {
      reads += 1
      return json({ income: incomeDetail('i1', reads > 1 ? { actions: [] } : {}) })
    })
    api.on('POST', `${INCOMES}/i1/cancel`, () => json({ error: code }, 409))
    show()
    const ask = await askCancel()
    fireEvent.change(within(ask).getByLabelText('취소 사유'), { target: { value: '사유' } })
    fireEvent.click(within(ask).getByRole('button', { name: '수입 취소' }))
    await waitFor(() => expect(screen.queryByText('이 수입을 취소할까요?')).toBeNull())
    const dialog = screen.getByRole('dialog')
    expect((await within(dialog).findByRole('alert')).textContent).toBe(INCOME_ERRORS[code])
    await waitFor(() =>
      expect(within(dialog).queryByRole('button', { name: '수입 취소' })).toBeNull(),
    )
  },
)

test('429면 확인을 연 채 그 문구를 보인다', async () => {
  const api = serve()
  api.on('POST', `${INCOMES}/i1/cancel`, () => json({ error: 'TOO_MANY_REQUESTS' }, 429))
  show()
  const ask = await askCancel()
  fireEvent.change(within(ask).getByLabelText('취소 사유'), { target: { value: '사유' } })
  fireEvent.click(within(ask).getByRole('button', { name: '수입 취소' }))
  expect((await within(ask).findByRole('alert')).textContent).toBe(INCOME_ERRORS.TOO_MANY_REQUESTS)
})

test('확인을 연 동안 다른 사람이 취소해 동작이 빠지면 확인을 닫고 알린다', async () => {
  const api = serve()
  let reads = 0
  api.on('GET', `${INCOMES}/i1`, () => {
    reads += 1
    return json({ income: incomeDetail('i1', reads > 1 ? { actions: [], cancelled: true } : {}) })
  })
  show()
  await askCancel()
  // 화면이 다시 보이면 상세를 다시 읽는다.
  document.dispatchEvent(new Event('visibilitychange'))
  await waitFor(() => expect(screen.queryByText('이 수입을 취소할까요?')).toBeNull())
  const dialog = screen.getByRole('dialog')
  expect((await within(dialog).findByRole('alert')).textContent).toBe(ACTION_GONE)
  expect(within(dialog).queryByRole('button', { name: '수입 취소' })).toBeNull()
})

test('열려 있던 수입이 사라지면(404) 상세를 닫고 이유를 목록 위에 보인다', async () => {
  const api = serve()
  api.on('GET', `${INCOMES}/i1`, () => json({ error: 'NOT_FOUND' }, 404))
  show()
  openIncomesTab()
  fireEvent.click(await screen.findByRole('button', { name: '지원금' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(screen.getByText(INCOME_LOST)).toBeTruthy()
})

test('상세를 읽다 권한을 잃으면(403) 닫고 학생회를 다시 읽게 한다', async () => {
  const api = serve()
  api.on('GET', `${INCOMES}/i1`, () => json({ error: 'FORBIDDEN' }, 403))
  const page = show()
  openIncomesTab()
  fireEvent.click(await screen.findByRole('button', { name: '지원금' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(screen.getByText(PERMISSION_CHANGED)).toBeTruthy()
  expect(page.onForbidden).toHaveBeenCalled()
})

test('수입 적기를 연 동안 재정 권한이 빠지면 닫고 이유를 보인다', async () => {
  serve()
  const page = show()
  openIncomesTab()
  fireEvent.click(await screen.findByRole('button', { name: '수입 적기' }))
  await screen.findByRole('form', { name: '수입 적기' })
  page.rerender(MEMBER_PERMISSIONS)
  await waitFor(() => expect(screen.queryByRole('form', { name: '수입 적기' })).toBeNull())
  expect(screen.getByText(PERMISSION_CHANGED)).toBeTruthy()
  expect(screen.queryByRole('button', { name: '수입 적기' })).toBeNull()
})

test('취소를 보낼 때 404면 상세를 닫고 이유를, 403이면 권한이 바뀌었다고 알린다', async () => {
  const api = serve()
  api.on('POST', `${INCOMES}/i1/cancel`, () => json({ error: 'NOT_FOUND' }, 404))
  show()
  let ask = await askCancel()
  fireEvent.change(within(ask).getByLabelText('취소 사유'), { target: { value: '사유' } })
  fireEvent.click(within(ask).getByRole('button', { name: '수입 취소' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(screen.getByText(INCOME_LOST)).toBeTruthy()
  cleanup()
  api.on('POST', `${INCOMES}/i1/cancel`, () => json({ error: 'FORBIDDEN' }, 403))
  const page = show()
  ask = await askCancel()
  fireEvent.change(within(ask).getByLabelText('취소 사유'), { target: { value: '사유' } })
  fireEvent.click(within(ask).getByRole('button', { name: '수입 취소' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(screen.getByText(PERMISSION_CHANGED)).toBeTruthy()
  expect(page.onForbidden).toHaveBeenCalled()
})
