// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { LEADER_PERMISSIONS, MEMBER_PERMISSIONS } from '@/test-support/council-fixtures'
import { FINANCE_PERMISSIONS } from '@/test-support/council-fixtures'
import { message, messagePage } from '@/test-support/chat-fixtures'
import { chatBase, ChatHarness, openAllRoom, serveChat } from '@/test-support/chat-harness'
import { asElement } from '@/test-support/elements'
import { deferredResponse, json } from '@/test-support/mock-api'
import { purchaseDetail } from '@/test-support/purchase-fixtures'
import { taskDetail } from '@/test-support/task-detail-fixtures'
import { PERMISSION_CHANGED, TASK_INVALID } from '@/lib/messages'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const PURCHASE = `${chatBase}/purchase-requests`
const TASKS = `${chatBase}/tasks?view=mine&status=open`
// 서버 계약이 번호를 uuid로 검사하므로 시험도 uuid를 쓴다.
const ME = '11111111-1111-4111-8111-111111111111'
const JAE = '22222222-2222-4222-8222-222222222222'
const GONE = '99999999-9999-4999-8999-999999999999'
const MSG = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const BUYING = message(MSG, '현수막 2개 사 주세요\n색은 파랑', { senderId: JAE })
const TASK_A = '33333333-3333-4333-8333-333333333333'
const TASK_B = '44444444-4444-4444-8444-444444444444'
// 서버가 준 actions만 본다. 상태를 못 바꾸는 업무는 고를 수 없다.
const MY_TASKS = [
  taskDetail({ id: TASK_A, title: '현수막 주문' }),
  taskDetail({ id: TASK_B, title: '남이 맡긴 일', actions: ['task.edit'] }),
]
const joined = '2026-10-01T01:00:00Z'
const teamOf = () => ({
  members: [
    { id: ME, name: '김회장', councilRank: null, departments: [], joinedAt: joined },
    { id: JAE, name: '이재정', councilRank: null, departments: [], joinedAt: joined },
  ],
  departments: [],
})

function serve(sent = BUYING) {
  const api = serveChat()
  api.on('GET', `${chatBase}/rooms/r1/messages`, () => json(messagePage([sent])))
  api.on('GET', `${chatBase}/members`, () => json(teamOf()))
  api.on('GET', `${chatBase}/events`, () => json({ events: [], truncated: false }))
  api.on('GET', TASKS, () => json({ tasks: MY_TASKS, truncated: false }))
  return api
}
const menuOf = async (name: string) => {
  fireEvent.keyDown(await screen.findByRole('button', { name: '메시지 동작' }), { key: 'Enter' })
  return screen.findByRole('menuitem', { name })
}
const openDialog = async () => {
  await openAllRoom()
  fireEvent.click(await menuOf('구매 요청 만들기'))
  return screen.findByRole('form', { name: '구매 요청 내기' })
}
const posts = (api: ReturnType<typeof serve>) =>
  api.calls.filter(call => call.method === 'POST' && call.path === PURCHASE)
const submit = () => asElement(screen.getByRole('button', { name: '내기' }), HTMLButtonElement)
const fill = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } })

test('모든 운영진의 메뉴에 구매 요청 만들기가 있고, 공지 항목은 회장단에게도 없다', async () => {
  serve()
  const view = render(<ChatHarness memberId={ME} permissions={MEMBER_PERMISSIONS} />)
  await openAllRoom()
  await menuOf('구매 요청 만들기')
  expect(screen.queryByRole('menuitem', { name: /공지/ })).toBeNull()
  view.unmount()

  render(<ChatHarness memberId={ME} permissions={LEADER_PERMISSIONS} />)
  await openAllRoom()
  await menuOf('구매 요청 만들기')
  expect(screen.queryByRole('menuitem', { name: /공지/ })).toBeNull()
})

test('권한이 없으면 메뉴 버튼이 없다', async () => {
  serve()
  render(<ChatHarness memberId={ME} permissions={['council.view']} />)
  await openAllRoom()
  await screen.findByText(/현수막 2개/)
  expect(screen.queryByRole('button', { name: '메시지 동작' })).toBeNull()
})

