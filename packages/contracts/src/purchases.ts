import { z } from 'zod'
import type { DeliverySummary } from './deliveries.js'
import { text, token } from './input.js'

export const PURCHASE_LINKS_MAX = 5
export const PURCHASE_PRODUCT_NAME_MAX = 500
export const PURCHASE_OPTION_MAX = 200
export const PURCHASE_PACKAGING_MAX = 50
export const PURCHASE_NOTE_MAX = 200
export const PURCHASE_REASON_MAX = 500
export const PURCHASE_WARNING_MAX = 500
export const PURCHASE_BATCH_MAX = 50
// DB integer 칸의 상한이다.
export const PURCHASE_INTEGER_MAX = 2147483647

export type PurchaseItemStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'cancelled'
export const PURCHASE_ITEM_ACTIONS = ['submitted', 'approved', 'rejected', 'cancelled', 'approval_revoked', 'needed_by_changed',
  'purchased', 'purchase_undone', 'received', 'receipt_undone', 're_added'] as const
export type PurchaseItemAction = typeof PURCHASE_ITEM_ACTIONS[number]

const id = token(64)
const version = z.number().int().min(1).max(PURCHASE_INTEGER_MAX)
const quantity = z.number().int().min(1).max(PURCHASE_INTEGER_MAX)
const price = z.number().int().min(0).max(PURCHASE_INTEGER_MAX)
// 달력에 있는 날짜만 받는다. 2026-02-30 같은 값은 거부한다.
export const purchaseDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const parsed = new Date(`${value}T00:00:00Z`)
  return value >= '0001-01-01' && !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
})
const itemRefs = z.array(z.strictObject({ id, version })).min(1).max(PURCHASE_BATCH_MAX)
  .refine(items => new Set(items.map(item => item.id)).size === items.length)

export const CreatePurchaseDraftsSchema = z.strictObject({
  idempotencyKey: token(128),
  // 쿠팡 상품 링크인지는 서버가 정규화하며 검사한다.
  links: z.array(token(4096)).min(1).max(PURCHASE_LINKS_MAX),
})
// 작성 중 품목의 내용만 고친다. 받을 날짜는 ChangeNeededBySchema로 바꾼다.
export const UpdatePurchaseItemSchema = z.strictObject({
  version,
  productName: text(PURCHASE_PRODUCT_NAME_MAX).nullable().optional(),
  selectedOption: text(PURCHASE_OPTION_MAX).nullable().optional(),
  optionRequired: z.boolean().nullable().optional(),
  quantity: quantity.nullable().optional(),
  packagingUnit: text(PURCHASE_PACKAGING_MAX).nullable().optional(),
  estimatedUnitPrice: price.nullable().optional(),
  note: text(PURCHASE_NOTE_MAX).nullable().optional(),
}).refine(value => Object.keys(value).length > 1)
export const PurchaseItemVersionSchema = z.strictObject({ version })
export const SubmitPurchaseItemsSchema = z.strictObject({ items: itemRefs })
export const ChangeNeededBySchema = z.strictObject({ items: itemRefs, neededBy: purchaseDate.nullable() })
export const PurchaseReceivedSchema = z.strictObject({ version, received: z.boolean() })
export const PurchasePurchasedSchema = z.strictObject({ version, purchased: z.boolean() })
export const DecidePurchaseItemsSchema = z.strictObject({
  decisions: z.array(z.discriminatedUnion('decision', [
    z.strictObject({ id, version, decision: z.literal('approved') }),
    z.strictObject({ id, version, decision: z.literal('rejected'), reason: text(PURCHASE_REASON_MAX) }),
  ])).min(1).max(PURCHASE_BATCH_MAX).refine(list => new Set(list.map(item => item.id)).size === list.length),
})
// 끼룩이 출력의 품목 칸. 빈 글은 모르는 값(null)으로 본다.
const generatedText = (max: number) =>
  z.preprocess(value => typeof value === 'string' && !value.trim() ? null : value, text(max).nullable())
export const GeneratedPurchaseItemSchema = z.strictObject({
  productUrl: z.string(),
  productName: generatedText(PURCHASE_PRODUCT_NAME_MAX),
  selectedOption: generatedText(PURCHASE_OPTION_MAX),
  packagingUnit: generatedText(PURCHASE_PACKAGING_MAX),
  optionRequired: z.boolean().nullable(),
  quantity: quantity.nullable(),
  note: generatedText(PURCHASE_NOTE_MAX),
  neededBy: purchaseDate.nullable(),
  sourceMessageIds: z.array(token(200)).max(20),
  warnings: z.array(text(PURCHASE_WARNING_MAX)).max(10),
})

export type CreatePurchaseDraftsRequest = z.infer<typeof CreatePurchaseDraftsSchema>
export type UpdatePurchaseItemRequest = z.infer<typeof UpdatePurchaseItemSchema>
export type SubmitPurchaseItemsRequest = z.infer<typeof SubmitPurchaseItemsSchema>
export type ChangeNeededByRequest = z.infer<typeof ChangeNeededBySchema>
export type DecidePurchaseItemsRequest = z.infer<typeof DecidePurchaseItemsSchema>
export type GeneratedPurchaseItemFields = z.infer<typeof GeneratedPurchaseItemSchema>

export interface PurchasePerson { id: string; name: string }
export interface PurchaseItemSummary {
  id: string
  event: { id: string; name: string }
  requester: PurchasePerson
  // 보는 사람이 요청자인지. 내 품목 묶음과 "내 품목" 표시에 쓴다.
  mine: boolean
  // 제출할 때의 요청자 부서. 작성 중이거나 미배정이면 null이다.
  departmentName: string | null
  status: PurchaseItemStatus
  version: number
  submissionId: string | null
  productUrl: string
  productName: string | null
  selectedOption: string | null
  optionRequired: boolean | null
  quantity: number | null
  packagingUnit: string | null
  estimatedUnitPrice: number | null
  note: string | null
  // null이면 "상관없음"이다.
  neededBy: string | null
  // 제출 뒤 요청자가 받을 날짜를 바꿨는지.
  neededByChanged: boolean
  warnings: string[]
  createdAt: string
  submittedAt: string | null
  decidedAt: string | null
  decidedBy: PurchasePerson | null
  decisionReason: string | null
  purchasedAt: string | null
  receivedAt: string | null
  receivedBy: PurchasePerson | null
  shipments: DeliverySummary[]
}
export interface PurchaseItemHistoryEntry {
  id: string
  action: PurchaseItemAction
  actor: PurchasePerson
  reason: string | null
  changes: Record<string, unknown>
  createdAt: string
}
export interface PurchaseItemDetail extends PurchaseItemSummary {
  sources: { id: string; content: string; authorName: string; createdAt: string }[]
  history: PurchaseItemHistoryEntry[]
}
export interface PurchaseItemsResponse { items: PurchaseItemSummary[] }
export interface EventPurchaseItemsResponse { items: PurchaseItemSummary[]; truncated: boolean }
export interface PurchaseItemResponse { item: PurchaseItemDetail }
export interface PurchaseReviewResponse { pending: PurchaseItemSummary[]; approved: PurchaseItemSummary[]; truncated: boolean }
