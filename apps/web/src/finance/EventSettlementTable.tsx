import type { EventSettlementRow } from '@vada/contracts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cardClass } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { EVENT_STATUS_LABEL, EVENT_STATUS_TONE, settlementLabel } from '../events/event-view'
import { rowLinkClass, settlementDate, settlementMark } from './event-settlement-view'

type Props = {
  rows: EventSettlementRow[]
  // 그 행사의 '예산·정산' 탭으로 간다.
  onOpen: (eventId: string) => void
}

const head = 'px-4 py-2 text-xs font-medium text-gray-500'

function MarkCell({ row }: { row: EventSettlementRow }) {
  const mark = settlementMark(row)
  return (
    <td className="px-4 py-3 text-right text-sm font-semibold whitespace-nowrap text-gray-900 tabular-nums">
      {mark?.kind === 'settled' ? settlementLabel(row.settlement) : mark?.count}
    </td>
  )
}

// 재정 '행사 정산' 탭의 넓은 화면 표. 와이어프레임 FIN-00 '행사별' 표와 같은 모양이다(이름 굵게, 수는 오른쪽 정렬로 세로 줄을 맞춘다).
// 읽기만 하고, 줄 어디를 눌러도 그 행사의 정산이 열린다(이름 버튼의 가상 요소가 줄을 덮는다).
export function EventSettlementTable({ rows, onOpen }: Props) {
  return (
    <div className={cn(cardClass, 'overflow-hidden')}>
      <table aria-label="행사 정산" className="w-full border-collapse text-left">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className={head}>
              행사
            </th>
            <th scope="col" className={cn(head, 'w-28')}>
              상태
            </th>
            <th scope="col" className={cn(head, 'w-60')}>
              날짜
            </th>
            <th scope="col" className={cn(head, 'w-32 text-right')}>
              정산 남은 것
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.event.id} className="relative border-t transition-colors hover:bg-gray-50">
              <td className="px-4 py-3">
                <Button
                  variant="link"
                  className={rowLinkClass}
                  title={row.event.name}
                  onClick={() => onOpen(row.event.id)}
                >
                  <span className="line-clamp-2">{row.event.name}</span>
                </Button>
              </td>
              <td className="px-4 py-3">
                <Badge tone={EVENT_STATUS_TONE[row.event.status]}>
                  {EVENT_STATUS_LABEL[row.event.status]}
                </Badge>
              </td>
              <td className="px-4 py-3 text-sm text-gray-500">{settlementDate(row.event)}</td>
              <MarkCell row={row} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
