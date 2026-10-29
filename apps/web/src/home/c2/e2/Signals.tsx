import { CircleDashed, Clock, Users, Wallet } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { C2Event, C2Signal } from '../c2-data'
import { signalAction, type C2Props } from '../c2-props'
import { SIGNAL, SIGNAL_ICON, SIGNALS_WIDE, TEXT_SUB } from './tokens'

const ICON: Record<C2Signal['kind'], LucideIcon> = {
  registration: Users,
  undecided: CircleDashed,
  late: Clock,
  budget: Wallet,
}

// 신청 현황 글은 '18/40'뿐이라 흑백에서도 무엇인지 읽히게 앞에 '신청'을 붙인다.
const labelOf = (signal: C2Signal) =>
  signal.kind === 'registration' ? `신청 ${signal.text}` : signal.text

// 색: 위험 빨강은 지남·예산 초과(danger)에만. 다 참은 굵은 검정, 나머지(미정·예산 미정·신청 중)는 중간 회색.
function toneOf(signal: C2Signal) {
  if (signal.danger) return 'font-semibold text-danger'
  if (signal.kind === 'registration' && signal.full) return 'font-semibold text-fg'
  return 'font-medium text-fg-secondary'
}

// 신호 하나 = 아이콘 + 글 단추. 테두리·면 없이 글 자체가 누르는 자리다(명세 5절). 줄 덮개 위(z-10)에 있다.
function Signal({ signal, onClick }: { signal: C2Signal; onClick: () => void }) {
  const Icon = ICON[signal.kind]
  return (
    <Button
      variant="link"
      data-sig
      data-c2-danger={signal.danger || undefined}
      className={cn(
        'border-0 underline-offset-4 hover:bg-muted/70 hover:no-underline',
        SIGNAL,
        TEXT_SUB,
        toneOf(signal),
      )}
      onClick={onClick}
    >
      <Icon aria-hidden className={SIGNAL_ICON} strokeWidth={2.25} />
      {labelOf(signal)}
    </Button>
  )
}

export function Signals({ event, props }: { event: C2Event; props: C2Props }) {
  if (event.signals.length === 0) return null
  return (
    <div className={cn('mt-1.5 flex min-w-0 flex-wrap gap-x-4 @2xl:mt-0', SIGNALS_WIDE)}>
      {event.signals.map(signal => (
        <Signal
          key={`${signal.kind}-${signal.text}`}
          signal={signal}
          onClick={signalAction(props, event, signal)}
        />
      ))}
    </div>
  )
}
