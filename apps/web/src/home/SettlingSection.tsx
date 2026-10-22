import type { HomeSettling } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { whenLabel } from '../events/event-view'
import { settlementLabel } from './home-view'

type Props = {
  settling: HomeSettling
  // 그 행사의 '돈' 탭으로 간다.
  onOpenEvent: (eventId: string, tab: 'money') => void
  onSeeAll: () => void
}

// 정산할 행사(재정부): 끝났고 완료하지 않은 행사와 정산에 남은 것.
export default function SettlingSection({ settling, onOpenEvent, onSeeAll }: Props) {
  const { events, total } = settling
  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-900">
          정산할 행사{total > 0 && ` ${total}`}
        </h2>
        {total > events.length && (
          <Button variant="link" size="sm" className="px-0" onClick={onSeeAll}>
            모두 보기
          </Button>
        )}
      </div>
      {events.length === 0 && <StateMessage kind="empty">정산할 행사가 없어요.</StateMessage>}
      <ul className="flex flex-col">
        {events.map(({ event, settlement }) => (
          <li key={event.id}>
            <Button
              variant="ghost"
              className="h-auto w-full flex-col items-start gap-0.5 px-2 py-2 text-left whitespace-normal"
              onClick={() => onOpenEvent(event.id, 'money')}
            >
              <span className="text-sm font-medium text-gray-900 wrap-anywhere">{event.name}</span>
              <span className="flex flex-wrap gap-x-2 text-xs font-normal text-gray-500">
                <span>{whenLabel(event)}</span>
                <span>{settlementLabel(settlement)}</span>
              </span>
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  )
}
