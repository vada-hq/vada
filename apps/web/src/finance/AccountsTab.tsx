import { useState } from 'react'
import { whoDoes, type AccountItem } from '@vada/contracts'
import { EmptyMessage } from '@/components/EmptyMessage'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { ACCOUNTS_LOAD_FAILED } from '@/lib/messages'
import { AccountCard } from './AccountCard'
import { AccountCloseDialog } from './AccountCloseDialog'
import { AccountFormDialog } from './AccountFormDialog'
import type { AccountChangeHandlers } from './useAccountChange'
import { useAccounts } from './useAccounts'

type Props = {
  councilId: string

  // `finance.manage`가 있을 때만 더한다. 보는 것은 모든 운영진이다.
  canManage: boolean
  onForbidden: () => void
}

// 열린 대화상자: 더하기, 고치기·닫기(그 계좌)
type Open = { kind: 'add' } | { kind: 'edit' | 'close'; account: AccountItem } | null

function OpenDialog({
  open,
  councilId,
  handlers,
  onClose,
}: {
  open: Open
  councilId: string
  handlers: AccountChangeHandlers
  onClose: () => void
}) {
  if (open === null) return null
  if (open.kind === 'close')
    return (
      <AccountCloseDialog
        councilId={councilId}
        account={open.account}
        onClose={onClose}
        {...handlers}
      />
    )
  return (
    <AccountFormDialog
      councilId={councilId}
      account={open.kind === 'edit' ? open.account : null}
      onClose={onClose}
      {...handlers}
    />
  )
}

function Cards({
  accounts,
  truncated,
  canManage,
  onOpen,
}: {
  accounts: AccountItem[]
  truncated: boolean
  canManage: boolean
  onOpen: (open: Open) => void
}) {
  if (accounts.length === 0)
    return (
      <EmptyMessage who={canManage ? null : whoDoes('finance.manage', '더해요')}>
        계좌 없음
      </EmptyMessage>
    )
  return (
    <>
      <ul aria-label="계좌" className="flex flex-col gap-2">
        {accounts.map(account => (
          <li key={account.id}>
            <AccountCard
              account={account}
              onEdit={() => onOpen({ kind: 'edit', account })}
              onClose={() => onOpen({ kind: 'close', account })}
            />
          </li>
        ))}
      </ul>
      {truncated && <StateMessage kind="notice">계좌가 많아서 일부만 보여요.</StateMessage>}
    </>
  )
}

// 계좌 탭: 통장 목록. 재정부는 더하고 고치고 닫는다. 닫은 계좌는 뒤에 닫은 날과 함께 보인다.
export function AccountsTab({ councilId, canManage, onForbidden }: Props) {
  const list = useAccounts(councilId, onForbidden)
  const [open, setOpen] = useState<Open>(null)
  const [lost, setLost] = useState<string | null>(null)
  const { state } = list
  const handlers = {
    onForbidden,
    onLost: (message: string) => {
      setOpen(null)
      setLost(message)
      void list.reload()
    },
    onSaved: () => {
      setOpen(null)
      void list.reload()
    },
  }
  const start = (next: Open) => {
    setLost(null)
    setOpen(next)
  }
  if (state.kind === 'loading') return <StateMessage kind="loading">계좌 불러오는 중…</StateMessage>
  if (state.kind === 'failed')
    return (
      <div className="flex flex-col items-start gap-3">
        <StateMessage kind="error">{ACCOUNTS_LOAD_FAILED}</StateMessage>
        <Button variant="outline" onClick={() => void list.reload()}>
          다시 시도
        </Button>
      </div>
    )
  return (
    <div className="flex flex-col gap-3 max-sm:[&_button]:min-h-11">
      {lost && <StateMessage kind="error">{lost}</StateMessage>}
      {canManage && (
        <Button className="self-start" onClick={() => start({ kind: 'add' })}>
          계좌 더하기
        </Button>
      )}
      <Cards
        accounts={state.data.accounts}
        truncated={state.data.truncated}
        canManage={canManage}
        onOpen={start}
      />
      <OpenDialog
        open={open}
        councilId={councilId}
        handlers={handlers}
        onClose={() => setOpen(null)}
      />
    </div>
  )
}
