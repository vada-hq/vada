// @vitest-environment jsdom
import { resetAddress } from '@/test-support/address-reset'
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import {
  accountItem,
  accountsResponse,
  BUSINESS_ACCOUNT_ID,
  MAIN_ACCOUNT_ID,
  standardAccounts,
} from '@/test-support/account-fixtures'
import { MEMBER_PERMISSIONS } from '@/test-support/council-fixtures'
import { asElement } from '@/test-support/elements'
import { BASE, serveFinance } from '@/test-support/expense-harness'
import { AccountsTab } from './AccountsTab'
import { ACCOUNT_LOST, PERMISSION_CHANGED } from '@/lib/messages'
import { deferredResponse, json } from '@/test-support/mock-api'

afterEach(async () => {
  cleanup()
  await resetAddress()
  vi.unstubAllGlobals()
})

const ACCOUNTS = `${BASE}/accounts`

function showAccounts(permissions?: readonly string[]) {
  const handlers = { onForbidden: vi.fn() }
  render(
    <AccountsTab
      councilId={BASE.split('/').at(-1)!}
      canManage={permissions === undefined || permissions.includes('finance.manage')}
      {...handlers}
    />,
  )
  return handlers
}

async function open(accounts = standardAccounts(), permissions?: readonly string[]) {
  const api = serveFinance()
  api.on('GET', ACCOUNTS, () => json(accounts))
  const handlers = showAccounts(permissions)
  await screen.findByRole('list', { name: '계좌' })
  return { api, handlers }
}
const button = (name: string) => asElement(screen.getByRole('button', { name }), HTMLButtonElement)
const fill = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
function cardOf(name: string) {
  const card = screen.getByText(name).closest('li')
  if (!card) throw new Error(`카드가 없다: ${name}`)
  return card
}

test('카드에 이름, 은행, 계좌번호, 예금주, 종류, 닫힘이 보인다', async () => {
  await open()
  const main = within(cardOf('학생회비 통장'))
  expect(main.getByText('국민은행')).toBeTruthy()
  expect(main.getByText('123-45-678901')).toBeTruthy()
  expect(main.getByText('예금주 소프트웨어학부 학생회')).toBeTruthy()
  expect(main.getByText('대표 계좌')).toBeTruthy()
  const closed = within(cardOf('지난 통장'))
  expect(closed.getByText('닫힘 2026-09-01')).toBeTruthy()
  // 닫은 계좌는 서버가 동작을 주지 않아 고치기·닫기가 없다.
  expect(closed.queryByRole('button')).toBeNull()
  expect(cardOf('학생회비 통장').querySelector('.wrap-anywhere')).toBeTruthy()
})

test('재정부가 아니면 더하기·고치기·닫기가 없다', async () => {
  const readOnly = accountsResponse([accountItem(MAIN_ACCOUNT_ID, { actions: [] })])
  await open(readOnly, MEMBER_PERMISSIONS)
  expect(screen.queryByRole('button', { name: '계좌 더하기' })).toBeNull()
  expect(screen.queryByRole('button', { name: '고치기' })).toBeNull()
  expect(screen.queryByRole('button', { name: '닫기' })).toBeNull()
})

test('신청 양식이 쓰는 계좌는 사용 수가 보이고 서버가 닫기를 주지 않아 닫기 버튼이 없다', async () => {
  const used = accountItem(MAIN_ACCOUNT_ID, { formsInUse: 2, actions: ['account.update'] })
  await open(accountsResponse([used]))
  expect(await screen.findByText('신청 양식 2개에서 사용 중')).toBeTruthy()
  expect(screen.getByRole('button', { name: '고치기' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: '닫기' })).toBeNull()
})

test('계좌가 없으면 빈 문구가 보인다', async () => {
  const api = serveFinance()
  api.on('GET', ACCOUNTS, () => json(accountsResponse()))
  showAccounts()
  expect(await screen.findByText('계좌 없음')).toBeTruthy()
})

