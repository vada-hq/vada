import type { ExpenseDetail } from '@vada/contracts'
import { Badge } from '@/components/ui/badge'
import { monthDay } from '@/lib/korean-date-text'
import { chipsOf, METHOD_LABEL, paidByLabel } from './expense-view'
import { approvalLine, versionLine } from './expense-text'
import { wonLabel } from './purchase-view'

// 지출의 칸: 사용처 아래에 금액, 결제일, 결제 수단, 먼저 낸 사람과 상태 칩, 예산 항목, 부탁한 사람, 사유.
export function ExpenseFacts({ expense }: { expense: ExpenseDetail }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-base font-semibold text-gray-900">{wonLabel(expense.amount)}</span>
        {chipsOf(expense).map(chip => (
          <Badge key={chip.label} tone={chip.tone}>
            {chip.label}
          </Badge>
        ))}
      </div>
      <p className="text-sm wrap-anywhere text-gray-800">{expense.description}</p>
      <div className="flex flex-col gap-1 text-xs text-gray-500">
        <span>
          {monthDay(expense.paidOn)} · {METHOD_LABEL[expense.method]}
        </span>
        <span className="wrap-anywhere">{paidByLabel(expense)}</span>
        {expense.account && <span className="wrap-anywhere">계좌 {expense.account.name}</span>}
        {expense.budgetItem && (
          <span className="wrap-anywhere">예산 항목 {expense.budgetItem.purpose}</span>
        )}
        {expense.requestedBy && (
          <span className="wrap-anywhere">부탁한 사람 {expense.requestedBy.name}</span>
        )}
        {expense.reason && <span className="wrap-anywhere">사유 {expense.reason}</span>}
      </div>
    </div>
  )
}

// 결제한 품목: 품목 이름과 결제 금액, 어느 요청의 것인지, 승인할 때 정한 예산 항목.
export function ExpenseLines({ lines }: { lines: ExpenseDetail['lines'] }) {
  if (lines.length === 0) return null
  return (
    <section aria-label="결제한 품목" className="flex flex-col gap-2">
      <h3 className="text-sm font-medium text-gray-700">결제한 품목</h3>
      <ul className="flex flex-col gap-2">
        {lines.map(line => (
          <li key={line.lineItemId} className="flex flex-col gap-1 rounded-sm border p-3 text-xs">
            <span className="text-sm font-medium wrap-anywhere text-gray-900">
              {line.name} · {wonLabel(line.amount)}
            </span>
            <span className="wrap-anywhere text-gray-500">요청 {line.requestTitle}</span>
            {line.budgetPurpose && (
              <span className="wrap-anywhere text-gray-500">{line.budgetPurpose}</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

// 결재와 이력: 오래된 판부터 모두(DEC-34, DEC-46).
export function ExpenseRecords({ expense }: { expense: ExpenseDetail }) {
  return (
    <>
      {expense.approvals.length > 0 && (
        <section aria-label="결재 이력" className="flex flex-col gap-2">
          <h3 className="text-sm font-medium text-gray-700">결재 이력</h3>
          <ul className="flex flex-col gap-1 text-xs text-gray-500">
            {expense.approvals.map(approval => (
              <li key={approval.id} className="wrap-anywhere">
                {approvalLine(approval)}
              </li>
            ))}
          </ul>
        </section>
      )}
      <section aria-label="이력" className="flex flex-col gap-2">
        <h3 className="text-sm font-medium text-gray-700">이력</h3>
        <ol className="flex flex-col gap-1 text-xs text-gray-500">
          {expense.history.map(version => (
            <li key={version.versionNo} className="wrap-anywhere">
              {versionLine(version)}
            </li>
          ))}
        </ol>
      </section>
    </>
  )
}
