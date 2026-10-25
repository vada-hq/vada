import type { ReactNode } from 'react'
import { AuthCard } from '@/components/AuthCard'
import { BrandMark } from '@/components/BrandMark'

// 가운데 카드: 맨 위 로고 줄과 내용. 와이어프레임 SIGN-IN·INV-00과 같은 틀이다. 부품 확인 화면은 페이지 없이 이 카드만 그린다.
export function AuthPageCard({ children }: { children: ReactNode }) {
  return (
    <AuthCard>
      <div className="flex flex-wrap items-center gap-2">
        <BrandMark />
        <h1 className="text-base font-semibold text-gray-900">VADA</h1>
        <p className="ml-auto text-xs text-gray-500">학생회를 위한 공간</p>
      </div>
      {children}
    </AuthCard>
  )
}

// 로그인 전후의 가운데 카드 화면.
export default function AuthPage({ children }: { children: ReactNode }) {
  // 작업 공간의 h-dvh 열 안에서 카드가 화면보다 길어도 줄어들지 않고 페이지가 스크롤되게 shrink-0을 둔다.
  return (
    <main className="flex min-h-dvh shrink-0 items-center justify-center p-4 sm:py-12">
      <AuthPageCard>{children}</AuthPageCard>
    </main>
  )
}
