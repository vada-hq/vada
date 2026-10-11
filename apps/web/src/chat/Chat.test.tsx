// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import Chat from './Chat'
import type { MessageSummary } from '@vada/contracts'

afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals() })
const msg = (id: string, content = id): MessageSummary => ({ id, content, chatRoomId: 'r1', author: { id: 'u1', name: '기획부 사용자' }, createdAt: '2026-09-29T00:00:00Z' })
const ok = (messages: MessageSummary[], nextCursor: string | null = null) => ({ ok: true, status: 200, json: async () => ({ messages, nextCursor }) })
const props = { organizationId: 'o1', eventId: 'e1', eventName: '체육대회' }

test('shows loading, author, plain text, time and older messages without duplicates', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(ok([msg('new', '<script>hello</script>')], 'new')).mockResolvedValueOnce(ok([msg('old')], null)))
  render(<Chat {...props} />)
  expect(screen.getByRole('status').textContent).toContain('불러오는 중')
  expect(await screen.findByText('<script>hello</script>')).toBeTruthy()
  expect(screen.getByText('기획부 사용자')).toBeTruthy()
  expect(document.querySelector('time')?.getAttribute('datetime')).toBe('2026-09-29T00:00:00Z')
  fireEvent.click(screen.getByRole('button', { name: '이전 메시지' }))
  expect(await screen.findByText('old')).toBeTruthy()
  expect(screen.queryByRole('button', { name: '이전 메시지' })).toBeNull()
})

test('polls every three seconds and stops after unmount', async () => {
  vi.useFakeTimers()
  const fetchMock = vi.fn().mockResolvedValueOnce(ok([])).mockResolvedValue(ok([msg('reply')]))
  vi.stubGlobal('fetch', fetchMock)
  const view = render(<Chat {...props} />)
  await act(async () => {})
  expect(screen.getByText('아직 대화가 없어요.')).toBeTruthy()
  await act(async () => { await vi.advanceTimersByTimeAsync(3000) })
  expect(screen.getByText('reply')).toBeTruthy()
  expect(fetchMock).toHaveBeenCalledTimes(2)
  view.unmount()
  await vi.advanceTimersByTimeAsync(6000)
  expect(fetchMock).toHaveBeenCalledTimes(2)
})

test('polling catches up through pages when more than fifty new messages arrive', async () => {
  vi.useFakeTimers()
  const recent = Array.from({ length: 50 }, (_, i) => msg(`n${i + 10}`))
  const intermediate = Array.from({ length: 9 }, (_, i) => msg(`n${i + 1}`))
  const fetchMock = vi.fn().mockResolvedValueOnce(ok([msg('original')]))
    .mockResolvedValueOnce(ok(recent, 'n10')).mockResolvedValueOnce(ok([msg('original'), ...intermediate]))
  vi.stubGlobal('fetch', fetchMock)
  render(<Chat {...props} />)
  await act(async () => {})
  await act(async () => { await vi.advanceTimersByTimeAsync(3000) })
  expect(screen.getAllByRole('listitem')).toHaveLength(60)
  expect(screen.getAllByText('original')).toHaveLength(1)
  expect(fetchMock).toHaveBeenLastCalledWith(expect.stringContaining('before=n10'), expect.anything())
})

