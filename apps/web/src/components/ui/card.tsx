import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

// 와이어프레임 카드: 반경 큰 값, gray-200 테두리, 옅은 그림자. section·details처럼 의미 있는 태그에는 cardClass를 직접 준다.
export const cardClass = 'rounded-lg border bg-card text-card-foreground shadow-sm'

export function Card({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="card" className={cn(cardClass, className)} {...props} />
}
