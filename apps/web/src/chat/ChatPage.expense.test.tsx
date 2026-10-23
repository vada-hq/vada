// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MEMBER_PERMISSIONS, FINANCE_PERMISSIONS } from '@/test-support/council-fixtures'
import { message, messagePage } from '@/test-support/chat-fixtures'
import { chatBase, ChatHarness, openAllRoom, serveChat } from '@/test-support/chat-harness'
import { asElement } from '@/test-support/elements'
import { expenseDetail } from '@/test-support/expense-fixtures'
import { accountItem, accountsResponse, MAIN_ACCOUNT_ID } from '@/test-support/account-fixtures'
import { deferredResponse, json } from '@/test-support/mock-api'
import { PERMISSION_CHANGED } from '@/lib/messages'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const EXPENSES = `${chatBase}/expenses`
const ME = '11111111-1111-4111-8111-111111111111'
const JAE = '22222222-2222-4222-8222-222222222222'
const MSG = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const PHOTO_1 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1'
const PHOTO_2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2'
// 한국 시각 2020-03-02 10:30
const SENT = '2020-03-02T01:30:00Z'
const RECEIPT = message(MSG, '인쇄소 영수증이에요\n포스터 20장', { senderId: JAE, sentAt: SENT })
const joined = '2026-10-01T01:00:00Z'
const teamOf = () => ({
  members: [
    { id: ME, name: '김회장', councilRank: null, departments: [], joinedAt: joined },
    { id: JAE, name: '이재정', councilRank: null, departments: [], joinedAt: joined },
  ],
  departments: [],
})
const withPhotos = expenseDetail('e7', {
  evidence: [{ id: 'v1', type: 'receipt', fileId: 'f1' }],
  evidenceCount: 1,
})

function serve(sent = RECEIPT) {
  const api = serveChat()
  api.on('GET', `${chatBase}/rooms/r1/messages`, () => json(messagePage([sent])))
  api.on('GET', `${chatBase}/members`, () => json(teamOf()))
  api.on('GET', `${chatBase}/events`, () => json({ events: [], truncated: false }))
  api.on('GET', `${chatBase}/accounts`, () =>
    json(accountsResponse([accountItem(MAIN_ACCOUNT_ID)])),
  )
  api.on('GET', `${chatBase}/purchase-requests?view=all`, () =>
    json({ requests: [], truncated: false }),
  )
  api.on('GET', `${EXPENSES}/e7`, () => json({ expense: expenseDetail('e7') }))
  return api
}
const menuOf = async (name: string) => {
  fireEvent.keyDown(await screen.findByRole('button', { name: '메시지 동작' }), { key: 'Enter' })
  return screen.findByRole('menuitem', { name })
}
const openForm = async () => {
  await openAllRoom()
  fireEvent.click(await menuOf('지출 적기'))
  return screen.findByRole('form', { name: '지출 적기' })
}
const posts = (api: ReturnType<typeof serve>) =>
  api.calls.filter(call => call.method === 'POST' && call.path === EXPENSES)
const submit = () => asElement(screen.getByRole('button', { name: '적기' }), HTMLButtonElement)
const fill = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
const value = (label: string) => {
  const field = screen.getByLabelText(label)
  return field instanceof HTMLInputElement || field instanceof HTMLSelectElement ? field.value : ''
}

test('지출 적기는 finance.manage가 있을 때만 메뉴에 있다', async () => {
  serve()
  const view = render(<ChatHarness memberId={ME} permissions={MEMBER_PERMISSIONS} />)
  await openAllRoom()
  await menuOf('구매 요청 만들기')
  expect(screen.queryByRole('menuitem', { name: '지출 적기' })).toBeNull()
  view.unmount()
  cleanup()

  render(<ChatHarness memberId={ME} permissions={FINANCE_PERMISSIONS} />)
  await openAllRoom()
  await menuOf('지출 적기')
})

