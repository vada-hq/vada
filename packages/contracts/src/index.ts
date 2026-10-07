export { codePoints, isStrictObject, text, token } from './input.js'
export { EVENT_NAME_MAX, CreateEventSchema, type CreateEventRequest } from './events.js'
export { MESSAGE_CONTENT_MAX, CreateMessageSchema, type CreateMessageRequest } from './chat.js'
export { DeliveryLookupSchema, RegisterShipmentSchema, UnlinkShipmentSchema } from './deliveries.js'
export interface HealthResponse {
  status: 'ok'
}
export type { DeliveryStatus, DeliveryLookupRequest, RegisterShipmentRequest, UnlinkShipmentRequest,
  DeliveryLookupResponse, DeliveryCarriersResponse, ShipmentRegistrationResponse, DeliverySummary, EventDeliveriesResponse } from './deliveries.js'

export interface MembershipSummary {
  id: string
  organization: { id: string; name: string; inviteCode: string }
  // 초대로 들어와 아직 부서가 없으면 null(미배정)이다.
  department: { id: string; name: string; handlesFinance: boolean } | null
}

export interface MembershipsResponse {
  memberships: MembershipSummary[]
}

export interface EventSummary {
  id: string
  organizationId: string
  name: string
  createdBy: string
  createdAt: string
}

export interface EventResponse {
  event: EventSummary
}

export interface EventsResponse {
  events: EventSummary[]
}

export interface MessageSummary {
  id: string
  chatRoomId: string
  author: { id: string; name: string }
  content: string
  createdAt: string
}

export interface MessageResponse {
  message: MessageSummary
}

export interface MessagesResponse {
  messages: MessageSummary[]
  // 이전 50개 조회 시 before에 전달한다. null이면 더 오래된 메시지가 없다.
  nextCursor: string | null
}

export type PurchaseStatus = 'draft' | 'discarded' | 'submitted' | 'approved' | 'rejected'
export interface CreatePurchaseDraftRequest { idempotencyKey: string; links: string[] }
export interface PurchaseItemFields {
  productName: string | null
  selectedOption: string | null
  optionRequired: boolean | null
  quantity: number | null
  packagingUnit: string | null
  estimatedUnitPrice: number | null
}
export interface UpdatePurchaseDraftRequest {
  version: number
  purpose?: string | null
  neededBy?: string | null
  estimatedShippingCost?: number | null
  items?: (Partial<PurchaseItemFields> & { id: string })[]
}
export interface DiscardPurchaseDraftRequest { version: number }
export interface SubmitPurchaseRequest { version: number }
export type DecidePurchaseRequest = { version: number } & (
  { decision: 'approved' } | { decision: 'rejected'; reason: string }
)
export interface PurchaseSummary {
  id: string
  eventId: string
  organizationId: string
  requesterId: string
  // 요청자가 미배정이면 null이다.
  departmentId: string | null
  purpose: string | null
  neededBy: string | null
  estimatedShippingCost: number | null
  status: PurchaseStatus
  version: number
  createdAt: string
  updatedAt: string
}
export interface PurchaseDetail extends PurchaseSummary {
  items: (PurchaseItemFields & {
    id: string; position: number; productUrl: string
    productSnapshot: Record<string, unknown> | null; productFetchedAt: string | null
  })[]
  sources: { id: string; content: string; authorId: string; createdAt: string }[]
  history: {
    id: string; actorId: string; action: string; version: number
    changes: Record<string, unknown>; reason: string | null; createdAt: string
  }[]
  warnings: string[]
  estimatedTotal: number | null
}
export interface PurchaseResponse { request: PurchaseDetail }
export interface PurchasesResponse { requests: PurchaseSummary[]; nextCursor: string | null }
