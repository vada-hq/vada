import { useState } from 'react'
import CouncilWorkspace from './CouncilWorkspace'
import type { Opener, WorkspaceProps } from './pages'

// 작업 공간 틀. 방금 만들었거나 들어온 학생회가 있으면 그 학생회를 먼저 연다.
export default function Workspace({ councils, initialCouncilId, ...props }: WorkspaceProps) {
  const [councilId, setCouncilId] = useState(
    () => (councils.find(item => item.id === initialCouncilId) ?? councils[0])?.id,
  )
  // 방금 만들었거나 들어온 학생회만 운영진 화면으로 시작한다. 그 밖에는 대화가 첫 화면이다.
  const [fresh, setFresh] = useState(initialCouncilId)
  const [picked, setPicked] = useState<{ councilId: string; from: Opener } | null>(null)
  const council = councils.find(item => item.id === councilId) ?? councils[0]
  if (!council) return null
  // 고른 학생회가 열릴 때만 포커스를 옮긴다. 학생회를 잃어 다른 학생회로 넘어갈 때는 옮기지 않는다.
  return (
    <CouncilWorkspace
      key={council.id}
      {...props}
      councils={councils}
      council={council}
      startPage={fresh === council.id ? 'people' : 'chat'}
      returnFocusTo={picked?.councilId === council.id ? picked.from : null}
      onSelect={(next, from) => {
        setFresh(undefined)
        setPicked({ councilId: next, from })
        setCouncilId(next)
      }}
    />
  )
}
