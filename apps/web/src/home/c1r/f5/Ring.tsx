import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CHECK_RING, GROUP_STYLE, RING_GAP_DEG, type Group } from './tokens'

const FULL_DEG = 360
const TOP_DEG = -90
const HALF = 2

// 건수 링: 조각 하나 = 한 건. 12시에서 시계 방향으로 목록 차례(지남·오늘 → 임박 → 배정 필요)대로 놓는다.
// 진행(목표 대비 채움)이 아니라 '몇 건이, 어떤 이유로' 쌓였는지를 센다. 0건이면 그리지 않는다(체크 링이 대신한다).
export function CountRing({
  groups,
  size,
  stroke,
  children,
}: {
  groups: Group[]
  size: number
  stroke: number
  children: React.ReactNode
}) {
  const r = (size - stroke) / HALF
  const c = size / HALF
  const circumference = HALF * Math.PI * r
  const step = FULL_DEG / groups.length
  const gap = groups.length > 1 ? RING_GAP_DEG : 0
  const length = ((step - gap) / FULL_DEG) * circumference
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg aria-hidden width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {groups.map((group, i) => (
          <circle
            // oxlint-disable-next-line react/no-array-index-key -- 조각은 차례 자체가 정체다(같은 묶음이 여러 번 온다)
            key={i}
            cx={c}
            cy={c}
            r={r}
            fill="none"
            strokeWidth={stroke}
            className={GROUP_STYLE[group].stroke}
            strokeDasharray={`${length} ${circumference}`}
            transform={`rotate(${TOP_DEG + i * step + gap / HALF} ${c} ${c})`}
          />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  )
}

// 정상인 날: 다 채운 작은 링 안의 체크(확인할 일 없음).
export function CheckRing({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full border-[3px] border-success text-success',
        className,
      )}
      style={{ width: CHECK_RING, height: CHECK_RING }}
    >
      <Check className="size-3.5" strokeWidth={3} />
    </span>
  )
}
