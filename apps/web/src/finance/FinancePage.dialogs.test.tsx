// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { PURCHASE_ITEMS_MAX } from '@vada/contracts'
import { councilView, MEMBER_PERMISSIONS } from '@/test-support/council-fixtures'
import { deferredResponse, json, mockApi } from '@/test-support/mock-api'
import { purchaseDetail, purchaseSummary } from '@/test-support/purchase-fixtures'
import { asElement } from '@/test-support/elements'
import { PURCHASE_LOST } from '@/lib/messages'
import FinancePage from './FinancePage'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const BASE = '/api/organizations/c1/purchase-requests'
const LIST = `${BASE}?view=mine`

function setup(detail = purchaseDetail()) {
  const api = mockApi()
  api.on('GET', LIST, () => json({ requests: [purchaseSummary('r1')], truncated: false }))
  api.on('GET', `${BASE}/r1`, () => json({ request: detail }))
  const handlers = { onForbidden: vi.fn(), onChanged: vi.fn() }
  render(
    <FinancePage view={councilView('c1', { permissions: MEMBER_PERMISSIONS })} {...handlers} />,
  )
  const reads = () => api.calls.filter(call => call.path === LIST).length
  return { api, handlers, reads }
}

const openCreate = async () => {
  fireEvent.click(await screen.findByRole('button', { name: '구매 요청 내기' }))
  return screen.findByRole('form', { name: '구매 요청 내기' })
}
const submit = () => asElement(screen.getByRole('button', { name: '내기' }), HTMLButtonElement)
const fill = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } })

test('제목과 품목 이름을 쓰면 [내기]가 켜지고, 보내면 닫히고 목록과 수를 다시 읽는다', async () => {
  const { api, handlers, reads } = setup()
  api.on('POST', BASE, () => json({ request: purchaseDetail() }, 201))
  await openCreate()
  expect(submit().disabled).toBe(true)
  fill('제목', '  테이프  ')
  expect(submit().disabled).toBe(true)
  fill('품목 1 이름', '박스 테이프')
  expect(submit().disabled).toBe(false)
  const before = reads()
  fireEvent.click(submit())
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(api.calls.find(call => call.method === 'POST')?.body).toEqual({
    title: '  테이프  ',
    body: null,
    neededBy: null,
    items: [{ name: '박스 테이프', quantity: 1, link: null, options: null }],
  })
  expect(handlers.onChanged).toHaveBeenCalledTimes(1)
  await waitFor(() => expect(reads()).toBeGreaterThan(before))
})

test('품목은 더하고 뺄 수 있고 한 줄은 못 빼며 상한에서 더하기가 막힌다', async () => {
  setup()
  await openCreate()
  expect(screen.queryByRole('button', { name: '품목 1 빼기' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '품목 더하기' }))
  expect(screen.getByLabelText('품목 2 이름')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '품목 1 빼기' }))
  expect(screen.queryByLabelText('품목 2 이름')).toBeNull()
  for (let count = 1; count < PURCHASE_ITEMS_MAX; count += 1)
    fireEvent.click(screen.getByRole('button', { name: '품목 더하기' }))
  expect(screen.getAllByRole('group', { name: /^품목 \d+$/ })).toHaveLength(PURCHASE_ITEMS_MAX)
  expect(
    asElement(screen.getByRole('button', { name: '품목 더하기' }), HTMLButtonElement).disabled,
  ).toBe(true)
})

test('링크, 수량, 날짜, 내용을 요청에 담고, 쓸 수 없는 값이면 [내기]가 꺼진다', async () => {
  const { api } = setup()
  api.on('POST', BASE, () => json({ request: purchaseDetail() }, 201))
  await openCreate()
  fill('제목', '포스터')
  fill('품목 1 이름', 'A2 포스터')
  fill('품목 1 수량', '3')
  fill('품목 1 링크', 'javascript:alert(1)')
  expect(submit().disabled).toBe(true)
  fill('품목 1 링크', 'https://example.com/p')
  fill('품목 1 옵션', '무광')
  fill('필요한 때', '2026-10-30')
  fill('내용', '행사용')
  fill('품목 1 수량', '0')
  expect(submit().disabled).toBe(true)
  fill('품목 1 수량', '3')
  fireEvent.click(submit())
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(api.calls.find(call => call.method === 'POST')?.body).toEqual({
    title: '포스터',
    body: '행사용',
    neededBy: '2026-10-30',
    items: [{ name: 'A2 포스터', quantity: 3, link: 'https://example.com/p', options: '무광' }],
  })
})