test('계좌 더하기: 빈 칸이나 숫자와 - 아닌 계좌번호는 보내지 않고 칸 아래에 알리며, 두 번 눌러도 한 번만 간다', async () => {
  const { api } = await open()
  const pending = deferredResponse()
  api.on('POST', ACCOUNTS, () => pending.promise)
  fireEvent.click(button('계좌 더하기'))
  const form = await screen.findByRole('form', { name: '계좌 더하기' })
  expect(button('더하기').disabled).toBe(false)
  // 입력칸 안에 예시 글을 두지 않는다.
  expect(form.querySelector('[placeholder]')).toBeNull()
  fireEvent.click(button('더하기'))
  expect(screen.getByText('이름을 입력해 주세요')).toBeTruthy()
  expect(screen.getByText('은행을 입력해 주세요')).toBeTruthy()
  expect(screen.getByText('계좌번호를 입력해 주세요')).toBeTruthy()
  expect(screen.getByText('예금주를 입력해 주세요')).toBeTruthy()
  await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('이름')))
  fill('이름', '동아리 통장')
  fill('은행', '우리은행')
  fill('계좌번호', '12가나')
  fill('예금주', '김회계')
  fireEvent.click(button('더하기'))
  expect(screen.getByText('숫자와 -만 입력해 주세요')).toBeTruthy()
  expect(screen.getByLabelText('계좌번호').getAttribute('aria-invalid')).toBe('true')
  expect(api.calls.filter(call => call.method === 'POST')).toHaveLength(0)
  fill('계좌번호', '1002-123-456789')
  expect(screen.queryByText('숫자와 -만 입력해 주세요')).toBeNull()
  fireEvent.click(button('더하기'))
  fireEvent.click(button('더하기'))
  await waitFor(() => expect(button('더하기').disabled).toBe(true))
  expect(api.calls.filter(call => call.method === 'POST')).toHaveLength(1)
  api.on('GET', ACCOUNTS, () =>
    json(accountsResponse([accountItem('x1', { name: '동아리 통장', type: 'business' })])),
  )
  pending.resolve(json({ account: accountItem('x1') }, 201))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(api.calls.find(call => call.method === 'POST')?.body).toEqual({
    name: '동아리 통장',
    bank: '우리은행',
    accountNumber: '1002-123-456789',
    holder: '김회계',
    type: 'business',
  })
  expect(await screen.findByText('동아리 통장')).toBeTruthy()
})

test.each([
  ['MAIN_ACCOUNT_EXISTS', /대표 계좌가 이미 있어요/],
  ['ACCOUNT_NAME_TAKEN', /같은 이름의 계좌/],
  ['INVALID_INPUT', /보낼 수 없는 내용/],
])('더하기 409·400 %s는 문구가 보이고 입력이 남는다', async (code, text) => {
  const { api } = await open()
  api.on('POST', ACCOUNTS, () => json({ error: code }, code === 'INVALID_INPUT' ? 400 : 409))
  fireEvent.click(button('계좌 더하기'))
  await screen.findByRole('form', { name: '계좌 더하기' })
  fill('이름', '동아리 통장')
  fill('은행', '우리은행')
  fill('계좌번호', '1002')
  fill('예금주', '김회계')
  fireEvent.click(button('더하기'))
  expect((await screen.findByRole('alert')).textContent).toMatch(text)
  expect(asElement(screen.getByLabelText('이름'), HTMLInputElement).value).toBe('동아리 통장')
  expect(button('더하기').disabled).toBe(false)
})

test('고치기는 지금 값으로 채워지고 칸을 모두 보낸다', async () => {
  const { api } = await open()
  api.on('POST', `${ACCOUNTS}/${BUSINESS_ACCOUNT_ID}`, () =>
    json({ account: accountItem(BUSINESS_ACCOUNT_ID) }),
  )
  fireEvent.click(within(cardOf('행사 통장')).getByRole('button', { name: '고치기' }))
  await screen.findByRole('form', { name: '계좌 고치기' })
  expect(asElement(screen.getByLabelText('은행'), HTMLInputElement).value).toBe('신한은행')
  fill('이름', '행사 통장 2')
  fireEvent.click(button('고치기'))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(api.calls.find(call => call.method === 'POST')?.body).toEqual({
    name: '행사 통장 2',
    bank: '신한은행',
    accountNumber: '123-45-678901',
    holder: '소프트웨어학부 학생회',
    type: 'business',
  })
})

