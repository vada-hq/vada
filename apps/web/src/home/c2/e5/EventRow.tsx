import { ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { rowLinkTarget } from '@/components/ui/row-link'
import { cn } from '@/lib/utils'
import type { C2Event } from '../c2-data'
import { signalAction, type C2Props } from '../c2-props'
import { SignalPill } from './SignalPill'
import { DATE, ROW, ROW_FOCUS, ROW_RULE, SIGNALS_WIDE, TEXT_NAME, TEXT_SUB } from './tokens'

const WRAP = 'break-keep wrap-anywhere'

// 다음 일정: 굵은 'D-3' + 회색 이름('신청 마감'). 390에서는 줄 끝 날짜 칸이 없어 날짜를 같은 줄에 붙인다.
function NextLine({ event }: { event: C2Event }) {
  if (!event.next) return <p className={cn('text-fg-tertiary', TEXT_SUB)}>{event.nextText}</p>
  return (
    <p className={cn('flex min-w-0 flex-wrap items-baseline gap-x-1.5', TEXT_SUB)}>
      <span className="font-bold whitespace-nowrap text-fg">{event.next.dday}</span>
      <span className="whitespace-nowrap text-fg-secondary">{event.next.name}</span>
      <span aria-hidden className="text-fg-muted @2xl:hidden">
        ·
      </span>
      <span className="whitespace-nowrap text-fg-muted @2xl:hidden">{event.next.dateText}</span>
    </p>
  )
}

// 행사 줄: 무엇·언제(이름 / D-n 일정) | 신호 알약(오른쪽 끝에서 왼쪽으로 흐름) | 다음 일정 날짜 | 꺾쇠.
// 신호가 없는 줄도 오른쪽 끝에 날짜가 있어 977 오른쪽이 비지 않는다. 390은 신호를 일정 아래로 내린다.
export function EventRow({ event, props }: { event: C2Event; props: C2Props }) {
  return (
    <li
      data-c2-event={event.id}
      className={cn('relative flex items-center rounded-2xl', ROW, ROW_RULE, ROW_FOCUS)}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 @2xl:flex-row @2xl:items-center @2xl:gap-4">
        <div className="min-w-0 @2xl:flex-1">
          <Button
            variant="link"
            data-name
            className={cn(
              'h-auto max-w-full justify-start border-0 p-0 text-left whitespace-normal text-fg hover:no-underline',
              TEXT_NAME,
              rowLinkTarget,
            )}
            onClick={() => props.onOpen(event)}
          >
            <span className={cn('line-clamp-2 @2xl:line-clamp-1', WRAP)}>{event.name}</span>
          </Button>
          <NextLine event={event} />
        </div>
        {event.signals.length > 0 && (
          <div className={cn('flex shrink-0 flex-wrap gap-x-1.5 @2xl:gap-y-1.5', SIGNALS_WIDE)}>
            {event.signals.map(signal => (
              <SignalPill
                key={signal.kind + signal.text}
                signal={signal}
                onClick={signalAction(props, event, signal)}
              />
            ))}
          </div>
        )}
      </div>
      <span className={cn('shrink-0 text-fg-muted @max-2xl:hidden', DATE, TEXT_SUB)}>
        {event.next?.dateText}
      </span>
      <ChevronRight aria-hidden className="size-5 shrink-0 text-fg-muted" />
    </li>
  )
}
