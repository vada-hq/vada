import { codePoints, RECEIPTS_PER_EXPENSE_MAX, type ExpenseAction, type ExpenseHistoryEntry, type ExpenseMethod, type ExpenseSummary,
  type ReceiptKind } from '@vada/contracts'
import { won } from '../purchases/purchase-view'

export const methodLabels: Record<ExpenseMethod, string> = { council_card: '학생회 카드', transfer: '계좌이체', cash: '현금',
  personal: '개인 결제(환급 필요)' }
export const kindLabels: Record<ReceiptKind, string> = { receipt: '영수증', statement: '거래명세서', tax_invoice: '세금계산서', other: '기타' }
const actionLabels: Record<ExpenseAction, string> = { created: '기록', updated: '수정', voided: '취소', receipt_added: '증빙 추가',
  receipt_removed: '증빙 삭제' }
const fieldLabels: Record<string, string> = { event: '행사', vendor: '사용처', description: '내용', amount: '금액', paidOn: '결제일',
  method: '결제 수단', payer: '결제한 사람', note: '메모' }

export const eventText = (expense: Pick<ExpenseSummary, 'event'>) => expense.event?.name ?? '상시 운영'
// 2026-10-09 → 10.9
export const dayText = (paidOn: string) => `${Number(paidOn.slice(5, 7))}.${Number(paidOn.slice(8, 10))}`
export const monthTitle = (paidOn: string) => `${paidOn.slice(0, 4)}년 ${Number(paidOn.slice(5, 7))}월`
// 결제한 달별로 묶는다. 서버가 결제일 최근 순으로 준다.
export function groupByMonth<T extends Pick<ExpenseSummary, 'paidOn'>>(list: T[]) {
  const groups: { title: string; expenses: T[] }[] = []
  for (const expense of list) {
    const title = monthTitle(expense.paidOn)
    const last = groups.at(-1)
    if (last?.title === title) last.expenses.push(expense)
    else groups.push({ title, expenses: [expense] })
  }
  return groups
}
// 연결 품목의 승인 금액과 실제 결제액. 값을 모르면 비교하지 않는다.
export function comparisonText(expense: Pick<ExpenseSummary, 'approvedTotal' | 'amount'>) {
  if (expense.approvedTotal === null) return null
  const diff = expense.amount - expense.approvedTotal
  return `승인 ${won(expense.approvedTotal)} → 실제 ${won(expense.amount)}${diff === 0 ? '' : ` · ${won(Math.abs(diff))} ${diff > 0 ? '많음' : '적음'}`}`
}
function valueText(key: string, value: unknown) {
  if (value === null || value === undefined) return key === 'event' ? '상시 운영' : '없음'
  if (key === 'amount' && typeof value === 'number') return won(value)
  if (key === 'method' && typeof value === 'string' && value in methodLabels) return methodLabels[value as ExpenseMethod]
  return String(value)
}
// 처리 기록 한 줄. 수정은 바뀐 칸을 이전 → 이후로 적는다.
export function historyText(entry: ExpenseHistoryEntry) {
  const changes = entry.changes
  if (entry.action === 'updated') {
    const parts = Object.entries(changes).map(([key, change]) => {
      if (key === 'items') {
        const { added, removed } = change as { added: number; removed: number }
        return `연결 품목 ${[added ? `${added}개 더함` : '', removed ? `${removed}개 뺌` : ''].filter(Boolean).join(', ')}`
      }
      const { from, to } = change as { from: unknown; to: unknown }
      return `${fieldLabels[key] ?? key} ${valueText(key, from)} → ${valueText(key, to)}`
    })
    return `${actionLabels.updated}: ${parts.join(' · ')}`
  }
  if (entry.action === 'voided') return `${actionLabels.voided}: ${String(changes.reason ?? '')}`
  if (entry.action === 'receipt_added' || entry.action === 'receipt_removed') {
    const kind = typeof changes.kind === 'string' && changes.kind in kindLabels ? kindLabels[changes.kind as ReceiptKind] : '증빙'
    return `${actionLabels[entry.action]}: ${kind} ${String(changes.fileName ?? '')}`
  }
  return actionLabels[entry.action]
}
// 이름이 너무 길면 확장자를 남기고 줄인다. 길이는 서버와 같이 코드 포인트로 센다.
export function fitFileName(name: string, max: number) {
  const trimmed = name.trim() || '증빙'
  if (codePoints(trimmed) <= max) return trimmed
  const dot = trimmed.lastIndexOf('.')
  const extension = dot > 0 && codePoints(trimmed.slice(dot)) <= 10 ? trimmed.slice(dot) : ''
  return [...trimmed.slice(0, trimmed.length - extension.length)].slice(0, max - codePoints(extension)).join('') + extension
}

export const expenseErrors: Record<string, string> = {
  FORBIDDEN: '권한이 없어요. 재정 부서나 회장단만 할 수 있어요.',
  NOT_FOUND: '지출이나 품목을 찾을 수 없어요. 새로 불러와 주세요.',
  VERSION_CONFLICT: '다른 곳에서 먼저 바뀌었어요. 새로 불러와 주세요.',
  INVALID_STATE: '취소된 지출은 바꿀 수 없어요.',
  ITEM_NOT_LINKABLE: '연결할 수 없는 품목이 있어요. 같은 행사의 승인 품목 중 다른 지출에 연결되지 않은 것만 고를 수 있어요.',
  PAYER_NOT_MEMBER: '결제한 사람을 학생회 구성원 중에서 골라 주세요.',
  RECEIPT_LIMIT: `증빙은 지출 하나에 ${RECEIPTS_PER_EXPENSE_MAX}개까지 올릴 수 있어요.`,
  UPLOAD_MISMATCH: '파일이 제대로 올라가지 않았어요. 다시 올려 주세요.',
  STORAGE_NOT_CONFIGURED: '영수증 저장소가 아직 준비되지 않았어요.',
  INVALID_INPUT: '입력값을 확인해 주세요.',
}
export const expenseFailure = '처리하지 못했어요. 다시 시도해 주세요.'
export const expenseMessage = (code: unknown) => typeof code === 'string' ? expenseErrors[code] ?? expenseFailure : expenseFailure