test('보내는 동안 막히고 두 번 눌러도 한 번만 간다', async () => {
  const { api } = setup()
  const pending = deferredResponse()
  api.on('POST', BASE, () => pending.promise)
  await openCreate()
  fill('제목', '테이프')
  fill('품목 1 이름', '테이프')
  fireEvent.click(submit())
  await waitFor(() => expect(submit().disabled).toBe(true))
  fireEvent.submit(screen.getByRole('form', { name: '구매 요청 내기' }))
  pending.resolve(json({ request: purchaseDetail() }, 201))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(api.calls.filter(call => call.method === 'POST')).toHaveLength(1)
})

test('너무 빨리 보내면(429) 문구가 보이고 입력은 그대로 있다', async () => {
  const { api } = setup()
  api.on('POST', BASE, () => json({ error: 'TOO_MANY_REQUESTS' }, 429))
  await openCreate()
  fill('제목', '테이프')
  fill('품목 1 이름', '테이프')
  fireEvent.click(submit())
  expect(
    await screen.findByText('너무 빨리 보내고 있어요. 잠시 뒤에 다시 시도해 주세요.'),
  ).toBeTruthy()
  expect(asElement(screen.getByLabelText('제목'), HTMLInputElement).value).toBe('테이프')
})

test('내다가 권한을 잃으면(403) 학생회를 다시 읽게 하고 이유를 보인다', async () => {
  const { api, handlers } = setup()
  api.on('POST', BASE, () => json({ error: 'FORBIDDEN' }, 403))
  await openCreate()
  fill('제목', '테이프')
  fill('품목 1 이름', '테이프')
  fireEvent.click(submit())
  await waitFor(() => expect(handlers.onForbidden).toHaveBeenCalled())
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect((await screen.findByRole('alert')).textContent).toMatch(/권한이 바뀌었어요/)
})

test('카드를 누르면 상세에 요청, 품목, 결재 이력, 이력이 보인다', async () => {
  setup()
  fireEvent.click(await screen.findByRole('button', { name: '요청 r1' }))
  const dialog = await screen.findByRole('dialog')
  await within(dialog).findByText('10월 말 행사용이에요.')
  expect(within(dialog).getByText('행사 포스터 인쇄')).toBeTruthy()
  expect(within(dialog).getByText('A2 포스터 × 3')).toBeTruthy()
  expect(within(dialog).getByText('12,000원')).toBeTruthy()
  expect(within(dialog).getByText('행사 홍보')).toBeTruthy()
  const link = within(dialog).getByRole('link', { name: 'https://example.com/poster' })
  expect(link.getAttribute('target')).toBe('_blank')
  expect(link.getAttribute('rel')).toBe('noopener noreferrer')
  expect(within(dialog).getByText(/이재정 · 10월 21일 14:03 · 반려: 이미 있어요/)).toBeTruthy()
  expect(within(dialog).getByText('김회장 · 10월 20일 14:03 · 요청함')).toBeTruthy()
})

test('결제한 품목에는 결제함이 보인다', async () => {
  const detail = purchaseDetail()
  setup({ ...detail, items: detail.items.map(item => ({ ...item, paid: item.id === 'i2' })) })
  fireEvent.click(await screen.findByRole('button', { name: '요청 r1' }))
  expect(await screen.findByText('결제함')).toBeTruthy()
})

test('[요청 취소]는 동작에 있을 때만 보이고 확인을 거치며, 취소하면 목록과 수를 다시 읽는다', async () => {
  const { api, handlers } = setup()
  let reads = 0
  api.on('GET', `${BASE}/r1`, () => {
    reads += 1
    return json({
      request: purchaseDetail('r1', reads > 1 ? { status: 'cancelled', actions: [] } : {}),
    })
  })
  const pending = deferredResponse()
  api.on('POST', `${BASE}/r1/cancel`, () => pending.promise)
  fireEvent.click(await screen.findByRole('button', { name: '요청 r1' }))
  fireEvent.click(await screen.findByRole('button', { name: '요청 취소' }))
  expect(api.calls.some(call => call.method === 'POST')).toBe(false)
  const confirm = await screen.findByRole('button', { name: '취소하기' })
  fireEvent.click(confirm)
  fireEvent.click(confirm)
  pending.resolve(new Response(null, { status: 204 }))
  await waitFor(() => expect(screen.queryByRole('button', { name: '요청 취소' })).toBeNull())
  expect(api.calls.filter(call => call.method === 'POST')).toHaveLength(1)
  expect(api.calls.find(call => call.method === 'POST')?.body).toEqual({})
  expect(handlers.onChanged).toHaveBeenCalled()
})

