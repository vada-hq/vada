import { useId, useState } from 'react'
import { CalendarDays, MapPin } from 'lucide-react'
import { koreanOf, type EventCard } from '@vada/contracts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { ownerLine } from './event-header-view'
import { momentLabel, whenLabel } from './event-view'
import EventStatusChip from './EventStatusChip'

type Props = { event: EventCard; onOpen: () => void }
const NAME_PREVIEW_LENGTH = 24

function Count({ label, count, unit }: { label: string; count: number; unit: string }) {
  return (
    <Badge
      tone="neutral"
      className={cn('justify-end text-right tabular-nums', count > 0 && 'text-fg-secondary')}
    >
      {`${label} ${count}${unit}`}
    </Badge>
  )
}

export default function EventRow({ event, onOpen }: Props) {
  const [expanded, setExpanded] = useState(false)
  const titleId = useId()
  return (
    <Card className="relative flex h-full min-w-0 flex-col gap-3 p-5 break-keep transition-colors hover:border-primary-border-strong">
      <div className="flex min-w-0 flex-col items-start gap-2">
        <EventStatusChip status={event.status} />
        <h3 id={titleId} className="w-full min-w-0">
          <Button
            touch
            variant="link"
            onClick={onOpen}
            className="h-auto w-full min-w-0 justify-start p-0 text-left text-base font-semibold whitespace-normal text-fg after:absolute after:inset-0"
          >
            <span
              className={cn('min-w-0 wrap-anywhere', !expanded && 'line-clamp-2 sm:line-clamp-1')}
            >
              {event.name}
            </span>
          </Button>
        </h3>
      </div>
      {event.name.length > NAME_PREVIEW_LENGTH && (
        <Button
          touch
          size="sm"
          variant="link"
          aria-expanded={expanded}
          aria-controls={titleId}
          className="relative z-10 self-start p-0"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? '이름 접기' : '전체 이름 보기'}
        </Button>
      )}
      <div className="flex min-w-0 flex-wrap gap-x-4 gap-y-1 text-sm text-fg-muted">
        <p className="flex min-w-0 items-start gap-2">
          <CalendarDays aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span className="min-w-0 tabular-nums wrap-anywhere">
            {event.startsAt ? whenLabel(event) : '미정'}
          </span>
        </p>
        <p className="flex min-w-0 items-start gap-2">
          <MapPin aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span className="min-w-0 wrap-anywhere">{event.place ?? '장소 미정'}</span>
        </p>
        <p className="min-w-0 wrap-anywhere">{ownerLine(event)}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Count label="신청" count={event.applicantCount} unit="명" />
        <Count label="업무" count={event.tasks.total} unit="개" />
      </div>
      <div className="flex flex-wrap gap-x-2 gap-y-1 text-xs text-fg-muted">
        <span>남은 정리</span>
        <span
          className={cn('text-right tabular-nums', event.tasks.open > 0 && 'text-fg-secondary')}
        >
          끝나지 않은 업무 {event.tasks.open}건
        </span>
        <span aria-hidden>·</span>
        <span className={cn('text-right tabular-nums', event.remaining > 0 && 'text-fg-secondary')}>
          정산에 남은 것 {event.remaining}건
        </span>
      </div>
      <p className="text-xs text-fg-subtle tabular-nums wrap-anywhere">
        마지막 수정{' '}
        <time dateTime={event.updatedAt}>{momentLabel(koreanOf(new Date(event.updatedAt)))}</time>
      </p>
    </Card>
  )
}
