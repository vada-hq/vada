// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { message, messagePage, room } from '@/test-support/chat-fixtures'
import { chatBase, DirectChatHarness, openAllRoom, serveChat } from '@/test-support/chat-harness'
import { json } from '@/test-support/mock-api'
import { resetDrafts } from './composer-drafts'

beforeEach(resetDrafts)
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const DIRECT_ROOMS: Record<string, string> = { m2: 'dm2', m3: 'dm3' }
const NAMES: Record<string, string> = { m2: '이재정', m3: '박새내' }

// 공지방에는 이재정(m2), 떠난 사람, 내(m1) 메시지가 있다. 1:1을 열면 사람마다 그 방을 준다.
function serve() {
  const api = serveChat()
  api.on('GET', `${chatBase}/rooms/r1/messages`, () =>
    json(
      messagePage([
        message('a1', '회의록 올렸어요'),
        message('a2', '그동안 고마웠어요', { senderId: 'gone', senderName: '떠난 운영진 2' }),
        message('a3', '확인했어요', { senderId: 'm1', senderName: '김회장' }),
      ]),
    ),
  )
  api.on('POST', `${chatBase}/direct`, call => {
    const { memberId } = call.body as { memberId: string }
    return json({ roomId: DIRECT_ROOMS[memberId] })
  })
  for (const [memberId, roomId] of Object.entries(DIRECT_ROOMS)) {
    const name = NAMES[memberId]!
    api.on('GET', `${chatBase}/rooms/${roomId}`, () =>
      json({
        room: room(roomId, { type: 'direct', name, memberCount: 2 }),
        participants: [
          { memberId: 'm1', name: '김회장' },
          { memberId, name },
        ],
      }),
    )
    api.on('GET', `${chatBase}/rooms/${roomId}/messages`, () =>
      json(messagePage([message(`${roomId}-1`, `${name}와 나눈 말`, { senderId: memberId })])),
    )
    api.on('POST', `${chatBase}/rooms/${roomId}/read`, () => new Response(null, { status: 204 }))
  }
  return api
}

const mainField = () => screen.getAllByLabelText<HTMLTextAreaElement>('메시지')[0]!
const panel = () => screen.getByRole('complementary', { name: /1:1 대화$/ })
const openRoom = async () => {
  render(<DirectChatHarness />)
  await openAllRoom()
  await screen.findByText('회의록 올렸어요')
}

test('보낸 사람 이름을 누르면 오른쪽 1:1 패널이 열리고 보내기 버튼이 받는 사람을 적는다', async () => {
  const api = serve()
  await openRoom()
  fireEvent.click(screen.getByRole('button', { name: '이재정 1:1 대화' }))
  expect(await screen.findByText('이재정와 나눈 말')).toBeTruthy()
  const opens = api.calls.filter(call => call.path === `${chatBase}/direct`)
  expect(opens.map(call => call.body)).toEqual([{ memberId: 'm2' }])
  expect(within(panel()).getByRole('heading', { name: '이재정' })).toBeTruthy()
  expect(within(panel()).getByRole('button', { name: '이재정에게 보내기' })).toBeTruthy()
  // 머리는 메인 방과 다른 색이다(오발송 막기).
  expect(panel().innerHTML).toContain('bg-amber')
  api.assertNoUnexpectedRequests()
})

test('나와 떠난 사람의 이름은 누를 수 없다', async () => {
  serve()
  await openRoom()
  expect(screen.getByText('떠난 운영진 2')).toBeTruthy()
  expect(screen.queryByRole('button', { name: /떠난 운영진 2/ })).toBeNull()
  expect(screen.queryByRole('button', { name: /김회장/ })).toBeNull()
})

test("입력칸이 '/'로 시작하면 보내지 않고 이름 목록을 띄우며, 고르면 그 사람과 1:1을 연다", async () => {
  const api = serve()
  await openRoom()
  fireEvent.change(mainField(), { target: { value: '/박  내일 와요?' } })
  const list = screen.getByRole('list', { name: '1:1 대화할 사람' })
  expect(within(list).queryByText('김회장')).toBeNull()
  expect(within(list).queryByText('이재정')).toBeNull()
  // Enter는 보내지 않고 첫 사람을 연다.
  fireEvent.keyDown(mainField(), { key: 'Enter' })
  expect(await screen.findByText('박새내와 나눈 말')).toBeTruthy()
  expect(
    api.calls.some(call => call.path === `${chatBase}/rooms/r1/messages` && call.method === 'POST'),
  ).toBe(false)
  expect(mainField().value).toBe('')
  // '/이름' 뒤에 친 글은 그 1:1 입력칸으로 옮겨 두고 보내지 않는다.
  expect(within(panel()).getByLabelText<HTMLTextAreaElement>('메시지').value).toBe('내일 와요?')
})

test("'/'만 쳐도 보내기는 꺼지고 목록에서 누른 사람을 연다", async () => {
  serve()
  await openRoom()
  fireEvent.change(mainField(), { target: { value: '/' } })
  expect(screen.getAllByRole<HTMLButtonElement>('button', { name: '보내기' })[0]!.disabled).toBe(
    true,
  )
  const list = screen.getByRole('list', { name: '1:1 대화할 사람' })
  fireEvent.click(within(list).getByRole('button', { name: '이재정' }))
  expect(await screen.findByText('이재정와 나눈 말')).toBeTruthy()
})

test('다른 이름을 누르면 패널이 그 사람으로 바뀌고 쓰던 글은 방마다 남으며, 닫기로 닫는다', async () => {
  serve()
  await openRoom()
  fireEvent.click(screen.getByRole('button', { name: '이재정 1:1 대화' }))
  await screen.findByText('이재정와 나눈 말')
  const panelField = () => within(panel()).getByLabelText<HTMLTextAreaElement>('메시지')
  fireEvent.change(panelField(), { target: { value: '재정부 회의 언제예요?' } })

  fireEvent.change(mainField(), { target: { value: '/박새내' } })
  fireEvent.keyDown(mainField(), { key: 'Enter' })
  expect(await screen.findByText('박새내와 나눈 말')).toBeTruthy()
  expect(screen.getAllByRole('complementary')).toHaveLength(1)
  expect(panelField().value).toBe('')

  fireEvent.click(screen.getAllByRole('button', { name: '이재정 1:1 대화' })[0]!)
  await screen.findByText('이재정와 나눈 말')
  await waitFor(() => expect(panelField().value).toBe('재정부 회의 언제예요?'))

  fireEvent.click(within(panel()).getByRole('button', { name: '닫기' }))
  expect(screen.queryByRole('complementary')).toBeNull()
})

test('1:1을 열지 못하면 패널에 이유를 보인다', async () => {
  const api = serve()
  api.on('POST', `${chatBase}/direct`, () => json({ error: 'NOT_FOUND' }, 404))
  await openRoom()
  fireEvent.click(screen.getByRole('button', { name: '이재정 1:1 대화' }))
  expect(await within(panel()).findByText(/이 운영진을 찾지 못했어요/)).toBeTruthy()
})
