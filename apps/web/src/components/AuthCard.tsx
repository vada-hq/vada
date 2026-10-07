import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

// 와이어프레임 SIGN-IN·INV 화면의 가운데 카드(폭 520px, 여백 36px). 페이지 가운데 정렬은 쓰는 쪽이 맡는다.
export function AuthCard({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('flex w-full max-w-148 flex-col gap-6 rounded-lg border bg-white p-6 shadow-sm sm:p-10', className)} {...props} />
}
