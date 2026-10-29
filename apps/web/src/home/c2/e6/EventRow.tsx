import { CircleDashed, Clock, UserCheck, Users, Wallet, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { rowLinkTarget } from '@/components/ui/row-link'
import { cn } from '@/lib/utils'
import type { C2Event, C2Signal } from '../c2-data'
import { signalAction, type C2Props } from '../c2-props'
import type { Axis } from './axis'
import { Lane } from './Lane'
import { eventColorOf, type EventColor } from './event-color'
import {
  EVENT_MARK,
  EVENT_MARK_GAP,
  EVENT_MARK_SIZE,
  EVENT_MARK_TOP,
  NAME_GAP,
  NAME_LINE,
  NAME_LINE_GAP,
  LANE_GAP,
  PILL,
  PILL_ICON,
  PILL_ROW_GAP,
  PILL_TOUCH,
  ROW,
  ROW_HOVER,
  TEXT_NAME,
  TEXT_PILL,
} from './tokens'

// Button 기본 모양(테두리·모서리·크기)을 지우고 글 단추로 쓴다
const BARE = 'h-auto border-0 p-0 font-medium'

// 행사 네모: 오늘 선 왼쪽 칸에 가득 찬 행사 색 작은 네모. 글자 배지(e3 '가'·'진'·'소')는 이름이 바로 옆에 있어 뺐다.
// 사람 얼굴(①, 둥근 옅은 면 + 글자)과 모양으로 갈린다.
function EventMark({ axis, color }: { axis: Axis; color: EventColor }) {
  return (
    <span
      aria-hidden
      className={cn('absolute', EVENT_MARK, EVENT_MARK_TOP, color.solid)}
      style={{ left: axis.gutter - EVENT_MARK_GAP - EVENT_MARK_SIZE }}
    />
  )
}

const SIGNAL_ICON: Record<C2Signal['kind'], LucideIcon> = {
  registration: Users,
  undecided: CircleDashed,
  late: Clock,
  budget: Wallet,
}
// 화면 읽기용 앞말('18/40'만으로는 무엇인지 모름)
const SIGNAL_LABEL: Record<C2Signal['kind'], string> = {
  registration: '신청 ',
  undecided: '',
  late: '',
  budget: '',
}

function pillFace(signal: C2Signal) {
  if (signal.danger) return 'bg-danger-surface font-semibold text-danger'
  if (signal.kind === 'registration' && signal.full)
    return 'bg-muted font-semibold text-fg group-hover/sig:bg-border'
  return 'bg-muted font-medium text-fg-secondary group-hover/sig:bg-border'
}

// 신호 알약: 글 자체가 누르는 자리(테두리 버튼 없음). 위험(지남·초과)만 빨간 면, 나머지는 중립 회색 면.
function SignalPill({ signal, onClick }: { signal: C2Signal; onClick: () => void }) {
  const Icon = signal.kind === 'registration' && signal.full ? UserCheck : SIGNAL_ICON[signal.kind]
  return (
    <Button
      variant="ghost"
      data-c2-danger={signal.danger || undefined}
      className={cn(
        BARE,
        PILL_TOUCH,
        'group/sig relative z-10 rounded-full bg-transparent hover:bg-transparent',
      )}
      onClick={onClick}
    >
      <span
        className={cn(
          'inline-flex items-center whitespace-nowrap',
          PILL,
          TEXT_PILL,
          pillFace(signal),
        )}
      >
        <Icon aria-hidden className={PILL_ICON} strokeWidth={2.25} />
        <span className="sr-only">{SIGNAL_LABEL[signal.kind]}</span>
        {signal.text}
      </span>
    </Button>
  )
}

type RowProps = { event: C2Event; axis: Axis; actions: C2Props }

// 행사 줄: 행사 네모(오늘 선 왼쪽) | 이름 + 신호 알약 / 그 아래 일정 글(이름과 같은 x) + 막대(오늘 → 다음 일정).
// 줄 전체가 행사 보기(이름 단추의 덮개), 알약은 덮개 위에서 따로 누른다.
export function EventRow({ event, axis, actions }: RowProps) {
  const color = eventColorOf(event)
  return (
    <li data-c2-event={event.id} className={cn('group/row relative', ROW, ROW_HOVER)}>
      <div
        className={cn('flex flex-wrap items-center', NAME_LINE_GAP, NAME_LINE)}
        style={{ paddingLeft: axis.gutter + NAME_GAP }}
      >
        <EventMark axis={axis} color={color} />
        <Button
          variant="link"
          className={cn(
            BARE,
            'max-w-full min-w-0 justify-start text-left whitespace-normal text-fg group-hover/row:underline hover:underline',
            TEXT_NAME,
            rowLinkTarget,
          )}
          onClick={() => actions.onOpen(event)}
        >
          <span className="line-clamp-2 break-keep wrap-anywhere @2xl:line-clamp-none @2xl:truncate">
            {event.name}
          </span>
        </Button>
        {event.signals.length > 0 && (
          <div className={cn('flex flex-wrap items-center', PILL_ROW_GAP)}>
            {event.signals.map(signal => (
              <SignalPill
                key={signal.kind + signal.text}
                signal={signal}
                onClick={signalAction(actions, event, signal)}
              />
            ))}
          </div>
        )}
      </div>
      <div className={LANE_GAP}>
        <Lane event={event} axis={axis} color={color} />
      </div>
    </li>
  )
}
