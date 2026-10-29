import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type Props = {
  kind: 'loading' | 'error' | 'empty' | 'notice'
  children: ReactNode
  className?: string
}

// 표시와 접근성만 담당한다. 표시 조건·문구·재시도는 사용하는 기능에서 결정한다.
export default function StateMessage({ kind, children, className }: Props) {
  const role = kind === 'error' ? 'alert' : kind === 'empty' ? undefined : 'status'
  return (
    <p
      role={role}
      className={cn(
        'text-sm wrap-anywhere',
        kind === 'error' ? 'text-destructive' : 'text-fg-muted',
        className,
      )}
    >
      {children}
    </p>
  )
}
