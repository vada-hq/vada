import type { ReactNode } from 'react'

// 정의 목록 안의 칸 하나: 작은 회색 이름과 그 값. 긴 값은 줄을 바꾼다.
export function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs font-medium text-gray-500">{label}</dt>
      <dd className="text-sm text-gray-800 wrap-anywhere">{children}</dd>
    </div>
  )
}
