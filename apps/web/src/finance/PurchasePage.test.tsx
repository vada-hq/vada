// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ProductInfo } from '@vada/contracts'
import { navigate, pageState } from '@/lib/app-location'
import { hasUnsavedInput } from '@/lib/leave-guard'
import { resetAddress } from '@/test-support/address-reset'
import { councilView, MEMBER_PERMISSIONS } from '@/test-support/council-fixtures'
import { COUNCIL_ID as C, PurchasesAt } from '@/test-support/finance-at'
import { deferredResponse, json, mockApi } from '@/test-support/mock-api'
import { purchaseDetail } from '@/test-support/purchase-fixtures'
import { taskDetail } from '@/test-support/task-detail-fixtures'
import { ProductPreview } from './ProductPreview'

const LINK = 'https://www.coupang.com/vp/products/100?itemId=11'
const REQUEST = '0199d1a0-0000-7000-8000-00000000a001'
const SOURCE = '0199d1a0-0000-7000-8000-0000000000a1'
const TASK = '0199d1a0-0000-7000-8000-0000000000a2'
const BASE = `/api/organizations/${C}`
const view = councilView(C, { permissions: MEMBER_PERMISSIONS })
const PRODUCT: ProductInfo = {
  name: '새내기 안내용 펜',
  selectedItemId: '11',
  items: [{ itemId: '11', name: '검정 펜 12개 1세트', price: 12000, listPrice: null }],
  shipping: '무료배송',
  deliveryEta: '내일 도착 예정',
  rocket: false,
  inStock: false,
  imageUrl: 'https://thumbnail.coupangcdn.com/pen.jpg',
  fetchedAt: '2026-10-27T01:00:00.000Z',
}

afterEach(async () => {
  cleanup()
  await resetAddress()
  vi.unstubAllGlobals()
})

function setup() {
  const api = mockApi()
  api.on('GET', `${BASE}/events`, () => json({ events: [], truncated: false }))
  api.on('GET', `${BASE}/purchase-requests/0199d1a0-0000-7000-8000-00000000a001`, () =>
    json({ request: purchaseDetail(REQUEST) }),
  )
  return api
}
function open(start: Record<string, unknown> = {}, memberId = view.me.memberId) {
  navigate(`/purchases/${C}/new`, {
    force: true,
    pageState: {
      kind: 'purchase',
      councilId: C,
      memberId,
      ...start,
    },
  })
  return render(<PurchasesAt view={view} onForbidden={() => {}} />)
}
const fill = (name: string, value: string) =>
  fireEvent.change(screen.getByLabelText(name), { target: { value } })

test('작성은 별도 주소에서 열리고 새로고침 후 입력·원문·업무 연결을 보존하며 표시용 상품 값은 보내지 않는다', async () => {
  const api = setup()
  api.on('POST', `${BASE}/product-info`, () => json({ product: PRODUCT, reason: null }))
  api.on('POST', `${BASE}/purchase-requests`, () => json({ request: purchaseDetail(REQUEST) }, 201))
  const first = open({
    taskId: TASK,
    start: {
      title: LINK,
      sourceMessageId: SOURCE,
      items: [{ name: '', link: LINK, loadedPrice: null }],
    },
  })
  await screen.findByText('품절')
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(window.location.pathname).toBe(`/purchases/${C}/new`)
  expect(screen.getByLabelText<HTMLInputElement>('제목').value).toBe(PRODUCT.items[0]?.name)
  fill('제목', '준비물 구매 요청')
  fill('품목 1 수량', '2')
  fill('품목 1 예상 단가', '13000')
  first.unmount()
  render(<PurchasesAt view={view} onForbidden={() => {}} />)
  expect(screen.getByLabelText<HTMLInputElement>('제목').value).toBe('준비물 구매 요청')
  expect(screen.getByLabelText<HTMLInputElement>('품목 1 수량').value).toBe('2')
  expect(screen.getByLabelText<HTMLInputElement>('품목 1 예상 단가').value).toBe('13000')
  fireEvent.click(screen.getByRole('button', { name: '내기' }))
  await waitFor(() =>
    expect(
      api.calls.some(call => call.method === 'POST' && call.path === `${BASE}/purchase-requests`),
    ).toBe(true),
  )
  const posted = api.calls.find(
    call => call.method === 'POST' && call.path === `${BASE}/purchase-requests`,
  )?.body
  expect(posted).toMatchObject({
    sourceMessageId: SOURCE,
    taskId: TASK,
    items: [{ estimatedUnitPrice: 13000, estimatedShippingFee: 0, quantity: 2, link: LINK }],
  })
  expect(posted).not.toHaveProperty('items.0.loadedProduct')
  expect(pageState()).toBeUndefined()
  expect(window.location.pathname).toBe(`/purchases/${C}/${REQUEST}`)
  await screen.findByRole('heading', { name: '행사 포스터 인쇄' })
})

