import { useState, type ReactNode } from 'react'
import type { MyCouncil } from '@vada/contracts'
import { Button } from '@/components/ui/button'
import CreateCouncilForm from './CreateCouncilForm'
import NoCouncil from './NoCouncil'

// 가운데 카드의 틀. compact는 할 일이 있는 화면(학생회 만들기)이라 계정을 맨 아래 한 줄로 내린다.
// no-council은 학생회가 없을 때의 안내라 계정 줄에 [탈퇴]를 둔다(학생회가 있으면 옆 메뉴에서 탈퇴한다).
export type CardFrame = 'compact' | 'no-council'

type Props = {
  card: (content: ReactNode, frame?: CardFrame) => ReactNode
  // 로그인한 Google 이름(만들기의 '내 이름' 칸에 미리 채운다).
  userName: string
  onEnterCode: (code: string) => void
  onCreated: (council: MyCouncil) => void
  initialCreating?: boolean
  onClose?: (() => void) | undefined
}

// 학생회가 없을 때: 안내(초대 코드, 만들기)를 보이다가 [학생회 만들기]를 누르면 만들기 단계로 바뀐다.
export default function NoCouncilFlow({
  card,
  userName,
  onEnterCode,
  onCreated,
  initialCreating = false,
  onClose,
}: Props) {
  const [creating, setCreating] = useState(initialCreating)
  if (!creating)
    return card(
      <>
        <NoCouncil
          onEnterCode={onEnterCode}
          onCreate={() => setCreating(true)}
          additional={Boolean(onClose)}
        />
        {onClose && (
          <Button touch variant="outline" className="mt-4 w-full" onClick={onClose}>
            닫기
          </Button>
        )}
      </>,
      onClose ? 'compact' : 'no-council',
    )
  return card(
    <CreateCouncilForm
      userName={userName}
      onCancel={() => setCreating(false)}
      onCreated={council => {
        setCreating(false)
        onCreated(council)
      }}
      onClose={onClose}
    />,
    'compact',
  )
}
