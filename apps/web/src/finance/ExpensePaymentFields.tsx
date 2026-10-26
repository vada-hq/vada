import type { FiscalPeriodView } from '@vada/contracts'
import { PaymentFields, type FieldsProps } from './ExpenseFields'
import { usePeriods } from './useIncomes'

const NO_EXPENSE_PERIOD = '이 날짜가 든 회계 기간이 없어요'

export function expensePeriodNotice(day: string, periods: readonly FiscalPeriodView[]) {
  if (!day || periods.some(period => period.startsOn <= day && day <= period.endsOn))
    return undefined
  return NO_EXPENSE_PERIOD
}

export function ExpensePaymentFields({
  councilId,
  onForbidden,
  ...props
}: FieldsProps & {
  councilId: string
  onForbidden: () => void
}) {
  const periods = usePeriods(councilId, onForbidden)
  const notice =
    periods.state.kind === 'ready'
      ? expensePeriodNotice(props.values.paidOn, periods.state.data.periods)
      : undefined
  return <PaymentFields {...props} paidOnNotice={notice} />
}
