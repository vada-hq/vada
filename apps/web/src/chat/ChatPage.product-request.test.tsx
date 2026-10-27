// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ProductInfo } from '@vada/contracts'
import { message, messagePage } from '@/test-support/chat-fixtures'
import { chatBase, ChatHarness, openAllRoom, serveChat } from '@/test-support/chat-harness'
import { deferredResponse, json } from '@/test-support/mock-api'
import { resetAddress } from '@/test-support/address-reset'
import { resetWindowHistory } from '@/lib/use-window-history'
import { purchaseDetail } from '@/test-support/purchase-fixtures'

afterEach(async () => {
  cleanup()
  vi.unstubAllGlobals()
  resetWindowHistory()
  await resetAddress()
})

const LINK = 'https://www.coupang.com/vp/products/7334523?itemId=18698271'
const MSG = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const PURCHASE = `${chatBase}/purchase-requests`
const PRODUCT: ProductInfo = {
  name: '행사 부스용 네임펜',
  items: [{ itemId: '18698271', name: '네임펜 12색 1세트', price: 9900, listPrice: 12000 }],
  selectedItemId: '18698271',
  shipping: '무료배송',
  deliveryEta: null,
  rocket: true,
}

function serve(product: ProductInfo | null = PRODUCT) {
  const api = serveChat()
  api.on('GET', `${chatBase}/rooms/r1/messages`, () =>
    json(messagePage([message(MSG, `부스 준비물 부탁해요\n${LINK}`)])),
  )
  api.on('GET', `${chatBase}/events`, () => json({ events: [], truncated: false }))
  api.on('GET', `${chatBase}/tasks?view=mine&status=open`, () =>
    json({ tasks: [], truncated: false }),
  )
  api.on('POST', `${chatBase}/product-info`, () =>
    json(product ? { product, reason: null } : { product: null, reason: 'unavailable' }),
  )
  api.on('POST', PURCHASE, () => json({ request: purchaseDetail('r7') }, 201))
  return api
}

async function openFromMenu() {
  render(<ChatHarness />)
  await openAllRoom()
  fireEvent.keyDown(await screen.findByRole('button', { name: '메시지 동작' }), { key: 'Enter' })
  fireEvent.click(await screen.findByRole('menuitem', { name: '구매 요청 만들기' }))
  return screen.findByRole('form', { name: '구매 요청 내기' })
}

test('메시지로 연 요청은 링크를 보존하고 조회 실패 때도 직접 적어 원문에 연결해 제출한다', async () => {
  const api = serve(null)
  const form = within(await openFromMenu())
  expect(form.getByLabelText<HTMLInputElement>('품목 1 링크').value).toBe(LINK)
  fireEvent.change(form.getByLabelText('품목 1 이름'), { target: { value: '직접 적은 품목' } })
  fireEvent.click(form.getByRole('button', { name: '내기' }))
  await waitFor(() => expect(api.calls.some(call => call.path === PURCHASE)).toBe(true))
  expect(api.calls.find(call => call.path === PURCHASE)?.body).toMatchObject({
    sourceMessageId: MSG,
    items: [{ name: '직접 적은 품목', link: LINK, quantity: 1 }],
  })
})

test('쿠팡 상품 패널에서 선택한 이름과 링크가 실제 양식에 채워지고 수정한 값만 제출한다', async () => {
  const api = serve()
  render(<ChatHarness />)
  await openAllRoom()
  fireEvent.click(await screen.findByRole('link', { name: LINK }))
  const panel = within(await screen.findByRole('complementary', { name: '상품 정보' }))
  fireEvent.click(await panel.findByRole('button', { name: '구매 요청 만들기' }))
  const form = within(await screen.findByRole('form', { name: '구매 요청 내기' }))
  expect(form.getByLabelText<HTMLInputElement>('품목 1 이름').value).toBe('네임펜 12색 1세트')
  expect(form.getByLabelText<HTMLInputElement>('품목 1 링크').value).toBe(LINK)
  fireEvent.change(form.getByLabelText('품목 1 이름'), {
    target: { value: '부스 안내판용 네임펜' },
  })
  fireEvent.change(form.getByLabelText('품목 1 수량'), { target: { value: '2' } })
  fireEvent.click(form.getByRole('button', { name: '내기' }))
  await waitFor(() => expect(api.calls.some(call => call.path === PURCHASE)).toBe(true))
  const posted = api.calls.find(call => call.path === PURCHASE)?.body
  expect(posted).toMatchObject({
    sourceMessageId: MSG,
    items: [{ name: '부스 안내판용 네임펜', link: LINK, quantity: 2 }],
  })
  expect(posted).not.toHaveProperty('items.0.price')
  expect(posted).not.toHaveProperty('items.0.loadedPrice')
})

