import { cn } from '@/lib/utils'

const bar =
  'absolute inset-0 size-full appearance-none overflow-hidden rounded-full [&::-webkit-progress-bar]:bg-transparent'

// 두 겹 막대(와이어프레임 FIN-00 집행률): 진한 칸은 first(실제 지출), 그 뒤의 연한 칸은 second(지출 예정)까지다.
// 막대 둘을 겹쳐 그린다. 아래 막대는 first + second, 위 막대는 first이고, 화면 읽기는 두 막대를 각각 읽는다.
// max가 0보다 커야 한다(부르는 쪽이 없음을 따로 보인다). 예정 포함 금액이 넘치면 두 막대를 빨갛게 칠한다.
export function TwoPartMeter({
  first,
  second,
  max,
  labels,
  className,
}: {
  first: number
  second: number
  max: number
  labels: { first: string; both: string }
  className?: string
}) {
  const over = first + second > max
  return (
    <div
      className={cn('relative h-2 w-full overflow-hidden rounded-full bg-muted-strong', className)}
    >
      <progress
        className={cn(
          bar,
          'bg-transparent',
          over
            ? '[&::-moz-progress-bar]:bg-danger-emphasis [&::-webkit-progress-value]:bg-danger-emphasis'
            : '[&::-moz-progress-bar]:bg-primary-soft [&::-webkit-progress-value]:bg-primary-soft',
        )}
        value={first + second}
        max={max}
        aria-label={labels.both}
      />
      <progress
        className={cn(
          bar,
          'bg-transparent',
          over
            ? '[&::-moz-progress-bar]:bg-danger-emphasis [&::-webkit-progress-value]:bg-danger-emphasis'
            : '[&::-moz-progress-bar]:bg-primary-emphasis [&::-webkit-progress-value]:bg-primary-emphasis',
        )}
        value={first}
        max={max}
        aria-label={labels.first}
      />
    </div>
  )
}
