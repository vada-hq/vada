import { useEffect } from 'react'
import { statusOf, type BudgetResponse } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { INCOME_ITEMS_FAILED } from '@/lib/messages'
import { usePolledRead } from '@/lib/use-polled-read'
import { ChoiceSelect } from '@/tasks/ChoiceSelect'
import { incomeItems } from './budget-form'
import { budgetPath } from './finance-api'
import { wonLabel } from './purchase-view'

type Props = {
  councilId: string
  // 수입을 적는 회계 기간. 서버는 받은 날이 든 기간의 수입 항목만 받으므로(DEC-70) 그 기간의 예산을 읽는다. 끝난 기간도 같다.
  periodId: string
  value: string | null
  disabled: boolean
  onChange: (budgetItemId: string | null) => void
  onForbidden: () => void
}

// 수입 예산 항목 고르기(고르지 않을 수도 있다).
// 다시 읽은 목록에서 고른 항목이 사라졌으면 값을 비워 몰래 나가지 않게 한다.
export function IncomeItemSelect({
  councilId,
  periodId,
  value,
  disabled,
  onChange,
  onForbidden,
}: Props) {
  const budget = usePolledRead<BudgetResponse>(budgetPath(councilId, periodId), status => {
    if (status === statusOf('FORBIDDEN')) onForbidden()
  })
  const loaded = budget.state.kind === 'ready'
  const items = budget.state.kind === 'ready' ? incomeItems(budget.state.data.items) : []
  const gone = loaded && value !== null && !items.some(item => item.id === value)
  useEffect(() => {
    if (gone) onChange(null)
  }, [gone, onChange])
  if (budget.state.kind === 'failed')
    return <StateMessage kind="error">{INCOME_ITEMS_FAILED}</StateMessage>
  return (
    <ChoiceSelect
      label="수입 예산 항목"
      optional
      choices={[
        { id: null, label: '고르지 않음' },
        ...items.map(item => ({
          id: item.id,
          label: `${item.purpose} (${wonLabel(item.amount)})`,
        })),
      ]}
      value={value}
      disabled={disabled}
      onChange={onChange}
    />
  )
}
