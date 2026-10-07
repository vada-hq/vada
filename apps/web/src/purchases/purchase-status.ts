import type { PurchaseStatus } from '@vada/contracts'
import type { Tone } from '@/components/ui/badge'

export const purchaseStatusLabels: Record<PurchaseStatus, string> = {
  draft: '검토 대기', discarded: '폐기', submitted: '접수', approved: '승인', rejected: '반려',
}
// 접수는 정보, 승인은 성공, 반려는 위험, 작성 중·폐기는 중립 색이다.
export const purchaseStatusTones: Record<PurchaseStatus, Tone> = {
  draft: 'neutral', discarded: 'neutral', submitted: 'info', approved: 'success', rejected: 'danger',
}
