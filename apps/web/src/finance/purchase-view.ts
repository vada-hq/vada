import {
  DAY_MS,
  koreanDateOf,
  type LineItemStatus,
  type PurchaseRequestSummary,
  type PurchaseStatus,
  type PurchaseView,
} from '@vada/contracts'
import { monthDay } from '@/lib/korean-date-text'

export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'

export const STATUS_LABEL: Record<PurchaseStatus, string> = {
  pending: '결재 대기',
  approved: '승인',
  rejected: '반려',
  partial: '일부 승인',
  cancelled: '취소',
}
export const STATUS_TONE: Record<PurchaseStatus, Tone> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
  partial: 'info',
  cancelled: 'neutral',
}

export const ITEM_STATUS_LABEL: Record<LineItemStatus, string> = {
  pending: '대기',
  approved: '승인',
  rejected: '반려',
  cancelled: '취소됨',
}
export const ITEM_STATUS_TONE: Record<LineItemStatus, Tone> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
  cancelled: 'neutral',
}

export const VIEW_LABEL: Record<PurchaseView, string> = {
  mine: '내 요청',
  pending: '결재 대기',
  all: '전체',
}
export const VIEW_EMPTY: Record<PurchaseView, string> = {
  mine: '내가 낸 구매 요청이 없어요.',
  pending: '결재를 기다리는 요청이 없어요.',
  all: '구매 요청이 없어요.',
}

export const neededByLabel = (neededBy: string | null) =>
  neededBy ? `${monthDay(neededBy)}까지 필요` : '필요한 때 없음'

// 결재 목록에서 '임박'을 붙이는 기간: 필요한 때가 오늘(한국)부터 이 날수 안이거나 지났다(DEC-92, 024 정한 것 9). 시범 운영에서 고친다.
const NEEDED_SOON_DAYS = 3
export const neededSoon = (neededBy: string | null, now: Date) =>
  neededBy !== null && neededBy <= koreanDateOf(new Date(now.getTime() + NEEDED_SOON_DAYS * DAY_MS))

// 정수 원 → '12,000원'
export const wonLabel = (amount: number) =>
  `${String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}원`

export interface PendingCount {
  label: string
  description: string
}

// 옆 메뉴 '재정'의 결재 대기 수. 0이면 없고, 넘치면 '+'다.
export function pendingCountOf(
  pending: PurchaseRequestSummary[],
  truncated: boolean,
): PendingCount | null {
  if (pending.length === 0) return null
  const plus = truncated ? '+' : ''
  return {
    label: `${pending.length}${plus}`,
    description: `결재 대기 요청 ${pending.length}개${truncated ? ' 이상' : ''}`,
  }
}
