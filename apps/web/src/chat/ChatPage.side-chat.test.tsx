// @vitest-environment jsdom
import { useState } from 'react'
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { Action } from '@vada/contracts'
import { councilView, MEMBER_PERMISSIONS } from '@/test-support/council-fixtures'
import { message, messagePage, room, roomDetail, roomList } from '@/test-support/chat-fixtures'
import { navigationWidth } from '@/test-support/navigation-width'
import { chatBase, serveChat } from '@/test-support/chat-harness'
import { deferredResponse, json } from '@/test-support/mock-api'
import { useTeam } from '@/team/useTeam'
import ChatPage, { type Screen } from './ChatPage'
import { useRoomList } from './useRoomList'
import { saveSideRoom } from './last-room'

afterEach(() => {
  cleanup()
  localStorage.clear()
  saveSideRoom('c1', 'm1', null)
  vi.unstubAllGlobals()
})

const a = room('side-a', { type: 'direct', name: '이재정', unread: 1 })
const b = room('side-b', { type: 'direct', name: '박새내', lastMessageAt: null })

function Harness({ permissions = MEMBER_PERMISSIONS }: { permissions?: Action[] }) {
  const [current, setCurrent] = useState<Screen>({ kind: 'home', roomId: 'r1' })
  const team = useTeam('side-council', () => {})
  const rooms = useRoomList('c1', () => {}, true)
  return (
    <ChatPage
      councilId="c1"
      view={councilView('c1', { permissions })}
      team={team}
      rooms={rooms}
      screen={current}
      onScreen={setCurrent}
      onBack={() => setCurrent({ kind: 'home' })}
      onForbidden={() => {}}
      onOpenRequest={() => {}}
    />
  )
}

function serve() {
  const api = serveChat()
  api.on('GET', '/api/organizations/side-council/members', () =>
    json({
      members: [
        { id: 'm1', name: '김회장' },
        { id: 'm2', name: '이재정' },
        { id: 'm3', name: '박새내' },
      ],
      departments: [],
    }),
  )
  api.on('GET', `${chatBase}/rooms`, () => json(roomList({ rooms: [room('r1'), b, a] })))
  for (const item of [a, b]) {
    api.on('GET', `${chatBase}/rooms/${item.id}`, () => json(roomDetail(item)))
    api.on('GET', `${chatBase}/rooms/${item.id}/messages`, () =>
      json(messagePage([message(item.id, `${item.name}의 글`)])),
    )
    api.on('POST', `${chatBase}/rooms/${item.id}/read`, () => new Response(null, { status: 204 }))
  }
  api.on('POST', `${chatBase}/direct`, () => json({ roomId: a.id }))
  return api
}

// 머리의 [1:1]은 칸을 여닫는 버튼이라 aria-expanded가 있다(칸 안 방 머리의 [1:1]은 목록으로 돌아가기).
const toggle = () =>
  screen.getAllByRole('button', { name: /^1:1/ }).find(item => item.hasAttribute('aria-expanded'))!

// 1:1 칸은 평소 닫혀 있다. 화면 머리의 [1:1]로 연다.
async function openPanel() {
  await screen.findAllByRole('button', { name: /^1:1/ })
  fireEvent.click(toggle())
  return screen.findByRole('complementary', { name: '1:1' })
}

// 1:1 칸은 노란 면 없이 흰 면·옅은 선이다. 1:1임은 머리 글로 알린다.
function expectNeutral(element: HTMLElement) {
  expect(element.className).not.toMatch(/personal|amber|warning|attention/)
}

