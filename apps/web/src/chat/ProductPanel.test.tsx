// @vitest-environment jsdom
import { useState } from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ChatMessage, ProductInfo, ProductInfoResponse } from '@vada/contracts'
import { message, messagePage, room } from '@/test-support/chat-fixtures'
import { chatBase, openAllRoom, serveChat } from '@/test-support/chat-harness'
import { councilView, MEMBER_PERMISSIONS } from '@/test-support/council-fixtures'
import { deferredResponse, json } from '@/test-support/mock-api'
import { purchaseDetail } from '@/test-support/purchase-fixtures'
import { PURCHASE_ERRORS } from '@/lib/messages'
import { resetWindowHistory, windowHistoryIdle } from '@/lib/use-window-history'
import { useTeam } from '../team/useTeam'
import ChatPage, { type Screen } from './ChatPage'
import DirectPanel from './DirectPanel'
import { DirectOpenContext } from './direct-open'
import { ProductOpenContext, useProductPanel } from './product-open'
import ProductPanel from './ProductPanel'
import { resetDrafts } from './composer-drafts'
import { useDirectPanel } from './useDirectPanel'
import { useRoomList } from './useRoomList'

beforeEach(() => {
  resetDrafts()
  resetWindowHistory()
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const COUPANG = 'https://www.coupang.com/vp/products/7334523?itemId=18698271'
const OTHER = 'https://example.com/a'
const MSG = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const PRODUCT: ProductInfo = {
  name: '모나미 네임펜 12색',
  items: [
    { itemId: '18698271', name: '12색 1세트', price: 9900, listPrice: 12000 },
    { itemId: '18698272', name: '24색 1세트', price: 17800, listPrice: 17800 },
  ],
  selectedItemId: '18698271',
  shipping: '무료배송',
  deliveryEta: '내일(화) 도착',
  rocket: true,
}
const LOADED: ProductInfoResponse = { product: PRODUCT, reason: null }
const PRODUCT_PATH = `${chatBase}/product-info`
const SOURCE_USED = PURCHASE_ERRORS.SOURCE_MESSAGE_USED!

// 작업 공간처럼 오른쪽 자리 하나에 1:1 또는 상품 정보를 둔다(상품 정보가 위).
function Harness() {
  const team = useTeam('c1', () => {})
  const rooms = useRoomList('c1', () => {}, true)
  const [view] = useState(() => councilView('c1', { permissions: MEMBER_PERMISSIONS }))
  const [screenOf, setScreen] = useState<Screen>({ kind: 'list' })
  const page = { councilId: 'c1', view, team, rooms, onForbidden: () => {} }
  const full = { ...page, onOpenRequest: () => {} }
  const direct = useDirectPanel(page)
  const product = useProductPanel()
  return (
    <DirectOpenContext value={direct.opener}>
      <ProductOpenContext value={product.open}>
        <ChatPage
          {...full}
          screen={screenOf}
          onScreen={setScreen}
          onBack={() => setScreen({ kind: 'list' })}
        />
        {product.target ? (
          <ProductPanel page={full} target={product.target} onClose={product.close} />
        ) : (
          direct.target && <DirectPanel page={full} target={direct.target} onClose={direct.close} />
        )}
      </ProductOpenContext>
    </DirectOpenContext>
  )
}

function serve(sent: ChatMessage[], answer: () => Response | Promise<Response>) {
  const api = serveChat()
  api.on('GET', `${chatBase}/rooms/r1/messages`, () => json(messagePage(sent)))
  api.on('GET', `${chatBase}/events`, () => json({ events: [], truncated: false }))
  api.on('GET', `${chatBase}/tasks?view=mine&status=open`, () =>
    json({ tasks: [], truncated: false }),
  )
  api.on('POST', PRODUCT_PATH, answer)
  return api
}

const panel = () => screen.getByRole('complementary', { name: '상품 정보' })
const openLink = async (url = COUPANG) => {
  render(<Harness />)
  await openAllRoom()
  const link = await screen.findByRole('link', { name: url })
  fireEvent.click(link)
  return link
}

// 022 정한 것 20: 쿠팡 상품 링크는 패널을 열고 불러온 정보를 보인다.
test('쿠팡 상품 링크를 누르면 상품 정보 패널이 열려 불러온 이름·판매 단위·배송·로켓을 보인다', async () => {
  const api = serve([message(MSG, `이거 사요 ${COUPANG}`)], () => json(LOADED))
  await openLink()
  const box = within(panel())
  expect(box.getByRole('heading', { name: '상품 정보' })).toBeTruthy()
  expect(await box.findByText('불러온 정보')).toBeTruthy()
  expect(box.getByText('모나미 네임펜 12색')).toBeTruthy()
  const units = within(box.getByRole('list', { name: '판매 단위' })).getAllByRole('listitem')
  expect(units.map(unit => unit.textContent)).toEqual([
    '12색 1세트9,900원정가 12,000원',
    '24색 1세트17,800원',
  ])
  expect(box.getByText('무료배송')).toBeTruthy()
  expect(box.getByText('내일(화) 도착')).toBeTruthy()
  expect(box.getByText('로켓배송')).toBeTruthy()
  const shop = box.getByRole('link', { name: '쿠팡에서 열기' })
  expect(shop.getAttribute('href')).toBe(COUPANG)
  expect(shop.getAttribute('target')).toBe('_blank')
  expect(box.getByRole('button', { name: '구매 요청 만들기' })).toBeTruthy()
  const calls = api.calls.filter(call => call.path === PRODUCT_PATH)
  expect(calls.map(call => call.body)).toEqual([{ url: COUPANG }])
})

test('불러오는 동안 자리 표시가 있고 요청 버튼은 아직 없다', async () => {
  const pending = deferredResponse()
  serve([message(MSG, COUPANG)], () => pending.promise)
  await openLink()
  expect(within(panel()).getByText('상품 정보 불러오는 중…')).toBeTruthy()
  expect(within(panel()).queryByRole('button', { name: '구매 요청 만들기' })).toBeNull()
  expect(within(panel()).getByRole('link', { name: '쿠팡에서 열기' })).toBeTruthy()
  pending.resolve(json(LOADED))
  expect(await within(panel()).findByText('모나미 네임펜 12색')).toBeTruthy()
})

test('불러오지 못하면 상품 정보 없음과 쿠팡에서 열기만 있다', async () => {
  serve([message(MSG, COUPANG)], () => json({ product: null, reason: 'unavailable' }))
  await openLink()
  const box = within(panel())
  expect(await box.findByText('상품 정보 없음')).toBeTruthy()
  expect(box.getByRole('link', { name: '쿠팡에서 열기' })).toBeTruthy()
  expect(box.queryByRole('button', { name: '구매 요청 만들기' })).toBeNull()
  expect(box.queryByText('불러온 정보')).toBeNull()
})

test('쿠팡 상품 주소가 아닌 링크는 패널을 열지 않고 새 탭 링크 그대로다', async () => {
  const api = serve([message(MSG, `참고 ${OTHER} 그리고 https://link.coupang.com/a/b`)], () =>
    json(LOADED),
  )
  render(<Harness />)
  await openAllRoom()
  for (const name of [OTHER, 'https://link.coupang.com/a/b']) {
    const link = await screen.findByRole('link', { name })
    expect(link.getAttribute('target')).toBe('_blank')
    expect(fireEvent.click(link)).toBe(true)
  }
  expect(screen.queryByRole('complementary', { name: '상품 정보' })).toBeNull()
  expect(api.calls.some(call => call.path === PRODUCT_PATH)).toBe(false)
})

// 패널의 [구매 요청 만들기]는 그 메시지를 근거로 내고, 낸 요청이 메시지 아래에 바로 보인다.
test('패널에서 낸 구매 요청은 그 메시지를 근거로 하고 메시지 아래에 기록이 생긴다', async () => {
  const api = serve([message(MSG, `현수막 사 주세요 ${COUPANG}`)], () => json(LOADED))
  api.on('POST', `${chatBase}/purchase-requests`, () =>
    json({ request: purchaseDetail('r7', { title: '현수막 사 주세요' }) }, 201),
  )
  await openLink()
  fireEvent.click(await within(panel()).findByRole('button', { name: '구매 요청 만들기' }))
  const form = await screen.findByRole('form', { name: '구매 요청 내기' })
  fireEvent.change(within(form).getByLabelText('품목 1 이름'), { target: { value: '네임펜' } })
  fireEvent.click(within(form).getByRole('button', { name: '내기' }))
  const records = await screen.findByRole('list', { name: '이 메시지로 만든 기록' })
  expect(within(records).getByRole('button').textContent).toBe('구매 요청 · 현수막 사 주세요')
  const sent = api.calls.find(call => call.path === `${chatBase}/purchase-requests`)
  expect(sent?.body).toMatchObject({ sourceMessageId: MSG })
  // 막 낸 요청은 안내의 [재정에서 보기]가 열고, 같은 메시지로 다시 만드는 버튼은 없다.
  expect(within(panel()).queryByRole('button', { name: '구매 요청 만들기' })).toBeNull()
  expect(within(panel()).getByRole('button', { name: '재정에서 보기' })).toBeTruthy()
})

test('그 메시지로 낸 요청이 막고 있으면 패널의 버튼은 구매 요청 보기다', async () => {
  const made = [{ kind: 'purchase_request' as const, id: 'r3', title: '앞 요청', blocking: true }]
  serve([message(MSG, COUPANG, { made })], () => json(LOADED))
  await openLink()
  fireEvent.click(await within(panel()).findByRole('button', { name: '구매 요청 보기' }))
  // 패널이 쓰던 방문 기록 칸을 거둔 뒤에 주소를 쌓는다(use-window-history).
  await waitFor(() => expect(window.location.pathname).toContain('r3'))
  expect(within(panel()).queryByRole('button', { name: '구매 요청 만들기' })).toBeNull()
})

// 오른쪽 자리는 하나: 상품 정보가 1:1 위에 덮이고, Esc로 닫으면 1:1로 돌아가 그 머리에 포커스가 간다(와이어프레임 P-15).
test('상품 정보는 열린 1:1 위에 덮이고 Esc로 닫으면 1:1로 돌아간다', async () => {
  const api = serve([message(MSG, COUPANG)], () => json(LOADED))
  api.on('POST', `${chatBase}/direct`, () => json({ roomId: 'dm2' }))
  api.on('GET', `${chatBase}/rooms/dm2`, () =>
    json({
      room: room('dm2', { type: 'direct', name: '이재정', memberCount: 2 }),
      participants: [{ memberId: 'm2', name: '이재정' }],
    }),
  )
  api.on('GET', `${chatBase}/rooms/dm2/messages`, () => json(messagePage([])))
  api.on('POST', `${chatBase}/rooms/dm2/read`, () => new Response(null, { status: 204 }))
  render(<Harness />)
  await openAllRoom()
  fireEvent.click(await screen.findByRole('button', { name: '이재정 1:1 대화' }))
  await screen.findByRole('complementary', { name: '이재정 1:1 대화' })
  const link = screen.getByRole('link', { name: COUPANG })
  link.focus()
  fireEvent.click(link)
  expect(screen.queryByRole('complementary', { name: '이재정 1:1 대화' })).toBeNull()
  await within(panel()).findByText('모나미 네임펜 12색')
  expect(document.activeElement?.textContent).toBe('상품 정보')
  fireEvent.keyDown(within(panel()).getByRole('heading'), { key: 'Escape' })
  expect(screen.queryByRole('complementary', { name: '상품 정보' })).toBeNull()
  const direct = screen.getByRole('complementary', { name: '이재정 1:1 대화' })
  await waitFor(() =>
    expect(document.activeElement).toBe(within(direct).getByRole('heading', { name: '이재정' })),
  )
})

test('1:1 없이 연 상품 정보를 닫으면 연 링크로 포커스가 돌아간다', async () => {
  serve([message(MSG, COUPANG)], () => json(LOADED))
  render(<Harness />)
  await openAllRoom()
  const link = await screen.findByRole('link', { name: COUPANG })
  link.focus()
  fireEvent.click(link)
  fireEvent.click(within(panel()).getByRole('button', { name: '닫기' }))
  expect(screen.queryByRole('complementary', { name: '상품 정보' })).toBeNull()
  expect(document.activeElement).toBe(link)
})

// 휴대폰 전체 화면 패널은 뒤로 가기로 닫힌다(DEC-78 이동 4, 창의 방문 기록 칸).
test('뒤로 가기는 앱을 떠나지 않고 상품 정보 패널을 닫는다', async () => {
  serve([message(MSG, COUPANG)], () => json(LOADED))
  await openLink()
  await windowHistoryIdle()
  window.history.back()
  await waitFor(() => expect(screen.queryByRole('complementary', { name: '상품 정보' })).toBeNull())
  expect(screen.getByRole('link', { name: COUPANG })).toBeTruthy()
})

// 그사이 다른 사람이 같은 메시지로 요청을 냈으면 409 문구가 [내기] 바로 위에 보이고 입력은 남는다.
test('같은 메시지로 이미 낸 요청이 있으면 409 문구가 내기 버튼 곁에 보인다', async () => {
  const api = serve([message(MSG, COUPANG)], () => json(LOADED))
  api.on('POST', `${chatBase}/purchase-requests`, () => json({ error: 'SOURCE_MESSAGE_USED' }, 409))
  await openLink()
  fireEvent.click(await within(panel()).findByRole('button', { name: '구매 요청 만들기' }))
  const form = await screen.findByRole('form', { name: '구매 요청 내기' })
  fireEvent.change(within(form).getByLabelText('제목'), { target: { value: '네임펜' } })
  fireEvent.change(within(form).getByLabelText('품목 1 이름'), { target: { value: '네임펜' } })
  fireEvent.click(within(form).getByRole('button', { name: '내기' }))
  const alert = await within(form).findByText(SOURCE_USED)
  const footer = within(form).getByRole('button', { name: '내기' }).parentElement
  expect(alert.nextElementSibling).toBe(footer)
  expect(within(form).getByLabelText<HTMLInputElement>('품목 1 이름').value).toBe('네임펜')
})
