import { cn } from '@/lib/utils'

const bar =
  'absolute inset-0 size-full appearance-none overflow-hidden rounded-full [&::-webkit-progress-bar]:bg-transparent'

// 두 겹 막대(와이어프레임 FIN-00 집행률): 진한 칸은 first(실제 지출), 그 뒤의 연한 칸은 second(지출 예정)까지다.
// 막대 둘을 겹쳐 그린다. 아래 막대는 first + second, 위 막대는 first이고, 화면 읽기는 두 막대를 각각 읽는다.
// max가 0보다 커야 한다(부르는 쪽이 없음을 따로 보인다). 넘치면 브라우저가 가득 찬 막대로 그린다.
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
  return (
    <div className={cn('relative h-2 w-full overflow-hidden rounded-full bg-gray-200', className)}>
      <progress
        className={cn(
          bar,
          'bg-transparent [&::-moz-progress-bar]:bg-blue-300 [&::-webkit-progress-value]:bg-blue-300',
        )}
        value={first + second}
        max={max}
        aria-label={labels.both}
      />
      <progress
        className={cn(
          bar,
          'bg-transparent [&::-moz-progress-bar]:bg-blue-600 [&::-webkit-progress-value]:bg-blue-600',
        )}
        value={first}
        max={max}
        aria-label={labels.first}
      />
    </div>
  )
}
