import { councilPath } from '@/finance/finance-api'

export const feePaymentsPath = (councilId: string, studentId?: string) =>
  `${councilPath(councilId)}/fee-payments${studentId ? `?studentId=${encodeURIComponent(studentId)}` : ''}`
export const feePaymentRemovePath = (councilId: string, paymentId: string) =>
  `${councilPath(councilId)}/fee-payments/${encodeURIComponent(paymentId)}/remove`
