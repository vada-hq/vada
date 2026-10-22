import type { ClosingCheckKind } from './closing.js'
import type { EvidenceType, ExpenseMethod } from './expenses.js'
import type { IncomeSource } from './incomes.js'

// 사람이 읽는 이름. 화면과 엑셀이 같은 말을 쓴다.
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

// 참가비는 행사 완료 때, 이월금은 결산 공개 때 서버가 만든다. 출처 이름이 곧 그 표시다.
export const SOURCE_LABEL: Record<IncomeSource, string> = {
  fee: '학생회비',
  grant: '지원금',
  business: '사업 수익',
  donation: '후원금',
  other: '기타',
  participation_fee: '참가비',
  carryover: '이월금',
}

export const CLOSING_CHECK_LABEL: Record<ClosingCheckKind, string> = {
  no_evidence: '증빙 없음',
  no_reason: '사유 없음',
  unreimbursed: '환급 전',
  no_account: '계좌 없음',
  no_item: '예산 항목 없음',
  other_period_item: '다른 기간 예산 항목',
}
