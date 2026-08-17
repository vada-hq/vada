import type { ReactNode } from 'react'

// figma.design.json 7:3(양축 중앙 정렬, py 42→48) + 7:4(콘텐츠 448→512,
// padding 35→40, border 1). 카드 총폭 594 = 512 + 40×2 + 1×2 (÷0.875 환산).
// 카드 폭은 화면마다 다르다 — ORG-02(14:242)는 860→982로 더 넓다.
const DEFAULT_MAX_WIDTH = 594

export function PageCard({
  children,
  maxWidth = DEFAULT_MAX_WIDTH,
}: {
  children: ReactNode
  maxWidth?: number
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
      <main
        style={{ maxWidth: `${maxWidth}px` }}
        className="w-full rounded-xl border border-gray-200 bg-white p-10 shadow-sm"
      >
        {children}
      </main>
    </div>
  )
}
