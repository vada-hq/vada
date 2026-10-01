import type { PurchaseStatus } from '@vada/contracts'
export const purchaseStatusLabels: Record<PurchaseStatus, string> = {
  draft: '검토 대기', discarded: '폐기', submitted: '접수', approved: '승인', rejected: '반려',
}
