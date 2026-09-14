import type { ReactNode } from 'react'
import { CARD_WIDTH } from './spec'

/** 셸 없이 가운데 놓이는 행사 조직 설정 카드다. */
export function SetupCard({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-start justify-center bg-gray-50 px-4 py-12">
      <main
        style={{ maxWidth: `${CARD_WIDTH}px` }}
        className="w-full rounded-xl border border-gray-200 bg-white p-10 shadow-sm"
      >
        {children}
      </main>
    </div>
  )
}
