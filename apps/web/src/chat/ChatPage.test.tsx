// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { PRESIDENT_PERMISSIONS, teamResponse } from '@/test-support/council-fixtures'
import { messagePage, message, room, roomDetail, roomList } from '@/test-support/chat-fixtures'
import { json, mockApi } from '@/test-support/mock-api'
import { settle } from '@/test-support/settle'
import { chatBase, ChatHarness, openAllRoom, serveChat } from '@/test-support/chat-harness'

afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const base = chatBase
const Harness = ChatHarness
const serve = serveChat
const openAll = openAllRoom
const posts = (api: ReturnType<typeof mockApi>) => api.calls.filter(call => call.method === 'POST')

test('방 줄은 이름, 마지막 시각, 마지막 말, 참여 인원, 안 읽은 수, 나를 부름, 보기만을 보이고 공지 칸은 없다(DEC-90)', async () => {
  serve()
  render(<Harness />)
  const all = await screen.findByRole('button', { name: /공지방/ })
  expect(all.textContent).toContain('2020년 3월 2일')
  expect(within(all).getByLabelText('안 읽은 메시지 3개').textContent).toBe('3')
  expect(within(all).getByLabelText('나를 부른 메시지 1개')).toBeTruthy()
  expect(screen.getByRole('button', { name: /회장단방/ }).textContent).not.toContain('2020')
  expect(screen.getByRole('button', { name: /박새내/ }).textContent).toContain('보기만')
  const list = screen.getByRole('list', { name: '대화방' })
  expect(
    within(list)
      .getAllByRole('button')
      .map(item => item.textContent?.slice(0, 3)),
  ).toEqual(['공지방', '회장단', '재정부'])
  expect(screen.getByRole('region', { name: '1:1 대화' }).textContent).toContain('박새내')
  expect(within(all).getByText('이재정: 회의록 올렸어요')).toBeTruthy()
  expect(within(all).getByText('참여 12명')).toBeTruthy()
})

test('안 읽은 수가 99를 넘으면 99+다', async () => {
  const api = serve()
  api.on('GET', `${base}/rooms`, () =>
    json(roomList({ rooms: [room('r1', { unread: 150 })], unreadTotal: 150 })),
  )
  render(<Harness />)
  expect((await screen.findByLabelText('안 읽은 메시지 150개')).textContent).toBe('99+')
})

test('방을 열면 메시지를 보이고 마지막 메시지까지 읽음을 보낸다. 공지방 위에 띠가 없다', async () => {
  const api = serve()
  render(<Harness />)
  await openAll()
  expect(await screen.findByText('모레 회의 있어요')).toBeTruthy()
  await waitFor(() => expect(posts(api)).toHaveLength(1))
  expect(posts(api)[0]?.body).toEqual({ messageId: 'a2' })
  expect(screen.getByRole('heading', { name: '공지방' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: '모아 보기' })).toBeNull()
})

test('새 메시지는 3초 뒤 나타나고 읽음을 다시 보내며, 화면이 숨으면 읽지 않는다', async () => {
  const api = serve()
  let later = false
  api.on('GET', `${base}/rooms/r1/messages?after=a2`, () => {
    later = true
    return json(messagePage([message('a3', '방금 온 글')]))
  })
  render(<Harness />)
  await openAll()
  await screen.findByText('모레 회의 있어요')
  vi.useFakeTimers({ shouldAdvanceTime: true })
  await act(async () => {
    await vi.advanceTimersByTimeAsync(3000)
  })
  expect(await screen.findByText('방금 온 글')).toBeTruthy()
  await waitFor(() => expect(posts(api).map(call => call.body)).toContainEqual({ messageId: 'a3' }))
  expect(later).toBe(true)

  later = false
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
  document.dispatchEvent(new Event('visibilitychange'))
  await act(async () => {
    await vi.advanceTimersByTimeAsync(9000)
  })
  expect(api.calls.filter(call => call.path.endsWith('after=a3'))).toHaveLength(0)
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
})

test('이전 메시지 보기는 첫 메시지 앞쪽을 읽어 앞에 붙인다', async () => {
  const api = serve()
  api.on('GET', `${base}/rooms/r1/messages`, () =>
    json(messagePage([message('a2', '둘째')], { hasOlder: true })),
  )
  api.on('GET', `${base}/rooms/r1/messages?before=a2`, () =>
    json(messagePage([message('a1', '첫째')])),
  )
  render(<Harness />)
  await openAll()
  fireEvent.click(await screen.findByRole('button', { name: '이전 메시지 보기' }))
  expect(await screen.findByText('첫째')).toBeTruthy()
  expect(screen.queryByRole('button', { name: '이전 메시지 보기' })).toBeNull()
  const texts = screen.getAllByRole('listitem').map(item => item.textContent)
  const at = (body: string) => texts.findIndex(text => text.includes(body))
  expect(at('첫째')).toBeGreaterThan(-1)
  expect(at('첫째')).toBeLessThan(at('둘째'))
})

