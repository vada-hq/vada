// 요청 내기 폼의 값. 입력칸 값은 글자라 비운 칸은 빈 글이고, 요청으로 바꿀 때 null이 된다.
import { purchaseEstimateOf, type ProductInfo } from '@vada/contracts'
import type { Parsed } from '@/lib/use-form-check'
import { wonOf } from '@/lib/won-input'

export type ItemValues = {
  // 줄을 지워도 입력칸 상태가 섞이지 않게 하는 키(서버로 보내지 않는다)
  key: number
  name: string
  nameEdited?: boolean
  quantity: string
  link: string
  options: string
  // 조회 원본은 표시용이고, 예상 단가·배송비만 아래의 별도 계약 필드로 보낸다.
  loadedPrice?: number | null
  loadedProduct?: ProductInfo
  estimatedUnitPrice: string
  estimatedShippingFee: string
  unitPriceEdited?: boolean
  shippingFeeEdited?: boolean
}
export type RequestValues = {
  title: string
  titleEdited?: boolean
  body: string
  neededBy: string
  // 낼 때 고르고 바꾸지 않는다. 비면 행사에 잇지 않는다.
  eventId: string | null
  // 재정부가 남을 대신해 낼 때의 요청한 사람. 비면 나다.
  requestedBy: string | null
  // 메시지에서 열었으면 그 메시지. 사람이 고르지 않고 서버가 볼 수 있는지 본다.
  sourceMessageId: string | null
  items: ItemValues[]
}
// 메시지에서 열 때 미리 채우는 값
export type RequestStart = Partial<
  Pick<RequestValues, 'title' | 'body' | 'requestedBy' | 'sourceMessageId'>
> & {
  items?: {
    name: string
    link: string
    loadedPrice: number | null
    loadedProduct?: ProductInfo
    estimatedUnitPrice?: string
    estimatedShippingFee?: string
  }[]
}

let lastKey = 0
export const newItem = (): ItemValues => ({
  key: ++lastKey,
  name: '',
  quantity: '1',
  link: '',
  options: '',
  estimatedUnitPrice: '',
  estimatedShippingFee: '',
})
export const emptyRequest = (
  eventId: string | null = null,
  start: RequestStart = {},
): RequestValues => ({
  title: start.title ?? '',
  body: start.body ?? '',
  neededBy: '',
  eventId,
  requestedBy: start.requestedBy ?? null,
  sourceMessageId: start.sourceMessageId ?? null,
  items: start.items?.length ? start.items.map(item => ({ ...newItem(), ...item })) : [newItem()],
})

// 새로고침 뒤 숫자 키의 전역 순번이 다시 시작해도 새 품목과 겹치지 않는다.
export const restoredRequest = (values: RequestValues): RequestValues => ({
  ...values,
  items: values.items.map(item => {
    const fresh = newItem()
    return { ...fresh, ...item, key: fresh.key }
  }),
})

const orNull = (value: string) => (value.trim() === '' ? null : value)
// 예상 금액은 선택 칸이라 비면 null이다.
const estimatedWon = (value: string) => (value.trim() === '' ? null : wonOf(value))

// 수량이 비었거나 숫자가 아니면 NaN이라 계약 검사가 막는다.
export const requestOf = (values: RequestValues) => ({
  title: values.title,
  eventId: values.eventId,
  // 비면 키를 보내지 않는다(서버 기본값이 같다).
  ...(values.requestedBy === null ? {} : { requestedBy: values.requestedBy }),
  ...(values.sourceMessageId === null ? {} : { sourceMessageId: values.sourceMessageId }),
  body: orNull(values.body),
  neededBy: orNull(values.neededBy),
  items: values.items.map(item => ({
    name: item.name,
    quantity: item.quantity.trim() === '' ? Number.NaN : Number(item.quantity),
    link: orNull(item.link),
    options: orNull(item.options),
    estimatedUnitPrice: estimatedWon(item.estimatedUnitPrice),
    estimatedShippingFee: estimatedWon(item.estimatedShippingFee),
  })),
})

// 계약의 합계 확인(단가 × 수량 + 배송비)은 늘 단가 칸에 걸린다. 단가 × 수량만으로는 상한 안이면 배송비가 넘긴 것이라 그 칸으로 옮긴다.
export function estimateParsed(
  items: ReturnType<typeof requestOf>['items'],
  parsed: Parsed,
): Parsed {
  if (!parsed.error) return parsed
  const issues = parsed.error.issues.map(issue => {
    const [list, at, field] = issue.path
    const item = list === 'items' && typeof at === 'number' ? items[at] : undefined
    if (!item || field !== 'estimatedUnitPrice' || issue.code !== 'custom') return issue
    const { subtotal } = purchaseEstimateOf({ ...item, estimatedShippingFee: null })
    return subtotal === null
      ? issue
      : { ...issue, path: [...issue.path.slice(0, -1), 'estimatedShippingFee'] }
  })
  return { ...parsed, error: { issues } }
}
