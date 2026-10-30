// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { message, messagePage, room, roomDetail } from '@/test-support/chat-fixtures'
import { chatBase, ChatHarness, openAllRoom, serveChat } from '@/test-support/chat-harness'
import { deferredResponse, json, mockApi } from '@/test-support/mock-api'
import { resizeToJpeg } from '@/lib/photo-resize'
import { draftOf } from './composer-drafts'

vi.mock('@/lib/photo-resize', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/photo-resize')>()),
  resizeToJpeg: vi.fn(),
}))

const ANOTHER = '22222222-2222-4222-8222-222222222222'
const jpeg = () => new Blob(['jpeg'], { type: 'image/jpeg' })

beforeEach(() => {
  vi.stubGlobal(
    'URL',
    Object.assign(URL, { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} }),
  )
  vi.mocked(resizeToJpeg).mockImplementation(file =>
    Promise.resolve(file instanceof File && file.name === 'bad.heic' ? null : jpeg()),
  )
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const sends = (api: ReturnType<typeof mockApi>) =>
  api.calls.filter(call => call.method === 'POST' && call.path === `${chatBase}/rooms/r1/messages`)
const field = () => screen.getByLabelText<HTMLTextAreaElement>('메시지')
const signed = {
  key: 'k1',
  url: '/r2/k1',
  headers: { 'Content-Type': 'image/jpeg', 'If-None-Match': '*' },
  expiresAt: '2026-10-21T00:10:00.000Z',
}
const sendButton = () => screen.getByRole<HTMLButtonElement>('button', { name: /보내/ })
const type = (value: string) => fireEvent.change(field(), { target: { value } })
const choose = (...names: string[]) =>
  fireEvent.change(screen.getByLabelText('사진 고르기'), {
    target: { files: names.map(name => new File(['raw'], name, { type: 'image/jpeg' })) },
  })

// 참여자는 나(m1)와 이재정이다. 보내기와 올리기 응답을 등록한다.
function serve() {
  const api = serveChat()
  api.on('GET', `${chatBase}/rooms/r1`, () =>
    json({
      room: room('r1'),
      participants: [
        { memberId: 'm1', name: '김회장' },
        { memberId: ANOTHER, name: '이재정' },
      ],
    }),
  )
  api.on('POST', `${chatBase}/rooms/r1/messages`, () => json({ id: 'a3' }, 201))
  api.on('GET', `${chatBase}/rooms/r1/messages?after=a2`, () =>
    json(messagePage([message('a3', '보낸 글')])),
  )
  api.on('POST', `${chatBase}/rooms/r1/uploads`, () => json(signed))
  api.on('PUT', '/r2/k1', () => new Response(null, { status: 200 }))
  return api
}
const open = async () => {
  render(<ChatHarness />)
  await openAllRoom()
  await screen.findByLabelText('메시지')
}

test('빈 글과 공백만이면 보내기가 꺼지고, 글이 있으면 켜진다', async () => {
  serve()
  await open()
  expect(sendButton().disabled).toBe(true)
  type('   \n ')
  expect(sendButton().disabled).toBe(true)
  type('안녕하세요')
  expect(sendButton().disabled).toBe(false)
})

test('입력 자리 글과 보내기 이름이 지금 방을 가리킨다', async () => {
  serve()
  await open()
  expect(field().placeholder).toBe('메시지 입력 · @ 부르기 · / 1:1 대화')
  expect(screen.getByRole('button', { name: '공지방에 보내기' })).toBeTruthy()
})

test('보내면 글을 비우고 보낸 글이 흐름에 나타난다', async () => {
  const api = serve()
  await open()
  type('보낸 글')
  fireEvent.click(sendButton())
  expect(await screen.findByText('보낸 글', { selector: 'p' })).toBeTruthy()
  expect(sends(api)[0]?.body).toEqual({ body: '보낸 글', mentions: [], photos: [] })
  expect(field().value).toBe('')
})

test('보내는 동안에는 두 번 보내지 않는다', async () => {
  const api = serve()
  const pending = deferredResponse()
  api.on('POST', `${chatBase}/rooms/r1/messages`, () => pending.promise)
  await open()
  type('한 번만')
  fireEvent.click(sendButton())
  fireEvent.click(sendButton())
  fireEvent.submit(field().closest('form') as HTMLFormElement)
  await waitFor(() => expect(sendButton().disabled).toBe(true))
  expect(sends(api)).toHaveLength(1)
  pending.resolve(json({ id: 'a3' }, 201))
  await waitFor(() => expect(field().value).toBe(''))
})

test('@를 치면 참여자 목록(나 제외)이 뜨고, 고르면 "@이름 "이 들어가 그 사람을 부른다', async () => {
  const api = serve()
  await open()
  type('@')
  const list = await screen.findByRole('list', { name: '부를 사람' })
  expect(within(list).queryByText('김회장')).toBeNull()
  fireEvent.click(within(list).getByRole('button', { name: '이재정' }))
  expect(field().value).toBe('@이재정 ')
  type('@이재정 확인 부탁해요')
  fireEvent.click(sendButton())
  await waitFor(() => expect(sends(api)).toHaveLength(1))
  expect(sends(api)[0]?.body).toEqual({
    body: '@이재정 확인 부탁해요',
    mentions: [ANOTHER],
    photos: [],
  })
})

test('본문에서 지운 이름은 부르지 않는다', async () => {
  const api = serve()
  await open()
  type('@이')
  fireEvent.click(await screen.findByRole('button', { name: '이재정' }))
  type('그냥 글')
  fireEvent.click(sendButton())
  await waitFor(() => expect(sends(api)).toHaveLength(1))
  expect(sends(api)[0]?.body).toEqual({ body: '그냥 글', mentions: [], photos: [] })
})

test('사진만 있으면 보내기가 켜지고, 줄인 JPEG를 서버가 준 머리 그대로 올린 뒤 키를 싣는다', async () => {
  const api = serve()
  await open()
  choose('여행.png')
  await waitFor(() => expect(sendButton().disabled).toBe(false))
  const put = vi.mocked(fetch).mock.calls.find(([, init]) => init?.method === 'PUT')
  expect(put?.[1]?.headers).toEqual(signed.headers)
  expect(put?.[1]?.credentials).toBe('omit')
  expect(api.calls.find(call => call.path.endsWith('/uploads'))?.body).toEqual({})
  fireEvent.click(sendButton())
  await waitFor(() => expect(sends(api)).toHaveLength(1))
  expect(sends(api)[0]?.body).toEqual({ mentions: [], photos: ['k1'] })
  await waitFor(() => expect(screen.queryByLabelText('보낼 사진')).toBeNull())
})

test('올리는 중에는 보내기가 꺼져 있다', async () => {
  const api = serve()
  const pending = deferredResponse()
  api.on('PUT', '/r2/k1', () => pending.promise)
  await open()
  type('글도 있어요')
  choose('a.jpg')
  expect(await screen.findByText('올리는 중…')).toBeTruthy()
  expect(sendButton().disabled).toBe(true)
  pending.resolve(new Response(null, { status: 200 }))
  await waitFor(() => expect(sendButton().disabled).toBe(false))
})

test('열 수 없는 사진은 그 자리에 문구가 뜨고 보내기가 꺼지며, 빼면 켜진다', async () => {
  serve()
  await open()
  type('글')
  choose('bad.heic')
  expect(await screen.findByText('이 사진을 열 수 없어요. 다른 사진을 골라 주세요.')).toBeTruthy()
  expect(sendButton().disabled).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'bad.jpg 빼기' }))
  expect(sendButton().disabled).toBe(false)
})

