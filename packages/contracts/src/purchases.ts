import { z } from 'zod'
import type { PurchaseShipment } from './shipments.js'
import { WON_MAX, type EventRef } from './budget.js'
import { EmptyRequestSchema, text, token } from './input.js'
import { koreanDate } from './korean-time.js'
import { recordIdInput } from './team.js'
import { purchaseEstimateOf, type PurchaseEstimate } from './purchase-estimate.js'
export {
  purchaseEstimateOf,
  purchaseEstimatesOf,
  type PurchaseEstimate,
} from './purchase-estimate.js'

// 구매 요청(DEC-15, DEC-40). 요청서 한 장에 품목 여럿이고, 상태는 저장하지 않고 품목의 결재로 센다. 값은 DB CHECK와 같다.
export const PURCHASE_TITLE_MAX = 100
export const PURCHASE_BODY_MAX = 1000
export const PURCHASE_ITEM_NAME_MAX = 100
export const PURCHASE_ITEM_LINK_MAX = 2000
export const PURCHASE_ITEM_OPTIONS_MAX = 200
export const PURCHASE_ITEMS_MAX = 20
export const PURCHASE_QUANTITY_MAX = 999
// 목록 상한: 결재 대기는 오래된 순 300개, 내 요청과 전체는 최근 순 100개. 넘치면 truncated다.
export const PURCHASE_PENDING_LIMIT = 300
export const PURCHASE_RECENT_LIMIT = 100

export const PURCHASE_VIEWS = ['mine', 'pending', 'all'] as const
export type PurchaseView = (typeof PURCHASE_VIEWS)[number]
// 행사를 주면 그 행사에 이은 요청만 준다.
export const PurchaseRequestListQuerySchema = z.strictObject({
  view: z.enum(PURCHASE_VIEWS),
  event: recordIdInput.optional(),
})
export type PurchaseRequestListQuery = z.infer<typeof PurchaseRequestListQuerySchema>

// 품목 하나의 상태(품목의 마지막 결재 결과, 없으면 대기)와 요청 전체의 상태(결재 안 된 품목이 있으면 대기, 섞이면 일부 승인)
export const LINE_ITEM_STATUSES = ['pending', 'approved', 'rejected', 'cancelled'] as const
export type LineItemStatus = (typeof LINE_ITEM_STATUSES)[number]
export const PURCHASE_STATUSES = [
  'pending',
  'approved',
  'rejected',
  'partial',
  'cancelled',
] as const
export type PurchaseStatus = (typeof PURCHASE_STATUSES)[number]

// 요청마다 서버가 주는 할 수 있는 동작. 화면은 이것으로 버튼을 보이거나 숨기고 권한을 다시 계산하지 않는다(DEC-38).
// 권한 키(purchase.cancel, purchase.approve)와 이름이 겹치지 않아, 화면이 권한 목록을 읽는 코드로 이 동작을 쓴 것처럼 보이지 않는다.
export const PURCHASE_ACTIONS = ['purchase_request.cancel', 'purchase_request.decide'] as const
export type PurchaseAction = (typeof PURCHASE_ACTIONS)[number]

// 품목마다 서버가 주는 동작. 승인했고 결제하지 않은 품목을 재정부가 취소한다(DEC-73).
export const LINE_ITEM_ACTIONS = ['line_item.cancel'] as const
export type LineItemAction = (typeof LINE_ITEM_ACTIONS)[number]

const isWebUrl = (value: string) => {
  try {
    const { protocol } = new URL(value)
    return protocol === 'https:' || protocol === 'http:'
  } catch {
    return false
  }
}

// 링크는 운영진이 쓴 주소라 http와 https만 받는다(javascript: 같은 주소가 화면에서 실행되지 않게).
// 상품 정보 불러오기(기능 022)도 품목 링크로 쓸 주소를 받으므로 같은 규칙을 쓴다.
export const itemLinkInput = token(PURCHASE_ITEM_LINK_MAX).refine(isWebUrl)
const CreateLineItemSchema = z
  .strictObject({
    name: text(PURCHASE_ITEM_NAME_MAX),
    quantity: z.number().int().min(1).max(PURCHASE_QUANTITY_MAX),
    link: itemLinkInput.nullable().default(null),
    options: text(PURCHASE_ITEM_OPTIONS_MAX).nullable().default(null),
    estimatedUnitPrice: z.number().int().min(0).max(WON_MAX).nullish(),
    estimatedShippingFee: z.number().int().min(0).max(WON_MAX).nullish(),
  })
  .refine(item => item.estimatedUnitPrice == null || purchaseEstimateOf(item).subtotal !== null, {
    path: ['estimatedUnitPrice'],
  })

