// @vitest-environment jsdom
import { resetAddress } from '@/test-support/address-reset'
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { EVENT_ID, eventSummary } from '@/test-support/event-fixtures'
import { openHistory } from '@/test-support/history'
import { expenseDetail, expenseSummary } from '@/test-support/expense-fixtures'
import {
  BASE,
  EXPENSES,
  openExpensesTab,
  serveFinance,
  showFinance,
} from '@/test-support/expense-harness'
import {
  BUSINESS_ACCOUNT_ID,
  CLOSED_ACCOUNT_ID,
  MAIN_ACCOUNT_ID,
  standardAccounts,
} from '@/test-support/account-fixtures'
import { deferredResponse, json } from '@/test-support/mock-api'
import {
  ACTION_GONE,
  EXPENSE_ACCOUNT_CLOSED,
  EXPENSE_OPTIONS_FAILED,
  EXPENSE_ERRORS,
  EXPENSE_LOST,
} from '@/lib/messages'

afterEach(async () => {
  cleanup()
  await resetAddress()
  vi.unstubAllGlobals()
})

const DONE_EVENT = '00000000-0000-4000-8000-0000000000e2'

function serve(detail = expenseDetail()) {
  const api = serveFinance()
  api.on('GET', EXPENSES, () =>
    json({ expenses: [expenseSummary('0199d1a0-0000-7000-8000-00000000b101')], truncated: false }),
  )
  api.on('GET', `${EXPENSES}/0199d1a0-0000-7000-8000-00000000b101`, () => json({ expense: detail }))
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
  fireEvent.click(
    await screen.findByRole('button', { name: '사용처 0199d1a0-0000-7000-8000-00000000b101' }),
  )
  const detail = await screen.findByRole('dialog')
  fireEvent.click(await within(detail).findByRole('button', { name: '고치기' }))
  const dialog = (await screen.findAllByRole('dialog')).at(-1)!
  await waitFor(() =>
    expect(within(dialog).getByLabelText('행사')).toHaveProperty('disabled', false),
  )
  return dialog
}
const posts = (api: ReturnType<typeof serve>) =>
  api.calls.filter(
    call =>
      call.method === 'POST' && call.path === `${EXPENSES}/0199d1a0-0000-7000-8000-00000000b101`,
  )
const save = (dialog: HTMLElement) => within(dialog).getByRole('button', { name: '저장' })

test('[고치기]는 서버 actions에 expense.update가 있을 때만 보인다', async () => {
  serve(expenseDetail('0199d1a0-0000-7000-8000-00000000b101', { actions: ['expense.cancel'] }))
  showFinance()
  openExpensesTab()
  fireEvent.click(
    await screen.findByRole('button', { name: '사용처 0199d1a0-0000-7000-8000-00000000b101' }),
  )
  const detail = await screen.findByRole('dialog')
  await within(detail).findByRole('button', { name: '지출 취소' })
  expect(within(detail).queryByRole('button', { name: '고치기' })).toBeNull()
})

test('행사 고르기는 완료하지 않은 행사만 보이고, 바뀐 칸이 없으면 저장을 눌러도 보내지 않고 닫는다', async () => {
  const api = serve()
  showFinance()
  const dialog = await openUpdate()
  // 위에 설명 글 없이 제목만 있다.
  expect(within(dialog).getByRole('heading').parentElement?.children).toHaveLength(1)
  const options = within(within(dialog).getByLabelText('행사')).getAllByRole('option')
  expect(options.map(option => option.textContent)).toEqual(['행사 없음', '신입생 환영회'])
  expect(save(dialog)).toHaveProperty('disabled', false)
  fireEvent.click(save(dialog))
  await waitFor(() => expect(screen.queryByText('지출 고치기')).toBeNull())
  expect(posts(api)).toHaveLength(0)
})

test('바뀐 칸만 보내고, 두 번 눌러도 한 번만 보내며, 저장하면 닫고 새 값과 목록 다시 읽기를 한다', async () => {
  const api = serve()
  const handlers = showFinance()
  const dialog = await openUpdate()
  const pending = deferredResponse()
  api.on('POST', `${EXPENSES}/0199d1a0-0000-7000-8000-00000000b101`, () => pending.promise)
  fireEvent.change(within(dialog).getByLabelText('행사'), { target: { value: EVENT_ID } })
  fireEvent.click(save(dialog))
  fireEvent.click(save(dialog))
  await waitFor(() => expect(posts(api)).toHaveLength(1))
  expect(posts(api)[0]?.body).toEqual({ eventId: EVENT_ID })
  pending.resolve(
    json({
      expense: expenseDetail('0199d1a0-0000-7000-8000-00000000b101', {
        event: { id: EVENT_ID, name: '신입생 환영회' },
      }),
    }),
  )
  await waitFor(() => expect(screen.queryByText('지출 고치기')).toBeNull())
  expect(screen.getByRole('button', { name: '신입생 환영회' })).toBeTruthy()
  expect(handlers.onChanged).not.toHaveBeenCalled()
})

