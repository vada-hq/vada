import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

// 본문과 머리글이 같이 쓰는 폭. 목록이 쓰기에 좁지 않고(Polaris 기본 폭 약 1000px), 넓은 화면에서 끝까지 늘어나지 않는다.
// 머리글도 이 폭으로 가운데에 모아야 제목과 본문의 왼쪽 줄이 맞는다.
export const pageWidthClass = 'mx-auto w-full max-w-5xl'

// 작업 공간 본문의 폭 틀.
export default function PageColumn({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn(pageWidthClass, 'flex flex-col gap-4', className)} {...props} />
}