test('메시지와 상품 조회가 저절로 채운 값만 있으면 [취소]는 묻지 않고, 사람이 고치면 묻는다', async () => {
  const api = setup()
  api.on('POST', `${BASE}/product-info`, () => json({ product: PRODUCT, reason: null }))
  open({
    start: {
      title: LINK,
      body: '새내기 안내용 펜이 필요해요',
      sourceMessageId: SOURCE,
      items: [{ name: '', link: LINK, loadedPrice: null }],
    },
  })
  await screen.findByText('품절')
  expect(screen.getByLabelText<HTMLInputElement>('제목').value).toBe(PRODUCT.items[0]?.name)
  expect(hasUnsavedInput()).toBe(false)
  fill('품목 1 수량', '2')
  expect(hasUnsavedInput()).toBe(true)
  fill('품목 1 수량', '1')
  expect(hasUnsavedInput()).toBe(false)
  fireEvent.click(screen.getByRole('button', { name: '취소' }))
  await waitFor(() => expect(window.location.pathname).not.toBe(`/purchases/${C}/new`))
})

test('업무만 고른 뒤 늦게 온 상품 조회는 떠날 때 묻는 기준을 옮기지 않는다', async () => {
  const api = setup()
  const pending = deferredResponse()
  api.on('POST', `${BASE}/product-info`, () => pending.promise)
  api.on('GET', `${BASE}/tasks?view=mine&status=open`, () =>
    json({ tasks: [taskDetail({ id: TASK, title: '펜 주문' })], truncated: false }),
  )
  open({
    pickTask: true,
    start: { title: LINK, items: [{ name: '', link: LINK, loadedPrice: null }] },
  })
  await screen.findByRole('option', { name: '펜 주문' })
  fireEvent.change(screen.getByLabelText('업무'), { target: { value: TASK } })
  expect(hasUnsavedInput()).toBe(true)
  pending.resolve(json({ product: PRODUCT, reason: null }))
  await screen.findByText('품절')
  expect(hasUnsavedInput()).toBe(true)
})

test('명시 조회의 늦은 응답은 직접 고친 제목·상품명·예상 단가·배송비를 덮지 않는다', async () => {
  const api = setup()
  const pending = deferredResponse()
  api.on('POST', `${BASE}/product-info`, () => pending.promise)
  open()
  fill('품목 1 링크', LINK)
  fireEvent.keyDown(screen.getByLabelText('품목 1 링크'), { key: 'Enter' })
  fill('제목', '내 제목')
  fill('품목 1 이름', '내 이름')
  fill('품목 1 예상 단가', '9000')
  fill('품목 1 예상 배송비', '2500')
  pending.resolve(json({ product: PRODUCT, reason: null }))
  await screen.findByText('품절')
  expect(screen.getByLabelText<HTMLInputElement>('제목').value).toBe('내 제목')
  expect(screen.getByLabelText<HTMLInputElement>('품목 1 이름').value).toBe('내 이름')
  expect(screen.getByLabelText<HTMLInputElement>('품목 1 예상 단가').value).toBe('9000')
  expect(screen.getByLabelText<HTMLInputElement>('품목 1 예상 배송비').value).toBe('2500')
  expect(
    within(screen.getByRole('complementary', { name: '요청 요약' })).getByText('11,500원'),
  ).toBeTruthy()
})

