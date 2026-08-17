import type { ReactNode } from 'react'

// figma.design.json 7:3(양축 중앙 정렬, py 42→48) + 7:4(콘텐츠 448→512,
// padding 35→40, border 1). 카드 총폭 594 = 512 + 40×2 + 1×2 (÷0.875 환산).
export function PageCard({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
      <main className="w-full max-w-[594px] rounded-xl border border-gray-200 bg-white p-10 shadow-sm">
        {children}
      </main>
    </div>
  )
}
