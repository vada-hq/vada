import { useState } from 'react'
import { CloseAccountSchema, type AccountItem } from '@vada/contracts'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { accountClosePath } from './finance-api'
import { useAccountChange, type AccountChangeHandlers } from './useAccountChange'

type Props = AccountChangeHandlers & {
  councilId: string
  account: AccountItem
  onClose: () => void
}

// 계좌 닫기 확인. 닫은 계좌는 다시 열 수 없고 새 지출에 고를 수 없다. 이미 적은 지출에는 그대로 남는다.
export function AccountCloseDialog({ councilId, account, onClose, ...handlers }: Props) {
  const [saving, setSaving] = useState(false)
  const change = useAccountChange(accountClosePath(councilId, account.id), {}, CloseAccountSchema, {
    ...handlers,
    setSaving,
  })
  return (
    <ConfirmDialog
      title={`${account.name} 계좌를 닫을까요?`}
      description="닫은 계좌는 다시 열 수 없고 새 지출에 고를 수 없어요. 이미 적은 지출에는 그대로 남아요."
      confirmLabel="계좌 닫기"
      destructive
      busy={saving}
      error={change.problem}
      onConfirm={() => void change.submit()}
      onClose={onClose}
    />
  )
}