test('PC 1:1 칸은 닫혀 있다가 [1:1]로 목록을 열고 [닫기]·Esc로 닫으면 초점이 그 버튼으로 돌아온다', async () => {
  navigationWidth(1280)
  serve()
  render(<Harness />)
  await screen.findByText('모레 회의 있어요')
  expect(screen.queryByRole('complementary', { name: '1:1' })).toBeNull()
  const button = toggle()
  expect(button.getAttribute('aria-expanded')).toBe('false')
  expect(within(button).getByLabelText('안 읽은 메시지 1개')).toBeTruthy()
  button.focus()
  fireEvent.click(button)
  const panel = await screen.findByRole('complementary', { name: '1:1' })
  expect(within(panel).getByRole('list', { name: '1:1 대화방' })).toBeTruthy()
  expect(button.getAttribute('aria-expanded')).toBe('true')
  fireEvent.click(within(panel).getByRole('button', { name: '닫기' }))
  expect(screen.queryByRole('complementary', { name: '1:1' })).toBeNull()
  expect(document.activeElement).toBe(button)
  // 방을 연 채로도 Esc 한 번에 칸이 닫히고, 다시 열면 목록부터다.
  fireEvent.click(button)
  const again = await screen.findByRole('complementary', { name: '1:1' })
  fireEvent.click(within(again).getByRole('button', { name: /이재정/ }))
  await within(again).findByRole('textbox', { name: '메시지' })
  // 방에서 목록으로 돌아오면 누른 버튼이 사라지므로 칸이 초점을 받아 Esc가 닿는다.
  fireEvent.click(within(again).getByRole('button', { name: '1:1' }))
  expect(document.activeElement).toBe(again)
  fireEvent.click(within(again).getByRole('button', { name: /이재정/ }))
  const input = await within(again).findByRole('textbox', { name: '메시지' })
  fireEvent.keyDown(input, { key: 'Escape' })
  expect(screen.queryByRole('complementary', { name: '1:1' })).toBeNull()
  expect(document.activeElement).toBe(button)
  fireEvent.click(button)
  const third = await screen.findByRole('complementary', { name: '1:1' })
  expect(within(third).getByRole('list', { name: '1:1 대화방' })).toBeTruthy()
  // [1:1]을 다시 누르면 닫힌다.
  fireEvent.click(button)
  expect(screen.queryByRole('complementary', { name: '1:1' })).toBeNull()
})

test('PC에서 학생회 방 탭을 옮기거나 메뉴를 다녀와도 연 1:1 칸은 열린 채다', async () => {
  navigationWidth(1280)
  const api = serve()
  const other = room('r2', { type: 'leadership' })
  api.on('GET', `${chatBase}/rooms`, () => json(roomList({ rooms: [room('r1'), other, b, a] })))
  api.on('GET', `${chatBase}/rooms/r2`, () => json(roomDetail(other)))
  api.on('GET', `${chatBase}/rooms/r2/messages`, () =>
    json(messagePage([message('r2', '회장단 글')])),
  )
  api.on('POST', `${chatBase}/rooms/r2/read`, () => new Response(null, { status: 204 }))
  const { unmount } = render(<Harness />)
  const panel = await openPanel()
  fireEvent.click(within(panel).getByRole('button', { name: /이재정/ }))
  await within(panel).findByText('이재정의 글')
  fireEvent.click(screen.getByRole('tab', { name: /회장단/ }))
  expect(await screen.findByText('회장단 글')).toBeTruthy()
  expect(screen.getByRole('complementary', { name: '1:1' })).toBeTruthy()
  unmount()
  render(<Harness />)
  expect(
    await within(await screen.findByRole('complementary', { name: '1:1' })).findByText(
      '이재정의 글',
    ),
  ).toBeTruthy()
})

test('상품 정보가 열린 동안 이름으로 1:1을 열면 상품 정보를 닫고 1:1 칸을 연다', async () => {
  navigationWidth(1280)
  const api = serve()
  const link = 'https://www.coupang.com/vp/products/7334523?itemId=18698271'
  api.on('GET', `${chatBase}/rooms/r1/messages`, () =>
    json(
      messagePage([
        message(
          'p1',
          `부스 준비물 부탁해요
${link}`,
        ),
      ]),
    ),
  )
  api.on('POST', `${chatBase}/product-info`, () => json({ product: null, reason: 'unavailable' }))
  render(<Harness />)
  fireEvent.click(await screen.findByRole('link', { name: link }))
  expect(await screen.findByRole('complementary', { name: '상품 정보' })).toBeTruthy()
  expect(toggle().getAttribute('aria-expanded')).toBe('false')
  fireEvent.click(screen.getAllByRole('button', { name: '이재정님과 1:1 대화' })[0]!)
  const panel = await screen.findByRole('complementary', { name: '1:1' })
  await within(panel).findByText('이재정의 글')
  expect(screen.queryByRole('complementary', { name: '상품 정보' })).toBeNull()
})

