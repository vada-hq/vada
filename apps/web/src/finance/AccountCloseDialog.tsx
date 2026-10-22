import { useState } from 'react'
import { CloseAccountSchema, type AccountItem } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
    <Dialog
      open
      onOpenChange={open => {
        if (!open && !saving) onClose()
      }}
    >
      <DialogContent aria-describedby="account-close-description">
        <DialogHeader>
          <DialogTitle className="wrap-anywhere">{account.name} 계좌를 닫을까요?</DialogTitle>
          <DialogDescription id="account-close-description">
            닫은 계좌는 다시 열 수 없고 새 지출에 고를 수 없어요. 이미 적은 지출에는 그대로 남아요.
          </DialogDescription>
        </DialogHeader>
        {change.problem && <StateMessage kind="error">{change.problem}</StateMessage>}
        <DialogFooter>
          <Button variant="outline" disabled={saving} onClick={onClose}>
            취소
          </Button>
          <Button variant="destructive" disabled={saving} onClick={() => void change.submit()}>
            계좌 닫기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