test.each([401, 403, 404])(
  '방을 읽다 %i이면 흐름을 비우고 "이 방을 볼 수 없어요"를 보인다',
  async status => {
    const api = serve()
    api.on('GET', `${base}/rooms/r1/messages`, () => json({ error: 'X' }, status))
    render(<Harness />)
    await openAll()
    expect(await screen.findByText('이 방을 볼 수 없어요')).toBeTruthy()
    expect(screen.queryByText('모레 회의 있어요')).toBeNull()
  },
)

test('보는 중에 방을 잃으면(403) 흐름을 비운다', async () => {
  const api = serve()
  api.on('GET', `${base}/rooms/r1/messages?after=a2`, () => json({ error: 'FORBIDDEN' }, 403))
  render(<Harness />)
  await openAll()
  await screen.findByText('모레 회의 있어요')
  vi.useFakeTimers({ shouldAdvanceTime: true })
  await act(async () => {
    await vi.advanceTimersByTimeAsync(3000)
  })
  expect(await screen.findByText('이 방을 볼 수 없어요')).toBeTruthy()
  expect(screen.queryByText('모레 회의 있어요')).toBeNull()
})

// 목록과 방을 나란히 둘 만큼 넓은 화면(PC)
const wide = () =>
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: true,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))

test('PC 폭에서는 목록 옆에 첫 방(회장단은 회장단방)을 열고, 고른 방을 기억해 다음에 그 방부터 연다', async () => {
  wide()
  const api = serve()
  const finance = room('r3', { type: 'department', name: '재정부', departmentId: 'd1' })
  const leadership = room('r2', { type: 'leadership' })
  for (const [summary, text] of [
    [finance, '영수증 올려요'],
    [leadership, '회장단 회의 7시'],
  ] as const) {
    const path = `${base}/rooms/${summary.id}`
    api.on('GET', path, () => json(roomDetail(summary)))
    api.on('GET', `${path}/messages`, () => json(messagePage([message(`${summary.id}m`, text)])))
    api.on('POST', `${path}/read`, () => new Response(null, { status: 204 }))
  }
  render(<Harness />)
  expect(await screen.findByText('회장단 회의 7시')).toBeTruthy()
  const lead = screen.getByRole('button', { name: /회장단방/ })
  expect(lead.getAttribute('aria-current')).toBe('true')
  expect(screen.queryByRole('button', { name: '대화방 목록' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: /재정부/ }))
  expect(await screen.findByText('영수증 올려요')).toBeTruthy()
  cleanup()
  render(<Harness />)
  expect(await screen.findByText('영수증 올려요')).toBeTruthy()
  expect(screen.getByRole('button', { name: /재정부/ }).getAttribute('aria-current')).toBe('true')
})

test('메시지 메뉴에 공지 표시 항목이 없다(회장단도, DEC-90)', async () => {
  serve()
  render(<Harness permissions={PRESIDENT_PERMISSIONS} />)
  await openAll()
  await screen.findByText('모레 회의 있어요')
  fireEvent.keyDown((await screen.findAllByRole('button', { name: '메시지 동작' }))[0]!, {
    key: 'Enter',
  })
  await screen.findByRole('menuitem', { name: '구매 요청 만들기' })
  expect(screen.queryByRole('menuitem', { name: /공지/ })).toBeNull()
  expect(screen.queryByText('공지')).toBeNull()
})

test('1:1 창을 열면 운영진을 다시 읽어 방금 들어온 사람이 보인다', async () => {
  const api = serve()
  render(<Harness />)
  const before = api.calls.filter(call => call.path === `${base}/members`).length
  const joined = {
    ...teamResponse(),
    members: [
      ...teamResponse().members,
      {
        id: 'm9',
        name: '신입',
        councilRank: null,
        departments: [],
        joinedAt: '2026-10-25T01:00:00.000Z',
      },
    ],
  }
  api.on('GET', `${base}/members`, () => json(joined))
  fireEvent.click(await screen.findByRole('button', { name: '1:1 대화' }))
  const dialog = await screen.findByRole('dialog')
  expect(await within(dialog).findByRole('button', { name: '신입' })).toBeTruthy()
  expect(api.calls.filter(call => call.path === `${base}/members`).length).toBeGreaterThan(before)
})

