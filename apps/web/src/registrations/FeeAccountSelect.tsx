import StateMessage from '@/components/StateMessage'
import { openAccounts, pickAccount } from '@/finance/account-form'
import { useAccounts } from '@/finance/useAccounts'
import { FEE_ACCOUNT_CLOSED, FEE_ACCOUNTS_FAILED } from '@/lib/registration-messages'
import { Field } from '@/components/ui/field'
import { NativeSelect } from '@/components/ui/native-select'
import { choiceId, choiceValue } from '@/tasks/task-form-options'

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

type Props = {
  account: FeeAccount
  disabled: boolean
  // 만들기를 눌렀는데 고르지 않았다.
  error?: string | undefined
  onPick: (accountId: string | null) => void
}

// 참가비 계좌 고르기. 닫지 않은 계좌만 보인다. 고른 계좌가 닫혔으면 조용히 비우지 않고 이유를 보인다.
export function FeeAccountSelect({ account, disabled, error, onPick }: Props) {
  if (account.failed) return <StateMessage kind="error">{FEE_ACCOUNTS_FAILED}</StateMessage>
  return (
    <div className="flex flex-col gap-2">
      <Field label="참가비 받을 계좌" required error={error}>
        <NativeSelect
          value={choiceValue(account.pick.id)}
          disabled={disabled}
          onChange={event => onPick(choiceId(event.target.value))}
        >
          <option value={choiceValue(null)}>계좌 선택</option>
          {openAccounts(account.accounts ?? []).map(item => (
            <option key={item.id} value={item.id}>
              {`${item.name} (${item.bank})`}
            </option>
          ))}
        </NativeSelect>
      </Field>
      {account.pick.closed && <StateMessage kind="error">{FEE_ACCOUNT_CLOSED}</StateMessage>}
    </div>
  )
}
