import {
  PURCHASE_BODY_MAX,
  PURCHASE_ITEM_LINK_MAX,
  PURCHASE_ITEM_NAME_MAX,
  PURCHASE_ITEMS_MAX,
  PURCHASE_TITLE_MAX,
  type ChatMessage,
  type ProductInfo,
  type TeamMember,
} from '@vada/contracts'
import { bodyParts } from './message-links'

// 메시지 링크로 채우는 초안. 조회 원본은 표시용이며 예상 가격은 024-11의 별도 필드로 보낸다.
export type ItemSeed = {
  name: string
  nameEdited?: boolean
  link: string
  loadedPrice: number | null
  loadedProduct?: ProductInfo
  estimatedUnitPrice?: string
  estimatedShippingFee?: string
  unitPriceEdited?: boolean
  shippingFeeEdited?: boolean
}

// 메시지로 구매 요청을 열 때 채우는 값. 모두 사람이 고친다.
export type RequestSeed = {
  title: string
  body: string
  // 재정부만 고른다. 재정부가 아니면 null이고 서버가 나로 본다.
  requestedBy: string | null
  sourceMessageId: string
  // 메시지의 링크마다 한 품목. 링크가 없으면 비어 있고 양식은 지금처럼 빈 품목 하나다.
  items: ItemSeed[]
}

// 글자 수는 계약과 같은 단위(코드 포인트)로 센다. 이모지를 반으로 자르지 않는다.
export function clipText(value: string, max: number) {
  return Array.from(value).slice(0, max).join('').trim()
}

type Context = {
  meId: string
  // 지금 운영진. 아직 못 읽었으면 null이다.
  members: TeamMember[] | null
  canAssign: boolean
}

// 남의 메시지면 보낸 사람이 요청한 사람이다. 떠났거나 시스템이면(지금 운영진에 없으면) 나다.
function requesterOf(message: ChatMessage, { meId, members, canAssign }: Context) {
  if (!canAssign) return null
  const sender = message.senderId
  const stillHere = sender !== null && members?.some(member => member.id === sender)
  return stillHere ? sender : meId
}

// 메시지의 첫 줄(비지 않은 첫 줄). 지출 내역도 같은 줄을 쓴다.
export const firstLineOf = (message: ChatMessage) =>
  (message.body ?? '').split('\n').find(line => line.trim() !== '') ?? ''

// 메시지의 링크들. 같은 주소는 하나, 품목 상한까지다. 품목 링크 상한보다 긴 주소는 품목에 담을 수 없어 뺀다.
function messageLinksOf(message: ChatMessage) {
  const links = bodyParts(message.body ?? '')
    .filter(part => part.kind === 'link')
    .map(part => part.text)
    .filter(link => Array.from(link).length <= PURCHASE_ITEM_LINK_MAX)
  return [...new Set(links)].slice(0, PURCHASE_ITEMS_MAX)
}

// 불러온 상품의 판매 단위(고른 것, 없으면 쿠팡이 고른 것)로 이름과 가격을 채운다. 쿠팡 상품명은 길어 품목 이름 상한에서 자른다.
// 사람이 이미 적은 이름은 덮지 않는다(불러온 값은 초안, PRIN-2).
function unitPriceValue(seed: ItemSeed, price: number | null) {
  if (seed.unitPriceEdited) return seed.estimatedUnitPrice ?? ''
  return price === null ? '' : String(price)
}

function shippingFeeValue(seed: ItemSeed, shipping: string | null) {
  if (seed.shippingFeeEdited) return seed.estimatedShippingFee ?? ''
  return /^(무료\s?배송|배송비\s?무료)$/.test(shipping?.trim() ?? '')
    ? '0'
    : (seed.estimatedShippingFee ?? '')
}

export function withLoaded(seed: ItemSeed, product: ProductInfo, itemId?: string): ItemSeed {
  const unit =
    product.items.find(item => item.itemId === (itemId ?? product.selectedItemId)) ?? null
  const name = clipText(unit?.name ?? product.name, PURCHASE_ITEM_NAME_MAX)
  return {
    ...seed,
    name: seed.nameEdited || seed.name.trim() !== '' ? seed.name : name,
    loadedPrice: unit?.price ?? null,
    loadedProduct: product,
    estimatedUnitPrice: unitPriceValue(seed, unit?.price ?? null),
    estimatedShippingFee: shippingFeeValue(seed, product.shipping),
  }
}

// 상품 정보 패널에서 연 요청: 그 링크의 품목을 패널이 보인 상품과 판매 단위로 채운다.
export type LoadedPick = { link: string; product: ProductInfo; itemId?: string }

export function requestSeedOf(
  message: ChatMessage,
  context: Context,
  picked?: LoadedPick,
): RequestSeed {
  const firstLine = firstLineOf(message)
  const items = messageLinksOf(message).map(link => {
    const seed = { name: '', link, loadedPrice: null }
    return picked?.link === link ? withLoaded(seed, picked.product, picked.itemId) : seed
  })
  return {
    title: clipText(
      picked && firstLine.trim() === picked.link ? picked.product.name : firstLine,
      PURCHASE_TITLE_MAX,
    ),
    body: clipText(message.body ?? '', PURCHASE_BODY_MAX),
    requestedBy: requesterOf(message, context),
    sourceMessageId: message.id,
    items,
  }
}
