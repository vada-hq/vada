import { CircleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { C2Event, C2Signal } from '../c2-data'
import { signalAction, type C2Props } from '../c2-props'
import { GAUGE_FILL, GAUGE_TRACK, SIGNAL, SIGNAL_GAP, SIGNAL_ICON, TEXT_SUB } from './tokens'

type Registration = Extract<C2Signal, { kind: 'registration' }>

// Button 기본 모양(테두리·모서리·크기)을 지우고 글 단추로 쓴다. 신호마다 테두리 버튼을 달지 않는다(명세 5절).
const BARE = 'border-0 p-0 rounded-md'
const PERCENT = 100

// 신청 게이지: 신청 기간이고 정원이 있을 때만 막대를 그린다. 정원이 없으면 '신청 18명' 글만, 막대 자리도 남기지 않는다.
// 글('신청 18/40')을 막대 앞에 둬 업무 진행 막대(막대 뒤 '업무 n/m')로 읽히지 않게 하고, 막대는 짧게(56px) 글 끝에 붙인다.
// 다 차면 막대가 꽉 차고 글이 굵어진다(위험 색 아님, 명세 6절).
function Gauge({ signal }: { signal: Registration }) {
  const { capacity, count, full } = signal
  return (
    <>
      <span className="font-normal text-fg-secondary">신청</span>
      <span className={cn('tabular-nums', full ? 'font-bold text-fg' : 'font-semibold text-fg')}>
        {signal.text}
      </span>
      {capacity !== null && (
        <span aria-hidden className={cn('ml-0.5 inline-block overflow-hidden', GAUGE_TRACK)}>
          <span
            className={cn('block', GAUGE_FILL)}
            style={{ width: `${Math.min(count / capacity, 1) * PERCENT}%` }}
          />
        </span>
      )}
    </>
  )
}

// 신호 하나 = 누르는 글 하나. 위험 색은 지남·예산 초과(danger)에만, 그 요소에 data-c2-danger를 단다(판 문서 5절).
function Signal({ props, event, signal }: { props: C2Props; event: C2Event; signal: C2Signal }) {
  return (
    <Button
      variant="link"
      data-signal
      data-c2-danger={signal.danger || undefined}
      className={cn(
        BARE,
        SIGNAL,
        'gap-1.5 text-left whitespace-nowrap hover:underline',
        TEXT_SUB,
        signal.danger ? 'font-semibold text-danger' : 'font-medium text-fg-secondary',
      )}
      onClick={signalAction(props, event, signal)}
    >
      {signal.danger && <CircleAlert aria-hidden className={SIGNAL_ICON} strokeWidth={2.5} />}
      {signal.kind === 'registration' ? <Gauge signal={signal} /> : signal.text}
    </Button>
  )
}

// 신호 흐름: 신청 → 미정 → 늦은 부서 → 예산(견본 차례). 신호가 없으면 아무것도 그리지 않는다(빈 칸·장식 없음).
export function Signals({ props, event }: { props: C2Props; event: C2Event }) {
  if (event.signals.length === 0) return null
  return (
    <div className={cn('mt-1.5 flex min-w-0 flex-wrap items-center @2xl:mt-0', SIGNAL_GAP)}>
      {event.signals.map(signal => (
        <Signal key={signal.kind + signal.text} props={props} event={event} signal={signal} />
      ))}
    </div>
  )
}
