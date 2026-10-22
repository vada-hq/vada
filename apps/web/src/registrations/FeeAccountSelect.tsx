import StateMessage from '@/components/StateMessage'
import { openAccounts, pickAccount } from '@/finance/account-form'
import { useAccounts } from '@/finance/useAccounts'
import { FEE_ACCOUNT_CLOSED, FEE_ACCOUNTS_FAILED } from '@/lib/messages'
import { ChoiceSelect } from '@/tasks/ChoiceSelect'

// 참가비를 받을 계좌와 그 목록에서 본 지금 계좌(고르지 않았으면 닫지 않은 대표 계좌). 상태에 채워 넣지 않고 그때그때 구한다(pickAccount).
export function useFeeAccount(
  councilId: string,
  onForbidden: () => void,
  chosen: string | null | undefined,
) {
  const list = useAccounts(councilId, onForbidden)
  const accounts = list.state.kind === 'ready' ? list.state.data.accounts : null
  return { accounts, failed: list.state.kind === 'failed', pick: pickAccount(chosen, accounts) }
}
type FeeAccount = ReturnType<typeof useFeeAccount>

type Props = { account: FeeAccount; disabled: boolean; onPick: (accountId: string | null) => void }

// 참가비 계좌 고르기. 닫지 않은 계좌만 보인다. 고른 계좌가 닫혔으면 조용히 비우지 않고 이유를 보인다.
export function FeeAccountSelect({ account, disabled, onPick }: Props) {
  if (account.failed) return <StateMessage kind="error">{FEE_ACCOUNTS_FAILED}</StateMessage>
  return (
    <div className="flex flex-col gap-2">
      <ChoiceSelect
        label="참가비 받을 계좌"
        choices={[
          { id: null, label: '고르세요' },
          ...openAccounts(account.accounts ?? []).map(item => ({
            id: item.id,
            label: `${item.name} (${item.bank})`,
          })),
        ]}
        value={account.pick.id}
        disabled={disabled}
        onChange={onPick}
      />
      {account.pick.closed && <StateMessage kind="error">{FEE_ACCOUNT_CLOSED}</StateMessage>}
    </div>
  )
}
