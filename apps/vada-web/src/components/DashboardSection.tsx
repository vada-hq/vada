import type { ReactNode } from 'react'

interface DashboardSectionProps {
  /** design 대조가 이 카드를 찾아가는 끈(spec/screens.ts의 nodeIdOf). */
  nodeId?: string
  title?: string
  action?: ReactNode
  children: ReactNode
}

// 제목 줄과 내용으로 이루어진 카드(16:135·16:206·16:239·16:269).
// 카드 radius 9.25→rounded-xl, 테두리 gray-200, 흰 배경.
// 제목 줄 16:136: 배경 #F9FAFB→gray-50, padding 10.5/17.5→3/5, 아래 테두리.
export function DashboardSection({
  nodeId,
  title,
  action,
  children,
}: DashboardSectionProps) {
  return (
    <section data-node-id={nodeId} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 bg-gray-50 px-5 py-3">
          {title && <h2 className="text-sm font-semibold text-gray-700">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  )
}
