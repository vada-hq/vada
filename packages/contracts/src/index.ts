export { codePoints, isStrictObject, text, token } from './input.js'
export { COUPANG_LINKS_PER_MESSAGE_MAX, normalizeCoupangUrl, parseCoupangLinks, readCoupangUrl, type CoupangLink } from './coupang.js'
export { EVENT_NAME_MAX, EVENT_PLACE_MAX, CreateEventSchema, UpdateEventSchema, CompleteEventSchema, CancelEventCompletionSchema, type CreateEventRequest,
  type UpdateEventRequest, type CompleteEventRequest, eventPhaseOf, type EventPhase } from './events.js'
export { koreanDateTime, dateFromKorean, koreanOf } from './korean-time.js'
export { REGISTRATION_NAME_MAX, REGISTRATION_NOTICE_MAX, REGISTRATION_CAPACITY_MAX, REGISTRATION_RETENTION_DAYS, REGISTRATION_FEE_MAX, studentIdInput,
  phoneInput, CreateRegistrationFormSchema, UpdateRegistrationFormSchema, CancelRegistrationSchema, RegisterSchema, RegistrationTokenSchema,
  PaymentActionSchema, SetDuesMemberSchema, CheckInScanSchema, CheckInActionSchema, checkInQrText, checkInCodeOf } from './registrations.js'
export type { CreateRegistrationFormRequest, UpdateRegistrationFormRequest, RegisterRequest, SetDuesMemberRequest, RegistrationState,
  RegistrationFormView, RegistrationEntry, RegistrationResponse, PublicRegistrationEvent, PublicRegistrationForm, RegistrationCreated, PaymentBasis,
  MyPayment, MyRegistration, CheckInScanRequest, CheckInScanResponse } from './registrations.js'
export { FEE_BANK_MAX, FEE_HOLDER_MAX, FEE_ACCOUNT_NUMBER_MAX, FEE_ACCOUNT_HISTORY_MAX, DUES_ROSTER_LABEL_MAX, DUES_ROSTER_MEMBERS_MAX,
  DUES_ROSTER_USE_DAYS_MAX, accountNumberInput, SetFeeAccountSchema, DuesMemberSchema, ReplaceDuesRosterSchema, DeleteDuesRosterSchema } from './fees.js'
export type { SetFeeAccountRequest, ReplaceDuesRosterRequest, DeleteDuesRosterRequest, FeeAccount, FeeAccountView, FeeAccountChange, DuesMember,
  DuesRosterView, FeeSettingsResponse } from './fees.js'
export { TASK_TITLE_MAX, TASK_DESCRIPTION_MAX, TASKS_PER_EVENT_MAX, MY_TASKS_OPEN_LIMIT, MY_TASKS_DONE_LIMIT, TASK_STATUSES, TASK_STATUS_LABELS,
  CreateTaskSchema, UpdateTaskSchema, ChangeTaskStatusSchema, DeleteTaskSchema } from './tasks.js'
export type { TaskStatus, TaskAction, CreateTaskRequest, UpdateTaskRequest, ChangeTaskStatusRequest, DeleteTaskRequest, TaskPerson, TaskSummary,
  TaskHistoryEntry, TaskDetail, TaskResponse, EventTasksResponse, MyTasksResponse } from './tasks.js'
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
  // 부서가 있는 구성원. 행사 일시·장소와 참가 신청을 관리하고 신청자 명단을 본다.
  manageEvents: boolean
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
  // 한국 시각 YYYY-MM-DDTHH:mm. 끝은 시작이 있을 때만 있다.
  startsAt: string | null
  endsAt: string | null
  place: string | null
  version: number
  // 행사를 완료한 시각(ISO, M5a). 완료하지 않았으면 null이다.
  completedAt: string | null
  // 행사 담당 부서와 책임자(M5b). 정하지 않았으면 null이다. 책임자는 소속 ID와 이름이다.
  ownerDepartment: { id: string; name: string } | null
  owner: { membershipId: string; name: string } | null
}

export interface EventResponse {
  event: EventSummary
}

export interface EventsResponse {
  events: EventSummary[]
}

