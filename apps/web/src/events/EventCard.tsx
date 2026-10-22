import type { EventSummary } from '@vada/contracts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EVENT_STATUS_LABEL, EVENT_STATUS_TONE, ownerLabel, whenLabel } from './event-view'

type Props = { event: EventSummary; onOpen: () => void }

// 행사 카드: 이름, 일시, 상태, 책임자. 이름을 누르면 행사가 열린다.
export default function EventCard({ event, onOpen }: Props) {
  return (
    <Card className="flex flex-col gap-2 p-4">
      <div className="flex items-start gap-2">
        <h2 className="min-w-0 flex-1">
          <Button
            variant="link"
            className="h-auto max-w-full justify-start p-0 text-left text-sm font-semibold whitespace-normal text-gray-900 wrap-anywhere"
            onClick={onOpen}
          >
            {event.name}
          </Button>
        </h2>
        <Badge tone={EVENT_STATUS_TONE[event.status]}>{EVENT_STATUS_LABEL[event.status]}</Badge>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
        <span>{whenLabel(event)}</span>
        <span className="wrap-anywhere">{ownerLabel(event.owner)}</span>
      </div>
    </Card>
  )
}