test('메시지 메뉴에서도 상품명을 채우며 늦게 불러온 정보가 직접 고친 이름을 덮지 않는다', async () => {
  const api = serve()
  const pending = deferredResponse()
  api.on('POST', `${chatBase}/product-info`, () => pending.promise)
  const form = within(await openFromMenu())
  await waitFor(() =>
    expect(api.calls.filter(call => call.path === `${chatBase}/product-info`)).toHaveLength(1),
  )
  fireEvent.change(form.getByLabelText('품목 1 이름'), { target: { value: '직접 고친 이름' } })
  pending.resolve(json({ product: PRODUCT, reason: null }))
  await form.findByText('불러온 가격 9,900원')
  expect(form.getByLabelText<HTMLInputElement>('품목 1 이름').value).toBe('직접 고친 이름')
})

test('쿠팡 상품 정보를 읽지 못한 패널을 닫아도 원문에서 직접 구매 요청을 낼 수 있다', async () => {
  serve(null)
  render(<ChatHarness />)
  await openAllRoom()
  fireEvent.click(await screen.findByRole('link', { name: LINK }))
  const panel = within(await screen.findByRole('complementary', { name: '상품 정보' }))
  expect(await panel.findByText('상품 정보 없음')).toBeTruthy()
  expect(panel.getByRole('link', { name: '쿠팡에서 열기' })).toBeTruthy()
  fireEvent.click(panel.getByRole('button', { name: '닫기' }))
  fireEvent.keyDown(await screen.findByRole('button', { name: '메시지 동작' }), { key: 'Enter' })
  fireEvent.click(await screen.findByRole('menuitem', { name: '구매 요청 만들기' }))
  const form = within(await screen.findByRole('form', { name: '구매 요청 내기' }))
  expect(form.getByLabelText<HTMLInputElement>('품목 1 링크').value).toBe(LINK)
  expect(form.getByLabelText<HTMLInputElement>('품목 1 이름').value).toBe('')
})

test('메시지 메뉴로 연 요청은 불러온 품목명을 자동으로 채우고 이름·가격만 읽는다', async () => {
  const api = serve()
  const form = within(await openFromMenu())
  await waitFor(() =>
    expect(form.getByLabelText<HTMLInputElement>('품목 1 이름').value).toBe('네임펜 12색 1세트'),
  )
  expect(form.getByText('불러온 가격 9,900원')).toBeTruthy()
  expect(
    api.calls.filter(call => call.path === `${chatBase}/product-info`).map(call => call.body),
  ).toEqual([{ url: LINK }])
})

test('이미 만든 구매 요청이 있으면 상품 패널에서도 만들기 대신 보기만 제공한다', async () => {
  const api = serve()
  api.on('GET', `${chatBase}/rooms/r1/messages`, () =>
    json(
      messagePage([
        message(MSG, LINK, {
          made: [{ kind: 'purchase_request', id: 'r7', title: '네임펜', blocking: true }],
        }),
      ]),
    ),
  )
  render(<ChatHarness />)
  await openAllRoom()
  fireEvent.click(await screen.findByRole('link', { name: LINK }))
  const panel = within(await screen.findByRole('complementary', { name: '상품 정보' }))
  expect(await panel.findByRole('button', { name: '구매 요청 보기' })).toBeTruthy()
  expect(panel.queryByRole('button', { name: '구매 요청 만들기' })).toBeNull()
})

test('경합으로 이미 만든 요청이 있으면 오류를 제출 옆에 보이고 입력은 보존한다', async () => {
  const api = serve(null)
  api.on('POST', PURCHASE, () => json({ error: 'SOURCE_MESSAGE_USED' }, 409))
  const form = within(await openFromMenu())
  fireEvent.change(form.getByLabelText('품목 1 이름'), { target: { value: '직접 적은 품목' } })
  fireEvent.click(form.getByRole('button', { name: '내기' }))
  expect(
    await form.findByText(
      '이 메시지로 만든 기록이 이미 있어요. 대화에서 기존 기록을 확인해 주세요.',
    ),
  ).toBeTruthy()
  expect(form.getByLabelText<HTMLInputElement>('품목 1 이름').value).toBe('직접 적은 품목')
})