test('동작에 purchase.cancel이 없으면 [요청 취소]가 없다', async () => {
  setup(purchaseDetail('r1', { actions: [] }))
  fireEvent.click(await screen.findByRole('button', { name: '요청 r1' }))
  await screen.findByText('A2 포스터 × 3')
  expect(screen.queryByRole('button', { name: '요청 취소' })).toBeNull()
})

test('이미 결재가 시작됐으면(409) 이유를 보이고 요청을 다시 읽는다', async () => {
  const { api } = setup()
  let reads = 0
  api.on('GET', `${BASE}/r1`, () => {
    reads += 1
    return json({ request: purchaseDetail('r1', reads > 1 ? { actions: [] } : {}) })
  })
  api.on('POST', `${BASE}/r1/cancel`, () => json({ error: 'REQUEST_CLOSED' }, 409))
  fireEvent.click(await screen.findByRole('button', { name: '요청 r1' }))
  fireEvent.click(await screen.findByRole('button', { name: '요청 취소' }))
  fireEvent.click(await screen.findByRole('button', { name: '취소하기' }))
  expect(await screen.findByText(/이미 결재가 시작됐거나 취소된 요청/)).toBeTruthy()
  expect(screen.getByRole('dialog', { name: '행사 포스터 인쇄' })).toBeTruthy()
  expect(reads).toBeGreaterThan(1)
})

test('취소가 너무 빠르면(429) 확인 안에 문구가 보인다', async () => {
  const { api } = setup()
  api.on('POST', `${BASE}/r1/cancel`, () => json({ error: 'TOO_MANY_REQUESTS' }, 429))
  fireEvent.click(await screen.findByRole('button', { name: '요청 r1' }))
  fireEvent.click(await screen.findByRole('button', { name: '요청 취소' }))
  fireEvent.click(await screen.findByRole('button', { name: '취소하기' }))
  const alert = await screen.findByRole('alert')
  expect(alert.textContent).toMatch(/너무 빨리 보내고 있어요/)
  // 확인을 닫으면 실패 문구도 사라진다.
  fireEvent.click(screen.getByRole('button', { name: '취소' }))
  await waitFor(() =>
    expect(screen.queryByRole('dialog', { name: '이 요청을 취소할까요?' })).toBeNull(),
  )
  expect(screen.queryByText(/너무 빨리 보내고 있어요/)).toBeNull()
})

test('열 때 요청이 없으면(404) 대화상자를 닫고 이유를 보인다', async () => {
  const { api } = setup()
  api.on('GET', `${BASE}/r1`, () => json({ error: 'NOT_FOUND' }, 404))
  fireEvent.click(await screen.findByRole('button', { name: '요청 r1' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect((await screen.findByRole('alert')).textContent).toBe(PURCHASE_LOST)
})

test('취소하다 권한을 잃으면(403) 학생회를 다시 읽게 하고 대화상자를 닫는다', async () => {
  const { api, handlers } = setup()
  api.on('POST', `${BASE}/r1/cancel`, () => json({ error: 'FORBIDDEN' }, 403))
  fireEvent.click(await screen.findByRole('button', { name: '요청 r1' }))
  fireEvent.click(await screen.findByRole('button', { name: '요청 취소' }))
  fireEvent.click(await screen.findByRole('button', { name: '취소하기' }))
  await waitFor(() => expect(handlers.onForbidden).toHaveBeenCalled())
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
})

test('상세를 못 읽으면 다시 시도를 보인다', async () => {
  const { api } = setup()
  let attempts = 0
  api.on('GET', `${BASE}/r1`, () => {
    attempts += 1
    return attempts === 1 ? json({ error: 'INTERNAL' }, 500) : json({ request: purchaseDetail() })
  })
  fireEvent.click(await screen.findByRole('button', { name: '요청 r1' }))
  fireEvent.click(await screen.findByRole('button', { name: '다시 시도' }))
  expect(await screen.findByText('A2 포스터 × 3')).toBeTruthy()
})
