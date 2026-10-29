import type { ComponentProps } from 'react'
import type { HomeDepartmentBoard } from '@vada/contracts'
import { openMenu } from '@/lib/go-to'
import AvailableLine from './AvailableLine'
import BoardHome from './BoardHome'

type Props = Omit<ComponentProps<typeof BoardHome>, 'board' | 'money'> & {
  board: HomeDepartmentBoard
}

// 부장 홈(HOME-01D, 10/30 확정): 회장단 홈과 같은 배치·부품에 서버가 좁힌 부장 범위의 데이터를 그린다.
// 돈 한 줄은 우리 부서가 맡은 예산이고, 서버가 줄 때만(지금은 시연 학생회의 고정값만) 보인다.
export default function DepartmentHome(props: Props) {
  const { budget } = props.board
  return (
    <BoardHome
      {...props}
      money={
        budget && (
          <AvailableLine
            label={budget.name}
            amount={budget.amount}
            remaining={budget.remaining}
            onFinance={() => openMenu('finance', props.councilId)}
          />
        )
      }
    />
  )
}
