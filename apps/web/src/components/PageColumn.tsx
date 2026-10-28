import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

// 폭과 가운데 정렬은 작업 공간이 정한다. 겹친 PageColumn도 그 폭을 꽉 채운다(DEC-101).
export default function PageColumn({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('w-full flex flex-col gap-4', className)} {...props} />
}
