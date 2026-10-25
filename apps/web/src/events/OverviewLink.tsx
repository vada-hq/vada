import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// 개요 카드 안의 글자 단추(업무 보기, 재정 보기, 업무 제목). 카드 높이를 늘리지 않게 안쪽 여백을 없앤다.
export function OverviewLink({
  onClick,
  className,
  children,
}: {
  onClick: () => void
  className?: string
  children: ReactNode
}) {
  return (
    <Button
      variant="link"
      size="sm"
      className={cn('h-auto p-0 text-sm', className)}
      onClick={onClick}
    >
      {children}
    </Button>
  )
}
