import type { ComponentProps } from 'react'
import type { HomeCouncilBoard } from '@vada/contracts'
import { openMenu } from '@/lib/go-to'
import AvailableLine from './AvailableLine'
import BoardHome from './BoardHome'

type Props = Omit<ComponentProps<typeof BoardHome>, 'board' | 'money'> & { board: HomeCouncilBoard }

// 회장단 홈(HOME-01C): 공통 홈 배치에 회장단 데이터와 사용 가능 한 줄.
// 사용 가능은 회계 기간이 없으면(overview null) 숨긴다. 재정 담당이 없어도 금액은 사실이라 보인다(재정 담당 없음은 ①의 몫, c235 2.5).
export default function CouncilHome(props: Props) {
  const available = props.home.financeSummary?.overview?.available
  return (
    <BoardHome
      {...props}
      money={
        available !== undefined && (
          <AvailableLine
            amount={available}
            onFinance={() => openMenu('finance', props.councilId)}
          />
        )
      }
    />
  )
}