test('send trims content, prevents duplicate submission and reloads messages', async () => {
  let resolve!: (value: unknown) => void
  const fetchMock = vi.fn().mockResolvedValueOnce(ok([]))
    .mockImplementationOnce(() => new Promise(r => { resolve = r })).mockResolvedValueOnce(ok([msg('sent', '준비해요')]))
  vi.stubGlobal('fetch', fetchMock)
  render(<Chat {...props} />)
  await screen.findByText('아직 대화가 없어요.')
  const form = screen.getByRole('form', { name: '메시지 보내기' })
  fireEvent.change(screen.getByLabelText('메시지'), { target: { value: '  ' } })
  fireEvent.submit(form)
  expect(fetchMock).toHaveBeenCalledTimes(1)
  fireEvent.change(screen.getByLabelText('메시지'), { target: { value: 'a'.repeat(2001) } })
  fireEvent.submit(form)
  expect(fetchMock).toHaveBeenCalledTimes(1)
  fireEvent.change(screen.getByLabelText('메시지'), { target: { value: 'a\u0000b' } })
  expect(screen.getByRole('button', { name: '전송' }).hasAttribute('disabled')).toBe(true)
  fireEvent.change(screen.getByLabelText('메시지'), { target: { value: '  준비해요  ' } })
  fireEvent.submit(form)
  fireEvent.submit(form)
  expect(fetchMock).toHaveBeenCalledTimes(2)
  expect(fetchMock).toHaveBeenLastCalledWith('/api/organizations/o1/events/e1/messages', expect.objectContaining({ method: 'POST', body: JSON.stringify({ content: '준비해요' }) }))
  await act(async () => resolve({ ok: true, status: 201, json: async () => ({ message: msg('sent', '준비해요') }) }))
  expect(await screen.findByText('준비해요')).toBeTruthy()
  expect((screen.getByLabelText('메시지') as HTMLTextAreaElement).value).toBe('')
})

test('failed sending retains draft and never retries the POST automatically', async () => {
  vi.useFakeTimers()
  const fetchMock = vi.fn().mockResolvedValueOnce(ok([])).mockRejectedValueOnce(new Error('private')).mockResolvedValue(ok([]))
  vi.stubGlobal('fetch', fetchMock)
  render(<Chat {...props} />)
  await act(async () => {})
  fireEvent.change(screen.getByLabelText('메시지'), { target: { value: '안녕하세요' } })
  await act(async () => fireEvent.submit(screen.getByRole('form', { name: '메시지 보내기' })))
  expect(screen.getByRole('alert').textContent).toContain('다시 보내기 전에')
  expect((screen.getByLabelText('메시지') as HTMLTextAreaElement).value).toBe('안녕하세요')
  await act(async () => { await vi.advanceTimersByTimeAsync(6000) })
  expect(fetchMock.mock.calls.filter(call => call[1]?.method === 'POST')).toHaveLength(1)
})

test('typing the next draft while sending does not lose it on success', async () => {
  let resolve!: (value: unknown) => void
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(ok([]))
    .mockImplementationOnce(() => new Promise(r => { resolve = r })).mockResolvedValueOnce(ok([msg('sent', '첫 메시지')])))
  render(<Chat {...props} />)
  await screen.findByText('아직 대화가 없어요.')
  fireEvent.change(screen.getByLabelText('메시지'), { target: { value: '첫 메시지' } })
  fireEvent.submit(screen.getByRole('form', { name: '메시지 보내기' }))
  fireEvent.change(screen.getByLabelText('메시지'), { target: { value: '다음 메시지' } })
  await act(async () => resolve({ ok: true, json: async () => ({ message: msg('sent', '첫 메시지') }) }))
  expect((screen.getByLabelText('메시지') as HTMLTextAreaElement).value).toBe('다음 메시지')
})

test('initial fetch failure is distinct from empty chat and can be retried', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: false, status: 500 }).mockResolvedValueOnce(ok([])))
  render(<Chat {...props} />)
  expect(await screen.findByRole('alert')).toBeTruthy()
  expect(screen.queryByText('아직 대화가 없어요.')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '대화 다시 불러오기' }))
  expect(await screen.findByText('아직 대화가 없어요.')).toBeTruthy()
})

test('permission loss clears messages and disables sending', async () => {
  vi.useFakeTimers()
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(ok([msg('private')])).mockResolvedValue({ ok: false, status: 403 }))
  render(<Chat {...props} />)
  await act(async () => {})
  await act(async () => { await vi.advanceTimersByTimeAsync(3000) })
  expect(screen.queryByText('private')).toBeNull()
  expect(screen.getByRole('alert').textContent).toContain('접근')
  expect(screen.getByRole('button', { name: '전송' }).hasAttribute('disabled')).toBe(true)
})

