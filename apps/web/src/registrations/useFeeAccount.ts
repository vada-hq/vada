import type { AccountItem } from '@vada/contracts'
import { openAccounts, pickAccount } from '@/finance/account-form'
import { useAccounts } from '@/finance/useAccounts'

// 참가비 계좌. 고르지 않았으면 닫지 않은 대표 계좌(pickAccount), 대표 계좌가 없어도 열린 계좌가 하나뿐이면 그 계좌다
// (학생회 계좌는 보통 하나라 또 고르게 하지 않는다, 대표 확정 10/30). 상태에 채워 넣지 않고 그때그때 구한다.
function pickFeeAccount(chosen: string | null | undefined, accounts: AccountItem[] | null) {
  const picked = pickAccount(chosen, accounts)
  if (chosen !== undefined || picked.id !== null || accounts === null) return picked
  const open = openAccounts(accounts)
  return { id: open.length === 1 ? open[0]!.id : null, closed: false }
}

// 참가비를 받을 계좌 목록과 그 목록에서 본 지금 계좌.
export function useFeeAccount(
  councilId: string,
  onForbidden: () => void,
  chosen: string | null | undefined,
) {
  const list = useAccounts(councilId, onForbidden)
  const accounts = list.state.kind === 'ready' ? list.state.data.accounts : null
  return {
    accounts,
    failed: list.state.kind === 'failed',
    pick: pickFeeAccount(chosen, accounts),
  }
}

export type FeeAccount = ReturnType<typeof useFeeAccount>
