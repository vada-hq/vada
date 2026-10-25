import { useState } from 'react'
import type { MyCouncil } from '@vada/contracts'
import CreateCouncilForm from './CreateCouncilForm'
import NoCouncil from './NoCouncil'

type Props = {
  // 로그인한 Google 이름(만들기의 '내 이름' 칸에 미리 채운다).
  userName: string
  onEnterCode: (code: string) => void
  onCreated: (council: MyCouncil) => void
}

// 학생회가 없을 때: 안내(초대 코드, 만들기)를 보이다가 [학생회 만들기]를 누르면 만들기 단계로 바뀐다.
export default function NoCouncilFlow({ userName, onEnterCode, onCreated }: Props) {
  const [creating, setCreating] = useState(false)
  if (!creating) return <NoCouncil onEnterCode={onEnterCode} onCreate={() => setCreating(true)} />
  return (
    <CreateCouncilForm
      userName={userName}
      onCancel={() => setCreating(false)}
      onCreated={council => {
        setCreating(false)
        onCreated(council)
      }}
    />
  )
}
