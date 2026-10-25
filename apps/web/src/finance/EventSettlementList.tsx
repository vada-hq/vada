import type { EventSettlementRow } from '@vada/contracts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  EVENT_STATUS_LABEL,
  EVENT_STATUS_TONE,
  remainingLabel,
  settlementLabel,
  whenLabel,
} from '../events/event-view'

type Props = {
  rows: EventSettlementRow[]
  // 그 행사의 '예산·정산' 탭으로 간다.
  onOpen: (eventId: string) => void
}

// 끝난 행사는 홈 '정산할 행사'와 같은 말(남은 것이 없으면 '완료 가능')이다. 완료한 행사는 상태 배지가 말하므로 수만 쓴다.
const sideLabel = ({ event, settlement }: EventSettlementRow) =>
  event.status === 'ended' ? settlementLabel(settlement) : remainingLabel(settlement.remaining)

// 재정 '행사 정산' 탭의 목록. 읽기만 하고, 줄 어디를 눌러도 그 행사의 정산이 열린다(DEC-38).
// 390px에서 넘치지 않게 상태와 수는 이름 아래 줄에 두고 줄을 바꾼다.
export function EventSettlementList({ rows, onOpen }: Props) {
  return (
    <ul aria-label="행사 정산" className="flex flex-col divide-y rounded-lg border bg-white">
      {rows.map(row => (
        <li
          key={row.event.id}
          className="relative flex flex-col gap-1 px-4 py-3 transition-colors hover:bg-gray-50"
        >
          <Button
            variant="link"
            className="h-auto max-w-full justify-start p-0 text-left text-sm font-medium whitespace-normal text-gray-900 wrap-anywhere after:absolute after:inset-0"
            onClick={() => onOpen(row.event.id)}
          >
            {row.event.name}
          </Button>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500">
            <Badge tone={EVENT_STATUS_TONE[row.event.status]}>
              {EVENT_STATUS_LABEL[row.event.status]}
            </Badge>
            <span className="font-medium text-gray-700">{sideLabel(row)}</span>
            <span>{whenLabel(row.event)}</span>
          </div>
        </li>
      ))}
    </ul>
  )
}
