import { ArrowRight, Ban, CalendarX, Clock, Pause, TicketX, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ClosedDataName } from '../form-data'
import type { FormProps } from '../form-props'
import { EventBand, Page, Sheet } from './band'
import { radius, size, type } from './tokens'

const ICON: Record<ClosedDataName, LucideIcon> = {
  full: Users,
  before: Clock,
  paused: Pause,
  ended: CalendarX,
  cancelled: Ban,
  moved: TicketX,
}

// 받지 않을 때: 머리 띠는 그대로, 신청 칸 자리(흰 시트)에 상태 카드. 아이콘 원 → 제목 → 설명 → 버튼.
// [새 설문으로 이동]만 갈 곳이 있는 주 행동이라 행사 색, [돌아가기]는 테두리 버튼이다.
export default function Closed(props: FormProps) {
  const { data } = props
  const closed = data.closed
  if (!closed) return null
  const Icon = ICON[closed.kind]
  const moving = closed.action.href !== null
  return (
    <Page>
      <EventBand text={data.text} />
      <Sheet className="items-center pt-10 text-center">
        <span
          className={cn(
            'flex items-center justify-center rounded-full bg-surface-muted text-fg-tertiary',
            size.stateIcon,
          )}
        >
          <Icon aria-hidden className="size-7" />
        </span>
        <h2 className={cn(type.title, 'mt-4 text-fg')}>{closed.title}</h2>
        <p className={cn(type.label, 'mt-2 max-w-80 break-keep text-fg-secondary')}>
          {closed.line}
        </p>
        <button
          type="button"
          onClick={props.onClosedAction}
          className={cn(
            type.body,
            'mt-8 flex w-full cursor-pointer items-center justify-center gap-2 font-bold outline-none focus-visible:ring-4',
            radius.control,
            size.button,
            moving
              ? 'bg-category-7-strong text-white hover:bg-category-7-strong/90 focus-visible:ring-category-7-strong/30'
              : 'border border-border-strong bg-white text-fg-secondary hover:bg-surface-subtle focus-visible:ring-border-strong/40',
          )}
        >
          {closed.action.label}
          {moving && <ArrowRight aria-hidden className="size-5" />}
        </button>
      </Sheet>
    </Page>
  )
}
