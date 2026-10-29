import { CalendarDays } from 'lucide-react'
import type { RecordEventItem } from '@vada/contracts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { rowLinkBox, rowLinkTarget } from '@/components/ui/row-link'
import { cn } from '@/lib/utils'
import { ownerLine } from '../events/event-header-view'
import EventStatusChip from '../events/EventStatusChip'
import { attendanceChip, completedLabel, executionChip, recordWhen, tasksChip } from './record-view'

type Props = { event: RecordEventItem; now?: Date | undefined; onOpen: () => void }
const CHIPS = [
  ['attendance', attendanceChip],
  ['execution', executionChip],
  ['tasks', tasksChip],
] as const

// 완료된 행사 카드(와이어프레임 REC-01 '행사 카드'): 완료 배지, 행사명, 일시, 담당, 성과 칩 셋, 완료 처리일, [상세 보기].
// 카드 전체가 [상세 보기]를 누르는 자리다. 기록 상태 배지(미발행·발행 vN)는 나중에 붙일 살이다(DEC-110).
export function RecordEventCard({ event, now, onOpen }: Props) {
  return (
    <Card
      className={cn(
        rowLinkBox,
        'flex min-w-0 flex-col gap-3 p-5 break-keep transition-colors hover:border-primary-border-strong',
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
          <EventStatusChip status="completed" />
          <h3 className="w-full min-w-0 text-base font-semibold text-fg wrap-anywhere">
            {event.name}
          </h3>
        </div>
        <Button
          variant="link"
          size="sm"
          aria-label={`${event.name} 상세 보기`}
          className={cn(rowLinkTarget, 'h-auto p-0 text-sm')}
          onClick={onOpen}
        >
          상세 보기
        </Button>
      </div>
      <div className="flex min-w-0 flex-wrap gap-x-4 gap-y-1 text-sm text-fg-muted">
        <p className="flex min-w-0 items-start gap-2">
          <CalendarDays aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span className="min-w-0 tabular-nums wrap-anywhere">{recordWhen(event, now)}</span>
        </p>
        <p className="min-w-0 wrap-anywhere">{ownerLine(event)}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {CHIPS.map(([key, chip]) => (
          <Badge key={key} tone="neutral" className="text-fg-secondary tabular-nums">
            {chip(event.chips)}
          </Badge>
        ))}
      </div>
      <p className="text-xs text-fg-subtle tabular-nums">
        {completedLabel(event.completedAt, now)}
      </p>
    </Card>
  )
}
