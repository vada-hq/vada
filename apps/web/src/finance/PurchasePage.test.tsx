// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { WON_MAX, type ProductInfo } from '@vada/contracts'
import { navigate, pageState } from '@/lib/app-location'
import { hasUnsavedInput } from '@/lib/leave-guard'
import { resetAddress } from '@/test-support/address-reset'
import { councilView, MEMBER_PERMISSIONS } from '@/test-support/council-fixtures'
import { COUNCIL_ID as C, PurchasesAt } from '@/test-support/finance-at'
import { deferredResponse, json, mockApi } from '@/test-support/mock-api'
import { PURCHASE_ERRORS } from '@/lib/messages'
import { purchaseDetail } from '@/test-support/purchase-fixtures'
import { taskDetail } from '@/test-support/task-detail-fixtures'
import { ProductPreview } from './ProductPreview'
import { RequestProductInfo } from './RequestProductInfo'

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

test.each([
  ['unsupported', '쿠팡 상품 주소만 불러올 수 있어요.'],
  ['not_found', '쿠팡에서 찾을 수 없는 상품이에요. 직접 적어 주세요.'],
  ['unavailable', '지금은 불러올 수 없어요. 직접 적어 주세요.'],
])('품목 불러오기 실패 %s는 까닭을 보이고 직접 적은 값을 유지한다', async (reason, text) => {
  const api = setup()
  api.on('POST', `${BASE}/product-info`, () => json({ product: null, reason }))
  open()
  fill('품목 1 이름', '직접 적은 펜')
  fill('품목 1 수량', '3')
  fill('품목 1 링크', reason === 'unsupported' ? 'https://example.com/item' : LINK)
  fireEvent.click(screen.getByRole('button', { name: '불러오기' }))
  expect(await screen.findByText(text)).toBeTruthy()
  expect(screen.getByLabelText<HTMLInputElement>('품목 1 이름').value).toBe('직접 적은 펜')
  expect(screen.getByLabelText<HTMLInputElement>('품목 1 수량').value).toBe('3')
  fill('품목 1 링크', 'https://example.com/next')
  expect(screen.queryByText(text)).toBeNull()
  api.assertNoUnexpectedRequests()
})

test.each([
  ['not_found', '쿠팡에서 찾을 수 없는 상품이에요.'],
  ['unavailable', '지금은 불러올 수 없어요.'],
])('구매 요청 보기 실패 %s는 남은 품목 정보로 확인하도록 안내한다', async (reason, text) => {
  const api = mockApi()
  api.on('POST', `${BASE}/product-info`, () => json({ product: null, reason }))
  render(<RequestProductInfo councilId={C} link={LINK} />)
  expect(await screen.findByText(`${text} 요청에 남은 품목 정보로 확인해 주세요.`)).toBeTruthy()
  expect(screen.queryByText(/직접 적어 주세요/)).toBeNull()
  api.assertNoUnexpectedRequests()
})

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

test.each([
  {
    where: '단가 × 수량이 넘으면 단가 칸',
    failed: '품목 1 예상 단가',
    shipping: '',
    quantity: '2',
  },
  {
    where: '배송비를 더해 넘으면 배송비 칸',
    failed: '품목 1 예상 배송비',
    shipping: '1',
    quantity: '1',
  },
])('예상 금액: $where에 알리고 보내지 않는다', async ({ failed, shipping, quantity }) => {
  const api = setup()
  open()
  fill('제목', '현수막')
  fill('품목 1 이름', '현수막')
  fill('품목 1 수량', quantity)
  fill('품목 1 예상 단가', String(WON_MAX))
  fill('품목 1 예상 배송비', shipping)
  fireEvent.click(screen.getByRole('button', { name: '내기' }))
  const field = screen.getByLabelText(failed)
  expect(screen.getAllByText('더 작은 값을 입력해 주세요')).toHaveLength(1)
  expect(screen.queryByText('더 짧게 입력해 주세요')).toBeNull()
  expect(field.getAttribute('aria-invalid')).toBe('true')
  await waitFor(() => expect(document.activeElement).toBe(field))
  expect(api.calls.some(call => call.method === 'POST')).toBe(false)
})

