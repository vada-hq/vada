import type { DeliveryStatus, PurchaseCandidate, PurchaseCandidateRequest, PurchaseCandidateShare, PurchaseItemAction, PurchaseItemHistoryEntry,
  PurchaseItemStatus, PurchaseItemSummary } from '@vada/contracts'
import type { Tone } from '@/components/ui/badge'
import { deliveryStatusLabels, deliveryStatusTones } from '../deliveries/delivery-status'

// 고른 버튼을 활성 메뉴 색으로 보여 준다. 보기 전환과 빠른 날짜 버튼이 쓴다.
export const pressed = 'aria-pressed:border-primary aria-pressed:bg-accent aria-pressed:text-accent-foreground'

export const statusLabels: Record<PurchaseItemStatus, string> = { draft: '작성 중', pending: '대기', approved: '승인', rejected: '반려', cancelled: '요청 취소' }
const statusTones: Record<PurchaseItemStatus, Tone> = { draft: 'neutral', pending: 'info', approved: 'success', rejected: 'danger', cancelled: 'neutral' }
// 나눠 온 송장 중 가장 늦은 단계를 품목의 배송 단계로 본다. 문제가 하나라도 있으면 문제로 보인다.
const shipmentOrder: DeliveryStatus[] = ['exception', 'unknown', 'pending', 'in_transit', 'delivered']

// 승인된 품목은 구매함·배송·수령 표시로 진행 단계를 보여 준다.
export function progressOf(item: PurchaseItemSummary): { label: string; tone: Tone } {
  if (item.status !== 'approved') return { label: statusLabels[item.status], tone: statusTones[item.status] }
  if (item.receivedAt) return { label: '수령 완료', tone: 'success' }
  const status = shipmentOrder.find(value => item.shipments.some(shipment => shipment.status === value))
  if (status) return { label: deliveryStatusLabels[status], tone: deliveryStatusTones[status] }
  return item.purchasedAt ? { label: '구매함', tone: 'info' } : { label: '승인', tone: 'success' }
}
export type Section = 'draft' | 'active' | 'ended'
export function sectionOf(item: PurchaseItemSummary): Section {
  if (item.status === 'draft') return 'draft'
  return item.status === 'pending' || (item.status === 'approved' && !item.receivedAt) ? 'active' : 'ended'
}
// 서버의 제출 필수값과 같다. 빈 칸 이름을 보여 준다.
export function missingFields(item: PurchaseItemSummary) {
  return [...(!item.productName ? ['상품명'] : []), ...(item.quantity === null ? ['수량'] : []),
    ...(item.optionRequired === null ? ['옵션 필요 여부'] : []), ...(item.optionRequired && !item.selectedOption ? ['선택 옵션'] : [])]
}
export const amountOf = (item: PurchaseItemSummary) =>
  item.quantity !== null && item.estimatedUnitPrice !== null ? item.quantity * item.estimatedUnitPrice : null
export function totalOf(items: PurchaseItemSummary[]) {
  const amounts = items.map(amountOf)
  return { known: amounts.reduce<number>((sum, value) => sum + (value ?? 0), 0), complete: amounts.every(value => value !== null) }
}
export const won = (value: number) => `${value.toLocaleString('ko-KR')}원`
// 가격은 상품 조회값이라 저장하지 않고 화면에 고정 안내로 둔다.
export const priceNotice = '조회 가격은 참고값이에요. 옵션·포장 단위와 배송비·최종 결제 금액을 확인해 주세요.'
const seoul = { timeZone: 'Asia/Seoul' } as const
// 10/9처럼 월/일. 조회 날짜에 쓴다.
export function shortDay(value: string) {
  const parts = new Intl.DateTimeFormat('ko-KR', { ...seoul, month: 'numeric', day: 'numeric' }).formatToParts(new Date(value))
  return `${parts.find(part => part.type === 'month')!.value}/${parts.find(part => part.type === 'day')!.value}`
}
export const candidateName = (candidate: PurchaseCandidate) => candidate.product?.name
  ?? (candidate.lookup === 'failed' ? '상품 정보를 가져오지 못했어요. 쿠팡에서 확인해 주세요.' : '상품 정보를 불러오는 중…')
export function candidatePrice(candidate: PurchaseCandidate) {
  const price = candidate.product?.price ?? null
  return `${price === null ? '금액 확인 필요' : `예상 ${won(price)}`}${candidate.fetchedAt ? ` · ${shortDay(candidate.fetchedAt)} 기준` : ''}`
}
export const shareText = (share: PurchaseCandidateShare) => `${share.author.name} · ${new Date(share.sharedAt)
  .toLocaleString('ko-KR', { ...seoul, month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })}에 공유`
