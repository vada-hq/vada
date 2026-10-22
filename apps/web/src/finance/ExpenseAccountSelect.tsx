import StateMessage from '@/components/StateMessage'
import { EXPENSE_ACCOUNT_CLOSED, EXPENSE_ACCOUNTS_FAILED } from '@/lib/messages'
import { ChoiceSelect } from '@/tasks/ChoiceSelect'
import { openAccounts, pickAccount } from './account-form'
import { useAccounts } from './useAccounts'

// 계좌 목록과, 그 목록에서 본 지금 계좌(고르지 않았으면 대표 계좌). 상태에 채워 넣지 않고 그때그때 구한다(pickAccount).
export function useExpenseAccount(
  councilId: string,
  onForbidden: () => void,
  chosen: string | null | undefined,
) {
  const list = useAccounts(councilId, onForbidden)
  const accounts = list.state.kind === 'ready' ? list.state.data.accounts : null
  return { accounts, failed: list.state.kind === 'failed', pick: pickAccount(chosen, accounts) }
}
type ExpenseAccount = ReturnType<typeof useExpenseAccount>

type Props = {
  account: ExpenseAccount
  disabled: boolean
  onPick: (accountId: string | null) => void
}

// 돈이 나간 계좌 고르기. 닫지 않은 계좌만 보이고 비울 수 있다. 읽지 못해도 계좌 없이 적을 수 있다.
// 고른 계좌가 닫혔으면 조용히 비우지 않고 이유를 칸 옆에 보인다.
export function ExpenseAccountSelect({ account, disabled, onPick }: Props) {
  if (account.failed) return <StateMessage kind="error">{EXPENSE_ACCOUNTS_FAILED}</StateMessage>
  return (
    <div className="flex flex-col gap-2">
      <ChoiceSelect
        label="계좌"
        choices={[
          { id: null, label: '없음' },
          ...openAccounts(account.accounts ?? []).map(item => ({
            id: item.id,
            label: `${item.name} (${item.bank})`,
          })),
        ]}
        value={account.pick.id}
        disabled={disabled}
        onChange={onPick}
      />
      {account.pick.closed && <StateMessage kind="error">{EXPENSE_ACCOUNT_CLOSED}</StateMessage>}
    </div>
  )
}
