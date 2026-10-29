import type { ExpenseDetail } from '@vada/contracts'
import { Badge } from '@/components/ui/badge'
import { openRecord } from '@/lib/go-to'
import { monthDay } from '@/lib/korean-date-text'
import { TaskEventLink } from '@/tasks/TaskEventLink'
import { chipsOf, METHOD_LABEL, paidByLabel } from './expense-view'
import { approvalLine } from './expense-text'
import { wonLabel } from './purchase-view'

// 지출의 칸: 사용처 아래에 금액, 결제일, 결제 수단, 먼저 낸 사람과 상태 칩, 예산 항목, 부탁한 사람, 사유.
export function ExpenseFacts({
  expense,
  councilId,
}: {
  expense: ExpenseDetail
  councilId: string
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-base font-semibold text-fg">{wonLabel(expense.amount)}</span>
        {chipsOf(expense).map(chip => (
          <Badge key={chip.label} tone={chip.tone}>
            {chip.label}
          </Badge>
        ))}
      </div>
      <p className="text-sm wrap-anywhere text-fg-body">{expense.description}</p>
      <div className="flex flex-col gap-1 text-xs text-fg-muted">
        <span>
          {monthDay(expense.paidOn)} · {METHOD_LABEL[expense.method]}
        </span>
        <span className="wrap-anywhere">{paidByLabel(expense)}</span>
        {expense.account && <span className="wrap-anywhere">계좌 {expense.account.name}</span>}
        {expense.event && (
          <span className="flex gap-1">
            행사
            <TaskEventLink
              event={expense.event}
              // 이 지출 상세 위에 쌓아, 행사에서 뒤로가 이 지출이다.
              onOpen={eventId => openRecord('events', councilId, eventId, { overRecord: true })}
              className="text-xs"
            />
          </span>
        )}
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
      <h3 className="text-sm font-medium text-fg-secondary">결제한 품목</h3>
      <ul className="flex flex-col gap-2">
        {lines.map(line => (
          <li key={line.lineItemId} className="flex flex-col gap-1 rounded-sm border p-3 text-xs">
            <span className="text-sm font-medium wrap-anywhere text-fg">
              {line.name} · {wonLabel(line.amount)}
            </span>
            <span className="wrap-anywhere text-fg-muted">요청 {line.requestTitle}</span>
            {line.budgetPurpose && (
              <span className="wrap-anywhere text-fg-muted">{line.budgetPurpose}</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

// 결재 기록: 누가 승인·반려했는지는 지금 상태를 설명하므로 상세에 남는다(DEC-80).
export function ExpenseApprovals({ approvals }: { approvals: ExpenseDetail['approvals'] }) {
  if (approvals.length === 0) return null
  return (
    <section aria-label="결재" className="flex flex-col gap-2">
      <h3 className="text-sm font-medium text-fg-secondary">결재</h3>
      <ul className="flex flex-col gap-1 text-xs text-fg-muted">
        {approvals.map(approval => (
          <li key={approval.id} className="wrap-anywhere">
            {approvalLine(approval)}
          </li>
        ))}
      </ul>
    </section>
  )
}
