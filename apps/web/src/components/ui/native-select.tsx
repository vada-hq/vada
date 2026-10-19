import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'
import { fieldClass } from './input'

// 입력칸 모양의 브라우저 선택칸. 휴대폰에서도 시스템 선택 화면을 그대로 쓴다.
export function NativeSelect({ className, ...props }: ComponentProps<'select'>) {
  return (
    <select
      data-slot="native-select"
      className={cn(fieldClass, 'cursor-pointer', className)}
      {...props}
    />
  )
}
