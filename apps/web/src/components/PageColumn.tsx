import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

// 본문의 폭. 머리글과 같은 왼쪽 줄에 붙고 가운데로 모으지 않는다(DEC-96, 와이어프레임 사이드바 v6.2).
// 화면마다 폭을 정하기 전에 넓은 화면에서 끝없이 넓어지지 않게 기본 최대 폭은 1024px이다(근거 약함, DEC-96).
export const pageWidthClass = 'w-full max-w-5xl'

// 화면마다의 와이어프레임 본문 폭(예 행사 목록 max-w-3xl). 그 화면을 고치는 영역이 넘긴다.
// 본문 끝까지 쓰는 화면(와이어프레임 OPS-TASK-01 업무 보드)은 max-w-none이다.
type PageWidth =
  'max-w-2xl' | 'max-w-3xl' | 'max-w-4xl' | 'max-w-5xl' | 'max-w-6xl' | 'max-w-7xl' | 'max-w-none'

// 작업 공간 본문의 폭 틀.
export default function PageColumn({
  width,
  className,
  ...props
}: ComponentProps<'div'> & { width?: PageWidth }) {
  return <div className={cn(pageWidthClass, width, 'flex flex-col gap-4', className)} {...props} />
}
