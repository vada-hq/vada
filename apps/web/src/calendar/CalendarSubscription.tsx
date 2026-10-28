import { useState } from 'react'
import { Rss } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CalendarFeedDialog } from './CalendarFeedDialog'
import { useCalendarFeed } from './use-calendar-feed'

type Props = { councilId: string; onForbidden: () => void }

function FeedDialog({ councilId, onForbidden, onClose }: Props & { onClose: () => void }) {
  const { state, busy, error, change, reload } = useCalendarFeed(councilId, onForbidden)
  return (
    <CalendarFeedDialog
      state={state}
      busy={busy}
      error={error}
      onChange={change}
      onReload={reload}
      onClose={onClose}
    />
  )
}

export function CalendarSubscription({ councilId, onForbidden }: Props) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="outline" size="sm" touch onClick={() => setOpen(true)}>
        <Rss aria-hidden />
        구독
      </Button>
      {open && (
        <FeedDialog
          key={councilId}
          councilId={councilId}
          onForbidden={onForbidden}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
