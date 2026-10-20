import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

// 작업 공간 본문의 폭 틀. 넓은 화면에서 내용이 끝까지 늘어나지 않게 가운데에 모은다.
export default function PageColumn({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('mx-auto flex max-w-3xl flex-col gap-4', className)} {...props} />
}