// 완료 확인 대화상자(M5a). 정산해야 완료할 수 있고, 끝나지 않은 업무(예정·진행 중)는 알리기만 한다.
export interface EventCompletionResponse {
  settled: boolean
  openTasks: number
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
  RECEIPT_FILE_NAME_MAX, RECEIPT_SIZE_MAX, EXPENSE_METHODS, RECEIPT_KINDS, RECEIPT_CONTENT_TYPES, EXPENSE_METHOD_LABELS, RECEIPT_KIND_LABELS,
  CreateExpenseSchema, UpdateExpenseSchema, VoidExpenseSchema, CreateReceiptUploadSchema, ReceiptActionSchema } from './expenses.js'
export type { ExpenseMethod, ReceiptKind, ReceiptContentType, ExpenseAction, CreateExpenseRequest, UpdateExpenseRequest, VoidExpenseRequest,
  CreateReceiptUploadRequest, ExpensePerson, ExpenseItem, ExpenseSummary, ReceiptSummary, ExpenseHistoryEntry, ExpenseDetail,
  ExpensesResponse, ExpenseResponse, ReceiptUploadResponse, LinkableItemsResponse } from './expenses.js'
export { SETTLEMENT_REASON_MAX, EVENT_FINANCE_HISTORY_MAX, SetEventBudgetSchema, SettleEventSchema, ReopenSettlementSchema } from './settlement.js'
export type { EventFinanceAction, SetEventBudgetRequest, SettleEventRequest, ReopenSettlementRequest, EventFinanceHistoryEntry, EventFinance,
  EventFinanceResponse, EventFees, EventFeeIncome } from './settlement.js'
export { BUDGET_PERIOD_NAME_MAX, BUDGET_LINE_NAME_MAX, BUDGET_INCOME_LINES_MAX, BUDGET_OPERATING_LINES_MAX, BUDGET_EVENTS_MAX, BUDGET_PERIODS_MAX,
  BUDGET_CANDIDATES_MAX, BUDGET_HISTORY_MAX, BUDGET_REOPEN_REASON_MAX, CreateBudgetPeriodSchema, SaveBudgetPlanSchema, ClosePeriodSchema,
  ReopenPeriodSchema } from './budget.js'
export type { CreateBudgetPeriodRequest, SaveBudgetPlanRequest, ClosePeriodRequest, ReopenPeriodRequest, BudgetGroup, BudgetPeriodAction,
  BudgetPeriodSummary, BudgetPeriodsResponse, BudgetIncomeLine, BudgetEventLine, BudgetOperatingLine, BudgetCandidate, BudgetChange,
  BudgetHistoryEntry, BudgetClosing, BudgetTotals, BudgetPlanResponse } from './budget.js'
export { INCOME_DESCRIPTION_MAX, INCOME_NOTE_MAX, INCOME_VOID_REASON_MAX, INCOME_RECORDS_MAX, CreateIncomeSchema, UpdateIncomeSchema,
  VoidIncomeSchema } from './incomes.js'
export type { IncomeAction, CreateIncomeRequest, UpdateIncomeRequest, VoidIncomeRequest, IncomeSummary, IncomeHistoryEntry, IncomeDetail,
  IncomeResponse } from './incomes.js'
export type { EventReportFacts, ReportPerson, EventReportResponse, EventRecord, RecordsResponse } from './reports.js'
export { RETRO_TEXT_MAX, RETRO_ANSWER_MAX, RETRO_ITEMS_MAX, RETRO_GENERATED_MAX, RETRO_QUESTIONS_MAX, RETRO_SOURCES_MAX, RETRO_SECTIONS,
  RETRO_SECTION_LABELS, GenerateRetrospectiveSchema, SaveRetrospectiveSchema, ConfirmRetrospectiveSchema, dDayOf } from './reports.js'
export type { RetroSection, GenerateRetrospectiveRequest, SaveRetrospectiveRequest, ConfirmRetrospectiveRequest, RecordTab, RecordEntryKind,
  RecordEntry, RetrospectiveSource, RetrospectiveItemView, RetrospectiveQuestionView, RetrospectiveView, RetrospectiveState, RetrospectiveItem,
  RetrospectiveQuestion, RetrospectiveContent } from './reports.js'
export { HOME_TASKS_MAX, HOME_EXPENSES_MAX, HOME_ITEM_KINDS } from './home.js'
export type { HomeItemKind, HomeTaskCounts, HomeEvent, HomeItem, HomeDepartment, HomeResponse } from './home.js'
