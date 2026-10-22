// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import {
  accountItem,
  accountsResponse,
  BUSINESS_ACCOUNT_ID,
  CLOSED_ACCOUNT_ID,
  MAIN_ACCOUNT_ID,
  standardAccounts,
} from '@/test-support/account-fixtures'
import { asElement } from '@/test-support/elements'
import { expenseDetail, expenseSummary } from '@/test-support/expense-fixtures'
import {
  BASE,
  EXPENSES,
  openExpensesTab,
  REQUESTS,
  serveFinance,
  showFinance,
} from '@/test-support/expense-harness'
import { deferredResponse, json } from '@/test-support/mock-api'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function serve(accounts = standardAccounts()) {
  const api = serveFinance()
  api.on('GET', `${BASE}/accounts`, () => json(accounts))
  api.on('GET', EXPENSES, () => json({ expenses: [expenseSummary('e1')], truncated: false }))
  api.on('GET', `${BASE}/members`, () => json({ members: [], departments: [] }))
  api.on('GET', `${REQUESTS}?view=all`, () => json({ requests: [], truncated: false }))
  api.on('GET', `${BASE}/budget`, () => json({ period: null, items: [], suggested: null }))
  return api
}
const openForm = async () => {
  openExpensesTab()
  fireEvent.click(await screen.findByRole('button', { name: '지출 적기' }))
  return screen.findByRole('form', { name: '지출 적기' })
}
const account = () => asElement(screen.getByLabelText('계좌'), HTMLSelectElement)

test('지출 적기의 계좌는 닫지 않은 대표 계좌로 채워지고 닫은 계좌는 고를 수 없다', async () => {
  serve()
  showFinance()
  await openForm()
  await waitFor(() => expect(account().value).toBe(MAIN_ACCOUNT_ID))
  expect(Array.from(account().options).map(option => option.textContent)).toEqual([
    '없음',
    '학생회비 통장 (국민은행)',
    '행사 통장 (신한은행)',
  ])
})

test('계좌를 없음으로 비우면 다시 채우지 않고 null로 보낸다', async () => {
  const api = serve()
  api.on('POST', EXPENSES, () => json({ expense: expenseDetail('e1') }, 201))
  api.on('GET', `${EXPENSES}/e1`, () => json({ expense: expenseDetail('e1') }))
  showFinance()
  await openForm()
  fireEvent.click(screen.getByRole('button', { name: '요청 없이' }))
  await waitFor(() => expect(account().value).toBe(MAIN_ACCOUNT_ID))
  fireEvent.change(account(), { target: { value: '' } })
  fireEvent.change(screen.getByLabelText('사용처'), { target: { value: '편의점' } })
  fireEvent.change(screen.getByLabelText('내역'), { target: { value: '간식' } })
  fireEvent.change(screen.getByLabelText('금액(원)'), { target: { value: '1000' } })
  expect(account().value).toBe('')
  fireEvent.click(screen.getByRole('button', { name: '적기' }))
  await screen.findByRole('button', { name: '사진 올리기' })
  expect(api.calls.find(call => call.method === 'POST')?.body).toMatchObject({ accountId: null })
})

test('고른 계좌는 지출 본문에 실려 간다', async () => {
  const api = serve()
  api.on('POST', EXPENSES, () => json({ expense: expenseDetail('e1') }, 201))
  api.on('GET', `${EXPENSES}/e1`, () => json({ expense: expenseDetail('e1') }))
  showFinance()
  await openForm()
  fireEvent.click(screen.getByRole('button', { name: '요청 없이' }))
  await waitFor(() => expect(account().value).toBe(MAIN_ACCOUNT_ID))
  fireEvent.change(account(), { target: { value: BUSINESS_ACCOUNT_ID } })
  fireEvent.change(screen.getByLabelText('사용처'), { target: { value: '편의점' } })
  fireEvent.change(screen.getByLabelText('내역'), { target: { value: '간식' } })
  fireEvent.change(screen.getByLabelText('금액(원)'), { target: { value: '1000' } })
  fireEvent.click(screen.getByRole('button', { name: '적기' }))
  await screen.findByRole('button', { name: '사진 올리기' })
  expect(api.calls.find(call => call.method === 'POST')?.body).toMatchObject({
    accountId: BUSINESS_ACCOUNT_ID,
  })
})

test('대표 계좌가 없으면 비어 있고, 목록을 못 읽어도 적을 수 있다', async () => {
  serve(accountsResponse([accountItem(CLOSED_ACCOUNT_ID, { closedOn: '2026-09-01' })]))
  showFinance()
  await openForm()
  await waitFor(() => expect(account().value).toBe(''))
})

