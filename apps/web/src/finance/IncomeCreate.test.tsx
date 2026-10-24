// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { koreanDateOf } from '@vada/contracts'
import {
  standardAccounts,
  BUSINESS_ACCOUNT_ID,
  MAIN_ACCOUNT_ID,
} from '@/test-support/account-fixtures'
import { asElement } from '@/test-support/elements'
import { BASE, showFinance } from '@/test-support/expense-harness'
import {
  incomeDetail,
  INCOME_ITEM,
  OLD_PERIOD,
  periodSummary,
} from '@/test-support/income-fixtures'
import {
  CURRENT_INCOMES,
  INCOMES,
  openIncomesTab,
  serveIncomes,
} from '@/test-support/income-harness'
import { deferredResponse, json } from '@/test-support/mock-api'
import {
  INCOME_ERRORS,
  INCOME_LOST,
  INCOME_PERIOD_NOT_STARTED,
  PERMISSION_CHANGED,
} from '@/lib/messages'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function serve() {
  const api = serveIncomes([])
  api.on('GET', `${BASE}/accounts`, () => json(standardAccounts()))
  api.on('GET', `${BASE}/budget`, () =>
    json({
      period: { id: 'p1', name: '2026', startsOn: '2026-01-01', endsOn: '2026-12-31' },
      items: [
        {
          id: INCOME_ITEM,
          purpose: '지원금 예산',
          amount: 800000,
          type: 'income',
          event: null,
          selectable: true,
        },
        {
          id: 'x1',
          purpose: '행사 홍보',
          amount: 300000,
          type: 'expense',
          event: null,
          selectable: true,
        },
      ],
      suggested: null,
    }),
  )
  return api
}

const openForm = async () => {
  openIncomesTab()
  fireEvent.click(await screen.findByRole('button', { name: '수입 적기' }))
  return screen.findByRole('form', { name: '수입 적기' })
}
const fill = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
const submit = () => asElement(screen.getByRole('button', { name: '적기' }), HTMLButtonElement)
const today = () => koreanDateOf(new Date())

test('출처는 사람이 적는 다섯만 보이고, 금액이 없거나 0이면 보내지 않고 금액 칸 아래에 알린다. 받은 날은 오늘, 계좌는 대표 계좌다', async () => {
  const api = serve()
  api.on('POST', INCOMES, () => json({ income: incomeDetail('i1') }, 201))
  showFinance()
  await openForm()
  // 제목에 적는 회계 기간이 있고, 위에 설명 글은 없다.
  const dialog = screen.getByRole('dialog', { name: /^수입 적기 · .+/ })
  expect(within(dialog).getByRole('heading').parentElement?.children).toHaveLength(1)
  const options = Array.from(
    asElement(screen.getByLabelText('출처'), HTMLSelectElement).options,
    option => option.textContent,
  )
  expect(options).toEqual(['학생회비', '지원금', '사업 수익', '후원금', '기타'])
  expect(asElement(screen.getByLabelText('받은 날'), HTMLInputElement).value).toBe(today())
  expect(submit().disabled).toBe(false)
  fireEvent.click(submit())
  expect(screen.getByText('금액을 입력해 주세요')).toBeTruthy()
  const amount = screen.getByLabelText('금액(원)')
  expect(amount.getAttribute('aria-invalid')).toBe('true')
  await waitFor(() => expect(document.activeElement).toBe(amount))
  fill('금액(원)', '0')
  fireEvent.click(submit())
  expect(screen.getByText('1 이상의 숫자를 입력해 주세요')).toBeTruthy()
  expect(api.calls.some(call => call.method === 'POST')).toBe(false)
  fill('금액(원)', '500000')
  // 수입 항목만 고를 수 있다.
  await screen.findByRole('option', { name: /지원금 예산/ })
  expect(screen.queryByRole('option', { name: /행사 홍보/ })).toBeNull()
  fill('출처', 'grant')
  fill('내용', '  ')
  fireEvent.click(submit())
  await waitFor(() => expect(screen.queryByRole('form', { name: '수입 적기' })).toBeNull())
  expect(api.calls.find(call => call.method === 'POST')?.body).toEqual({
    source: 'grant',
    amount: 500000,
    receivedOn: today(),
    description: null,
    budgetItemId: null,
    accountId: MAIN_ACCOUNT_ID,
  })
  // 적고 나면 수입 목록을 다시 읽는다.
  expect(api.calls.filter(call => call.path === CURRENT_INCOMES).length).toBeGreaterThan(1)
})