test('메시지로 제목과 내용을 채우고, 일반 운영진에게는 요청한 사람 칸이 없다. 품목 이름이 비면 보내지 않고, 내면 메시지 번호가 가고 재정에서 볼 수 있다', async () => {
  const api = serve()
  api.on('POST', PURCHASE, () => json({ request: purchaseDetail('r7') }, 201))
  const onOpenRequest = vi.fn()
  render(
    <ChatHarness memberId={ME} permissions={MEMBER_PERMISSIONS} onOpenRequest={onOpenRequest} />,
  )
  await openDialog()
  expect(asElement(screen.getByLabelText('제목'), HTMLInputElement).value).toBe(
    '현수막 2개 사 주세요',
  )
  expect(asElement(screen.getByLabelText('내용'), HTMLTextAreaElement).value).toBe(
    '현수막 2개 사 주세요\n색은 파랑',
  )
  expect(asElement(screen.getByLabelText('품목 1 이름'), HTMLInputElement).value).toBe('')
  expect(screen.queryByLabelText('요청한 사람')).toBeNull()
  // 품목 이름이 비면 눌러도 보내지 않고 그 칸 아래에 알린다.
  expect(submit().disabled).toBe(false)
  fireEvent.click(submit())
  expect(screen.getByText('이름을 입력해 주세요')).toBeTruthy()
  expect(screen.getByLabelText('품목 1 이름').getAttribute('aria-invalid')).toBe('true')
  expect(posts(api)).toHaveLength(0)
  fill('품목 1 이름', '현수막')
  fireEvent.click(submit())
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(posts(api)[0]?.body).toMatchObject({ sourceMessageId: MSG, title: '현수막 2개 사 주세요' })
  expect(posts(api)[0]?.body).not.toHaveProperty('requestedBy')
  fireEvent.click(await screen.findByRole('button', { name: '재정에서 보기' }))
  expect(onOpenRequest).toHaveBeenCalledWith('r7')
})

test('재정부는 요청한 사람이 남의 메시지면 보낸 사람이고, 보낸 사람이 떠났으면 나다', async () => {
  const api = serve()
  api.on('POST', PURCHASE, () => json({ request: purchaseDetail('r7') }, 201))
  const view = render(<ChatHarness memberId={ME} permissions={FINANCE_PERMISSIONS} />)
  await openDialog()
  await screen.findByRole('option', { name: '이재정' })
  expect(asElement(screen.getByLabelText('요청한 사람'), HTMLSelectElement).value).toBe(JAE)
  fill('품목 1 이름', '현수막')
  fireEvent.click(submit())
  await waitFor(() => expect(posts(api)).toHaveLength(1))
  expect(posts(api)[0]?.body).toMatchObject({ requestedBy: JAE, sourceMessageId: MSG })
  view.unmount()
  cleanup()

  serve(message(MSG, '대신 부탁해요', { senderId: GONE, senderName: '떠난 사람' }))
  render(<ChatHarness memberId={ME} permissions={FINANCE_PERMISSIONS} />)
  await openDialog()
  expect(asElement(screen.getByLabelText('요청한 사람'), HTMLSelectElement).value).toBe(ME)
})

test('409와 429 문구는 버튼 옆에 보이고, 보내는 동안 두 번 누를 수 없다', async () => {
  const api = serve()
  const pending = deferredResponse()
  api.on('POST', PURCHASE, () => pending.promise)
  render(<ChatHarness memberId={ME} permissions={FINANCE_PERMISSIONS} />)
  await openDialog()
  fill('품목 1 이름', '현수막')
  fireEvent.click(submit())
  fireEvent.click(submit())
  fireEvent.submit(screen.getByRole('form', { name: '구매 요청 내기' }))
  await waitFor(() => expect(posts(api)).toHaveLength(1))
  pending.resolve(json({ error: 'MESSAGE_INVALID' }, 409))
  expect(await screen.findByText(/이 메시지를 더는 볼 수 없어/)).toBeTruthy()
  expect(screen.getByRole('dialog')).toBeTruthy()
  api.on('POST', PURCHASE, () => json({ error: 'TOO_MANY_REQUESTS' }, 429))
  fireEvent.click(submit())
  expect(await screen.findByText(/너무 빨리 보내고 있어요/)).toBeTruthy()
  api.on('POST', PURCHASE, () => json({ error: 'MEMBER_INVALID' }, 409))
  fireEvent.click(submit())
  expect(await screen.findByText(/지금 운영진이 아니에요/)).toBeTruthy()
})