export const hiddenText = (hidden: NonNullable<PurchaseCandidate['hidden']>) =>
  `${hidden.by.name} · ${new Date(hidden.at).toLocaleDateString('ko-KR', { ...seoul, month: 'long', day: 'numeric' })}에 숨김`
export const requestText = (request: PurchaseCandidateRequest) =>
  `요청됨 · ${request.requester.name}${request.quantity === null ? '' : ` · ${request.quantity}개`}`

// 빠른 버튼은 저장할 때 한국 날짜로 바꾼다(2026-10-04 결정).
export const quickDates = [{ label: '3일 안', days: 3 }, { label: '1주 안', days: 7 }, { label: '2주 안', days: 14 }] as const
export const todayInSeoul = (now = new Date()) => now.toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
export function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}
export function neededByText(value: string | null) {
  if (!value) return '상관없음'
  const [, month, day] = value.split('-')
  return `${Number(month)}월 ${Number(day)}일까지`
}
export const timeText = (value: string) =>
  new Date(value).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })

export interface SubmissionGroup {
  id: string
  requester: PurchaseItemSummary['requester']
  departmentName: string | null
  event: PurchaseItemSummary['event']
  submittedAt: string
  items: PurchaseItemSummary[]
}
// 같이 제출한 품목끼리 처음 나온 순서대로 묶는다. 서버가 오래된 제출부터 준다.
export function groupBySubmission(items: PurchaseItemSummary[]): SubmissionGroup[] {
  const groups = new Map<string, SubmissionGroup>()
  for (const item of items) {
    const key = item.submissionId ?? item.id
    const group = groups.get(key) ?? { id: key, requester: item.requester, departmentName: item.departmentName, event: item.event,
      submittedAt: item.submittedAt ?? item.createdAt, items: [] }
    group.items.push(item)
    groups.set(key, group)
  }
  return [...groups.values()]
}

const actionLabels: Record<PurchaseItemAction, string> = { submitted: '제출', approved: '승인', rejected: '반려', cancelled: '요청 취소',
  approval_revoked: '승인 취소', needed_by_changed: '받을 날짜 변경', purchased: '구매함 표시', purchase_undone: '구매 표시 취소',
  received: '수령 확인', receipt_undone: '수령 취소', re_added: '다시 담기' }
// 요청자가 직접 결정한 기록은 따로 보여 준다(본인 승인은 막지 않고 기록한다, 2026-10-08 결정).
export function actionText(entry: PurchaseItemHistoryEntry, requesterId: string) {
  if (entry.actor.id === requesterId && entry.action === 'approved') return '본인 승인'
  if (entry.actor.id === requesterId && entry.action === 'rejected') return '본인 반려'
  return actionLabels[entry.action]
}

export const purchaseErrors: Record<string, string> = {
  VERSION_CONFLICT: '다른 곳에서 먼저 바뀌었어요. 목록을 새로 불러왔어요.',
  INVALID_STATE: '지금 상태에서는 할 수 없어요. 목록을 새로 불러왔어요.',
  NOT_FOUND: '품목을 찾을 수 없어요. 목록을 새로 불러왔어요.',
  ALREADY_SHIPPED: '송장이 연결된 품목이에요. 송장 연결을 먼저 해제해 주세요.',
  SUBMISSION_INCOMPLETE: '제출 전에 상품명·수량·옵션을 채워 주세요.',
  INVALID_PRODUCT_LINK: '쿠팡 상품 링크만 담을 수 있어요. 주소창의 상품 링크를 넣어 주세요.',
  DUPLICATE_LINK: '같은 링크가 두 번 들어 있어요.',
  GENERATION_IN_PROGRESS: '끼룩이가 이미 담는 중이에요. 잠시 후 다시 시도해 주세요.',
  IDEMPOTENCY_CONFLICT: '입력이 바뀌었어요. 담기를 다시 눌러 주세요.',
  GENERATION_FAILED: '끼룩이가 품목을 만들지 못했어요. 다시 시도해 주세요.',
  AI_NOT_CONFIGURED: '끼룩이 설정이 아직 안 됐어요. 관리자에게 알려 주세요.',
  FORBIDDEN: '권한이 없어요. 소속을 확인해 주세요.',
  INVALID_INPUT: '입력값을 확인해 주세요.',
}
export const purchaseFailure = '처리하지 못했어요. 다시 시도해 주세요.'
// 화면이 오래된 경우다. 목록을 새로 불러온다.
export const staleCodes = new Set(['VERSION_CONFLICT', 'INVALID_STATE', 'NOT_FOUND', 'ALREADY_SHIPPED'])
export const messageOf = (code: unknown) => typeof code === 'string' ? purchaseErrors[code] ?? purchaseFailure : purchaseFailure