// 예상 가격은 선택값이다(DEC-92). 승인 금액, 예산 항목, 사유는 받지 않는다(DEC-40).
export const CreatePurchaseRequestSchema = z.strictObject({
  title: text(PURCHASE_TITLE_MAX),
  eventId: recordIdInput.nullable().default(null),
  body: text(PURCHASE_BODY_MAX).nullable().default(null),
  neededBy: koreanDate.nullable().default(null),
  // 재정부가 부탁한 사람 대신 낼 때의 요청한 사람. 비우면 나다.
  requestedBy: recordIdInput.nullable().default(null),
  // 이 요청의 근거가 된 메시지. 내가 지금 볼 수 있는 것만 된다. 상세도 보는 사람의 접근권한을 다시 확인한다.
  sourceMessageId: recordIdInput.nullable().default(null),
  // 이 요청을 이을 업무(기능 015). 이 학생회의 끝나지 않은 업무로 내가 상태를 바꿀 수 있는 것만 된다. 비우거나 빼면 잇지 않는다.
  taskId: recordIdInput.nullish(),
  items: z.array(CreateLineItemSchema).min(1).max(PURCHASE_ITEMS_MAX),
})
export type CreatePurchaseRequest = z.infer<typeof CreatePurchaseRequestSchema>
// 취소는 본문이 없다.
export const CancelPurchaseRequestSchema = EmptyRequestSchema

export const PURCHASE_REASON_MAX = 500

// 품목마다 결재(DEC-15). 승인은 금액(그 줄 합계)과 예산 항목이, 반려는 사유가 꼭 있다. 한 번에 여러 품목을 보낸다.
const ApproveSchema = z.strictObject({
  lineItemId: recordIdInput,
  outcome: z.literal('approved'),
  amount: z.number().int().min(1).max(WON_MAX),
  budgetItemId: recordIdInput,
})
const RejectSchema = z.strictObject({
  lineItemId: recordIdInput,
  outcome: z.literal('rejected'),
  reason: text(PURCHASE_REASON_MAX),
})
export const DecideLineItemsSchema = z.strictObject({
  decisions: z
    .array(z.discriminatedUnion('outcome', [ApproveSchema, RejectSchema]))
    .min(1)
    .max(PURCHASE_ITEMS_MAX)
    .refine(list => new Set(list.map(item => item.lineItemId)).size === list.length),
})
export type DecideLineItems = z.infer<typeof DecideLineItemsSchema>

// 승인한 품목 취소(DEC-73). 사유가 꼭 있다.
export const CancelLineItemSchema = z.strictObject({ reason: text(PURCHASE_REASON_MAX) })
export type CancelLineItem = z.infer<typeof CancelLineItemSchema>

export interface PurchasePerson {
  id: string
  name: string
}

export interface PurchaseRequestSummary {
  id: string
  title: string
  status: PurchaseStatus
  requestedBy: PurchasePerson
  // 필요한 때(한국 날짜 YYYY-MM-DD)
  neededBy: string | null
  itemCount: number
  createdAt: string
  event: EventRef | null
  // 결제할 수 있는 품목이 하나라도 있는가(지출의 '결제할 요청'에 보인다). 서버가 정책에서 정한다.
  payable: boolean
  // 예상 가격은 승인 금액·약정과 별개다. 옛 클라이언트/저장된 응답에는 없을 수 있다.
  estimate?: PurchaseEstimate
}

export interface PurchaseLineItem {
  id: string
  name: string
  quantity: number
  link: string | null
  options: string | null
  estimatedUnitPrice?: number | null
  estimatedShippingFee?: number | null
  // 승인할 때 정한 금액(그 줄 합계, 정수 원). 결재 전에는 null이다.
  amount: number | null
  budgetItem: { id: string; purpose: string } | null
  status: LineItemStatus
  // 취소되지 않은 결제 내역이 있다.
  paid: boolean
  // 지출로 결제할 수 있는가: 마지막 결과가 승인이고 요청과 예산 항목의 행사가 완료 전이다. 서버가 정책에서 정한다.
  payable: boolean
  actions: LineItemAction[]
}

export interface PurchaseDecision {
  id: string
  lineItemId: string
  outcome: 'approved' | 'rejected' | 'cancelled'
  by: PurchasePerson | null
  at: string
  reason: string | null
}

export interface PurchaseExpenseRef {
  id: string
  vendor: string
  amount: number
  paidAt: string
  cancelled: boolean
}

// 판 사이에 바뀐 것. 요청은 만들고 취소하는 것뿐이다.
export type PurchaseChange = { field: 'created' } | { field: 'cancelled' }

export interface PurchaseVersion {
  versionNo: number
  at: string
  by: PurchasePerson | null
  changes: PurchaseChange[]
}

export interface PurchaseRequestDetail extends PurchaseRequestSummary {
  body: string | null
  // 현재 이 원문을 읽을 수 있을 때만 참조한다. 본문은 복사하지 않는다.
  sourceMessage?: { id: string; roomId: string } | null
  items: PurchaseLineItem[]
  decisions: PurchaseDecision[]
  expenses: PurchaseExpenseRef[]
  shipments: PurchaseShipment[]
  canAddShipment: boolean
  // 오래된 판부터 모두
  history: PurchaseVersion[]
  actions: PurchaseAction[]
}

export interface PurchaseRequestsResponse {
  requests: PurchaseRequestSummary[]
  truncated: boolean
}
export interface PurchaseRequestResponse {
  request: PurchaseRequestDetail
}