test('닫기는 확인을 거치고, 창을 닫으면 아무것도 보내지 않는다', async () => {
  const { api } = await open()
  api.on('POST', `${ACCOUNTS}/${BUSINESS_ACCOUNT_ID}/close`, () =>
    json({ account: accountItem(BUSINESS_ACCOUNT_ID, { closedOn: '2026-10-22', actions: [] }) }),
  )
  fireEvent.click(within(cardOf('행사 통장')).getByRole('button', { name: '닫기' }))
  await screen.findByText(/행사 통장 계좌를 닫을까요/)
  // 나가는 버튼은 [닫기]다(오른쪽 위 X도 같은 이름이라 첫 번째가 푸터의 것이다).
  fireEvent.click(within(screen.getByRole('dialog')).getAllByRole('button', { name: '닫기' })[0]!)
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(api.calls.some(call => call.method === 'POST')).toBe(false)
  fireEvent.click(within(cardOf('행사 통장')).getByRole('button', { name: '닫기' }))
  await screen.findByText(/행사 통장 계좌를 닫을까요/)
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '계좌 닫기' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(api.calls.filter(call => call.method === 'POST')).toHaveLength(1)
})

test('이미 닫은 계좌(409)면 닫고 이유를 보이며 목록을 다시 읽는다', async () => {
  const { api } = await open()
  api.on('POST', `${ACCOUNTS}/${BUSINESS_ACCOUNT_ID}`, () => json({ error: 'ACCOUNT_CLOSED' }, 409))
  const reads = () => api.calls.filter(call => call.method === 'GET' && call.path === ACCOUNTS)
  const before = reads().length
  fireEvent.click(within(cardOf('행사 통장')).getByRole('button', { name: '고치기' }))
  await screen.findByRole('form', { name: '계좌 고치기' })
  fireEvent.click(button('고치기'))
  expect((await screen.findByText(/이미 닫은 계좌예요/)).textContent).toBeTruthy()
  expect(screen.queryByRole('dialog')).toBeNull()
  await waitFor(() => expect(reads().length).toBeGreaterThan(before))
})

test('고치다 계좌가 없어졌으면(404) 이유를 보이고 대화상자를 닫고 목록을 다시 읽는다', async () => {
  const { api } = await open()
  api.on('POST', `${ACCOUNTS}/${BUSINESS_ACCOUNT_ID}`, () => json({ error: 'NOT_FOUND' }, 404))
  const reads = () => api.calls.filter(call => call.method === 'GET' && call.path === ACCOUNTS)
  const before = reads().length
  fireEvent.click(within(cardOf('행사 통장')).getByRole('button', { name: '고치기' }))
  await screen.findByRole('form', { name: '계좌 고치기' })
  fireEvent.click(button('고치기'))
  expect(await screen.findByText(ACCOUNT_LOST)).toBeTruthy()
  expect(screen.queryByRole('dialog')).toBeNull()
  await waitFor(() => expect(reads().length).toBeGreaterThan(before))
})

test('닫다 권한을 잃으면(403) 학생회를 다시 읽게 하고 이유를 보인다', async () => {
  const { api, handlers } = await open()
  api.on('POST', `${ACCOUNTS}/${BUSINESS_ACCOUNT_ID}/close`, () =>
    json({ error: 'FORBIDDEN' }, 403),
  )
  fireEvent.click(within(cardOf('행사 통장')).getByRole('button', { name: '닫기' }))
  await screen.findByText(/행사 통장 계좌를 닫을까요/)
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '계좌 닫기' }))
  expect(await screen.findByText(PERMISSION_CHANGED)).toBeTruthy()
  expect(handlers.onForbidden).toHaveBeenCalled()
  expect(screen.queryByRole('dialog')).toBeNull()
})

test('불러오지 못하면 오류와 [다시 시도]가 보인다', async () => {
  const api = serveFinance()
  api.on('GET', ACCOUNTS, () => json({ error: 'FAILED' }, 500))
  showAccounts()
  expect(await screen.findByText(/계좌를 불러오지 못했어요/)).toBeTruthy()
  expect(screen.getByRole('button', { name: '다시 시도' })).toBeTruthy()
})