test('403이면 닫고 이유를 보인다', async () => {
  const api = serve()
  api.on('POST', PURCHASE, () => json({ error: 'FORBIDDEN' }, 403))
  render(<ChatHarness memberId={ME} permissions={FINANCE_PERMISSIONS} />)
  await openDialog()
  fill('품목 1 이름', '현수막')
  fireEvent.click(submit())
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(screen.getByText(PERMISSION_CHANGED)).toBeTruthy()
})

test('긴 메시지는 계약 상한 안으로 채워 [내기]가 켜진다', async () => {
  serve(message(MSG, '😀'.repeat(3000), { senderId: JAE }))
  render(<ChatHarness memberId={ME} permissions={MEMBER_PERMISSIONS} />)
  await openDialog()
  fill('품목 1 이름', '현수막')
  expect(submit().disabled).toBe(false)
  const form = screen.getByRole('form', { name: '구매 요청 내기' })
  expect(within(form).getByLabelText('제목')).toBeTruthy()
})

test('업무(선택)는 상태를 바꿀 수 있는 내 업무만 나오고 기본은 고르지 않음이다. 고르면 taskId가 가고 안 고르면 가지 않는다', async () => {
  const api = serve()
  api.on('POST', PURCHASE, () => json({ request: purchaseDetail('r7') }, 201))
  render(<ChatHarness memberId={ME} permissions={MEMBER_PERMISSIONS} />)
  await openDialog()
  await screen.findByRole('option', { name: '현수막 주문' })
  expect(screen.queryByRole('option', { name: '남이 맡긴 일' })).toBeNull()
  const select = asElement(screen.getByLabelText('업무'), HTMLSelectElement)
  expect(select.value).toBe('')
  fill('품목 1 이름', '현수막')
  fireEvent.click(submit())
  await waitFor(() => expect(posts(api)).toHaveLength(1))
  expect(posts(api)[0]?.body).not.toHaveProperty('taskId')
  expect(api.calls.some(call => call.path === TASKS)).toBe(true)
})

test('업무를 고르고 내면 taskId가 같이 간다', async () => {
  const api = serve()
  api.on('POST', PURCHASE, () => json({ request: purchaseDetail('r7') }, 201))
  render(<ChatHarness memberId={ME} permissions={MEMBER_PERMISSIONS} />)
  await openDialog()
  await screen.findByRole('option', { name: '현수막 주문' })
  fireEvent.change(screen.getByLabelText('업무'), { target: { value: TASK_A } })
  fill('품목 1 이름', '현수막')
  fireEvent.click(submit())
  await waitFor(() => expect(posts(api)).toHaveLength(1))
  expect(posts(api)[0]?.body).toMatchObject({ taskId: TASK_A, sourceMessageId: MSG })
})

test('고른 업무가 그사이 끝났으면 409 문구가 버튼 옆에 보이고 대화상자는 열려 있다', async () => {
  const api = serve()
  api.on('POST', PURCHASE, () => json({ error: 'TASK_INVALID' }, 409))
  render(<ChatHarness memberId={ME} permissions={MEMBER_PERMISSIONS} />)
  await openDialog()
  await screen.findByRole('option', { name: '현수막 주문' })
  fireEvent.change(screen.getByLabelText('업무'), { target: { value: TASK_A } })
  fill('품목 1 이름', '현수막')
  fireEvent.click(submit())
  expect(await screen.findByText(TASK_INVALID)).toBeTruthy()
  expect(screen.getByRole('dialog')).toBeTruthy()
})
