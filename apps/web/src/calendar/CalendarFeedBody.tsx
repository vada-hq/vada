import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { dayLabel } from '@/lib/korean-date-text'
import { useNow } from '@/lib/use-now'
import { CALENDAR_FEED_LOAD_FAILED } from '@/lib/calendar-messages'
import type { FeedState } from './use-calendar-feed'
import { CalendarFeedAddress } from './CalendarFeedAddress'

type Props = {
  state: FeedState
  busy: boolean
  onChange: (action: 'create' | 'delete') => Promise<boolean>
  onConfirm: (action: 'create' | 'delete') => void
  onReload: () => void
}

export function CalendarFeedBody({ state, busy, onChange, onConfirm, onReload }: Props) {
  const now = useNow()
  if (state.kind === 'loading')
    return <StateMessage kind="loading">구독 상태 불러오는 중…</StateMessage>
  if (state.kind === 'failed')
    return (
      <div className="flex flex-col items-start gap-3">
        <StateMessage kind="error">{CALENDAR_FEED_LOAD_FAILED}</StateMessage>
        <Button variant="outline" touch onClick={onReload}>
          다시 시도
        </Button>
      </div>
    )
  if (state.url) return <CalendarFeedAddress key={state.url} url={state.url} />
  if (!state.feed)
    return (
      <Button touch busy={busy} className="self-start" onClick={() => void onChange('create')}>
        주소 만들기
      </Button>
    )
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-gray-500 wrap-anywhere">
        구독 주소 사용 중 · {dayLabel(state.feed.createdAt, now)}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" touch onClick={() => onConfirm('create')}>
          새 주소 만들기
        </Button>
        <Button variant="outline" touch onClick={() => onConfirm('delete')}>
          구독 끊기
        </Button>
      </div>
    </div>
  )
}
