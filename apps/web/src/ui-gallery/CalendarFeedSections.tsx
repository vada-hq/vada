import { useState } from 'react'
import { CalendarFeedDialog } from '@/calendar/CalendarFeedDialog'
import type { FeedState } from '@/calendar/use-calendar-feed'
import { Button } from '@/components/ui/button'
import { Section } from './GallerySection'

const feed = { createdAt: '2026-10-28T03:00:00Z' }
const url =
  'https://vada.example.test/api/public/calendar/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.ics'
const samples: { label: string; state: FeedState }[] = [
  { label: '주소 없음 구독 창 열기', state: { kind: 'ready', feed: null, url: null } },
  { label: '주소 생성 직후 구독 창 열기', state: { kind: 'ready', feed, url } },
  { label: '사용 중 구독 창 열기', state: { kind: 'ready', feed, url: null } },
]

function FeedExample({ label, state: initial }: { label: string; state: FeedState }) {
  const [open, setOpen] = useState(false)
  const [state, setState] = useState(initial)
  return (
    <>
      <Button
        variant="outline"
        touch
        onClick={() => {
          setState(initial)
          setOpen(true)
        }}
      >
        {label}
      </Button>
      {open && (
        <CalendarFeedDialog
          state={state}
          busy={false}
          error={null}
          onClose={() => setOpen(false)}
          onReload={() => {}}
          onChange={action => {
            setState({
              kind: 'ready',
              feed: action === 'delete' ? null : feed,
              url: action === 'delete' ? null : url,
            })
            return Promise.resolve(true)
          }}
        />
      )}
    </>
  )
}

export function CalendarFeedSection() {
  return (
    <Section title="캘린더 구독">
      {samples.map(sample => (
        <FeedExample key={sample.label} {...sample} />
      ))}
    </Section>
  )
}
