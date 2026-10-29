import { cn } from '@/lib/utils'

// 수 배지 상한. 옆 메뉴 칸이 좁아 세 글자('99+')까지만 쓴다(MUI 기본 99+, DEC-96).
const COUNT_MAX = 99

// '99+'처럼 상한을 넘으면 줄이고, 목록이 잘려 실제 수가 더 클 수 있으면(more) '+'를 붙인다.
export const countLabel = (count: number, more = false) =>
  count > COUNT_MAX ? `${COUNT_MAX}+` : `${count}${more ? '+' : ''}`

// 와이어프레임 수 배지(사이드바 v6.2): 빨간 둥근 칸 안의 흰 굵은 수. 나에게 걸린 수(안 읽은 메시지, 지난 업무)만 쓴다.
// 상태 칩(badge.tsx)과 다른 부품이다. 와이어프레임의 red-500은 흰 글 대비가 4.5:1에 못 미쳐 red-600이다(WCAG 1.4.3).
// 0이면 그리지 않는다. 수만으로는 뜻을 알 수 없어 읽는 이름(label)을 받는다.
export function CountBadge({
  count,
  prefix,
  more = false,
  label,
  className,
}: {
  count: number
  // 수 앞의 글(예: '지남')
  prefix?: string
  more?: boolean
  label: string
  className?: string
}) {
  if (count <= 0) return null
  return (
    <span
      aria-label={label}
      className={cn(
        'inline-flex shrink-0 items-center rounded-full bg-notify px-1.5 py-0.5 text-xs font-bold whitespace-nowrap text-white',
        className,
      )}
    >
      {prefix ? `${prefix} ` : ''}
      {countLabel(count, more)}
    </span>
  )
}
