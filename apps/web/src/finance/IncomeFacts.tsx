import type { IncomeDetail } from '@vada/contracts'
import { Badge } from '@/components/ui/badge'
import { monthDay } from '@/lib/korean-date-text'
import { SOURCE_LABEL, versionLine } from './income-view'
import { wonLabel } from './purchase-view'

// 수입의 칸: 금액과 취소됨, 내용, 받은 날, 기간, 계좌, 예산 항목, 적은 사람.
export function IncomeFacts({ income }: { income: IncomeDetail }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-base font-semibold text-gray-900">{wonLabel(income.amount)}</span>
        {income.cancelled && <Badge>취소됨</Badge>}
      </div>
      {income.description && (
        <p className="text-sm wrap-anywhere text-gray-800">{income.description}</p>
      )}
      <div className="flex flex-col gap-1 text-xs text-gray-500">
        <span>
          {SOURCE_LABEL[income.source]} · {monthDay(income.receivedOn)}
        </span>
        <span className="wrap-anywhere">회계 기간 {income.period.name}</span>
        {income.account && <span className="wrap-anywhere">계좌 {income.account.name}</span>}
        {income.budgetItem && (
          <span className="wrap-anywhere">예산 항목 {income.budgetItem.purpose}</span>
        )}
        {income.createdBy && (
          <span className="wrap-anywhere">적은 사람 {income.createdBy.name}</span>
        )}
      </div>
    </div>
  )
}

// 이력: 오래된 판부터 모두(DEC-34).
export function IncomeRecords({ income }: { income: IncomeDetail }) {
  return (
    <section aria-label="이력" className="flex flex-col gap-2">
      <h3 className="text-sm font-medium text-gray-700">이력</h3>
      <ol className="flex flex-col gap-1 text-xs text-gray-500">
        {income.history.map(version => (
          <li key={version.versionNo} className="wrap-anywhere">
            {versionLine(version)}
          </li>
        ))}
      </ol>
    </section>
  )
}
