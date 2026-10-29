import { Bell, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { C1R_TITLE } from '../c1r-data'
import { countReasons, type Reason } from './reasons'
import {
  BAND_PAD,
  BAND_RADIUS,
  BAND_RADIUS_QUIET,
  BAND_SHADOW,
  MEDAL,
  PILL,
  PILL_GAP,
  PILL_ICON,
  TEXT_COUNT,
  TEXT_MAIN,
  TEXT_SUB,
} from './tokens'

export const HEAD_ID = 'c1r-f3-head'

// 이유 알약(애플 홈 상태 알약): 아이콘 원 + 이유 / 건수 두 줄.
// 지남·오늘은 짙은 면(fg)으로 뒤집어 띠 안의 초점으로 삼는다. 위험 빨강은 줄의 사실 글에만 쓰므로(K5) 알약은 짙기로만 다르다.
function Pill({ reason, count }: { reason: Reason; count: number }) {
  const Icon = reason.icon
  return (
    <li
      className={cn(
        'flex items-center',
        PILL,
        PILL_GAP,
        reason.urgent ? 'bg-fg text-white' : 'bg-muted text-fg',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'flex shrink-0 items-center justify-center rounded-full',
          PILL_ICON,
          reason.urgent ? 'bg-white text-fg' : 'bg-card text-fg-secondary',
        )}
      >
        <Icon className="size-4" strokeWidth={2.25} />
      </span>
      <span className={cn('flex flex-col', TEXT_SUB)}>
        <span className="font-semibold whitespace-nowrap">{reason.label}</span>
        <span className={reason.urgent ? 'text-white/75' : 'text-fg-tertiary'}>{`${count}건`}</span>
      </span>
    </li>
  )
}

// 띠 앞 둥근 표. 평소(0건)에는 체크로 바뀐다.
function Medal({ quiet }: { quiet: boolean }) {
  const Icon = quiet ? Check : Bell
  return (
    <span
      aria-hidden
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-primary-surface text-primary-strong',
        MEDAL,
      )}
    >
      <Icon className="size-5" strokeWidth={2.25} />
    </span>
  )
}

// 구역 머리 = 둥근 띠 하나. 977은 한 줄(이름·건수 왼쪽, 알약 오른쪽), 그 아래 폭은 두 단(이름 줄 / 알약 줄).
// 알약은 목록(ul)이라 머리 건수 측정(K6)은 이름 줄의 수만 센다.
export function Band({ rows, total }: { rows: Parameters<typeof countReasons>[0]; total: number }) {
  const quiet = total === 0
  const reasons = countReasons(rows)
  return (
    <div
      className={cn(
        'flex flex-col gap-2.5 bg-card @4xl:flex-row @4xl:items-center @4xl:gap-6',
        BAND_SHADOW,
        BAND_PAD,
        quiet ? cn(BAND_RADIUS_QUIET, 'py-2') : BAND_RADIUS,
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <Medal quiet={quiet} />
        <h2
          id={HEAD_ID}
          className={cn('min-w-0 font-semibold text-fg', TEXT_MAIN, 'break-keep wrap-anywhere')}
        >
          {C1R_TITLE}
        </h2>
        {quiet ? (
          <span className={cn('shrink-0 text-fg-tertiary', TEXT_MAIN)}>없음</span>
        ) : (
          <span className="flex shrink-0 items-baseline gap-0.5">
            <span className={cn('font-bold text-fg tabular-nums', TEXT_COUNT)}>{total}</span>
            <span className={cn('text-fg-tertiary', TEXT_SUB)}>건</span>
          </span>
        )}
      </div>
      {reasons.length > 0 && (
        <ul
          aria-label="이유별 건수"
          className="flex flex-wrap gap-1.5 @2xl:pl-13 @4xl:ml-auto @4xl:pl-0"
        >
          {reasons.map(({ reason, count }) => (
            <Pill key={reason.key} reason={reason} count={count} />
          ))}
        </ul>
      )}
    </div>
  )
}
