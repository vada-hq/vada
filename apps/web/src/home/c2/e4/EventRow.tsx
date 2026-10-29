import { ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { rowLinkTarget } from '@/components/ui/row-link'
import { cn } from '@/lib/utils'
import type { C2Event } from '../c2-data'
import type { C2Props } from '../c2-props'
import { DayPill } from './DayPill'
import { Signals } from './Signals'
import { ROW, ROW_BODY, ROW_FOCUS, TEXT_SUB, TEXT_TITLE } from './tokens'

const WRAP = 'break-keep wrap-anywhere'

// 무엇: 행사 이름(줄 전체 = 행사 보기) + 다음 일정 이름. 남은 날 숫자는 알약이 말하므로 여기서는 '신청 마감'만 보인다.
// 977·716은 한 줄(이름 말줄임 · 일정), 358은 이름 두 줄까지 + 그 아래 일정.
function What({ event, open }: { event: C2Event; open: () => void }) {
  return (
    <div className={cn('min-w-0 @2xl:flex @2xl:items-baseline @2xl:gap-2', TEXT_SUB)}>
      <Button
        variant="link"
        data-title
        className={cn(
          'h-auto max-w-full min-w-0 shrink justify-start border-0 p-0 text-left whitespace-normal text-fg hover:no-underline',
          TEXT_TITLE,
          rowLinkTarget,
        )}
        onClick={open}
      >
        <span className={cn('@max-2xl:line-clamp-2 @2xl:block @2xl:truncate', WRAP)}>
          {event.name}
        </span>
      </Button>
      <p className="mt-0.5 shrink-0 whitespace-nowrap text-fg-secondary @2xl:mt-0">
        <span aria-hidden className="text-fg-muted @max-2xl:hidden">
          ·{' '}
        </span>
        {event.next ? (
          <>
            <span className="sr-only">{`${event.next.dday} `}</span>
            {event.next.name}
          </>
        ) : (
          event.nextText
        )}
      </p>
    </div>
  )
}

// 행사 줄: 남은 날 알약 / 무엇(이름 · 다음 일정) | 신호(신청 게이지 + 글 신호) / 꺾쇠.
// 신호가 없으면 오른쪽 칸은 비고 줄은 한 줄 높이 그대로다(평소 조용함, K7).
export function EventRow({ event, props }: { event: C2Event; props: C2Props }) {
  return (
    <li
      data-c2-event={event.id}
      className={cn('relative flex items-start @2xl:items-center', ROW, ROW_FOCUS)}
    >
      <DayPill event={event} />
      <div className={ROW_BODY}>
        <What event={event} open={() => props.onOpen(event)} />
        <Signals props={props} event={event} />
      </div>
      <ChevronRight
        aria-hidden
        className="size-5 shrink-0 self-center text-fg-muted max-sm:self-start max-sm:mt-0.5"
      />
    </li>
  )
}