// 명령 번호: 초안이 남아 있는 동안의 재시도는 같은 번호이고, 새로 쓰는 요청은 값이 같아도 새 번호다.
const REQUESTS = `${BASE}/purchase-requests`
const postedIds = (api: ReturnType<typeof setup>) =>
  api.calls
    .filter(call => call.method === 'POST' && call.path === REQUESTS)
    .map(call => (call.body as { commandId: string }).commandId)
const write = () => {
  fill('제목', '테이프')
  fill('품목 1 이름', '박스 테이프')
}
async function press(api: ReturnType<typeof setup>) {
  const before = postedIds(api).length
  fireEvent.click(screen.getByRole('button', { name: '내기' }))
  await waitFor(() => expect(postedIds(api).length).toBe(before + 1))
}
const whenFree = () =>
  waitFor(() =>
    expect(screen.getByRole<HTMLButtonElement>('button', { name: '내기' }).disabled).toBe(false),
  )

test('응답을 잃고 새로고침해도 초안이 남아 있으면 같은 번호로 다시 보낸다', async () => {
  const api = setup()
  api.on('POST', REQUESTS, () => json({ error: 'FAILED' }, 500))
  const first = open()
  write()
  await press(api)
  await whenFree()
  first.unmount()
  render(<PurchasesAt view={view} onForbidden={() => {}} />)
  await press(api)
  const [sent, resent] = postedIds(api)
  expect(resent).toBe(sent)
})

test('보내는 중에 새로고침해도 같은 번호다', async () => {
  const api = setup()
  const pending = deferredResponse()
  api.on('POST', REQUESTS, () => pending.promise)
  const first = open()
  write()
  await press(api)
  first.unmount()
  render(<PurchasesAt view={view} onForbidden={() => {}} />)
  pending.resolve(json({ error: 'FAILED' }, 500))
  await press(api)
  const [sent, resent] = postedIds(api)
  expect(resent).toBe(sent)
})

test('초안을 고치면 새 번호다', async () => {
  const api = setup()
  api.on('POST', REQUESTS, () => json({ error: 'FAILED' }, 500))
  open()
  write()
  await press(api)
  await whenFree()
  fill('품목 1 수량', '2')
  await press(api)
  const [sent, edited] = postedIds(api)
  expect(edited).not.toBe(sent)
})

test('낸 뒤 새로 쓰는 요청은 값이 같아도 새 번호다', async () => {
  const api = setup()
  api.on('POST', REQUESTS, () => json({ request: purchaseDetail(REQUEST) }, 201))
  const first = open()
  write()
  await press(api)
  await screen.findByRole('heading', { name: '행사 포스터 인쇄' })
  first.unmount()
  open()
  write()
  await press(api)
  const [sent, fresh] = postedIds(api)
  expect(fresh).not.toBe(sent)
})

test('작성을 나갔다가 새로 열면 값이 같아도 새 번호다', async () => {
  const api = setup()
  api.on('POST', REQUESTS, () => json({ error: 'FAILED' }, 500))
  const first = open()
  write()
  await press(api)
  await whenFree()
  first.unmount()
  open()
  write()
  await press(api)
  const [sent, fresh] = postedIds(api)
  expect(fresh).not.toBe(sent)
})

test('422 COMMAND_REUSED는 문구를 보이고 새로고침해도 다음에는 새 번호를 보낸다', async () => {
  const api = setup()
  api.on('POST', REQUESTS, () => json({ error: 'COMMAND_REUSED' }, 422))
  const first = open()
  write()
  await press(api)
  expect(await screen.findByText(PURCHASE_ERRORS.COMMAND_REUSED!)).toBeTruthy()
  first.unmount()
  render(<PurchasesAt view={view} onForbidden={() => {}} />)
  await press(api)
  const [sent, fresh] = postedIds(api)
  expect(fresh).not.toBe(sent)
})

test('409 COMMAND_CONFLICT는 같은 번호로 다시 보낼 수 있다', async () => {
  const api = setup()
  api.on('POST', REQUESTS, () => json({ error: 'COMMAND_CONFLICT' }, 409))
  open()
  write()
  await press(api)
  expect(await screen.findByText(PURCHASE_ERRORS.COMMAND_CONFLICT!)).toBeTruthy()
  await press(api)
  const [sent, resent] = postedIds(api)
  expect(resent).toBe(sent)
})
