import type { ReactNode } from 'react'

// 024-9 공통 틀: 본문과 요청 요약. 좁은 화면은 같은 읽기 순서로 요약이 아래로 간다.
export function PurchaseColumns({
  children,
  summary,
}: {
  children: ReactNode
  summary: ReactNode
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="flex min-w-0 flex-col gap-6 lg:col-span-2">{children}</div>
      <aside
        aria-label="요청 요약"
        className="flex flex-col gap-4 self-start rounded-sm border bg-white p-4 lg:sticky lg:top-4"
      >
        {summary}
      </aside>
    </div>
  )
}