test('올리기 실패는 그 사진 옆에 문구가 뜬다', async () => {
  const api = serve()
  api.on('PUT', '/r2/k1', () => new Response(null, { status: 500 }))
  await open()
  choose('a.jpg')
  expect(await screen.findByText(/사진을 올리지 못했어요/)).toBeTruthy()
  expect(sendButton().disabled).toBe(true)
})

test('사진은 10장까지다. 넘기면 문구가 뜨고 10장만 남는다', async () => {
  serve()
  await open()
  choose(...Array.from({ length: 11 }, (_, index) => `p${index}.jpg`))
  expect(await screen.findByText('사진은 한 번에 10장까지 보낼 수 있어요.')).toBeTruthy()
  expect(within(screen.getByLabelText('보낼 사진')).getAllByRole('listitem')).toHaveLength(10)
})

test('보내기에 실패하면 글과 사진이 남고 자동으로 다시 보내지 않는다', async () => {
  const api = serve()
  api.on('POST', `${chatBase}/rooms/r1/messages`, () => json({ error: 'X' }, 500))
  await open()
  type('남아야 해요')
  choose('a.jpg')
  await waitFor(() => expect(sendButton().disabled).toBe(false))
  fireEvent.click(sendButton())
  expect(await screen.findByText(/보내지 못했어요/)).toBeTruthy()
  expect(field().value).toBe('남아야 해요')
  expect(screen.getByLabelText('보낼 사진')).toBeTruthy()
  await new Promise(done => setTimeout(done, 50))
  expect(sends(api)).toHaveLength(1)
})

