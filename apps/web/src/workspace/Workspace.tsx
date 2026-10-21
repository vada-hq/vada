import { useState } from 'react'
import type { MyCouncil } from '@vada/contracts'
import CouncilWorkspace from './CouncilWorkspace'
import type { Opener, Page, WorkspaceProps } from './pages'

// 업무 알림으로 열었으면 업무 화면이, 방금 만든 학생회면 운영진 화면이, 그 밖에는 대화가 첫 화면이다.
function startPageOf(fresh: boolean, taskLinked: string | undefined): Page {
  if (taskLinked) return 'tasks'
  return fresh ? 'people' : 'chat'
}

// 알림으로 연 학생회나 방금 만든 학생회가 내 목록에 있으면 그 학생회, 없으면 첫 학생회다.
function councilOf(councils: MyCouncil[], wanted: string | undefined) {
  return councils.find(item => item.id === wanted) ?? councils[0]
}

// 작업 공간 틀. 방금 만들었거나 들어온 학생회가 있으면 그 학생회를 먼저 연다.
export default function Workspace({
  councils,
  initialCouncilId,
  chatLink,
  ...props
}: WorkspaceProps) {
  const [councilId, setCouncilId] = useState(
    () => councilOf(councils, chatLink?.councilId ?? initialCouncilId)?.id,
  )
  // 알림으로 연 방은 처음 열린 학생회에서 한 번만 연다. 학생회를 바꿨다 돌아와도 다시 열지 않는다.
  const [link, setLink] = useState(chatLink)
  // 방금 만들었거나 들어온 학생회만 운영진 화면으로 시작한다. 그 밖에는 대화가 첫 화면이다.
  const [fresh, setFresh] = useState(chatLink ? undefined : initialCouncilId)
  const [picked, setPicked] = useState<{ councilId: string; from: Opener } | null>(null)
  const council = councilOf(councils, councilId)
  if (!council) return null
  const linked = link?.councilId === council.id ? link : null
  // 고른 학생회가 열릴 때만 포커스를 옮긴다. 학생회를 잃어 다른 학생회로 넘어갈 때는 옮기지 않는다.
  return (
    <CouncilWorkspace
      key={council.id}
      {...props}
      councils={councils}
      council={council}
      startPage={startPageOf(fresh === council.id, linked?.taskId)}
      roomId={linked?.roomId}
      taskId={linked?.taskId}
      returnFocusTo={picked?.councilId === council.id ? picked.from : null}
      onSelect={(next, from) => {
        setFresh(undefined)
        setLink(null)
        setPicked({ councilId: next, from })
        setCouncilId(next)
      }}
    />
  )
}
