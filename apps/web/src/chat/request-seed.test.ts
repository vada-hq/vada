import { expect, test } from 'vitest'
import {
  CreatePurchaseRequestSchema,
  PURCHASE_ITEM_NAME_MAX,
  PURCHASE_ITEMS_MAX,
  PURCHASE_TITLE_MAX,
  type ProductInfo,
  type TeamMember,
} from '@vada/contracts'
import { message } from '@/test-support/chat-fixtures'
import { requestSeedOf, withLoaded } from './request-seed'

const member = (id: string): TeamMember => ({
  id,
  name: id,
  councilRank: null,
  departments: [],
  joinedAt: '2026-10-01T01:00:00.000Z',
  actions: [],
})
const members = [member('m1'), member('m2')]
const finance = { meId: 'm1', members, canAssign: true }
const plain = { meId: 'm1', members, canAssign: false }

// 계약이 받는지는 같은 스키마로 본다(숫자를 다시 적지 않는다).
const accepted = (seed: ReturnType<typeof requestSeedOf>) =>
  CreatePurchaseRequestSchema.safeParse({
    title: seed.title,
    body: seed.body === '' ? null : seed.body,
    items: [{ name: '물건', quantity: 1, link: null, options: null }],
  }).success

test('제목은 첫 줄, 내용은 본문 전체다', () => {
  const seed = requestSeedOf(message('a1', '\n  현수막 2개 사 주세요  \n색은 파랑'), finance)
  expect(seed.title).toBe('현수막 2개 사 주세요')
  expect(seed.body).toBe('현수막 2개 사 주세요  \n색은 파랑')
  expect(seed.sourceMessageId).toBe('a1')
})

test('사진만 있는 메시지는 제목과 내용이 비어 있다', () => {
  const seed = requestSeedOf(message('a1', ''), plain)
  expect(seed.title).toBe('')
  expect(seed.body).toBe('')
})

test('긴 글은 상한 안으로 자르고 이모지를 반으로 자르지 않는다', () => {
  const long = '😀'.repeat(5000)
  const seed = requestSeedOf(message('a1', long), plain)
  expect(accepted(seed)).toBe(true)
  expect(seed.title).not.toMatch(/[\ud800-\udbff](?![\udc00-\udfff])/)
  expect(seed.body).not.toMatch(/[\ud800-\udbff](?![\udc00-\udfff])/)
  expect(seed.title.length).toBeGreaterThan(0)
})

test('요청한 사람은 재정부에게만: 남의 메시지면 보낸 사람, 내 것이나 떠난 사람이나 시스템이면 나', () => {
  expect(requestSeedOf(message('a1', 'x', { senderId: 'm2' }), finance).requestedBy).toBe('m2')
  expect(requestSeedOf(message('a1', 'x', { senderId: 'm1' }), finance).requestedBy).toBe('m1')
  expect(requestSeedOf(message('a1', 'x', { senderId: 'm9' }), finance).requestedBy).toBe('m1')
  expect(requestSeedOf(message('a1', 'x', { senderId: null }), finance).requestedBy).toBe('m1')
  expect(requestSeedOf(message('a1', 'x', { senderId: 'm2' }), plain).requestedBy).toBeNull()
})

test('운영진 목록을 못 읽었으면 나로 채운다', () => {
  const seed = requestSeedOf(message('a1', 'x', { senderId: 'm2' }), { ...finance, members: null })
  expect(seed.requestedBy).toBe('m1')
})

const COUPANG = 'https://www.coupang.com/vp/products/7334523?itemId=18698271'
const OTHER = 'https://smartstore.naver.com/shop/products/9'
const product = (name: string): ProductInfo => ({
  name: '상품 전체 이름',
  items: [
    { itemId: '1', name: '파랑 1개', price: 1200, listPrice: 1500 },
    { itemId: '18698271', name, price: 9900, listPrice: null },
  ],
  selectedItemId: '18698271',
  shipping: '무료배송',
  deliveryEta: '내일 도착',
  rocket: true,
})

test('제목은 URL을 뺀 첫 글 줄이고 내용과 품목 링크는 보존한다', () => {
  const body = `  ${COUPANG}\n 간식은 ${OTHER} 이걸로 사면 어때요? ${COUPANG}  \n20명 나눠 줄 거예요`
  const seed = requestSeedOf(message('a1', body), plain)
  expect(seed.title).toBe('간식은  이걸로 사면 어때요?')
  expect(seed.body).toBe(body.trim())
  expect(seed.items.map(item => item.link)).toEqual([COUPANG, OTHER])
})

test('링크만 있으면 제목은 첫 품목 이름이고 불러온 이름이 없으면 빈 칸이다', () => {
  const body = `${COUPANG}\n${OTHER}`
  expect(requestSeedOf(message('a1', body), plain).title).toBe('')
  expect(
    requestSeedOf(message('a1', body), plain, {
      link: COUPANG,
      product: product('네임펜 12색 1세트'),
    }).title,
  ).toBe('네임펜 12색 1세트')
  expect(
    requestSeedOf(message('a1', body), plain, {
      link: OTHER,
      product: product('둘째 품목'),
    }).title,
  ).toBe('')
})