test.each([
  [429, 'TOO_MANY_REQUESTS', /너무 빨리/],
  [400, 'UPLOAD_MISMATCH', /올린 사진을 확인하지 못했어요/],
  [409, 'PHOTO_ALREADY_SENT', /이미 보낸 사진/],
  [400, 'INVALID_INPUT', /보낼 수 없는 내용/],
  [503, 'STORAGE_NOT_CONFIGURED', /지금은 사진을 보낼 수 없어요/],
])('보내기 %i %s는 입력칸 옆에 맞는 문구를 보이고 글을 남긴다', async (status, code, text) => {
  const api = serve()
  api.on('POST', `${chatBase}/rooms/r1/messages`, () => json({ error: code }, status))
  await open()
  type('글')
  fireEvent.click(sendButton())
  expect(await screen.findByText(text)).toBeTruthy()
  expect(field().value).toBe('글')
})

test.each([403, 404])('보내다 방을 잃으면(%i) "이 방을 볼 수 없어요"를 보인다', async status => {
  const api = serve()
  api.on('POST', `${chatBase}/rooms/r1/messages`, () => json({ error: 'X' }, status))
  await open()
  type('글')
  fireEvent.click(sendButton())
  expect(await screen.findByText('이 방을 볼 수 없어요')).toBeTruthy()
  expect(screen.queryByLabelText('메시지')).toBeNull()
})

test('올리다 방을 잃으면(403) 같은 화면으로 바뀐다', async () => {
  const api = serve()
  api.on('POST', `${chatBase}/rooms/r1/uploads`, () => json({ error: 'FORBIDDEN' }, 403))
  await open()
  choose('a.jpg')
  expect(await screen.findByText('이 방을 볼 수 없어요')).toBeTruthy()
})

test('사진이 붙은 메시지는 사진을 보이고, 누르면 크게 보인다', async () => {
  const api = serve()
  const withPhoto = { ...message('a2', ''), photos: [{ id: 'f1' }] }
  api.on('GET', `${chatBase}/rooms/r1/messages`, () => json(messagePage([withPhoto])))
  await open()
  const thumb = await screen.findByRole('button', { name: '사진 크게 보기' })
  expect(within(thumb).getByRole('img').getAttribute('src')).toBe(`${chatBase}/files/f1`)
  fireEvent.click(thumb)
  const dialog = await screen.findByRole('dialog')
  expect(within(dialog).getByRole('img').getAttribute('src')).toBe(`${chatBase}/files/f1`)
})

test('상대가 떠난 보기만 방에는 입력칸이 없다', async () => {
  const api = serve()
  api.on('GET', `${chatBase}/rooms/r1`, () => json(roomDetail(room('r1', { readOnly: true }))))
  render(<ChatHarness />)
  await openAllRoom()
  expect(await screen.findByText('이 방은 보기만 할 수 있어요.')).toBeTruthy()
  expect(screen.queryByLabelText('메시지')).toBeNull()
})

