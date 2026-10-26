import { EVENT_STATUS_LABEL, type EventStatus } from '@vada/contracts'
import { Badge } from '@/components/ui/badge'
import { EVENT_STATUS_TONE } from './event-view'

// 행사 상태 칩(DEC-93). 행사 머리, 행사 목록, 홈 행사 줄이 이것 하나를 써서 같은 행사가 어디서나 같은 이름·색이다.
export default function EventStatusChip({ status }: { status: EventStatus }) {
  return <Badge tone={EVENT_STATUS_TONE[status]}>{EVENT_STATUS_LABEL[status]}</Badge>
}
