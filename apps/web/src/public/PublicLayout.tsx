import type { ReactNode } from 'react'
import { BrandMark } from '@/components/BrandMark'

// 와이어프레임 EXT 화면: 휴대폰 한 열(390px). 넓은 화면에서는 가운데 카드로 둔다.
export function PublicLayout({ organizationName, children }: { organizationName?: string; children: ReactNode }) {
  return <div className="min-h-dvh bg-gray-50 sm:py-8">
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 bg-white px-4 py-6 sm:min-h-0 sm:rounded-lg sm:border sm:px-6 sm:shadow-sm">
      <header className="flex items-center gap-2">
        <BrandMark />
        <p className="text-sm font-semibold text-gray-900">VADA</p>
        {organizationName && <p className="ml-auto min-w-0 text-right text-xs wrap-anywhere text-gray-500">{organizationName}</p>}
      </header>
      {children}
    </main>
  </div>
}
