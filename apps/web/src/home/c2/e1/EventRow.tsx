import { Button } from '@/components/ui/button'
import { rowLinkTarget } from '@/components/ui/row-link'
import { cn } from '@/lib/utils'
import type { C2Event, C2Signal } from '../c2-data'
import { signalAction, type C2Props } from '../c2-props'
import {
  DAYS_CELL,
  ROW,
  ROW_FOCUS,
  ROW_RULE,
  SIGNAL,
  SIGNALS,
  TEXT_DAYS,
  TEXT_DAYS_LABEL,
  TEXT_SUB,
  TEXT_TITLE,
} from './tokens'

const WRAP = 'break-keep wrap-anywhere'
// Button 기본 모양(테두리·모서리·크기)을 지우고 글 단추로 쓴다
const BARE = 'border-0 p-0 rounded-sm'

// 신청 현황 글('18/40')만으로는 무엇의 수인지 모르므로 앞에 '신청'을 붙인다(레퍼런스 스케치와 같다).
const signalLabel = (signal: C2Signal) =>
  signal.kind === 'registration' ? `신청 ${signal.text}` : signal.text

// 신호 글의 생김새: 지남·예산 초과만 위험 색(굵게), 다 참은 굵게, 나머지는 강조 색 보통 굵기(누르는 글).
function signalTone(signal: C2Signal) {
  if (signal.danger) return 'font-semibold text-danger'
  if (signal.kind === 'registration' && signal.full) return 'font-semibold text-primary-strong'
  return 'font-medium text-primary-strong'
}

// 남은 날 칸: 큰 'D-1' + 작은 '행사 종료'. 일정 미정이면 칸 안에 '일정 미정'만.
function DaysCell({ event }: { event: C2Event }) {
  const { next } = event
  return (
    <div
      className={cn(
        'flex shrink-0 flex-col items-center justify-center bg-muted text-center',
        DAYS_CELL,
      )}
    >
      {next ? (
        <>
          <span className={cn('text-fg', TEXT_DAYS)}>{next.dday}</span>
          <span className={cn('text-fg-tertiary', TEXT_DAYS_LABEL)}>{next.name}</span>
        </>
      ) : (
        <span className={cn('font-medium text-fg-tertiary', TEXT_DAYS_LABEL)}>
          {event.nextText}
        </span>
      )}
    </div>
  )
}

// 신호 글 줄: '·'로 잇는다. 줄이 꺾이면 줄 머리의 '·'는 상자 왼쪽 밖으로 밀려 잘린다(overflow-x-clip).
function Signals({ event, ...props }: { event: C2Event } & C2Props) {
  if (event.signals.length === 0) return null
  return (
    <ul className={cn('flex flex-wrap gap-x-4 overflow-x-clip', SIGNALS, TEXT_SUB)}>
      {event.signals.map(signal => (
        <li
          key={`${signal.kind}-${signal.text}`}
          className="-ml-4 flex items-center before:w-4 before:text-center before:text-fg-muted before:content-['·']"
        >
          <Button
            variant="link"
            data-signal
            data-c2-danger={signal.danger || undefined}
            className={cn(
              BARE,
              SIGNAL,
              'relative z-10 whitespace-nowrap',
              TEXT_SUB,
              signalTone(signal),
            )}
            onClick={signalAction(props, event, signal)}
          >
            {signalLabel(signal)}
          </Button>
        </li>
      ))}
    </ul>
  )
}

// 행사 줄: 이름(줄 전체 = 행사 보기) + 그 아래 신호 글 / 오른쪽 끝 남은 날 칸.
export function EventRow({ event, ...props }: { event: C2Event } & C2Props) {
  return (
    <li
      data-c2-event={event.id}
      className={cn('relative flex items-start', ROW, ROW_FOCUS, ROW_RULE)}
    >
      <div className="min-w-0 flex-1 self-center">
        <Button
          variant="link"
          data-title
          className={cn(
            BARE,
            'h-auto max-w-full justify-start text-left whitespace-normal text-fg hover:no-underline',
            TEXT_TITLE,
            rowLinkTarget,
          )}
          onClick={() => props.onOpen(event)}
        >
          <span className={cn('line-clamp-2 @2xl:line-clamp-1', WRAP)}>{event.name}</span>
        </Button>
        <Signals event={event} {...props} />
      </div>
      <DaysCell event={event} />
    </li>
  )
}
