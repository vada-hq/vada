// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ChatMessage, ReplyPageResponse } from '@vada/contracts'
import { message, messagePage, room, roomDetail } from '@/test-support/chat-fixtures'
import { chatBase, openAllRoom, serveChat, SideChatHarness } from '@/test-support/chat-harness'
import { json } from '@/test-support/mock-api'
import { purchaseDetail } from '@/test-support/purchase-fixtures'
import { SEND_ERRORS, SEND_FAILED } from '@/lib/messages'
import { resetWindowHistory } from '@/lib/use-window-history'
import { ARCHIVED_LABEL } from './chat-view'
import { resetDrafts } from './composer-drafts'

beforeEach(() => {
  resetDrafts()
  resetWindowHistory()
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const ORIGINAL = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const REPLY = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const LAST_REPLY_AT = '2020-03-02T05:00:00Z'
const repliesOf = (id: string) => `${chatBase}/rooms/r1/messages/${id}/replies`

const notice = (options: Partial<ChatMessage> = {}) =>
  message(ORIGINAL, '내일 행사 공지', { senderId: 'm1', senderName: '김회장', ...options })
const page = (
  original: ChatMessage,
  replies: ChatMessage[] = [],
  options: Partial<ReplyPageResponse> = {},
): ReplyPageResponse => ({
  original,
  messages: replies,
  hasOlder: false,
  hasNewer: false,
  ...options,
})

// 공지방에 원글 하나(답글 1)와 다른 메시지 하나. 답글 읽기·이어 읽기와 읽음을 답한다.
function serve({
  flow = [notice({ replyCount: 1, lastReplyAt: LAST_REPLY_AT }), message(OTHER, '다른 글')],
  replies = [message(REPLY, '몇 시예요?', { sentAt: LAST_REPLY_AT })],
  readAt = null,
  readOnly = false,
  eventId = null,
}: {
  flow?: ChatMessage[]
  replies?: ChatMessage[]
  readAt?: string | null
  readOnly?: boolean
  eventId?: string | null
} = {}) {
  const api = serveChat()
  api.on('GET', `${chatBase}/rooms/r1`, () =>
    json(roomDetail(room('r1', { readOnly, eventId }), readAt)),
  )
  api.on('GET', `${chatBase}/rooms/r1/messages`, () => json(messagePage(flow)))
  for (const original of flow) {
    const list = original.id === ORIGINAL ? replies : []
    const answer = () => json(page({ ...original, replyCount: list.length }, list))
    api.on('GET', repliesOf(original.id), answer)
    const last = list.at(-1)
    if (last)
      api.on('GET', `${repliesOf(original.id)}?after=${last.id}`, () => json(page(original)))
  }
  return api
}

const panel = () => screen.getByRole('complementary', { name: '답글' })
const replyField = () => within(panel()).getByRole<HTMLTextAreaElement>('textbox', { name: '답글' })
const flowItem = (text: string) => screen.getByText(text).closest('li')!

// 수용 기준: 메시지 '…'과 메시지 위 단추에 '답글'이 있고, 누르면 오른쪽 패널에 원글과 답글, 답글 입력칸이 열린다.
test('메시지 위 단추와 … 메뉴의 답글은 원글·답글·답글 입력칸이 있는 패널을 연다', async () => {
  serve()
  render(<SideChatHarness />)
  await openAllRoom()
  await screen.findByText('다른 글')
  fireEvent.click(within(flowItem('다른 글')).getByRole('button', { name: '답글' }))
  expect(await within(panel()).findByText('답글 없음')).toBeTruthy()
  expect(within(panel()).getByRole('heading', { name: '답글' })).toBeTruthy()

  // … 메뉴에도 같은 동작이 있고, 다른 원글을 열면 패널 내용이 그 원글로 바뀐다.
  fireEvent.keyDown(
    within(flowItem('내일 행사 공지')).getByRole('button', { name: '메시지 동작' }),
    {
      key: 'Enter',
    },
  )
  fireEvent.click(await screen.findByRole('menuitem', { name: '답글' }))
  const box = within(panel())
  expect(await box.findByText('몇 시예요?')).toBeTruthy()
  expect(box.getByText('내일 행사 공지')).toBeTruthy()
  expect(box.getByText('답글 1')).toBeTruthy()
  expect(box.getByRole('textbox', { name: '답글' })).toBeTruthy()
  // 한 단계: 패널 안(원글과 답글)에는 답글 단추가 없다.
  expect(box.queryByRole('button', { name: '답글' })).toBeNull()
})

// 수용 기준: 방 흐름의 원글 아래 '답글 {n}'과 마지막 답글 시각, 방을 열 때의 이전 읽은 시각 뒤 답글이면 '새 답글'.
test('원글 아래 답글 수와 마지막 답글 시각이 있고, 이전 읽은 시각 뒤 답글이면 새 답글이 보인다', async () => {
  serve({ readAt: '2020-03-02T04:00:00Z' })
  render(<SideChatHarness />)
  await openAllRoom()
  const item = within((await screen.findByText('내일 행사 공지')).closest('li')!)
  expect(item.getByRole('button', { name: '답글 1' })).toBeTruthy()
  expect(item.getByText('2020년 3월 2일 (월) 14:00')).toBeTruthy()
  expect(item.getByText('새 답글')).toBeTruthy()
  // 답글 없는 메시지에는 요약이 없다.
  expect(within(flowItem('다른 글')).queryByText(/^답글 \d/)).toBeNull()
  // 열어 본 원글은 새 답글을 거둔다.
  fireEvent.click(item.getByRole('button', { name: '답글 1' }))
  expect(await within(panel()).findByText('몇 시예요?')).toBeTruthy()
  expect(item.queryByText('새 답글')).toBeNull()
})

test('이전 읽은 시각이 마지막 답글보다 뒤면 새 답글이 없다', async () => {
  serve({ readAt: '2020-03-02T05:00:00Z' })
  render(<SideChatHarness />)
  await openAllRoom()
  const item = within((await screen.findByText('내일 행사 공지')).closest('li')!)
  expect(item.getByRole('button', { name: '답글 1' })).toBeTruthy()
  expect(item.queryByText('새 답글')).toBeNull()
})

// 답글 입력칸: 원글 번호를 실어 보내고, 실패하면 글을 그대로 두며, 쓰던 글은 원글마다 남는다.
test('답글은 원글 번호로 보내고, 실패하면 글이 남고, 쓰던 글은 원글마다 따로 남는다', async () => {
  const api = serve()
  let fail = true
  api.on('POST', `${chatBase}/rooms/r1/messages`, () =>
    fail ? json({ error: 'INTERNAL' }, 500) : json(message('d1', '3시예요'), 201),
  )
  render(<SideChatHarness />)
  await openAllRoom()
  fireEvent.click(await screen.findByRole('button', { name: '답글 1' }))
  const field = await within(panel()).findByRole('textbox', { name: '답글' })
  fireEvent.change(field, { target: { value: '3시예요' } })
  fireEvent.submit(field.closest('form')!)
  expect(await within(panel()).findByText(SEND_FAILED)).toBeTruthy()
  expect(replyField().value).toBe('3시예요')
  const sent = api.calls.filter(call => call.method === 'POST' && call.path.endsWith('/messages'))
  expect(sent.at(-1)?.body).toMatchObject({ body: '3시예요', replyTo: ORIGINAL })

  // 다른 원글로 바꿨다 돌아와도 그 원글의 글이 남고, 방 입력칸에는 섞이지 않는다.
  fireEvent.click(within(flowItem('다른 글')).getByRole('button', { name: '답글' }))
  const other = await within(panel()).findByRole('textbox', { name: '답글' })
  await waitFor(() => expect((other as HTMLTextAreaElement).value).toBe(''))
  expect(screen.getByRole<HTMLTextAreaElement>('textbox', { name: '메시지' }).value).toBe('')
  fireEvent.click(screen.getByRole('button', { name: '답글 1' }))
  await waitFor(() => expect(replyField().value).toBe('3시예요'))
  fail = false
  fireEvent.submit(within(panel()).getByRole('textbox', { name: '답글' }).closest('form')!)
  await waitFor(() => expect(replyField().value).toBe(''))
})

// 보관된 방(완료한 행사)·보기만 되는 방의 원글은 답글을 읽기만 한다.
test('보기만 되는 방의 원글은 답글을 읽을 수 있지만 답글 입력칸이 없다', async () => {
  serve({ readOnly: true })
  render(<SideChatHarness />)
  await openAllRoom()
  fireEvent.click(await screen.findByRole('button', { name: '답글 1' }))
  const box = within(panel())
  expect(await box.findByText('몇 시예요?')).toBeTruthy()
  expect(box.getByText(SEND_ERRORS.ROOM_READ_ONLY!)).toBeTruthy()
  expect(box.queryByRole('textbox', { name: '답글' })).toBeNull()
})

// 수용 기준: 휴대폰 알림을 눌러 답글이 열린다. 알림 주소(?reply=원글)는 방을 열고 그 원글의 답글 패널을 연다.
test('답글 알림 주소로 들어오면 방이 열리고 그 원글의 답글 패널이 열린다', async () => {
  const api = serve()
  render(
    <SideChatHarness
      start={{ kind: 'room', roomId: 'r1', reply: { messageId: ORIGINAL, key: 'k1' } }}
    />,
  )
  expect(
    await within(await screen.findByRole('complementary', { name: '답글' })).findByText(
      '몇 시예요?',
    ),
  ).toBeTruthy()
  // 패널은 마지막 답글까지 읽음을 보낸다(방 단위 읽음).
  await waitFor(() =>
    expect(
      api.calls.some(
        call =>
          call.path === `${chatBase}/rooms/r1/read` &&
          (call.body as { messageId: string }).messageId === REPLY,
      ),
    ).toBe(true),
  )
})

// 오른쪽 자리는 하나다: 답글 위에 상품 정보가 덮이고, 1:1을 열면 답글이 닫힌다.
test('답글 패널에서 이름을 눌러 1:1을 열면 답글 패널은 닫히고 1:1이 열린다', async () => {
  const api = serve()
  api.on('POST', `${chatBase}/direct`, () => json({ roomId: 'dm2' }))
  api.on('GET', `${chatBase}/rooms/dm2`, () =>
    json(roomDetail(room('dm2', { type: 'direct', name: '이재정', memberCount: 2 }))),
  )
  api.on('GET', `${chatBase}/rooms/dm2/messages`, () => json(messagePage([])))
  api.on('POST', `${chatBase}/rooms/dm2/read`, () => new Response(null, { status: 204 }))
  render(<SideChatHarness />)
  await openAllRoom()
  fireEvent.click(await screen.findByRole('button', { name: '답글 1' }))
  await within(panel()).findByText('몇 시예요?')
  fireEvent.click(await within(panel()).findByRole('button', { name: '이재정 1:1 대화' }))
  expect(await screen.findByRole('complementary', { name: '이재정 1:1 대화' })).toBeTruthy()
  expect(screen.queryByRole('complementary', { name: '답글' })).toBeNull()
})

// 답글의 메시지 메뉴는 방 흐름과 같다(DEC-90): 답글로 낸 구매 요청은 그 답글을 근거로 하고 답글 아래에 기록이 생긴다.
test('답글의 … 메뉴로 낸 구매 요청은 그 답글을 근거로 하고 답글 아래에 기록이 생긴다', async () => {
  const api = serve()
  api.on('GET', `${chatBase}/events`, () => json({ events: [], truncated: false }))
  api.on('GET', `${chatBase}/tasks?view=mine&status=open`, () =>
    json({ tasks: [], truncated: false }),
  )
  api.on('POST', `${chatBase}/purchase-requests`, () =>
    json({ request: purchaseDetail('p7', { title: '몇 시예요?' }) }, 201),
  )
  render(<SideChatHarness />)
  await openAllRoom()
  fireEvent.click(await screen.findByRole('button', { name: '답글 1' }))
  const reply = (await within(panel()).findByText('몇 시예요?')).closest('li')!
  fireEvent.keyDown(within(reply).getByRole('button', { name: '메시지 동작' }), { key: 'Enter' })
  expect(screen.queryByRole('menuitem', { name: '답글' })).toBeNull()
  fireEvent.click(await screen.findByRole('menuitem', { name: '구매 요청 만들기' }))
  const form = await screen.findByRole('form', { name: '구매 요청 내기' })
  fireEvent.change(within(form).getByLabelText('품목 1 이름'), { target: { value: '네임펜' } })
  fireEvent.click(within(form).getByRole('button', { name: '내기' }))
  const records = await within(reply).findByRole('list', { name: '이 메시지로 만든 기록' })
  expect(within(records).getByRole('button').textContent).toBe('구매 요청 · 몇 시예요?')
  const sent = api.calls.find(call => call.path === `${chatBase}/purchase-requests`)
  expect(sent?.body).toMatchObject({ sourceMessageId: REPLY })
})

test('완료한 행사 방(보관)의 원글은 답글을 읽기만 하고 입력칸 자리에 완료된 행사가 보인다', async () => {
  serve({ readOnly: true, eventId: 'e1' })
  render(<SideChatHarness />)
  await openAllRoom()
  fireEvent.click(await screen.findByRole('button', { name: '답글 1' }))
  const box = within(panel())
  expect(await box.findByText('몇 시예요?')).toBeTruthy()
  expect(box.getByText(ARCHIVED_LABEL)).toBeTruthy()
  expect(box.queryByRole('textbox', { name: '답글' })).toBeNull()
})