test('사유를 비우면 null로 보낸다', async () => {
  const api = serve(expenseDetail('0199d1a0-0000-7000-8000-00000000b101', { reason: '급해서' }))
  api.on('POST', `${EXPENSES}/0199d1a0-0000-7000-8000-00000000b101`, () =>
    json({ expense: expenseDetail('0199d1a0-0000-7000-8000-00000000b101') }),
  )
  showFinance()
  const dialog = await openUpdate()
  fireEvent.change(within(dialog).getByLabelText('사유'), { target: { value: '' } })
  fireEvent.click(save(dialog))
  await waitFor(() => expect(posts(api)[0]?.body).toEqual({ reason: null }))
})

test('사유가 계약 상한보다 길면 저장을 눌러도 보내지 않고 사유 칸 아래에 이유가 보인다', async () => {
  const api = serve()
  showFinance()
  const dialog = await openUpdate()
  const reason = within(dialog).getByLabelText('사유')
  fireEvent.change(reason, { target: { value: '가'.repeat(1001) } })
  expect(within(dialog).queryByText('더 짧게 입력해 주세요')).toBeNull()
  fireEvent.click(save(dialog))
  expect(within(dialog).getByText('더 짧게 입력해 주세요')).toBeTruthy()
  await waitFor(() => expect(document.activeElement).toBe(reason))
  expect(posts(api)).toHaveLength(0)
})

test('요청과 행사가 다르면(409 EVENT_MISMATCH) 창은 열려 있고 문구가 보인다', async () => {
  const api = serve()
  api.on('POST', `${EXPENSES}/0199d1a0-0000-7000-8000-00000000b101`, () =>
    json({ error: 'EVENT_MISMATCH' }, 409),
  )
  showFinance()
  const dialog = await openUpdate()
  fireEvent.change(within(dialog).getByLabelText('행사'), { target: { value: EVENT_ID } })
  fireEvent.click(save(dialog))
  expect((await within(dialog).findByRole('alert')).textContent).toBe(EXPENSE_ERRORS.EVENT_MISMATCH)
  expect(screen.getByText('지출 고치기')).toBeTruthy()
})