test.each([
  { shipping: '무료배송 ∙ 오늘출발', fee: '0', total: '12,000원' },
  { shipping: '와우는 · 무료배송 · 무료반품 · 새벽도착', fee: '', total: '미확인' },
  { shipping: '19,800원 이상 무료배송', fee: '', total: '미확인' },
])(
  '불러온 배송 문구 "$shipping"이면 배송비는 "$fee", 예상 금액은 $total',
  async ({ shipping, fee, total }) => {
    const api = setup()
    api.on('POST', `${BASE}/product-info`, () =>
      json({ product: { ...PRODUCT, shipping }, reason: null }),
    )
    open({ start: { title: LINK, items: [{ name: '', link: LINK, loadedPrice: null }] } })
    await screen.findByText('품절')
    expect(screen.getByLabelText<HTMLInputElement>('품목 1 예상 배송비').value).toBe(fee)
    expect(
      within(screen.getByRole('complementary', { name: '요청 요약' })).getByText(total),
    ).toBeTruthy()
  },
)

test.each([
  { councilId: C, memberId: 'other-member' },
  { councilId: 'other-council', memberId: view.me.memberId },
])(
  '다른 운영진·학생회의 history 초안은 표시하지 않는다: $councilId / $memberId',
  ({ councilId, memberId }) => {
    setup()
    open({ councilId, start: { title: '다른 사람의 내용' } }, memberId)
    expect(screen.getByLabelText<HTMLInputElement>('제목').value).toBe('')
  },
)

test('상품 사진이 실패하거나 허용하지 않은 주소이면 사진 없음, 재고 누락은 확인 안 됨이다', () => {
  const image = render(<ProductPreview product={PRODUCT} />)
  fireEvent.error(screen.getByRole('img'))
  expect(screen.getByText('사진 없음')).toBeTruthy()
  image.rerender(
    <ProductPreview product={{ ...PRODUCT, imageUrl: 'https://example.com/x', inStock: null }} />,
  )
  expect(screen.queryByRole('img')).toBeNull()
  expect(screen.getByText('재고 확인 안 됨')).toBeTruthy()
})

test('새 품목은 맨 위에 더하고, 지운 원본 품목의 늦은 조회는 제목이나 품목을 되살리지 않는다', async () => {
  const api = setup()
  const pending = deferredResponse()
  api.on('POST', `${BASE}/product-info`, () => pending.promise)
  open({
    start: {
      title: LINK,
      items: [
        { name: '', link: LINK, loadedPrice: null },
        { name: '남길 품목', link: 'https://example.com/item', loadedPrice: null },
      ],
    },
  })
  await waitFor(() =>
    expect(api.calls.some(call => call.path === `${BASE}/product-info`)).toBe(true),
  )
  fireEvent.click(screen.getByRole('button', { name: '품목 1 빼기' }))
  await act(async () => {
    pending.resolve(json({ product: PRODUCT, reason: null }))
  })
  expect(screen.getByLabelText<HTMLInputElement>('제목').value).toBe(LINK)
  expect(screen.getByLabelText<HTMLInputElement>('품목 1 이름').value).toBe('남길 품목')
  expect(screen.queryByText('품절')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '품목 더하기' }))
  expect(screen.getByLabelText<HTMLInputElement>('품목 1 이름').value).toBe('')
  expect(screen.getByLabelText<HTMLInputElement>('품목 2 이름').value).toBe('남길 품목')
})
