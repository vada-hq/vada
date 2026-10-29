import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

// 입력칸·선택칸·여러 줄 입력이 같은 모양을 쓴다(데스크톱 높이 33.5px). 라벨 안에 넣어도 라벨 굵기를 물려받지 않게 font-normal을 둔다.
// 640px 미만에서는 16px(text-base)이다. iOS는 16px보다 작은 입력칸에 포커스가 가면 화면을 확대한다. 글자 크기를 바꾸는 쪽은 sm: 값도 같이 준다.
// 선택칸은 :read-only에 걸리므로 읽기 전용 모양은 입력칸과 여러 줄 입력에만 준다.
export const baseFieldClass =
  'w-full min-w-0 rounded-sm border border-input bg-white px-3 py-2 text-base font-normal sm:text-sm text-fg-body outline-none placeholder:text-fg-subtle focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:border-border disabled:bg-surface-subtle disabled:text-fg-subtle aria-invalid:border-destructive'

export const fieldClass = `${baseFieldClass} max-sm:min-h-11`

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return (
    <input
      data-slot="input"
      className={cn(fieldClass, 'read-only:border-border read-only:bg-surface-subtle', className)}
      {...props}
    />
  )
}