test('PC 오른쪽 1:1 목록은 권한 없이도 읽고 흐름을 왼쪽에 남기며 방마다 글을 보존한다', async () => {
  navigationWidth(1280)
  serve()
  render(<Harness permissions={MEMBER_PERMISSIONS.filter(item => item !== 'chat.direct')} />)
  const panel = await openPanel()
  expect(
    within(within(panel).getByRole('list', { name: '1:1 대화방' }))
      .getAllByRole('button')
      .map(item => item.textContent),
  ).toEqual([expect.stringContaining('이재정'), expect.stringContaining('박새내')])
  expect(within(panel).getByRole('button', { name: '닫기' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: '1:1 대화 시작' })).toBeNull()
  fireEvent.click(within(panel).getByRole('button', { name: /이재정/ }))
  expect(await within(panel).findByText('이재정의 글')).toBeTruthy()
  expect(screen.getByText('모레 회의 있어요')).toBeTruthy()
  const sideTitle = within(panel).getByRole('heading', { name: '이재정님과 1:1' })
  expectNeutral(sideTitle.parentElement!)
  expectNeutral(panel)
  const input = within(panel).getByRole('textbox', { name: '메시지' })
  fireEvent.change(input, { target: { value: 'A에게 쓰던 글' } })
  expect(within(panel).getByRole('button', { name: '이재정님에게 보내기' })).toBeTruthy()
  fireEvent.click(within(panel).getByRole('button', { name: '1:1' }))
  fireEvent.click(within(panel).getByRole('button', { name: /박새내/ }))
  await within(panel).findByText('박새내의 글')
  fireEvent.click(within(panel).getByRole('button', { name: '1:1' }))
  fireEvent.click(within(panel).getByRole('button', { name: /이재정/ }))
  await within(panel).findByText('이재정의 글')
  expect(within(panel).getByRole<HTMLTextAreaElement>('textbox', { name: '메시지' }).value).toBe(
    'A에게 쓰던 글',
  )
})

test('보낸 사람 이름과 /이름은 같은 API로 1:1을 열고 /는 메시지로 보내지 않는다', async () => {
  navigationWidth(1280)
  const api = serve()
  render(<Harness />)
  const names = await screen.findAllByRole('button', { name: '이재정님과 1:1 대화' })
  expect(screen.queryByRole('complementary', { name: '1:1' })).toBeNull()
  names[0]!.focus()
  fireEvent.click(names[0]!)
  const first = await screen.findByRole('complementary', { name: '1:1' })
  await within(first).findByText('이재정의 글')
  expect(toggle().getAttribute('aria-expanded')).toBe('true')
  // 닫으면 연 이름으로 초점이 돌아가고, 다시 이름을 누르면 같은 1:1이 열린다.
  fireEvent.click(within(first).getByRole('button', { name: '닫기' }))
  expect(screen.queryByRole('complementary', { name: '1:1' })).toBeNull()
  expect(document.activeElement).toBe(names[0])
  fireEvent.click(names[0]!)
  const panel = await screen.findByRole('complementary', { name: '1:1' })
  await within(panel).findByText('이재정의 글')
  fireEvent.click(within(panel).getByRole('button', { name: '1:1' }))
  const input = screen.getByRole<HTMLTextAreaElement>('textbox', { name: '메시지' })
  expect(input.getAttribute('placeholder')).toBe('메시지 입력 · @ 부르기 · / 1:1 대화')
  fireEvent.change(input, { target: { value: '/이' } })
  const people = await screen.findByRole('list', { name: '1:1 대화 상대' })
  expect(within(people).getByRole('button', { name: '이재정' })).toBeTruthy()
  fireEvent.submit(input.closest('form')!)
  expect(
    api.calls.filter(call => call.method === 'POST' && call.path.endsWith('/messages')),
  ).toHaveLength(0)
  fireEvent.keyDown(input, { key: 'Enter' })
  await within(panel).findByText('이재정의 글')
  await waitFor(() => expect(input.value).toBe(''))
  expect(api.calls.filter(call => call.path.endsWith('/direct')).map(call => call.body)).toEqual([
    { memberId: 'm2' },
    { memberId: 'm2' },
    { memberId: 'm2' },
  ])
})

test('휴대폰 첫 화면은 마지막 1:1 탭에서 목록을 열고 방에서 돌아와도 그 탭을 기억한다', async () => {
  navigationWidth(390)
  serve()
  render(<Harness />)
  const tab = await screen.findByRole('tab', { name: /1:1/ })
  expect(screen.getAllByRole('tab').at(-1)).toBe(tab)
  fireEvent.click(tab)
  fireEvent.click(screen.getByRole('button', { name: /이재정/ }))
  expect(await screen.findByText('이재정의 글')).toBeTruthy()
  expect(screen.queryByText('모레 회의 있어요')).toBeNull()
  // 휴대폰 1:1 전체 화면 머리도 PC 오른쪽 칸처럼 흰 머리이고 1:1임은 제목으로 말한다(MSG-04).
  const title = screen.getByRole('heading', { name: '이재정님과 1:1' })
  expectNeutral(title.parentElement!)
  expect(screen.queryByRole('button', { name: '닫기' })).toBeNull()
  expect(screen.getByRole('button', { name: '이재정님에게 보내기' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '대화방 목록' }))
  expect(screen.getByRole('tab', { name: /1:1/ }).getAttribute('aria-selected')).toBe('true')
})

