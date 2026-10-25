import type { ReactNode } from 'react'
import PushSettingsButton from '../push/PushSettings'
import AuthPage, { AuthPageCard } from './AuthPage'
import { Button } from '@/components/ui/button'

type Props = {
  user: { name: string; email: string }
  // 학생회 만들기·초대 확인처럼 할 일이 있는 화면. 계정은 맨 아래 한 줄로 내리고 로그아웃을 작게 둬,
  // 단계 제목이 카드 첫 줄이고 주요 버튼 줄이 하나로 보이게 한다(와이어프레임 ORG-01·02, INV-01).
  compact?: boolean
  // 부품 확인 화면은 페이지(가운데 정렬, 화면 높이) 없이 카드만 그린다.
  page?: boolean
  busy: boolean
  onLogout: () => void
  children: ReactNode
}

// 로그인한 사람의 가운데 카드: 이름과 이메일, 안에 들어갈 내용, 휴대폰 알림과 로그아웃.
export default function SignedInCard({
  user,
  compact = false,
  page = true,
  busy,
  onLogout,
  children,
}: Props) {
  const Frame = page ? AuthPage : AuthPageCard
  const logoutLabel = busy ? '로그아웃 중…' : '로그아웃'
  if (compact)
    return (
      <Frame>
        {children}
        <div className="flex items-center gap-2 border-t pt-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium wrap-anywhere text-gray-700">{user.name}</p>
            <p className="text-xs wrap-anywhere text-gray-500">{user.email}</p>
          </div>
          <PushSettingsButton />
          <Button variant="ghost" size="sm" touch busy={busy} onClick={onLogout}>
            {logoutLabel}
          </Button>
        </div>
      </Frame>
    )
  return (
    <Frame>
      <div className="flex flex-col gap-0.5 rounded-md bg-gray-50 px-3 py-2">
        <h2 className="text-xs font-medium text-gray-500">로그인 완료</h2>
        <p className="text-sm font-medium text-gray-900">{user.name}</p>
        <p className="text-xs wrap-anywhere text-gray-500">{user.email}</p>
      </div>
      {children}
      <div className="flex items-center gap-2">
        <PushSettingsButton />
        <Button variant="outline" className="flex-1" busy={busy} onClick={onLogout}>
          {logoutLabel}
        </Button>
      </div>
    </Frame>
  )
}