test('URL을 제거한 제목과 첫 품목 대체 제목은 계약 상한에서 이모지를 보존한다', () => {
  const long = '😀'.repeat(PURCHASE_TITLE_MAX + 1)
  const expected = '😀'.repeat(PURCHASE_TITLE_MAX)
  expect(requestSeedOf(message('a1', `${COUPANG} ${long}`), plain).title).toBe(expected)
  expect(
    requestSeedOf(message('a1', COUPANG), plain, {
      link: COUPANG,
      product: product(long),
    }).title,
  ).toBe(expected)
})

// 022 정한 것 21: 링크마다 품목 하나, 같은 주소는 하나, 링크가 없으면 품목 없음(양식은 빈 품목 하나).
test('품목은 메시지의 링크마다 하나이고 같은 주소는 한 번, 이름과 가격은 비어 있다', () => {
  const seed = requestSeedOf(message('a1', `${COUPANG} 이거랑\n${OTHER}\n다시 ${COUPANG}`), plain)
  expect(seed.items).toEqual([
    { name: '', link: COUPANG, loadedPrice: null },
    { name: '', link: OTHER, loadedPrice: null },
  ])
  expect(requestSeedOf(message('a1', '링크 없음'), plain).items).toEqual([])
})

test('품목은 품목 상한까지다', () => {
  const links = Array.from({ length: PURCHASE_ITEMS_MAX + 3 }, (_, i) => `https://a.kr/${i}`)
  expect(requestSeedOf(message('a1', links.join(' ')), plain).items).toHaveLength(
    PURCHASE_ITEMS_MAX,
  )
})

// 패널의 [구매 요청 만들기]: 고른 판매 단위의 이름과 가격. 긴 쿠팡 이름은 상한에서 잘라 보내기가 400이 되지 않는다.
test('패널에서 열면 그 링크의 품목을 고른 판매 단위 이름으로 채우고 긴 이름은 상한에서 자른다', () => {
  const long = '가'.repeat(PURCHASE_ITEM_NAME_MAX + 30)
  const seed = requestSeedOf(message('a1', `${COUPANG}\n${OTHER}`), plain, {
    link: COUPANG,
    product: product(long),
  })
  const [first, second] = seed.items
  expect(first?.name).toBe('가'.repeat(PURCHASE_ITEM_NAME_MAX))
  expect(first?.loadedPrice).toBe(9900)
  expect(second).toEqual({ name: '', link: OTHER, loadedPrice: null })
  const sent = CreatePurchaseRequestSchema.safeParse({
    title: seed.title,
    items: seed.items.map(item => ({ name: item.name || '물건', quantity: 1, link: item.link })),
  })
  expect(sent.success).toBe(true)
  // 가격은 보이기만 하고 보내지 않는다(품목 계약에 금액 칸이 없다).
  expect(Object.keys(CreatePurchaseRequestSchema.shape.items.element.shape)).not.toContain('price')
})

test('불러온 값은 사람이 적은 이름을 덮지 않고, 다른 판매 단위를 고르면 그 이름이다', () => {
  const loaded = product('빨강 3개')
  expect(withLoaded({ name: '내가 쓴 이름', link: COUPANG, loadedPrice: null }, loaded).name).toBe(
    '내가 쓴 이름',
  )
  const other = withLoaded({ name: '', link: COUPANG, loadedPrice: null }, loaded, '1')
  expect(other).toMatchObject({
    name: '파랑 1개',
    link: COUPANG,
    loadedPrice: 1200,
    estimatedUnitPrice: '1200',
  })
  expect(other.loadedProduct).toEqual(loaded)
})

test('무료배송이 조건 없이 확인되면 배송비를 0으로 채우고, 사람이 적은 배송비나 조건부 무료는 그대로 둔다', () => {
  const loaded = (shipping: string) => ({ ...product('빨강 3개'), shipping })
  const seed = { name: '', link: COUPANG, loadedPrice: null }
  expect(withLoaded(seed, loaded('무료배송 ∙ 오늘출발')).estimatedShippingFee).toBe('0')
  expect(
    withLoaded(seed, loaded('와우는 · 무료배송 · 무료반품 · 새벽도착')).estimatedShippingFee,
  ).toBe('')
  expect(withLoaded(seed, loaded('19,800원 이상 무료배송')).estimatedShippingFee).toBe('')
  expect(
    withLoaded(
      { ...seed, estimatedShippingFee: '2500', shippingFeeEdited: true },
      loaded('무료배송 ∙ 오늘출발'),
    ).estimatedShippingFee,
  ).toBe('2500')
})