test('내역은 첫 줄, 결제일은 보낸 날, 먼저 낸 사람은 보낸 사람, 계좌는 대표 계좌로 채워진다. 두 방식 모두 같다', async () => {
  const api = serve()
  render(<ChatHarness memberId={ME} permissions={FINANCE_PERMISSIONS} />)
  await openForm()
  await screen.findByRole('option', { name: '이재정' })
  expect(value('내역')).toBe('인쇄소 영수증이에요')
  expect(value('결제일')).toBe('2020-03-02')
  expect(value('먼저 낸 사람')).toBe(JAE)
  await waitFor(() => expect(value('계좌')).toBe(MAIN_ACCOUNT_ID))
  fireEvent.click(screen.getByRole('button', { name: '요청 없이' }))
  expect(value('내역')).toBe('인쇄소 영수증이에요')
  expect(value('결제일')).toBe('2020-03-02')
  expect(value('먼저 낸 사람')).toBe(JAE)
  fill('사용처', '인쇄소')
  fill('금액(원)', '36000')
  api.on('POST', EXPENSES, () => json({ expense: expenseDetail('e7') }, 201))
  fireEvent.click(submit())
  await screen.findByRole('button', { name: '사진 올리기' })
  expect(posts(api)[0]?.body).toMatchObject({
    description: '인쇄소 영수증이에요',
    paidOn: '2020-03-02',
    paidBy: JAE,
    accountId: MAIN_ACCOUNT_ID,
    sourceMessageId: MSG,
  })
})

test('내 메시지면 먼저 낸 사람은 학생회 돈이고, 떠난 사람의 메시지면 비운다', async () => {
  serve(message(MSG, '영수증', { senderId: ME, sentAt: SENT }))
  const view = render(<ChatHarness memberId={ME} permissions={FINANCE_PERMISSIONS} />)
  await openForm()
  await screen.findByRole('option', { name: '이재정' })
  expect(value('먼저 낸 사람')).toBe('')
  view.unmount()
  cleanup()

  serve(message(MSG, '영수증', { senderId: '99999999-9999-4999-8999-999999999999', sentAt: SENT }))
  render(<ChatHarness memberId={ME} permissions={FINANCE_PERMISSIONS} />)
  await openForm()
  await screen.findByRole('option', { name: '이재정' })
  expect(value('먼저 낸 사람')).toBe('')
})

async function writeDirect(api: ReturnType<typeof serve>) {
  await openForm()
  await screen.findByRole('option', { name: '이재정' })
  fireEvent.click(screen.getByRole('button', { name: '요청 없이' }))
  fill('사용처', '인쇄소')
  fill('금액(원)', '36000')
  return api
}

test('저장하면 상세가 열리고, 메시지 사진이 있으면 공개 안내와 함께 먼저 보이고 사진마다 붙인다', async () => {
  const api = serve(
    message(MSG, '영수증', {
      senderId: JAE,
      sentAt: SENT,
      photos: [{ id: PHOTO_1 }, { id: PHOTO_2 }],
    }),
  )
  api.on('POST', EXPENSES, () => json({ expense: expenseDetail('e7') }, 201))
  const attach = `${EXPENSES}/e7/evidence/from-chat`
  api.on('POST', attach, () => json({ expense: withPhotos }, 201))
  render(<ChatHarness memberId={ME} permissions={FINANCE_PERMISSIONS} />)
  await writeDirect(api)
  fireEvent.click(submit())
  const section = await screen.findByRole('region', { name: '이 메시지의 사진' })
  expect(within(section).getByText('증빙은 모든 운영진이 봐요.')).toBeTruthy()
  fireEvent.click(within(section).getByRole('button', { name: '이 메시지의 사진 2장 붙이기' }))
  await waitFor(() => expect(within(section).getAllByText('붙였어요')).toHaveLength(2))
  const sent = api.calls.filter(call => call.path === attach)
  expect(sent.map(call => call.body)).toEqual([
    { photoId: PHOTO_1, type: 'receipt' },
    { photoId: PHOTO_2, type: 'receipt' },
  ])
  expect(within(section).queryByRole('button', { name: /붙이기/ })).toBeNull()
})

test('사진이 없는 메시지는 사진 붙이기 칸이 없다', async () => {
  const api = serve()
  api.on('POST', EXPENSES, () => json({ expense: expenseDetail('e7') }, 201))
  render(<ChatHarness memberId={ME} permissions={FINANCE_PERMISSIONS} />)
  await writeDirect(api)
  fireEvent.click(submit())
  await screen.findByRole('button', { name: '사진 올리기' })
  expect(screen.queryByRole('region', { name: '이 메시지의 사진' })).toBeNull()
})

