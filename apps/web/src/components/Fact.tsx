import type { ReactNode } from 'react'

// 정의 목록 안의 칸 하나: 작은 회색 이름과 그 값. 긴 값은 줄을 바꾼다.
export function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs font-medium text-fg-muted">{label}</dt>
      <dd className="text-sm break-keep text-fg-body wrap-anywhere">{children}</dd>
    </div>
  )
}
