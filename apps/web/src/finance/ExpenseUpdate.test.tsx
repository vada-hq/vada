// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { EVENT_ID, eventSummary } from '@/test-support/event-fixtures'
import { expenseDetail, expenseSummary } from '@/test-support/expense-fixtures'
import {
  BASE,
  EXPENSES,
  openExpensesTab,
  serveFinance,
  showFinance,
} from '@/test-support/expense-harness'
import { deferredResponse, json } from '@/test-support/mock-api'
import { ACTION_GONE, EXPENSE_ERRORS, EXPENSE_LOST } from '@/lib/messages'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const DONE_EVENT = '00000000-0000-4000-8000-0000000000e2'

function serve(detail = expenseDetail()) {
  const api = serveFinance()
  api.on('GET', EXPENSES, () => json({ expenses: [expenseSummary('e1')], truncated: false }))
  api.on('GET', `${EXPENSES}/e1`, () => json({ expense: detail }))
  api.on('GET', `${BASE}/events`, () =>
    json({
      events: [
        eventSummary(),
        eventSummary({ id: DONE_EVENT, name: '끝난 행사', status: 'completed' }),
      ],
      truncated: false,
    }),
  )
  return api
}

async function openUpdate() {
  openExpensesTab()
  fireEvent.click(await screen.findByRole('button', { name: '사용처 e1' }))
  const detail = await screen.findByRole('dialog')
  fireEvent.click(await within(detail).findByRole('button', { name: '고치기' }))
  const dialog = (await screen.findAllByRole('dialog')).at(-1)!
  await waitFor(() =>
    expect(within(dialog).getByLabelText('행사')).toHaveProperty('disabled', false),
  )
  return dialog
}
const posts = (api: ReturnType<typeof serve>) =>
  api.calls.filter(call => call.method === 'POST' && call.path === `${EXPENSES}/e1`)
const save = (dialog: HTMLElement) => within(dialog).getByRole('button', { name: '저장' })

test('[고치기]는 서버 actions에 expense.update가 있을 때만 보인다', async () => {
  serve(expenseDetail('e1', { actions: ['expense.cancel'] }))
  showFinance()
  openExpensesTab()
  fireEvent.click(await screen.findByRole('button', { name: '사용처 e1' }))
  const detail = await screen.findByRole('dialog')
  await within(detail).findByRole('button', { name: '취소' })
  expect(within(detail).queryByRole('button', { name: '고치기' })).toBeNull()
})

test('행사 고르기는 완료하지 않은 행사만 보이고, 바뀐 칸이 없으면 저장이 꺼져 있다', async () => {
  serve()
  showFinance()
  const dialog = await openUpdate()
  const options = within(within(dialog).getByLabelText('행사')).getAllByRole('option')
  expect(options.map(option => option.textContent)).toEqual(['행사 없음', '신입생 환영회'])
  expect(save(dialog)).toHaveProperty('disabled', true)
  fireEvent.change(within(dialog).getByLabelText('사유'), { target: { value: '급해서' } })
  expect(save(dialog)).toHaveProperty('disabled', false)
})

test('바뀐 칸만 보내고, 두 번 눌러도 한 번만 보내며, 저장하면 닫고 새 값과 목록 다시 읽기를 한다', async () => {
  const api = serve()
  const handlers = showFinance()
  const dialog = await openUpdate()
  const pending = deferredResponse()
  api.on('POST', `${EXPENSES}/e1`, () => pending.promise)
  fireEvent.change(within(dialog).getByLabelText('행사'), { target: { value: EVENT_ID } })
  fireEvent.click(save(dialog))
  fireEvent.click(save(dialog))
  await waitFor(() => expect(posts(api)).toHaveLength(1))
  expect(posts(api)[0]?.body).toEqual({ eventId: EVENT_ID })
  pending.resolve(
    json({
      expense: expenseDetail('e1', { event: { id: EVENT_ID, name: '신입생 환영회' } }),
    }),
  )
  await waitFor(() => expect(screen.queryByText('지출 고치기')).toBeNull())
  expect(screen.getByText('행사 신입생 환영회')).toBeTruthy()
  expect(handlers.onChanged).not.toHaveBeenCalled()
})