test('행사가 완료됐으면(409 EVENT_COMPLETED) 창을 닫고 문구를 버튼 옆에 보이며 지출을 다시 읽는다', async () => {
  const api = serve()
  api.on('POST', `${EXPENSES}/0199d1a0-0000-7000-8000-00000000b101`, () => {
    api.on('GET', `${EXPENSES}/0199d1a0-0000-7000-8000-00000000b101`, () =>
      json({ expense: expenseDetail('0199d1a0-0000-7000-8000-00000000b101', { actions: [] }) }),
    )
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
  api.on('POST', `${EXPENSES}/0199d1a0-0000-7000-8000-00000000b101`, () =>
    json({ error: 'NOT_FOUND' }, 404),
  )
  showFinance()
  const dialog = await openUpdate()
  fireEvent.change(within(dialog).getByLabelText('사유'), { target: { value: '급해서' } })
  fireEvent.click(save(dialog))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect((await screen.findByRole('alert')).textContent).toBe(EXPENSE_LOST)
})

test('고치다 권한을 잃으면(403) 학생회를 다시 읽게 하고 창을 닫는다', async () => {
  const api = serve()
  api.on('POST', `${EXPENSES}/0199d1a0-0000-7000-8000-00000000b101`, () =>
    json({ error: 'FORBIDDEN' }, 403),
  )
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
  api.on('GET', `${EXPENSES}/0199d1a0-0000-7000-8000-00000000b101`, () =>
    json({ expense: expenseDetail('0199d1a0-0000-7000-8000-00000000b101', { actions: [] }) }),
  )
  document.dispatchEvent(new Event('visibilitychange'))
  await waitFor(() => expect(screen.queryByText('지출 고치기')).toBeNull())
  expect((await screen.findByRole('alert')).textContent).toBe(ACTION_GONE)
})

test('행사 목록을 읽지 못하면 이유를 보이고 사유는 고칠 수 있다', async () => {
  const api = serve()
  api.on('GET', `${BASE}/events`, () => json({ error: 'INTERNAL' }, 500))
  showFinance()
  openExpensesTab()
  fireEvent.click(
    await screen.findByRole('button', { name: '사용처 0199d1a0-0000-7000-8000-00000000b101' }),
  )
  const detail = await screen.findByRole('dialog')
  fireEvent.click(await within(detail).findByRole('button', { name: '고치기' }))
  expect((await screen.findByText(EXPENSE_OPTIONS_FAILED)).textContent).toBe(EXPENSE_OPTIONS_FAILED)
  // 지출 탭의 거르기 줄에도 '행사'가 있어 창 안에서 찾는다.
  const form = within(screen.getByRole('dialog'))
  expect(form.getByLabelText('행사')).toHaveProperty('disabled', true)
  expect(form.getByLabelText('사유')).toHaveProperty('disabled', false)
})

test('계좌 없는 지출은 없음으로 시작하고 사유만 고쳐도 계좌는 null 그대로 둔다', async () => {
  const api = serve()
  api.on('GET', `${BASE}/accounts`, () => json(standardAccounts()))
  api.on('POST', `${EXPENSES}/0199d1a0-0000-7000-8000-00000000b101`, () =>
    json({
      expense: expenseDetail('0199d1a0-0000-7000-8000-00000000b101', { reason: '보충' }),
    }),
  )
  showFinance()
  const dialog = await openUpdate()
  const account = within(dialog).getByLabelText('계좌')
  expect(account.parentElement?.textContent).toContain('(선택)')
  await within(account).findByRole('option', { name: '학생회비 통장 (국민은행)' })
  expect(account).toHaveProperty('value', '')
  expect(
    within(account)
      .getAllByRole('option')
      .map(option => option.textContent),
  ).toEqual(['없음', '학생회비 통장 (국민은행)', '행사 통장 (신한은행)'])
  fireEvent.change(within(dialog).getByLabelText('사유'), { target: { value: '보충' } })
  fireEvent.click(save(dialog))
  await waitFor(() => expect(posts(api)[0]?.body).toEqual({ reason: '보충' }))
})

test('기존 A에서 고른 B가 폴링으로 닫히면 저장을 막고 계좌 칸 오류를 보이며 다시 고르게 한다', async () => {
  const api = serve(
    expenseDetail('0199d1a0-0000-7000-8000-00000000b101', {
      account: { id: MAIN_ACCOUNT_ID, name: '학생회비 통장' },
    }),
  )
  api.on('GET', `${BASE}/accounts`, () => json(standardAccounts()))
  api.on('POST', `${EXPENSES}/0199d1a0-0000-7000-8000-00000000b101`, () =>
    json({ expense: expenseDetail() }),
  )
  showFinance()
  const dialog = await openUpdate()
  const account = within(dialog).getByLabelText('계좌')
  await within(account).findByRole('option', { name: '행사 통장 (신한은행)' })
  fireEvent.change(within(dialog).getByLabelText('사유'), { target: { value: '보충' } })
  fireEvent.change(account, { target: { value: BUSINESS_ACCOUNT_ID } })
  const updated = standardAccounts()
  updated.accounts.find(item => item.id === BUSINESS_ACCOUNT_ID)!.closedOn = '2026-10-28'
  api.on('GET', `${BASE}/accounts`, () => json(updated))
  fireEvent(document, new Event('visibilitychange'))
  await waitFor(() =>
    expect(within(account).queryByRole('option', { name: '행사 통장 (신한은행)' })).toBeNull(),
  )
  expect(save(dialog)).toHaveProperty('disabled', false)
  fireEvent.click(save(dialog))
  expect(posts(api)).toHaveLength(0)
  expect(within(dialog).getByText(EXPENSE_ACCOUNT_CLOSED)).toBeTruthy()
  expect(account.getAttribute('aria-invalid')).toBe('true')
  expect(account.parentElement?.textContent).toContain(EXPENSE_ACCOUNT_CLOSED)
  await waitFor(() => expect(document.activeElement).toBe(account))
  fireEvent.change(account, { target: { value: MAIN_ACCOUNT_ID } })
  expect(within(dialog).queryByText(EXPENSE_ACCOUNT_CLOSED)).toBeNull()
  fireEvent.click(save(dialog))
  await waitFor(() => expect(posts(api)[0]?.body).toEqual({ reason: '보충' }))
})

test.each([BUSINESS_ACCOUNT_ID, ''])(
  '기존 계좌를 %s로 바꾸면 계좌만 보내고 저장된 값과 이력이 보인다',
  async accountId => {
    const api = serve(
      expenseDetail('0199d1a0-0000-7000-8000-00000000b101', {
        account: { id: MAIN_ACCOUNT_ID, name: '학생회비 통장' },
      }),
    )
    api.on('GET', `${BASE}/accounts`, () => json(standardAccounts()))
    api.on('POST', `${EXPENSES}/0199d1a0-0000-7000-8000-00000000b101`, () =>
      json({
        expense: expenseDetail('0199d1a0-0000-7000-8000-00000000b101', {
          account: accountId ? { id: accountId, name: '행사 통장' } : null,
          history: [
            {
              versionNo: 2,
              at: '2026-10-25T03:00:00Z',
              by: null,
              reason: null,
              changes: [{ field: 'account' }],
            },
          ],
        }),
      }),
    )
    showFinance()
    const dialog = await openUpdate()
    const account = within(dialog).getByLabelText('계좌')
    await waitFor(() => expect(account).toHaveProperty('value', MAIN_ACCOUNT_ID))
    fireEvent.change(account, { target: { value: accountId } })
    fireEvent.click(save(dialog))
    await waitFor(() => expect(posts(api)[0]?.body).toEqual({ accountId: accountId || null }))
    await waitFor(() => expect(screen.queryByText('지출 고치기')).toBeNull())
    if (accountId) expect(screen.getByText('계좌 행사 통장')).toBeTruthy()
    expect((await openHistory()).textContent).toContain('계좌를 바꿈')
  },
)

test('기존 사업용 계좌는 대표 계좌로 바꾸지 않고 그대로 두면 요청 없이 닫는다', async () => {
  const api = serve(
    expenseDetail('0199d1a0-0000-7000-8000-00000000b101', {
      account: { id: BUSINESS_ACCOUNT_ID, name: '행사 통장' },
    }),
  )
  api.on('GET', `${BASE}/accounts`, () => json(standardAccounts()))
  showFinance()
  const dialog = await openUpdate()
  await waitFor(() =>
    expect(within(dialog).getByLabelText('계좌')).toHaveProperty('value', BUSINESS_ACCOUNT_ID),
  )
  fireEvent.click(save(dialog))
  await waitFor(() => expect(screen.queryByText('지출 고치기')).toBeNull())
  expect(posts(api)).toHaveLength(0)
})

test('기존 닫은 계좌는 사유만 고칠 때 지우지 않는다', async () => {
  const api = serve(
    expenseDetail('0199d1a0-0000-7000-8000-00000000b101', {
      account: { id: CLOSED_ACCOUNT_ID, name: '지난 통장' },
    }),
  )
  api.on('GET', `${BASE}/accounts`, () => json(standardAccounts()))
  api.on('POST', `${EXPENSES}/0199d1a0-0000-7000-8000-00000000b101`, () =>
    json({ expense: expenseDetail() }),
  )
  showFinance()
  const dialog = await openUpdate()
  const account = within(dialog).getByLabelText('계좌')
  await within(account).findByRole('option', { name: /지난 통장.*\(닫힘\)/ })
  expect(account).toHaveProperty('value', CLOSED_ACCOUNT_ID)
  fireEvent.change(within(dialog).getByLabelText('사유'), { target: { value: '보충' } })
  fireEvent.click(save(dialog))
  await waitFor(() => expect(posts(api)[0]?.body).toEqual({ reason: '보충' }))
})

test('닫힌 기존 계좌를 그대로 표시하고 없음을 고르면 계좌를 실제로 비운다', async () => {
  const api = serve(
    expenseDetail('0199d1a0-0000-7000-8000-00000000b101', {
      account: { id: CLOSED_ACCOUNT_ID, name: '지난 통장' },
    }),
  )
  api.on('GET', `${BASE}/accounts`, () => json(standardAccounts()))
  api.on('POST', `${EXPENSES}/0199d1a0-0000-7000-8000-00000000b101`, () =>
    json({ expense: expenseDetail() }),
  )
  showFinance()
  const dialog = await openUpdate()
  const account = within(dialog).getByLabelText('계좌')
  await within(account).findByRole('option', { name: /지난 통장.*\(닫힘\)/ })
  expect(account).toHaveProperty('value', CLOSED_ACCOUNT_ID)
  fireEvent.change(account, { target: { value: '' } })
  fireEvent.click(save(dialog))
  await waitFor(() => expect(posts(api)[0]?.body).toEqual({ accountId: null }))
})

test('계좌 목록이 늦거나 실패해도 기존 계좌를 비우지 않고 사유를 고친다', async () => {
  const api = serve(
    expenseDetail('0199d1a0-0000-7000-8000-00000000b101', {
      account: { id: BUSINESS_ACCOUNT_ID, name: '행사 통장' },
    }),
  )
  const pending = deferredResponse()
  api.on('GET', `${BASE}/accounts`, () => pending.promise)
  api.on('POST', `${EXPENSES}/0199d1a0-0000-7000-8000-00000000b101`, () =>
    json({ expense: expenseDetail() }),
  )
  showFinance()
  const dialog = await openUpdate()
  pending.resolve(json({ error: 'INTERNAL' }, 500))
  expect(await within(dialog).findByText(/계좌 목록을 불러오지 못했어요/)).toBeTruthy()
  fireEvent.change(within(dialog).getByLabelText('사유'), { target: { value: '보충' } })
  fireEvent.click(save(dialog))
  await waitFor(() => expect(posts(api)[0]?.body).toEqual({ reason: '보충' }))
})
