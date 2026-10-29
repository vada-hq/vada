import { cn } from '@/lib/utils'

// 얼마나 찼는지 보이는 가는 막대. value가 max를 넘으면 브라우저가 가득 찬 막대로 그린다.
export function Meter({
  value,
  max,
  label,
  className,
}: {
  value: number
  max: number
  label: string
  className?: string
}) {
  return (
    <progress
      className={cn(
        'h-1.5 w-full appearance-none overflow-hidden rounded-full bg-muted-strong [&::-moz-progress-bar]:bg-primary-emphasis [&::-webkit-progress-bar]:bg-muted-strong [&::-webkit-progress-value]:bg-primary-emphasis',
        className,
      )}
      value={value}
      max={max}
      aria-label={label}
    />
  )
}
