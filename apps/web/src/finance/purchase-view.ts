import {
  DAY_MS,
  koreanDateOf,
  type LineItemStatus,
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
  department: '부서 구매',
}
export const VIEW_EMPTY: Record<PurchaseView, string> = {
  mine: '내 구매 요청 없음',
  pending: '결재 대기 요청 없음',
  all: '구매 요청 없음',
  department: '부서 구매 요청 없음',
}

export const neededByLabel = (neededBy: string | null) =>
  neededBy ? `${monthDay(neededBy)}까지 필요` : '필요한 때 없음'

// 결재 목록에서 '임박'을 붙이는 기간: 필요한 때가 오늘(한국)부터 이 날수 안(DEC-92, 024 정한 것 9). 시범 운영에서 고친다.
const NEEDED_SOON_DAYS = 3
export type NeededMark = 'overdue' | 'soon' | null

// 필요한 때 표시: 이미 지났으면 '지남'(업무의 지남과 같은 빨강), 3일 안이면 '임박'(노랑), 아니면 없다.
export function neededMarkOf(neededBy: string | null, now: Date): NeededMark {
  if (neededBy === null) return null
  if (neededBy < koreanDateOf(now)) return 'overdue'
  return neededBy <= koreanDateOf(new Date(now.getTime() + NEEDED_SOON_DAYS * DAY_MS))
    ? 'soon'
    : null
}

// 정수 원 → '12,000원'
export const wonLabel = (amount: number) =>
  `${String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}원`
