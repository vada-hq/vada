import type { LineItemStatus, PurchaseStatus, PurchaseView } from '@vada/contracts'
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

// 정수 원 → '12,000원'
export const wonLabel = (amount: number) =>
  `${String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}원`
