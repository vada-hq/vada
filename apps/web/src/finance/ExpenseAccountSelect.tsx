import { useEffect, useRef } from 'react'
import StateMessage from '@/components/StateMessage'
import { EXPENSE_ACCOUNTS_FAILED } from '@/lib/messages'
import { ChoiceSelect } from '@/tasks/ChoiceSelect'
import { mainAccountOf, openAccounts } from './account-form'
import type { ExpenseValues } from './expense-form'
import { useAccounts } from './useAccounts'

type Props = {
  councilId: string
  values: ExpenseValues
  disabled: boolean
  // 함수로 바꾼다. 목록이 늦게 와도 그 사이에 사람이 바꾼 다른 칸을 되돌리지 않는다.
  onChange: (update: (values: ExpenseValues) => ExpenseValues) => void
  onForbidden: () => void
}

// 돈이 나간 계좌 고르기. 닫지 않은 계좌만 보이고 비울 수 있다. 목록을 처음 읽으면 닫지 않은 대표 계좌로 채운다(DEC-45).
// 사람이 비웠으면 다시 채우지 않는다. 읽지 못해도 계좌 없이 적을 수 있다.
export function ExpenseAccountSelect({
  councilId,
  values,
  disabled,
  onChange,
  onForbidden,
}: Props) {
  const list = useAccounts(councilId, onForbidden)
  const filled = useRef(false)
  const accounts = list.state.kind === 'ready' ? openAccounts(list.state.data.accounts) : null
  const main = list.state.kind === 'ready' ? mainAccountOf(list.state.data.accounts) : null
  const gone =
    accounts !== null &&
    values.accountId !== null &&
    !accounts.some(account => account.id === values.accountId)
  useEffect(() => {
    if (accounts === null || filled.current) return
    filled.current = true
    if (main)
      onChange(before => (before.accountId === null ? { ...before, accountId: main.id } : before))
  }, [accounts, main, onChange])
  // 다시 읽은 목록에서 고른 계좌가 닫혔으면 값을 비워 몰래 나가지 않게 한다.
  useEffect(() => {
    if (gone) onChange(before => ({ ...before, accountId: null }))
  }, [gone, onChange])
  if (list.state.kind === 'failed')
    return <StateMessage kind="error">{EXPENSE_ACCOUNTS_FAILED}</StateMessage>
  return (
    <ChoiceSelect
      label="계좌"
      choices={[
        { id: null, label: '없음' },
        ...(accounts ?? []).map(account => ({
          id: account.id,
          label: `${account.name} (${account.bank})`,
        })),
      ]}
      value={values.accountId}
      disabled={disabled}
      onChange={accountId => onChange(before => ({ ...before, accountId }))}
    />
  )
}
