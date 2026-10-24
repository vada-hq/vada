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
  value: string | null
  disabled: boolean
  onChange: (budgetItemId: string | null) => void
  onForbidden: () => void
}

// 수입 예산 항목 고르기. 예산 읽기는 지금 회계 기간의 항목만 주므로 지금 기간에 적을 때만 부른다(그래서 고르지 않을 수도 있다).
// 다시 읽은 목록에서 고른 항목이 사라졌으면(기간이 바뀜) 값을 비워 몰래 나가지 않게 한다.
export function IncomeItemSelect({ councilId, value, disabled, onChange, onForbidden }: Props) {
  const budget = usePolledRead<BudgetResponse>(budgetPath(councilId), status => {
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
