import type { HomeEventCard as Card } from '@vada/contracts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card as Box } from '@/components/ui/card'
import { EVENT_STATUS_LABEL, EVENT_STATUS_TONE, whenLabel } from '../events/event-view'
import { NO_ASSIGNEE_LABEL } from '../tasks/task-view'
import { settlementLabel } from './home-view'

type Props = {
  card: Card
  onOpen: (eventId: string, tab?: 'money') => void
}

// 학생회 부분의 행사 카드. 눌러서 그 행사로 간다(정산 수가 있으면 '돈' 탭).
export default function HomeEventCard({ card, onOpen }: Props) {
  const { event, tasks, settlement } = card
  return (
    <Box className="flex flex-col gap-2 p-3">
      <div className="flex items-start gap-2">
        <h3 className="min-w-0 flex-1">
          <Button
            variant="link"
            className="h-auto max-w-full justify-start p-0 text-left text-sm font-semibold whitespace-normal text-gray-900 wrap-anywhere"
            onClick={() => (settlement ? onOpen(event.id, 'money') : onOpen(event.id))}
          >
            {event.name}
          </Button>
        </h3>
        <Badge tone={EVENT_STATUS_TONE[event.status]}>{EVENT_STATUS_LABEL[event.status]}</Badge>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
        <span>{whenLabel(event)}</span>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
        <span>
          업무 {tasks.done}/{tasks.total}
        </span>
        {tasks.overdue > 0 && <span>지남 {tasks.overdue}</span>}
        {tasks.unassigned > 0 && (
          <span>
            {NO_ASSIGNEE_LABEL} {tasks.unassigned}
          </span>
        )}
        {settlement && <span className="font-medium">{settlementLabel(settlement)}</span>}
      </div>
    </Box>
  )
}
