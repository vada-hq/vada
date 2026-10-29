import { CircleDashed, Clock, UserCheck, Users, Wallet, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { rowLinkTarget } from '@/components/ui/row-link'
import { cn } from '@/lib/utils'
import type { C2Event, C2Signal } from '../c2-data'
import { signalAction, type C2Props } from '../c2-props'
import type { Axis } from './axis'
import { Lane } from './Lane'
import {
  EVENT_TINTS,
  GLYPH,
  GLYPH_TOP,
  NAME_GAP,
  NAME_LINE,
  LANE_GAP,
  PILL,
  PILL_ICON,
  PILL_TOUCH,
  ROW,
  ROW_HOVER,
  TEXT_NAME,
  TEXT_PILL,
  type EventTint,
} from './tokens'

// Button 기본 모양(테두리·모서리·크기)을 지우고 글 단추로 쓴다
const BARE = 'h-auto border-0 p-0 font-medium'

// 행사 색: id 번호로 정해 같은 행사는 어느 견본에서나 같은 색
export function tintOf(event: C2Event): EventTint {
  const n = Number(event.id.replace(/\D/g, '')) || 0
  return EVENT_TINTS[(n + EVENT_TINTS.length - 1) % EVENT_TINTS.length] ?? EVENT_TINTS[0]
}

// 머리글자: 이름의 첫 한글(앱 옆 메뉴 행사 목록과 같은 규칙. '2026 소프트웨어…' → '소')
const glyphOf = (name: string) => name.match(/[가-힣]/)?.[0] ?? name.slice(0, 1)

function Glyph({ event, tint }: { event: C2Event; tint: EventTint }) {
  return (
    <span
      aria-hidden
      className={cn(
        'absolute left-0 flex items-center justify-center font-bold',
        GLYPH,
        GLYPH_TOP,
        tint.glyph,
      )}
    >
      {glyphOf(event.name)}
    </span>
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

// 행사 줄: 머리글자(오늘 선 왼쪽) | 이름 + 신호 알약 / 그 아래 선로(오늘 → 다음 일정).
// 줄 전체가 행사 보기(이름 단추의 덮개), 알약은 덮개 위에서 따로 누른다.
export function EventRow({ event, axis, actions }: RowProps) {
  const tint = tintOf(event)
  return (
    <li data-c2-event={event.id} className={cn('group/row relative', ROW, ROW_HOVER)}>
      <div
        className={cn('flex flex-wrap items-center gap-x-2.5 gap-y-1.5', NAME_LINE)}
        style={{ paddingLeft: axis.gutter + NAME_GAP }}
      >
        <Glyph event={event} tint={tint} />
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
          <div className="flex flex-wrap items-center gap-1.5">
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
        <Lane event={event} axis={axis} tint={tint} />
      </div>
    </li>
  )
}
