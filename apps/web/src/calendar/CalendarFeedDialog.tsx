import { useState } from 'react'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { FeedState } from './use-calendar-feed'
import { CalendarFeedBody } from './CalendarFeedBody'

type Props = {
  state: FeedState
  busy: boolean
  error: string | null
  onChange: (action: 'create' | 'delete') => Promise<boolean>
  onReload: () => void
  onClose: () => void
}

export function CalendarFeedDialog({ state, busy, error, onChange, onReload, onClose }: Props) {
  const [confirm, setConfirm] = useState<'create' | 'delete' | null>(null)
  const confirmLabel = confirm === 'create' ? '새 주소 만들기' : '구독 끊기'
  return (
    <Dialog
      open
      onOpenChange={open => {
        if (!open && !busy) onClose()
      }}
    >
      <DialogContent
        closeDisabled={busy}
        aria-describedby={undefined}
        className="min-w-0 break-keep"
      >
        <DialogHeader>
          <DialogTitle>캘린더 구독</DialogTitle>
        </DialogHeader>
        <CalendarFeedBody
          state={state}
          busy={busy}
          onChange={onChange}
          onConfirm={setConfirm}
          onReload={onReload}
        />
        {error && !confirm && <StateMessage kind="error">{error}</StateMessage>}
        <DialogFooter>
          <Button variant="outline" touch busy={busy} onClick={onClose}>
            닫기
          </Button>
        </DialogFooter>
        {confirm && (
          <ConfirmDialog
            title={confirmLabel}
            description={
              confirm === 'create'
                ? '예전 주소는 바로 멈춰요.'
                : '이 주소로 일정을 더 이상 불러올 수 없어요.'
            }
            confirmLabel={confirmLabel}
            touch
            busy={busy}
            error={error ?? undefined}
            onClose={() => setConfirm(null)}
            onConfirm={() => {
              void onChange(confirm).then(ok => {
                if (ok) setConfirm(null)
              })
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
