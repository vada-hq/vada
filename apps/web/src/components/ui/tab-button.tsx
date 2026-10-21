import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

// 와이어프레임 페이지 탭: 높이 40px(py-3 + 밑줄 2px), 굵기 500, 비활성 gray-500, 활성 blue-700과 blue-600 밑줄. 탭 동작(ARIA·키보드)은 쓰는 쪽이 정한다.
// 밑줄을 부모의 border-b에 겹치려고 -mb-px를 쓴다. 부모에 overflow를 주면 1px이 넘쳐 스크롤 막대가 생기므로 두지 않는다.
export function TabButton({ className, ...props }: ComponentProps<'button'>) {
  return (
    <button
      type="button"
      role="tab"
      className={cn(
        '-mb-px inline-flex cursor-pointer items-center border-b-2 border-transparent px-4 py-3 text-sm font-medium whitespace-nowrap text-gray-500 transition-colors hover:text-gray-700 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none aria-selected:border-primary aria-selected:text-accent-foreground',
        className,
      )}
      {...props}
    />
  )
}
