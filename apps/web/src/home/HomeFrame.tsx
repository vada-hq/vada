import type { ReactNode } from 'react'
import { KkirukLine } from '@/components/KkirukLine'
import { asOfLabel } from './home-time'

type Props = {
  // 서버가 홈 응답을 만든 시각(ISO)
  asOf: string
  // 홈의 오늘(한국 날짜)
  today: string
  // 맨 위 '부서 배정 전' 띠(기능 020 조각 5의 부품)
  assignBand?: ReactNode
  // 그 아래 알림 꺼짐 띠
  pushBand?: ReactNode
  // 인사 카드(HomeGreeting)
  greeting: ReactNode
  // 배치 꼴(CouncilLayout, GridLayout)
  children: ReactNode
}

// 네 종류 홈이 함께 쓰는 틀(DEC-95): 띠 둘 → 끼룩이 한 줄 → 인사 카드 → 그 종류의 배치 꼴.
// 끼룩이 한 줄은 와이어프레임에서 머리 오른쪽에 있다. 작업 공간 머리는 그대로 두므로(DEC-95) 머리 바로 아래 같은 쪽에 둔다.
// 정해진 글이라 AI가 아니고, 누를 수 없다. 카드의 배치는 창 폭이 아니라 이 틀의 폭(@container)을 본다(옆 메뉴가 있는 1024px 창의 본문은 약 736px).
export default function HomeFrame({
  asOf,
  today,
  assignBand,
  pushBand,
  greeting,
  children,
}: Props) {
  return (
    <div className="@container flex flex-col gap-4">
      {assignBand}
      {pushBand}
      <div className="flex @2xl:justify-end">
        <KkirukLine>{`끼룩이가 ${asOfLabel(asOf, today)} 기준으로 정리했어요`}</KkirukLine>
      </div>
      {greeting}
      {children}
    </div>
  )
}
