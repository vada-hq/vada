import type { Closing, ClosingCheck, ClosingPendingEvent, SettlementTarget } from '@vada/contracts'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { targetLabel } from '@/events/settlement-view'
import { CHECK_LABEL, signedWon } from './closing-view'

export type ClosingOpeners = {
  onOpenExpense: (expenseId: string) => void
  onOpenRequest: (requestId: string) => void
  onOpenEvent: (eventId: string) => void
}

const linkClass =
  'h-auto max-w-full justify-start p-0 text-left text-sm whitespace-normal wrap-anywhere'

function Target({ target, openers }: { target: SettlementTarget; openers: ClosingOpeners }) {
  const open = () =>
    target.type === 'request' ? openers.onOpenRequest(target.id) : openers.onOpenExpense(target.id)
  return (
    <Button variant="link" className={linkClass} onClick={open}>
      {targetLabel(target)}
    </Button>
  )
}

function CheckRow({ check, openers }: { check: ClosingCheck; openers: ClosingOpeners }) {
  return (
    <li className="flex flex-col gap-1 rounded-sm border p-3">
      <span className="text-sm font-medium text-gray-900">
        {CHECK_LABEL[check.kind]} {check.count}개
      </span>
      {check.targets.map(target => (
        <Target key={`${target.type}-${target.id}`} target={target} openers={openers} />
      ))}
      {check.count > check.targets.length && (
        <span className="text-xs text-gray-500">외 {check.count - check.targets.length}개</span>
      )}
    </li>
  )
}

function PendingRow({ row, onOpen }: { row: ClosingPendingEvent; onOpen: (id: string) => void }) {
  return (
    <li className="flex flex-col gap-1 rounded-sm border p-3">
      <Button variant="link" className={linkClass} onClick={() => onOpen(row.event.id)}>
        {row.event.name}
      </Button>
      <span className="text-xs text-gray-500">
        입금 {row.depositCount}건 · {signedWon(row.amount)}
      </span>
    </li>
  )
}

// 점검: 증빙·사유 같은 빠진 것은 감사가 판단하므로 공개를 막지 않는다. 완료하지 않은 행사는 끝 날짜가 이 기간 안이거나 날짜 미정인 것이라 공개를 막는다.
// 다음 기간 행사에 받은 입금은 선수금이라 정보 줄로만 보이고 아무것도 막지 않는다.
export function ClosingChecks({
  closing,
  openers,
}: {
  closing: Pick<Closing, 'checks' | 'feePending'>
  openers: ClosingOpeners
}) {
  const checks = closing.checks.filter(check => check.count > 0)
  const { blocking, nextPeriod } = closing.feePending
  const empty = checks.length === 0 && blocking.length === 0
  return (
    <Card className="flex flex-col gap-3 p-4">
      <h3 className="text-sm font-semibold text-gray-900">점검</h3>
      {empty && <p className="text-sm text-gray-500">점검할 것 없음</p>}
      <ul className="flex flex-col gap-2">
        {blocking.length > 0 && (
          <li className="text-xs font-medium text-gray-700">완료하지 않은 행사의 입금</li>
        )}
        {blocking.map(row => (
          <PendingRow key={row.event.id} row={row} onOpen={openers.onOpenEvent} />
        ))}
        {checks.map(check => (
          <CheckRow key={check.kind} check={check} openers={openers} />
        ))}
      </ul>
      {nextPeriod.eventCount > 0 && (
        <Alert tone="info">
          다음 기간 행사에 받은 입금 {nextPeriod.depositCount}건 {signedWon(nextPeriod.amount)}은 이
          결산서의 수입에 없고 통장에는 있어요.
        </Alert>
      )}
    </Card>
  )
}
