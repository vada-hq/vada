import type { ReactNode } from 'react'
import { wideStepClass } from '@/components/AuthCard'
import { cn } from '@/lib/utils'
import SignedInCard from '../auth/SignedInCard'

const noop = () => {}
const sampleUser = { name: '김구글', email: 'kim.google@example.com' }

// 온보딩 견본을 실제 화면의 틀(로고 줄, 맨 아래 계정 줄과 로그아웃)째 그린다. 와이어프레임과 실제 모습을 나란히 비교하려는 것이다.
export function RealFrame({ children }: { children: ReactNode }) {
  return (
    <div className={cn('w-full max-w-148', wideStepClass)}>
      <SignedInCard user={sampleUser} compact page={false} busy={false} onLogout={noop}>
        {children}
      </SignedInCard>
    </div>
  )
}