test('수입 예산 항목은 서버가 고를 수 있다고 한 것만 보인다', async () => {
  const api = serve()
  api.on('GET', `${BASE}/budget`, () =>
    json({
      period: { id: 'p1', name: '2026', startsOn: '2026-01-01', endsOn: '2026-12-31' },
      items: [
        {
          id: INCOME_ITEM,
          purpose: '지원금 예산',
          amount: 1,
          type: 'income',
          event: null,
          selectable: true,
        },
        {
          id: 'x2',
          purpose: '끝난 행사 후원',
          amount: 1,
          type: 'income',
          event: null,
          selectable: false,
        },
      ],
      suggested: null,
    }),
  )
  showFinance()
  await openForm()
  await screen.findByRole('option', { name: /지원금 예산/ })
  expect(screen.queryByRole('option', { name: /끝난 행사 후원/ })).toBeNull()
})

test('예산 항목과 계좌와 내용을 골라 적는다. 계좌는 없음도 고를 수 있다', async () => {
  const api = serve()
  api.on('POST', INCOMES, () => json({ income: incomeDetail('i1') }, 201))
  showFinance()
  await openForm()
  fill('금액(원)', '1000')
  fill('내용', '학생회비 2학기분')
  await screen.findByRole('option', { name: /지원금 예산/ })
  fill('수입 예산 항목', INCOME_ITEM)
  fill('계좌', BUSINESS_ACCOUNT_ID)
  fireEvent.click(submit())
  await waitFor(() => expect(screen.queryByRole('form', { name: '수입 적기' })).toBeNull())
  expect(api.calls.find(call => call.method === 'POST')?.body).toMatchObject({
    description: '학생회비 2학기분',
    budgetItemId: INCOME_ITEM,
    accountId: BUSINESS_ACCOUNT_ID,
  })
})

test('오늘 뒤의 받은 날, 숫자가 아닌 금액, 계약의 상한을 넘는 내용은 보내지 않는다', async () => {
  const api = serve()
  api.on('POST', INCOMES, () => json({ income: incomeDetail('i1') }, 201))
  showFinance()
  await openForm()
  const posts = () => api.calls.filter(call => call.method === 'POST').length
  fill('금액(원)', '1000')
  const date = asElement(screen.getByLabelText('받은 날'), HTMLInputElement)
  expect(date.max).toBe(today())
  expect(date.min).toBe('2000-01-01')
  fill('받은 날', '2999-01-01')
  fireEvent.click(submit())
  expect(screen.getByText(`2000-01-01부터 ${today()} 사이의 날짜를 입력해 주세요`)).toBeTruthy()
  expect(date.getAttribute('aria-invalid')).toBe('true')
  fill('받은 날', today())
  fill('금액(원)', '1e3')
  fireEvent.click(submit())
  expect(screen.getByText('1 이상의 숫자를 입력해 주세요')).toBeTruthy()
  fill('금액(원)', '1000')
  fill('내용', '가'.repeat(201))
  fireEvent.click(submit())
  await new Promise(resolve => setTimeout(resolve, 20))
  expect(posts()).toBe(0)
  fill('내용', '😀'.repeat(200))
  fireEvent.click(submit())
  await waitFor(() => expect(posts()).toBe(1))
})

test('금액에 쉼표를 써도(500,000) 적을 수 있다', async () => {
  const api = serve()
  api.on('POST', INCOMES, () => json({ income: incomeDetail('i1') }, 201))
  showFinance()
  await openForm()
  fill('금액(원)', '500,000')
  fireEvent.click(submit())
  await waitFor(() =>
    expect(api.calls.find(call => call.method === 'POST')?.body).toMatchObject({ amount: 500000 }),
  )
})

test('두 번 눌러도 한 번만 보내고, 보내는 동안 닫지 못한다', async () => {
  const api = serve()
  const pending = deferredResponse()
  api.on('POST', INCOMES, () => pending.promise)
  showFinance()
  await openForm()
  fill('금액(원)', '1000')
  fireEvent.click(submit())
  fireEvent.click(submit())
  await waitFor(() => expect(api.calls.filter(call => call.method === 'POST')).toHaveLength(1))
  const form = screen.getByRole('form', { name: '수입 적기' })
  expect(
    asElement(within(form).getByRole('button', { name: '닫기' }), HTMLButtonElement).disabled,
  ).toBe(true)
  pending.resolve(json({ income: incomeDetail('i1') }, 201))
  await waitFor(() => expect(screen.queryByRole('form', { name: '수입 적기' })).toBeNull())
  expect(api.calls.filter(call => call.method === 'POST')).toHaveLength(1)
})

