import { useState } from 'react'
import type { MeetingDetail } from '@vada/contracts'
import PageActions from '@/components/PageActions'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { MINUTES_TEXT as T, confirmSummary } from './minutes-text'
import { minutesCounts } from './minutes-confirm'

export function MinutesConfirm({
  meeting,
  onConfirm,
}: {
  meeting: MeetingDetail
  onConfirm: () => Promise<string | null>
}) {
  const [asking, setAsking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const counts = minutesCounts(meeting)
  const confirm = async () => {
    if (busy) return
    setBusy(true)
    const problem = await onConfirm()
    setBusy(false)
    setError(problem)
    if (!problem) setAsking(false)
  }
  if (!meeting.actions.includes('meeting.confirm')) return null
  return (
    <>
      <PageActions>
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <span className="text-xs text-muted-foreground tabular-nums">
            {confirmSummary(counts.decisions, counts.followUps, counts.empty)}
          </span>
          <Button
            touch
            onClick={() => {
              setError(null)
              setAsking(true)
            }}
          >
            {T.confirm}
          </Button>
        </div>
      </PageActions>
      {asking && (
        <ConfirmDialog
          title={T.confirmQuestion}
          confirmLabel={T.confirmAction}
          touch
          busy={busy}
          error={error}
          onConfirm={() => void confirm()}
          onClose={() => setAsking(false)}
        />
      )}
    </>
  )
}