test('PC 머리 [+]로 목록에 아직 없는 1:1을 만들면 그 칸에서 즉시 입력한다', async () => {
  navigationWidth(1280)
  const api = serve()
  const fresh = room('fresh-direct', { type: 'direct', name: '박새내' })
  api.on('POST', `${chatBase}/direct`, () => json({ roomId: fresh.id }, 201))
  api.on('GET', `${chatBase}/rooms/${fresh.id}`, () => json(roomDetail(fresh)))
  api.on('GET', `${chatBase}/rooms/${fresh.id}/messages`, () => json(messagePage([])))
  render(<Harness />)
  const panel = await openPanel()
  fireEvent.click(await within(panel).findByRole('button', { name: '1:1 대화 시작' }))
  const dialog = await screen.findByRole('dialog')
  fireEvent.click(await within(dialog).findByRole('button', { name: '박새내' }))
  expect(await within(panel).findByRole('textbox', { name: '메시지' })).toBe(document.activeElement)
  expect(within(panel).getByRole('heading', { name: '박새내님과 1:1' })).toBeTruthy()
  expect(screen.getByText('모레 회의 있어요')).toBeTruthy()
})

test('/이름은 공백 없는 글만 막고 후보가 없거나 한글 조합 중이면 열지 않는다', async () => {
  navigationWidth(1280)
  const api = serve()
  render(<Harness />)
  const input = await screen.findByRole('textbox', { name: '메시지' })
  fireEvent.change(input, { target: { value: '/없는' } })
  expect(await screen.findByText('운영진 없음')).toBeTruthy()
  fireEvent.keyDown(input, { key: 'Enter' })
  expect(api.calls.some(call => call.path.endsWith('/direct'))).toBe(false)
  fireEvent.change(input, { target: { value: '/이' } })
  const people = await screen.findByRole('list', { name: '1:1 대화 상대' })
  fireEvent.keyDown(input, { key: 'Enter', isComposing: true })
  expect(api.calls.some(call => call.path.endsWith('/direct'))).toBe(false)
  fireEvent.click(within(people).getByRole('button', { name: '이재정' }))
  expect(await screen.findByRole('heading', { name: '이재정님과 1:1' })).toBeTruthy()
})

test('chat.direct가 없으면 / 안내·이름 동작이 없고 /로 시작한 글도 보통 글이다', async () => {
  navigationWidth(390)
  const api = serve()
  api.on('POST', `${chatBase}/rooms/r1/messages`, () => json({ error: 'X' }, 500))
  render(<Harness permissions={MEMBER_PERMISSIONS.filter(item => item !== 'chat.direct')} />)
  const input = await screen.findByRole('textbox', { name: '메시지' })
  expect(input.getAttribute('placeholder')).toBe('메시지 입력 · @ 부르기')
  expect(screen.queryByRole('button', { name: '이재정님과 1:1 대화' })).toBeNull()
  fireEvent.change(input, { target: { value: '/이' } })
  expect(screen.queryByRole('list', { name: '1:1 대화 상대' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '공지방에 보내기' }))
  await waitFor(() =>
    expect(api.calls.some(call => call.method === 'POST' && call.path.endsWith('/messages'))).toBe(
      true,
    ),
  )
})

test('/이름으로 여는 동안 새로 쓴 글은 열린 뒤에도 지우지 않는다', async () => {
  navigationWidth(1280)
  const api = serve()
  const pending = deferredResponse()
  api.on('POST', `${chatBase}/direct`, () => pending.promise)
  render(<Harness />)
  await screen.findByText('모레 회의 있어요')
  const input = screen.getByRole<HTMLTextAreaElement>('textbox', { name: '메시지' })
  fireEvent.change(input, { target: { value: '/이' } })
  await screen.findByRole('list', { name: '1:1 대화 상대' })
  fireEvent.keyDown(input, { key: 'Enter' })
  fireEvent.change(input, { target: { value: '여는 동안 쓴 글' } })
  pending.resolve(json({ roomId: a.id }))
  const panel = await screen.findByRole('complementary', { name: '1:1' })
  await within(panel).findByText('이재정의 글')
  expect(input.value).toBe('여는 동안 쓴 글')
})