test('계좌 목록을 못 읽으면 알리되 지출 적기는 막지 않는다', async () => {
  const api = serve()
  api.on('GET', `${BASE}/accounts`, () => json({ error: 'FAILED' }, 500))
  showFinance()
  await openForm()
  expect(await screen.findByText(/계좌 목록을 불러오지 못했어요/)).toBeTruthy()
  expect(screen.getByRole('button', { name: '요청 없이' })).toBeTruthy()
})

test('닫은 계좌로 적으면(409) 문구가 보이고 입력이 남는다', async () => {
  const api = serve()
  api.on('POST', EXPENSES, () => json({ error: 'ACCOUNT_INVALID' }, 409))
  showFinance()
  await openForm()
  fireEvent.click(screen.getByRole('button', { name: '요청 없이' }))
  await waitFor(() => expect(account().value).toBe(MAIN_ACCOUNT_ID))
  fireEvent.change(screen.getByLabelText('사용처'), { target: { value: '편의점' } })
  fireEvent.change(screen.getByLabelText('내역'), { target: { value: '간식' } })
  fireEvent.change(screen.getByLabelText('금액(원)'), { target: { value: '1000' } })
  fireEvent.click(screen.getByRole('button', { name: '적기' }))
  expect((await screen.findByRole('alert')).textContent).toMatch(/고를 수 없는 계좌/)
  expect(asElement(screen.getByLabelText('사용처'), HTMLInputElement).value).toBe('편의점')
})

test('지출 상세에 계좌 이름이 보인다', async () => {
  const api = serve()
  api.on('GET', `${EXPENSES}/e1`, () =>
    json({
      expense: expenseDetail('e1', { account: { id: MAIN_ACCOUNT_ID, name: '학생회비 통장' } }),
    }),
  )
  showFinance()
  openExpensesTab()
  fireEvent.click(await screen.findByRole('button', { name: /사용처 e1/ }))
  expect(await screen.findByText('계좌 학생회비 통장')).toBeTruthy()
})

test('목록 응답과 거의 동시에 다른 칸을 바꿔도 대표 계좌가 남는다', async () => {
  const api = serve()
  const pending = deferredResponse()
  api.on('GET', `${BASE}/accounts`, () => pending.promise)
  api.on('POST', EXPENSES, () => json({ expense: expenseDetail('e1') }, 201))
  api.on('GET', `${EXPENSES}/e1`, () => json({ expense: expenseDetail('e1') }))
  showFinance()
  await openForm()
  await act(async () => {
    pending.resolve(json(standardAccounts()))
    fireEvent.click(screen.getByRole('button', { name: '요청 없이' }))
  })
  await waitFor(() => expect(account().value).toBe(MAIN_ACCOUNT_ID))
  fireEvent.click(screen.getByRole('button', { name: '요청 없이' }))
  fireEvent.change(screen.getByLabelText('사용처'), { target: { value: '편의점' } })
  fireEvent.change(screen.getByLabelText('내역'), { target: { value: '간식' } })
  fireEvent.change(screen.getByLabelText('금액(원)'), { target: { value: '1000' } })
  fireEvent.click(screen.getByRole('button', { name: '적기' }))
  await screen.findByRole('button', { name: '사진 올리기' })
  expect(api.calls.find(call => call.method === 'POST')?.body).toMatchObject({
    accountId: MAIN_ACCOUNT_ID,
  })
})

test('고른 계좌가 다시 읽은 목록에서 닫혔으면 칸 옆에 이유가 보이고 계좌 없이 나간다', async () => {
  const api = serve()
  api.on('POST', EXPENSES, () => json({ expense: expenseDetail('e1') }, 201))
  api.on('GET', `${EXPENSES}/e1`, () => json({ expense: expenseDetail('e1') }))
  showFinance()
  await openForm()
  await waitFor(() => expect(account().value).toBe(MAIN_ACCOUNT_ID))
  fireEvent.click(screen.getByRole('button', { name: '요청 없이' }))
  fireEvent.change(screen.getByLabelText('사용처'), { target: { value: '편의점' } })
  fireEvent.change(screen.getByLabelText('내역'), { target: { value: '간식' } })
  fireEvent.change(screen.getByLabelText('금액(원)'), { target: { value: '1000' } })
  fireEvent.change(account(), { target: { value: BUSINESS_ACCOUNT_ID } })
  api.on('GET', `${BASE}/accounts`, () => json(accountsResponse([accountItem(MAIN_ACCOUNT_ID)])))
  // 화면이 다시 보이면 목록을 다시 읽는다.
  fireEvent(document, new Event('visibilitychange'))
  expect(await screen.findByText(/고른 계좌를 닫았어요/)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '적기' }))
  await screen.findByRole('button', { name: '사진 올리기' })
  expect(api.calls.find(call => call.method === 'POST')?.body).toMatchObject({ accountId: null })
})
