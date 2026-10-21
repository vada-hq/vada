import {
  EVIDENCE_MAX,
  type EvidenceType,
  type ExpenseDetail,
  type ExpenseMethod,
  type ExpenseSummary,
} from '@vada/contracts'

export const METHOD_LABEL: Record<ExpenseMethod, string> = {
  card: '카드',
  transfer: '계좌 이체',
  cash: '현금',
}

export const EVIDENCE_TYPE_LABEL: Record<EvidenceType, string> = {
  receipt: '영수증',
  statement: '거래명세서',
  tax_invoice: '세금계산서',
  card_statement: '카드 전표',
  transfer_confirmation: '이체 확인증',
  item_photo: '물품 사진',
  site_photo: '현장 사진',
  stock_photo: '입고 사진',
  other: '기타',
}

// 목록 카드와 상세가 같이 보이는 상태 칩. 취소된 지출은 환급 전과 증빙 없음을 말하지 않는다.
export type ExpenseChip = { label: string; tone: 'neutral' | 'warning' | 'success' }
export function chipsOf(expense: ExpenseSummary): ExpenseChip[] {
  if (expense.cancelled) return [{ label: '취소됨', tone: 'neutral' }]
  const chips: ExpenseChip[] = []
  if (expense.paidBy) {
    chips.push(
      expense.reimbursed
        ? { label: '환급함', tone: 'success' }
        : { label: '환급 전', tone: 'warning' },
    )
  }
  if (expense.evidenceCount === 0) chips.push({ label: '증빙 없음', tone: 'warning' })
  return chips
}

// 사진을 붙일 수 있는가. 재정부이고, 취소되지 않았고, 한도 안일 때다. 올리기 버튼과 서버 거절이 같은 조건을 본다.
export const canAttachEvidence = (expense: ExpenseDetail, canManage: boolean) =>
  canManage && !expense.cancelled && expense.evidence.length < EVIDENCE_MAX

export const paidByLabel = (expense: ExpenseSummary) =>
  expense.paidBy ? `먼저 낸 사람 ${expense.paidBy.name}` : '학생회 돈'