test('changing events ignores late responses and clears the draft', async () => {
  let resolve!: (value: unknown) => void
  vi.stubGlobal('fetch', vi.fn().mockImplementationOnce(() => new Promise(r => { resolve = r })).mockResolvedValueOnce(ok([])))
  const view = render(<Chat {...props} />)
  fireEvent.change(screen.getByLabelText('메시지'), { target: { value: 'Old draft' } })
  view.rerender(<Chat {...props} eventId="e2" eventName="다른 행사" />)
  await screen.findByText('아직 대화가 없어요.')
  await act(async () => resolve(ok([msg('old response')])))
  expect(screen.queryByText('old response')).toBeNull()
  expect((screen.getByLabelText('메시지') as HTMLTextAreaElement).value).toBe('')
})

test('쿠팡 상품 링크는 버튼으로 그리고, 누르면 그 링크를 넘기며, 다른 글은 그대로 둔다', async () => {
  const link = 'https://www.coupang.com/vp/products/1?itemId=2&vendorItemId=3'
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok([msg('m1', `이거 어때? ${link} 다른 건 https://example.com`)])))
  const onOpenLink = vi.fn()
  render(<Chat {...props} onOpenLink={onOpenLink} />)
  const button = await screen.findByRole('button', { name: link })
  expect(button.className).toContain('wrap-anywhere')
  fireEvent.click(button)
  expect(onOpenLink).toHaveBeenCalledWith(expect.objectContaining({ productId: '1', vendorItemId: '3', url: link }))
  expect(screen.getByText(/다른 건 https:\/\/example\.com/)).toBeTruthy()
})

test('후보에서 고른 메시지가 이전 페이지에 있으면 더 불러와 강조하고, 없으면 알린다', async () => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => String(url).includes('before=new') ? ok([msg('target')], null) : ok([msg('new')], 'new')))
  const scrolled = vi.fn()
  Element.prototype.scrollIntoView = scrolled
  try {
    const view = render(<Chat {...props} focus={null} />)
    await screen.findByText('new')
    view.rerender(<Chat {...props} focus={{ id: 1, messageId: 'target' }} />)
    const target = await screen.findByText('target')
    await waitFor(() => expect(target.closest('li')!.className).toContain('bg-yellow-50'))
    expect(scrolled).toHaveBeenCalled()
    view.rerender(<Chat {...props} focus={{ id: 2, messageId: 'missing' }} />)
    expect(await screen.findByText('메시지를 찾지 못했어요.')).toBeTruthy()
  } finally {
    Reflect.deleteProperty(Element.prototype, 'scrollIntoView')
  }
})

test('완료한 행사는 대화 입력 대신 안내를 보인다', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok([msg('old')])))
  render(<Chat {...props} readOnly />)
  expect(await screen.findByText('old')).toBeTruthy()
  expect(screen.queryByLabelText('메시지')).toBeNull()
  expect(screen.getByText('완료한 행사라 대화를 보낼 수 없어요.')).toBeTruthy()
})

test('보내는 사이 행사가 완료되면 다시 보내라고 하지 않고 완료를 알린다', async () => {
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => init?.method === 'POST'
    ? { ok: false, status: 409, json: async () => ({ error: 'EVENT_COMPLETED' }) } : ok([])))
  render(<Chat {...props} />)
  await screen.findByText('아직 대화가 없어요.')
  fireEvent.change(screen.getByLabelText('메시지'), { target: { value: '안녕' } })
  fireEvent.click(screen.getByRole('button', { name: '전송' }))
  expect(await screen.findByText('완료한 행사라 대화를 보낼 수 없어요.')).toBeTruthy()
})
