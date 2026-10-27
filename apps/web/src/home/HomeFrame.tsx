import type { ReactNode } from 'react'

type Props = {
  // 맨 위 '부서 배정 전' 띠(기능 020 조각 5의 부품)
  assignBand?: ReactNode
  // 그 아래 알림 꺼짐 띠
  pushBand?: ReactNode
  // 인사 카드(HomeGreeting)
  greeting: ReactNode
  // 배치 꼴(CouncilLayout, GridLayout)
  children: ReactNode
}

// 카드의 배치는 창 폭이 아니라 이 틀의 폭(@container)을 본다(옆 메뉴가 있는 1024px 창의 본문은 약 736px).
export default function HomeFrame({ assignBand, pushBand, greeting, children }: Props) {
  return (
    <div className="@container flex flex-col gap-4">
      {assignBand}
      {pushBand}
      {greeting}
      {children}
    </div>
  )
}