test('보내는 동안 이어 친 글과 새로 고른 사진은 남고, 보낸 글과 사진만 지워진다', async () => {
  const api = serve()
  const pending = deferredResponse()
  api.on('POST', `${chatBase}/rooms/r1/messages`, () => pending.promise)
  api.on('POST', `${chatBase}/rooms/r1/uploads`, () => json(signed))
  await open()
  type('보낸 글')
  choose('a.jpg')
  await waitFor(() => expect(sendButton().disabled).toBe(false))
  fireEvent.click(sendButton())
  await waitFor(() => expect(sends(api)).toHaveLength(1))
  type('보낸 글 이어서 친 글')
  api.on('POST', `${chatBase}/rooms/r1/uploads`, () => json({ ...signed, key: 'k2' }))
  choose('b.jpg')
  await waitFor(() => expect(screen.getAllByRole('img').length).toBeGreaterThan(1))
  pending.resolve(json({ id: 'a3' }, 201))
  await waitFor(() => expect(field().value).toBe('이어서 친 글'))
  const strip = screen.getByLabelText('보낼 사진')
  expect(within(strip).getAllByRole('listitem')).toHaveLength(1)
  expect(within(strip).getByRole('button', { name: 'b.jpg 빼기' })).toBeTruthy()
})

test('올리는 것은 줄인 JPEG이고 원본 파일이 아니다', async () => {
  serve()
  const resized = jpeg()
  vi.mocked(resizeToJpeg).mockResolvedValue(resized)
  await open()
  choose('원본.jpg')
  await waitFor(() => expect(sendButton().disabled).toBe(true))
  await waitFor(() =>
    expect(vi.mocked(fetch).mock.calls.some(([, i]) => i?.method === 'PUT')).toBe(true),
  )
  const put = vi.mocked(fetch).mock.calls.find(([, init]) => init?.method === 'PUT')
  expect(put?.[1]?.body).toBe(resized)
  expect(put?.[1]?.body).not.toBeInstanceOf(File)
})