test('사유를 비우면 null로 보낸다', async () => {
  const api = serve(expenseDetail('e1', { reason: '급해서' }))
  api.on('POST', `${EXPENSES}/e1`, () => json({ expense: expenseDetail('e1') }))
  showFinance()
  const dialog = await openUpdate()
  fireEvent.change(within(dialog).getByLabelText('사유'), { target: { value: '' } })
  fireEvent.click(save(dialog))
  await waitFor(() => expect(posts(api)[0]?.body).toEqual({ reason: null }))
})

test('요청과 행사가 다르면(409 EVENT_MISMATCH) 창은 열려 있고 문구가 보인다', async () => {
  const api = serve()
  api.on('POST', `${EXPENSES}/e1`, () => json({ error: 'EVENT_MISMATCH' }, 409))
  showFinance()
  const dialog = await openUpdate()
  fireEvent.change(within(dialog).getByLabelText('행사'), { target: { value: EVENT_ID } })
  fireEvent.click(save(dialog))
  expect((await within(dialog).findByRole('alert')).textContent).toBe(EXPENSE_ERRORS.EVENT_MISMATCH)
  expect(screen.getByText('지출 고치기')).toBeTruthy()
})

test('행사가 완료됐으면(409 EVENT_COMPLETED) 창을 닫고 문구를 버튼 옆에 보이며 지출을 다시 읽는다', async () => {
  const api = serve()
  api.on('POST', `${EXPENSES}/e1`, () => {
    api.on('GET', `${EXPENSES}/e1`, () => json({ expense: expenseDetail('e1', { actions: [] }) }))
    return json({ error: 'EVENT_COMPLETED' }, 409)
  })
  showFinance()
  const dialog = await openUpdate()
  fireEvent.change(within(dialog).getByLabelText('사유'), { target: { value: '급해서' } })
  fireEvent.click(save(dialog))
  await waitFor(() => expect(screen.queryByText('지출 고치기')).toBeNull())
  expect((await screen.findByRole('alert')).textContent).toBe(EXPENSE_ERRORS.EVENT_COMPLETED)
  expect(screen.queryByRole('button', { name: '고치기' })).toBeNull()
})

test('고치다 지출이 사라지면(404) 창을 닫고 이유를 목록 위에 보인다', async () => {
  const api = serve()
  api.on('POST', `${EXPENSES}/e1`, () => json({ error: 'NOT_FOUND' }, 404))
  showFinance()
  const dialog = await openUpdate()
  fireEvent.change(within(dialog).getByLabelText('사유'), { target: { value: '급해서' } })
  fireEvent.click(save(dialog))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect((await screen.findByRole('alert')).textContent).toBe(EXPENSE_LOST)
})

test('고치다 권한을 잃으면(403) 학생회를 다시 읽게 하고 창을 닫는다', async () => {
  const api = serve()
  api.on('POST', `${EXPENSES}/e1`, () => json({ error: 'FORBIDDEN' }, 403))
  const handlers = showFinance()
  const dialog = await openUpdate()
  fireEvent.change(within(dialog).getByLabelText('사유'), { target: { value: '급해서' } })
  fireEvent.click(save(dialog))
  await waitFor(() => expect(handlers.onForbidden).toHaveBeenCalled())
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
})

test('창을 열어 둔 사이 다시 읽은 지출에서 고치기가 빠지면 닫고 이유를 보인다', async () => {
  const api = serve()
  showFinance()
  await openUpdate()
  api.on('GET', `${EXPENSES}/e1`, () => json({ expense: expenseDetail('e1', { actions: [] }) }))
  document.dispatchEvent(new Event('visibilitychange'))
  await waitFor(() => expect(screen.queryByText('지출 고치기')).toBeNull())
  expect((await screen.findByRole('alert')).textContent).toBe(ACTION_GONE)
})