test('붙이다 실패하면 그 자리에 이유가 보이고 멈추며, 다시 누르면 남은 사진부터 붙인다', async () => {
  const api = serve(
    message(MSG, '영수증', {
      senderId: JAE,
      sentAt: SENT,
      photos: [{ id: PHOTO_1 }, { id: PHOTO_2 }],
    }),
  )
  api.on('POST', EXPENSES, () => json({ expense: expenseDetail('e7') }, 201))
  const attach = `${EXPENSES}/e7/evidence/from-chat`
  api.on('POST', attach, () => json({ error: 'STORAGE_NOT_CONFIGURED' }, 503))
  render(<ChatHarness memberId={ME} permissions={FINANCE_PERMISSIONS} />)
  await writeDirect(api)
  fireEvent.click(submit())
  const section = await screen.findByRole('region', { name: '이 메시지의 사진' })
  fireEvent.click(within(section).getByRole('button', { name: '이 메시지의 사진 2장 붙이기' }))
  expect(await within(section).findByText(/지금은 사진을 올릴 수 없어요/)).toBeTruthy()
  expect(api.calls.filter(call => call.path === attach)).toHaveLength(1)
  api.on('POST', attach, () => json({ expense: withPhotos }, 201))
  fireEvent.click(within(section).getByRole('button', { name: '이 메시지의 사진 2장 붙이기' }))
  await waitFor(() => expect(within(section).getAllByText('붙였어요')).toHaveLength(2))
})

test('대화 사진 붙이기의 파일 오류는 사진용 문구다', async () => {
  const api = serve(
    message(MSG, '영수증', { senderId: JAE, sentAt: SENT, photos: [{ id: PHOTO_1 }] }),
  )
  api.on('POST', EXPENSES, () => json({ expense: expenseDetail('e7') }, 201))
  api.on('POST', `${EXPENSES}/e7/evidence/from-chat`, () => json({ error: 'UPLOAD_MISMATCH' }, 400))
  render(<ChatHarness memberId={ME} permissions={FINANCE_PERMISSIONS} />)
  await writeDirect(api)
  fireEvent.click(submit())
  const section = await screen.findByRole('region', { name: '이 메시지의 사진' })
  fireEvent.click(within(section).getByRole('button', { name: '이 메시지의 사진 1장 붙이기' }))
  expect(await within(section).findByText(/증빙으로 붙일 수 없는 파일이에요/)).toBeTruthy()
  expect(within(section).queryByText(/빼고 다시 올려/)).toBeNull()
})

test('보내는 동안 두 번 누를 수 없다', async () => {
  const api = serve()
  const pending = deferredResponse()
  api.on('POST', EXPENSES, () => pending.promise)
  render(<ChatHarness memberId={ME} permissions={FINANCE_PERMISSIONS} />)
  await writeDirect(api)
  fireEvent.click(submit())
  fireEvent.click(submit())
  fireEvent.submit(screen.getByRole('form', { name: '지출 적기' }))
  await waitFor(() => expect(posts(api)).toHaveLength(1))
  pending.resolve(json({ error: 'MESSAGE_INVALID' }, 409))
  expect(await screen.findByText(/이 메시지를 근거로 할 수 없어요/)).toBeTruthy()
  expect(screen.queryByText(/이 사진은 붙일 수 없어요/)).toBeNull()
  expect(screen.getByRole('dialog')).toBeTruthy()
})

test('403이면 닫고 이유를 보인다', async () => {
  const api = serve()
  api.on('POST', EXPENSES, () => json({ error: 'FORBIDDEN' }, 403))
  render(<ChatHarness memberId={ME} permissions={FINANCE_PERMISSIONS} />)
  await writeDirect(api)
  fireEvent.click(submit())
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(screen.getByText(PERMISSION_CHANGED)).toBeTruthy()
})

test('404면 닫고 이유를 보인다', async () => {
  const api = serve()
  api.on('POST', EXPENSES, () => json({ error: 'NOT_FOUND' }, 404))
  render(<ChatHarness memberId={ME} permissions={FINANCE_PERMISSIONS} />)
  await writeDirect(api)
  fireEvent.click(submit())
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(screen.getByText(/볼 수 없어요/)).toBeTruthy()
})