test('1:1 대화는 나를 뺀 운영진 목록에서 고르면 그 방이 열린다', async () => {
  const api = serve()
  let opened = false
  api.on('GET', `${base}/rooms`, () =>
    json(
      roomList(opened ? { rooms: [room('r9', { type: 'direct', name: '박새내' })] } : undefined),
    ),
  )
  api.on('POST', `${base}/direct`, () => {
    opened = true
    return json({ roomId: 'r9' }, 201)
  })
  api.on('GET', `${base}/rooms/r9`, () =>
    json(roomDetail(room('r9', { type: 'direct', name: '박새내' }))),
  )
  api.on('GET', `${base}/rooms/r9/messages`, () => json(messagePage([])))
  render(<Harness />)
  fireEvent.click(await screen.findByRole('button', { name: '1:1 대화' }))
  const dialog = await screen.findByRole('dialog')
  expect(await within(dialog).findByRole('button', { name: '이재정' })).toBeTruthy()
  expect(within(dialog).queryByRole('button', { name: '김회장' })).toBeNull()
  fireEvent.click(within(dialog).getByRole('button', { name: '박새내' }))
  expect(await screen.findByText('아직 메시지가 없어요.')).toBeTruthy()
  expect(posts(api)[0]?.body).toEqual({ memberId: 'm3' })
})

test('1:1 방을 연 뒤 목록을 다시 읽지 못해도 찾을 수 없음 대신 방을 열어 서버가 정한다', async () => {
  const api = serve()
  let opened = false
  api.on('GET', `${base}/rooms`, () => (opened ? json({ error: 'x' }, 500) : json(roomList())))
  api.on('POST', `${base}/direct`, () => {
    opened = true
    return json({ roomId: 'r9' }, 201)
  })
  api.on('GET', `${base}/rooms/r9`, () =>
    json(roomDetail(room('r9', { type: 'direct', name: '박새내' }))),
  )
  api.on('GET', `${base}/rooms/r9/messages`, () => json(messagePage([message('x1', '안녕')])))
  api.on('POST', `${base}/rooms/r9/read`, () => new Response(null, { status: 204 }))
  render(<Harness />)
  fireEvent.click(await screen.findByRole('button', { name: '1:1 대화' }))
  const dialog = await screen.findByRole('dialog')
  fireEvent.click(await within(dialog).findByRole('button', { name: '박새내' }))
  expect(await screen.findByText('안녕')).toBeTruthy()
  expect(screen.queryByText('찾을 수 없음')).toBeNull()
})

test('1:1 열기가 409면 대화상자 안에 까닭을 보이고, 403이면 닫고 목록 위에 이유를 보인다', async () => {
  const api = serve()
  let status = 409
  api.on('POST', `${base}/direct`, () =>
    json({ error: status === 409 ? 'CANNOT_DIRECT_SELF' : 'FORBIDDEN' }, status),
  )
  render(<Harness />)
  fireEvent.click(await screen.findByRole('button', { name: '1:1 대화' }))
  fireEvent.click(await screen.findByRole('button', { name: '이재정' }))
  expect(await screen.findByText('나와는 1:1 대화를 열 수 없어요.')).toBeTruthy()
  status = 403
  fireEvent.click(screen.getByRole('button', { name: '이재정' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  await settle()
  expect(screen.getByText('권한이 바뀌었어요. 화면을 새로 불러왔어요.')).toBeTruthy()
})

test('방 정보와 메시지 중 하나만 403이어도 방을 잃은 것으로 본다', async () => {
  const api = serve()
  api.on('GET', `${base}/rooms/r1`, () => json({ error: 'FORBIDDEN' }, 403))
  api.on('GET', `${base}/rooms/r1/messages`, () => json({ error: 'X' }, 500))
  render(<Harness />)
  await openAll()
  expect(await screen.findByText('이 방을 볼 수 없어요')).toBeTruthy()
})

test('새 메시지를 읽지 못하면 흐름 옆에 연결 문구를 보이고, 다시 읽히면 사라진다', async () => {
  const api = serve()
  let ok = false
  api.on('GET', `${base}/rooms/r1/messages?after=a2`, () =>
    ok ? json(messagePage([])) : json({ error: 'X' }, 500),
  )
  render(<Harness />)
  await openAll()
  await screen.findByText('모레 회의 있어요')
  vi.useFakeTimers({ shouldAdvanceTime: true })
  await act(async () => {
    await vi.advanceTimersByTimeAsync(3000)
  })
  expect(await screen.findByText(/새 메시지를 불러오지 못하고 있어요/)).toBeTruthy()
  expect(screen.getByText('모레 회의 있어요')).toBeTruthy()
  ok = true
  await act(async () => {
    await vi.advanceTimersByTimeAsync(3000)
  })
  await waitFor(() => expect(screen.queryByText(/새 메시지를 불러오지 못하고 있어요/)).toBeNull())
})

test('방 목록은 15초마다, 열린 방은 3초마다 다시 읽는다', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  const api = serve()
  render(<Harness />)
  await screen.findByRole('button', { name: /공지방/ })
  const listReads = () => api.calls.filter(call => call.path === `${base}/rooms`).length
  await act(async () => {
    await vi.advanceTimersByTimeAsync(3000 * 4)
  })
  expect(listReads()).toBe(1)
  await act(async () => {
    await vi.advanceTimersByTimeAsync(3000)
  })
  expect(listReads()).toBe(2)
})
