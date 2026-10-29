import { Calendar } from '@/components/ui/calendar'
import { Button } from '@/components/ui/button'
import { dayLabel } from '@/lib/month-grid'
import { quickDuePicks } from './due-quick-picks'

type Props = {
  value: string | null
  today: string
  onPick: (date: string | null) => void
}

// 마감 고르기 창: 빠른 날 셋, 달력, 마감 없음. 고르면 바로 반영한다.
export function TaskDuePicker({ value, today, onPick }: Props) {
  return (
    <div className="flex flex-col">
      <div className="flex flex-col border-b pb-1">
        {quickDuePicks(today).map(pick => (
          <Button
            key={pick.label}
            variant="ghost"
            className="justify-between font-normal text-fg-secondary"
            onClick={() => onPick(pick.date)}
          >
            {pick.label}
            <span className="text-xs text-fg-subtle">{dayLabel(pick.date)}</span>
          </Button>
        ))}
      </div>
      <Calendar value={value} today={today} onSelect={onPick} />
      {value !== null && (
        <div className="border-t pt-1">
          <Button
            variant="ghost"
            className="w-full justify-start font-normal text-fg-secondary"
            onClick={() => onPick(null)}
          >
            마감 없음
          </Button>
        </div>
      )}
    </div>
  )
}
