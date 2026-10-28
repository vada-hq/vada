import type { EventSettlementRow } from '@vada/contracts'
import { Button } from '@/components/ui/button'
import { rowLinkBox } from '@/components/ui/row-link'
import { remainingLabel, settlementLabel } from '../events/event-view'
import EventStatusChip from '../events/EventStatusChip'
import { rowNameLinkClass, settlementDate, settlementMark } from './event-settlement-view'

type Props = {
  rows: EventSettlementRow[]
  // 그 행사의 '재정' 탭으로 간다.
  onOpen: (eventId: string) => void
}

function MarkText({ row }: { row: EventSettlementRow }) {
  const mark = settlementMark(row)
  if (!mark) return null
  return (
    <span className="shrink-0 text-sm font-semibold text-gray-900 tabular-nums">
      {mark.kind === 'settled' ? settlementLabel(row.settlement) : remainingLabel(mark.count)}
    </span>
  )
}

// 재정 '행사 정산' 탭의 좁은 화면 카드 줄. 읽기만 하고, 줄 어디를 눌러도 그 행사의 정산이 열린다(DEC-38).
// 남은 것은 이름 줄 오른쪽 끝에 굵게 두고, 긴 이름은 두 줄에서 자른다(누르면 행사에서 전체 이름이 보인다).
export function EventSettlementList({ rows, onOpen }: Props) {
  return (
    <ul aria-label="행사 정산" className="flex flex-col divide-y rounded-lg border bg-white">
      {rows.map(row => {
        const date = settlementDate(row.event)
        return (
          <li
            key={row.event.id}
            className={`${rowLinkBox} flex flex-col gap-1 px-4 py-3 transition-colors hover:bg-gray-50`}
          >
            <div className="flex items-start gap-3">
              <Button
                variant="link"
                className={`min-w-0 flex-1 ${rowNameLinkClass}`}
                title={row.event.name}
                onClick={() => onOpen(row.event.id)}
              >
                <span className="line-clamp-2">{row.event.name}</span>
              </Button>
              <MarkText row={row} />
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500">
              <EventStatusChip status={row.event.status} />
              {date && <span>{date}</span>}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