test.each([
  ['NO_FISCAL_PERIOD', 409],
  ['PERIOD_CLOSED', 409],
  ['EVENT_COMPLETED', 409],
  ['BUDGET_ITEM_INVALID', 409],
  ['ACCOUNT_INVALID', 409],
  ['TOO_MANY_REQUESTS', 429],
  ['INVALID_INPUT', 400],
])('%s 거절은 대화상자를 연 채 그 문구를 보인다', async (code, status) => {
  const api = serve()
  api.on('POST', INCOMES, () => json({ error: code }, status))
  showFinance()
  await openForm()
  fill('금액(원)', '1000')
  fireEvent.click(submit())
  const alert = await screen.findByRole('alert')
  expect(alert.textContent).toBe(INCOME_ERRORS[code])
  expect(screen.getByRole('form', { name: '수입 적기' })).toBeTruthy()
  // 고쳐서 다시 보낼 수 있다.
  expect(submit().disabled).toBe(false)
})

test('모르는 오류 코드는 일반 문구다', async () => {
  const api = serve()
  api.on('POST', INCOMES, () => json({ error: 'SOMETHING' }, 500))
  showFinance()
  await openForm()
  fill('금액(원)', '1000')
  fireEvent.click(submit())
  expect((await screen.findByRole('alert')).textContent).toContain('보내지 못했어요')
})

test('404면 대화상자를 닫고 이유를 목록 위에 보인다', async () => {
  const api = serve()
  api.on('POST', INCOMES, () => json({ error: 'NOT_FOUND' }, 404))
  showFinance()
  await openForm()
  fill('금액(원)', '1000')
  fireEvent.click(submit())
  await waitFor(() => expect(screen.queryByRole('form', { name: '수입 적기' })).toBeNull())
  expect(screen.getByText(INCOME_LOST)).toBeTruthy()
})

test('403이면 대화상자를 닫고 권한이 바뀌었다고 알리고 학생회를 다시 읽게 한다', async () => {
  const api = serve()
  api.on('POST', INCOMES, () => json({ error: 'FORBIDDEN' }, 403))
  const handlers = showFinance()
  await openForm()
  fill('금액(원)', '1000')
  fireEvent.click(submit())
  await waitFor(() => expect(screen.queryByRole('form', { name: '수입 적기' })).toBeNull())
  expect(screen.getByText(PERMISSION_CHANGED)).toBeTruthy()
  expect(handlers.onForbidden).toHaveBeenCalled()
})

test('지난 기간에 적으면 받은 날은 그 기간 끝일까지이고 예산 항목 칸이 없다', async () => {
  const api = serve()
  api.on('GET', `${INCOMES}?period=${OLD_PERIOD}`, () => json({ incomes: [], truncated: false }))
  api.on('POST', INCOMES, () => json({ income: incomeDetail('i1') }, 201))
  showFinance()
  openIncomesTab()
  await screen.findByRole('button', { name: '수입 적기' })
  fireEvent.change(screen.getByLabelText('회계 기간'), { target: { value: OLD_PERIOD } })
  await screen.findByText('적힌 수입이 없어요.')
  fireEvent.click(screen.getByRole('button', { name: '수입 적기' }))
  await screen.findByRole('form', { name: '수입 적기' })
  const date = asElement(screen.getByLabelText('받은 날'), HTMLInputElement)
  expect([date.min, date.max, date.value]).toEqual(['2020-01-01', '2020-12-31', '2020-12-31'])
  expect(screen.queryByLabelText('수입 예산 항목')).toBeNull()
  // 예산 항목은 지금 기간만 읽으므로 읽지도 않는다.
  expect(api.calls.some(call => call.path === `${BASE}/budget`)).toBe(false)
  fill('금액(원)', '1000')
  fireEvent.click(submit())
  await waitFor(() => expect(screen.queryByRole('form', { name: '수입 적기' })).toBeNull())
  expect(api.calls.find(call => call.method === 'POST')?.body).toMatchObject({
    receivedOn: '2020-12-31',
    budgetItemId: null,
  })
})

test('시작 전 기간이면 이유를 한 줄 보이고, 적기를 눌러도 보내지 않는다', async () => {
  const api = serve()
  const future = '77777777-7777-4777-8777-777777777773'
  api.on('GET', `${BASE}/fiscal-periods`, () =>
    json({
      periods: [
        periodSummary(future, {
          name: '다음 기간',
          startsOn: '2999-01-01',
          endsOn: '2999-12-31',
          current: false,
        }),
      ],
    }),
  )
  api.on('GET', `${INCOMES}?period=${future}`, () => json({ incomes: [], truncated: false }))
  showFinance()
  openIncomesTab()
  fireEvent.click(await screen.findByRole('button', { name: '수입 적기' }))
  await screen.findByRole('form', { name: '수입 적기' })
  expect(screen.getByText(INCOME_PERIOD_NOT_STARTED)).toBeTruthy()
  fill('금액(원)', '1000')
  fireEvent.click(submit())
  expect(screen.getByLabelText('받은 날').getAttribute('aria-invalid')).toBe('true')
  expect(api.calls.some(call => call.method === 'POST')).toBe(false)
})
