import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { CALENDAR_KIND_LABELS, type CalendarKind } from '@vada/contracts'
import { Button } from '@/components/ui/button'
import { monthLabel } from '@/tasks/calendar-month'
import { KIND_STYLE } from './kind-style'

export type CalendarLayout = 'month' | 'list'
const VIEWS = [
  { value: 'month', label: '월' },
  { value: 'list', label: '목록' },
] as const
const KINDS = [
  { value: null, label: '전체' },
  { value: 'event', label: CALENDAR_KIND_LABELS.event },
  { value: 'meeting', label: CALENDAR_KIND_LABELS.meeting },
  { value: 'deadline', label: CALENDAR_KIND_LABELS.deadline },
  { value: 'academic', label: CALENDAR_KIND_LABELS.academic },
  { value: 'external', label: CALENDAR_KIND_LABELS.external },
  { value: 'other', label: CALENDAR_KIND_LABELS.other },
] as const

type Props = {
  actions?: ReactNode
  month: string
  layout: CalendarLayout
  kind: CalendarKind | null
  onLayout: (layout: CalendarLayout) => void
  onKind: (kind: CalendarKind | null) => void
  onShift: (by: number) => void
  onToday: () => void
  onCreate?: (() => void) | undefined
}

export function CalendarHeader({
  month,
  layout,
  kind,
  onLayout,
  onKind,
  onShift,
  onToday,
  onCreate,
  actions,
}: Props) {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="일정 유형" className="flex flex-wrap gap-2">
          {KINDS.map(item => (
            <Button
              key={item.value ?? 'all'}
              size="sm"
              touch
              variant={kind === item.value ? 'secondary' : 'outline'}
              className="rounded-full"
              aria-pressed={kind === item.value}
              onClick={() => onKind(item.value)}
            >
              {item.label}
            </Button>
          ))}
        </div>
        <div role="group" aria-label="일정 보기" className="ml-auto flex gap-1">
          {VIEWS.map(item => (
            <Button
              key={item.value}
              size="sm"
              touch
              variant={layout === item.value ? 'secondary' : 'outline'}
              aria-pressed={layout === item.value}
              onClick={() => onLayout(item.value)}
            >
              {item.label}
            </Button>
          ))}
          {actions}
          {onCreate && (
            <Button size="sm" touch className="ml-2" onClick={onCreate}>
              일정 추가
            </Button>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            touch
            aria-label="이전 달"
            onClick={() => onShift(-1)}
          >
            <ChevronLeft />
          </Button>
          <h2 className="min-w-28 text-center text-base font-semibold text-fg">
            {monthLabel(month)}
          </h2>
          <Button size="icon" variant="ghost" touch aria-label="다음 달" onClick={() => onShift(1)}>
            <ChevronRight />
          </Button>
          <Button size="sm" variant="outline" touch className="ml-1" onClick={onToday}>
            오늘
          </Button>
        </div>
        <CalendarLegend />
      </div>
    </>
  )
}

function CalendarLegend() {
  const kinds: CalendarKind[] = ['event', 'meeting', 'deadline']
  return (
    <ul
      aria-label="일정 범례"
      className="hidden flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-muted sm:flex"
    >
      {kinds.map(kind => {
        const { Icon, text } = KIND_STYLE[kind]
        return (
          <li key={kind} className="flex items-center gap-1">
            <Icon aria-hidden className={`size-3.5 ${text}`} />
            {CALENDAR_KIND_LABELS[kind]}
          </li>
        )
      })}
    </ul>
  )
}
