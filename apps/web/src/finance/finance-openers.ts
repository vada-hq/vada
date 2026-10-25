import { openRecord } from '@/lib/go-to'
import type { ClosingOpeners } from './ClosingChecks'

// 요청·지출·행사는 그 종류의 주소로 연다(닫으면 들어온 곳으로 돌아간다).
export const financeOpeners = (councilId: string): ClosingOpeners => ({
  onOpenRequest: id => openRecord('purchases', councilId, id),
  onOpenExpense: id => openRecord('expenses', councilId, id),
  onOpenEvent: id => openRecord('events', councilId, id),
})