test('줄인 사진이 상한을 넘으면 올리지 않고 그 자리에서 알린다', async () => {
  serve()
  const big = jpeg()
  Object.defineProperty(big, 'size', { value: 10 * 1_048_576 + 1 })
  vi.mocked(resizeToJpeg).mockResolvedValue(big)
  await open()
  choose('큰.jpg')
  expect(await screen.findByText(/사진이 너무 커요/)).toBeTruthy()
  expect(vi.mocked(fetch).mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(false)
})

test('글만 보낼 때의 일반 503은 사진 저장소 문구가 아니다', async () => {
  const api = serve()
  api.on('POST', `${chatBase}/rooms/r1/messages`, () => json({ error: 'X' }, 503))
  await open()
  type('글')
  fireEvent.click(sendButton())
  expect(await screen.findByText(/보내지 못했어요/)).toBeTruthy()
  expect(screen.queryByText(/사진을 보낼 수 없어요/)).toBeNull()
})

test('보내다 보기만 되는 방(409)이 되면 입력칸을 닫고 보기만 안내로 바꾼다', async () => {
  const api = serve()
  api.on('POST', `${chatBase}/rooms/r1/messages`, () => json({ error: 'ROOM_READ_ONLY' }, 409))
  await open()
  type('글')
  fireEvent.click(sendButton())
  expect(await screen.findByText('이 방은 보기만 할 수 있어요.')).toBeTruthy()
  expect(screen.queryByLabelText('메시지')).toBeNull()
})

test('보내는 중에 방을 떠나도 보낸 글이 임시 글로 남지 않고, 보내기가 실패하면 임시 글로 돌아온다', async () => {
  const api = serve()
  const pending = deferredResponse()
  api.on('POST', `${chatBase}/rooms/r1/messages`, () => pending.promise)
  render(<ChatHarness />)
  await openAllRoom()
  await screen.findByLabelText('메시지')
  type('보낼 글')
  fireEvent.click(sendButton())
  await waitFor(() => expect(sends(api)).toHaveLength(1))
  cleanup()
  expect(draftOf('m1', 'c1', 'r1').body).toBe('')
  pending.resolve(json({ error: 'x', code: 'INTERNAL' }, 500))
  await waitFor(() => expect(draftOf('m1', 'c1', 'r1').body).toBe('보낼 글'))
})

test('방을 떠났다 돌아와도 붙인 사진이 미리 보기와 함께 남고, 그대로 보낸 뒤에야 주소를 거둔다', async () => {
  const api = serve()
  const revoked = vi.spyOn(URL, 'revokeObjectURL')
  await open()
  choose('a.jpg')
  await waitFor(() => expect(sendButton().disabled).toBe(false))
  cleanup()
  expect(revoked).not.toHaveBeenCalled()
  await open()
  const strip = within(screen.getByLabelText('보낼 사진'))
  expect(strip.getByRole<HTMLImageElement>('img', { name: 'a.jpg' }).src).toBe('blob:x')
  fireEvent.click(sendButton())
  await waitFor(() => expect(screen.queryByLabelText('보낼 사진')).toBeNull())
  expect(sends(api)[0]?.body).toEqual({ mentions: [], photos: ['k1'] })
  expect(revoked).toHaveBeenCalledExactlyOnceWith('blob:x')
})

test('올리는 중에 방을 떠나도 끝난 올리기를 잃지 않아 돌아오면 보낼 수 있다', async () => {
  const api = serve()
  const pending = deferredResponse()
  api.on('PUT', '/r2/k1', () => pending.promise)
  await open()
  choose('a.jpg')
  expect(await screen.findByText('올리는 중…')).toBeTruthy()
  cleanup()
  pending.resolve(new Response(null, { status: 200 }))
  await open()
  await waitFor(() => expect(sendButton().disabled).toBe(false))
  fireEvent.click(sendButton())
  await waitFor(() => expect(sends(api)).toHaveLength(1))
  expect(sends(api)[0]?.body).toEqual({ mentions: [], photos: ['k1'] })
})

test('방을 떠난 사이 올리기가 실패하면 돌아왔을 때 그 사진에 이유가 보인다', async () => {
  const api = serve()
  const pending = deferredResponse()
  api.on('PUT', '/r2/k1', () => pending.promise)
  await open()
  choose('a.jpg')
  expect(await screen.findByText('올리는 중…')).toBeTruthy()
  cleanup()
  pending.resolve(new Response(null, { status: 500 }))
  await open()
  expect(await screen.findByText(/사진을 올리지 못했어요/)).toBeTruthy()
  expect(sendButton().disabled).toBe(true)
})

test('보내는 중에 떠났다 돌아오면 같은 사진을 또 보낼 수 없고, 성공하면 사진이 사라진다', async () => {
  const api = serve()
  const revoked = vi.spyOn(URL, 'revokeObjectURL')
  const pending = deferredResponse()
  api.on('POST', `${chatBase}/rooms/r1/messages`, () => pending.promise)
  await open()
  choose('a.jpg')
  await waitFor(() => expect(sendButton().disabled).toBe(false))
  fireEvent.click(sendButton())
  await waitFor(() => expect(sends(api)).toHaveLength(1))
  cleanup()
  await open()
  expect(screen.getByLabelText('보낼 사진')).toBeTruthy()
  expect(sendButton().disabled).toBe(true)
  pending.resolve(json({ id: 'a3' }, 201))
  await waitFor(() => expect(screen.queryByLabelText('보낼 사진')).toBeNull())
  expect(sends(api)).toHaveLength(1)
  expect(revoked).toHaveBeenCalledExactlyOnceWith('blob:x')
})

test('보내는 중에 방을 떠났는데 보내기가 실패하면 사진이 남아 다시 보낼 수 있다', async () => {
  const api = serve()
  const revoked = vi.spyOn(URL, 'revokeObjectURL')
  const pending = deferredResponse()
  api.on('POST', `${chatBase}/rooms/r1/messages`, () => pending.promise)
  await open()
  choose('a.jpg')
  await waitFor(() => expect(sendButton().disabled).toBe(false))
  fireEvent.click(sendButton())
  await waitFor(() => expect(sends(api)).toHaveLength(1))
  cleanup()
  pending.resolve(json({ error: 'INTERNAL' }, 500))
  await open()
  await waitFor(() => expect(sendButton().disabled).toBe(false))
  expect(screen.getByLabelText('보낼 사진')).toBeTruthy()
  expect(revoked).not.toHaveBeenCalled()
})

test('떠났다 돌아와도 사진 상한은 남은 사진까지 센다', async () => {
  serve()
  await open()
  choose(...Array.from({ length: 10 }, (_, index) => `p${index}.jpg`))
  await waitFor(() => expect(sendButton().disabled).toBe(false))
  cleanup()
  await open()
  choose('p10.jpg')
  expect(await screen.findByText('사진은 한 번에 10장까지 보낼 수 있어요.')).toBeTruthy()
  expect(within(screen.getByLabelText('보낼 사진')).getAllByRole('listitem')).toHaveLength(10)
})

test('다른 사람으로 들어오면 앞 사람이 붙인 사진을 보지 않는다', async () => {
  serve()
  await open()
  choose('a.jpg')
  await waitFor(() => expect(sendButton().disabled).toBe(false))
  cleanup()
  render(<ChatHarness memberId="m9" />)
  await openAllRoom()
  await screen.findByLabelText('메시지')
  expect(screen.queryByLabelText('보낼 사진')).toBeNull()
})

test('사진을 빼면 미리 보기 주소를 거두고, 줄이는 중에 뺀 사진의 늦은 주소도 거둔다', async () => {
  serve()
  const revoked = vi.spyOn(URL, 'revokeObjectURL')
  await open()
  choose('a.jpg')
  await waitFor(() => expect(sendButton().disabled).toBe(false))
  fireEvent.click(screen.getByRole('button', { name: 'a.jpg 빼기' }))
  expect(revoked).toHaveBeenCalledExactlyOnceWith('blob:x')
  revoked.mockClear()
  let resized: (blob: Blob) => void = () => {}
  vi.mocked(resizeToJpeg).mockReturnValueOnce(
    new Promise(resolve => {
      resized = resolve
    }),
  )
  choose('b.jpg')
  fireEvent.click(await screen.findByRole('button', { name: 'b.jpg 빼기' }))
  resized(jpeg())
  await waitFor(() => expect(revoked).toHaveBeenCalledExactlyOnceWith('blob:x'))
})

test('보내는 중에 떠났다 돌아온 뒤 보내기가 실패하면 글과 부른 사람이 입력칸에 돌아와 함께 다시 보낸다', async () => {
  const api = serve()
  const pending = deferredResponse()
  api.on('POST', `${chatBase}/rooms/r1/messages`, () => pending.promise)
  await open()
  type('@')
  fireEvent.click(
    within(await screen.findByRole('list', { name: '부를 사람' })).getByRole('button', {
      name: '이재정',
    }),
  )
  type('@이재정 사진 봐 주세요')
  choose('a.jpg')
  await waitFor(() => expect(sendButton().disabled).toBe(false))
  fireEvent.click(sendButton())
  await waitFor(() => expect(sends(api)).toHaveLength(1))
  cleanup()
  await open()
  expect(field().value).toBe('')
  api.on('POST', `${chatBase}/rooms/r1/messages`, () => json({ id: 'a3' }, 201))
  pending.resolve(json({ error: 'INTERNAL' }, 500))
  await waitFor(() => expect(field().value).toBe('@이재정 사진 봐 주세요'))
  await waitFor(() => expect(sendButton().disabled).toBe(false))
  fireEvent.click(sendButton())
  await waitFor(() => expect(sends(api)).toHaveLength(2))
  expect(sends(api)[1]?.body).toEqual({
    body: '@이재정 사진 봐 주세요',
    mentions: [ANOTHER],
    photos: ['k1'],
  })
})

test('보내는 중에 떠났다 돌아와 새로 쓴 글은 보내기가 실패해도 되돌아온 글 뒤에 남는다', async () => {
  const api = serve()
  const pending = deferredResponse()
  api.on('POST', `${chatBase}/rooms/r1/messages`, () => pending.promise)
  await open()
  type('먼저 쓴 글')
  fireEvent.click(sendButton())
  await waitFor(() => expect(sends(api)).toHaveLength(1))
  cleanup()
  await open()
  type('새로 쓴 글')
  pending.resolve(json({ error: 'INTERNAL' }, 500))
  await waitFor(() => expect(field().value).toBe('먼저 쓴 글\n새로 쓴 글'))
})
