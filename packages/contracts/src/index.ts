export { codePoints, isStrictObject, text, token } from './input.js'
export { COUPANG_LINKS_PER_MESSAGE_MAX, normalizeCoupangUrl, parseCoupangLinks, readCoupangUrl, type CoupangLink } from './coupang.js'
export { EVENT_NAME_MAX, CreateEventSchema, type CreateEventRequest } from './events.js'
export { MESSAGE_CONTENT_MAX, CreateMessageSchema, type CreateMessageRequest } from './chat.js'
export { DeliveryLookupSchema, RegisterShipmentSchema, UnlinkShipmentSchema } from './deliveries.js'
export { INVITE_CODE_MAX, InviteCodeSchema, JoinOrganizationSchema, type JoinOrganizationRequest, type InvitePreviewResponse } from './invites.js'
export { ORGANIZATION_NAME_MAX, DEPARTMENT_NAME_MAX, MEMBER_TITLE_MAX, CREATE_DEPARTMENTS_MAX, LEADERSHIP_DEFAULT_NAME,
  CreateOrganizationSchema, CreateDepartmentSchema, UpdateDepartmentSchema, DeleteDepartmentSchema, AssignDepartmentSchema,
  UpdateMemberTitleSchema, type CreateOrganizationRequest, type UpdateDepartmentRequest } from './organizations.js'
export { PURCHASE_CANDIDATES_MAX, PURCHASE_PRODUCT_NAME_MAX, PURCHASE_OPTION_MAX, PURCHASE_PACKAGING_MAX, PURCHASE_NOTE_MAX, PURCHASE_REASON_MAX,
  PURCHASE_WARNING_MAX, PURCHASE_BATCH_MAX, PURCHASE_INTEGER_MAX, PURCHASE_ITEM_ACTIONS, purchaseDate, CreatePurchaseDraftsSchema,
  UpdatePurchaseItemSchema, PurchaseItemVersionSchema, SubmitPurchaseItemsSchema, ChangeNeededBySchema, PurchaseReceivedSchema,
  PurchasePurchasedSchema, DecidePurchaseItemsSchema, GeneratedPurchaseItemSchema, PurchaseCandidateHiddenSchema } from './purchases.js'
export type { PurchaseItemStatus, PurchaseItemAction, CreatePurchaseDraftsRequest, UpdatePurchaseItemRequest, SubmitPurchaseItemsRequest,
  ChangeNeededByRequest, DecidePurchaseItemsRequest, GeneratedPurchaseItemFields, PurchasePerson, PurchaseItemSummary,
  PurchaseItemHistoryEntry, PurchaseItemDetail, PurchaseItemsResponse, EventPurchaseItemsResponse, PurchaseItemResponse,
  PurchaseReviewResponse, PurchaseCandidateHiddenRequest, ProductLookupStatus, PurchaseCandidateProduct, PurchaseCandidateShare,
  PurchaseCandidateRequest, PurchaseCandidate, PurchaseCandidatesResponse, PurchaseCandidateResponse } from './purchases.js'
export interface HealthResponse {
  status: 'ok'
}
export type { DeliveryStatus, DeliveryLookupRequest, RegisterShipmentRequest, UnlinkShipmentRequest,
  DeliveryLookupResponse, DeliveryCarriersResponse, ShipmentRegistrationResponse, DeliverySummary } from './deliveries.js'

export interface MembershipPermissions {
  manageOrganization: boolean
  approvePurchases: boolean
}

export interface MembershipSummary {
  id: string
  organization: { id: string; name: string; inviteCode: string }
  // 초대로 들어와 아직 부서가 없으면 null(미배정)이다. 회장단도 부서 중 하나다.
  department: { id: string; name: string; handlesFinance: boolean; isLeadership: boolean } | null
  // 표시용 직책. 권한과 무관하다.
  title: string | null
  // 서버가 부서로 계산한 권한. 화면은 이 값만 보고 메뉴를 보인다.
  permissions: MembershipPermissions
}

export interface MembershipsResponse {
  memberships: MembershipSummary[]
}

export interface JoinOrganizationResponse {
  membership: MembershipSummary
}

export interface CreateOrganizationResponse {
  membership: MembershipSummary
}

export interface DepartmentSummary { id: string; name: string; isLeadership: boolean; handlesFinance: boolean }
// 구성원에게는 이름만 보인다. 이메일은 주지 않는다.
export interface MemberSummary { id: string; name: string; title: string | null; departmentId: string | null }
// 회장단 전용 변경도 이 응답을 돌려준다. 화면은 받은 값으로 목록을 통째로 바꾼다.
export interface OrganizationMembersResponse {
  viewer: MembershipSummary
  departments: DepartmentSummary[]
  members: MemberSummary[]
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
export { EXPENSE_VENDOR_MAX, EXPENSE_DESCRIPTION_MAX, EXPENSE_NOTE_MAX, EXPENSE_VOID_REASON_MAX, EXPENSE_ITEMS_MAX, RECEIPTS_PER_EXPENSE_MAX,
  RECEIPT_FILE_NAME_MAX, RECEIPT_SIZE_MAX, EXPENSE_METHODS, RECEIPT_KINDS, RECEIPT_CONTENT_TYPES, CreateExpenseSchema, UpdateExpenseSchema,
  VoidExpenseSchema, CreateReceiptUploadSchema, ReceiptActionSchema } from './expenses.js'
export type { ExpenseMethod, ReceiptKind, ReceiptContentType, ExpenseAction, CreateExpenseRequest, UpdateExpenseRequest, VoidExpenseRequest,
  CreateReceiptUploadRequest, ExpensePerson, ExpenseItem, ExpenseSummary, ReceiptSummary, ExpenseHistoryEntry, ExpenseDetail,
  ExpensesResponse, ExpenseResponse, ReceiptUploadResponse, LinkableItemsResponse } from './expenses.js'
