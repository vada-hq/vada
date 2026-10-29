import { ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { rowLinkTarget } from '@/components/ui/row-link'
import { cn } from '@/lib/utils'
import type { C2Event } from '../c2-data'
import type { C2Props } from '../c2-props'
import { DateCell } from './DateCell'
import { Signals } from './Signals'
import { RAIL, ROW, ROW_BODY, ROW_FOCUS, TEXT_SUB, TEXT_TITLE } from './tokens'

// 다음 일정 글: 남은 날(D-3·오늘)은 굵은 검정, 일정 이름은 중간 회색. 'D-2 신청 마감'이 한 덩어리로 읽힌다.
function NextText({ event }: { event: C2Event }) {
  if (!event.next) return <p className={cn('text-fg-tertiary', TEXT_SUB)}>{event.nextText}</p>
  return (
    <p className={cn('whitespace-nowrap text-fg-secondary', TEXT_SUB)}>
      <span className="font-bold text-fg tabular-nums">{event.next.dday}</span>
      {` ${event.next.name}`}
    </p>
  )
}

// 행사 줄: 날짜 칸 / 이름·다음 일정 / 신호 / 꺾쇠. 이름 단추의 덮개가 줄 전체를 덮어(행사 보기),
// 신호는 덮개 위에 따로 누르는 자리로 선다. 마지막 줄이 아니면 날짜 칸 아래로 세로 레일을 그어 다음 칸에 잇는다.
export function EventRow({
  event,
  last,
  props,
}: {
  event: C2Event
  last: boolean
  props: C2Props
}) {
  return (
    <li data-c2-event={event.id} className={cn('relative flex items-start', ROW, ROW_FOCUS)}>
      {!last && <span aria-hidden className={cn('absolute', RAIL)} />}
      <DateCell next={event.next} />
      <div className={cn('self-center', ROW_BODY)}>
        <div className="min-w-0 @2xl:flex-1">
          <Button
            variant="link"
            data-title
            className={cn(
              'h-auto max-w-full justify-start border-0 p-0 text-left whitespace-normal text-fg hover:no-underline',
              TEXT_TITLE,
              rowLinkTarget,
            )}
            onClick={() => props.onOpen(event)}
          >
            <span className="line-clamp-2 break-keep wrap-anywhere @2xl:line-clamp-1">
              {event.name}
            </span>
          </Button>
          <NextText event={event} />
        </div>
        <Signals event={event} props={props} />
      </div>
      <ChevronRight
        aria-hidden
        className="mt-3.5 size-5 shrink-0 self-start text-fg-muted @2xl:self-center @2xl:mt-0"
      />
    </li>
  )
}
