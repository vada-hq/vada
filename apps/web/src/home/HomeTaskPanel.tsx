import { useState } from 'react'
import type { CouncilView } from '@vada/contracts'
import { openRecord } from '@/lib/go-to'
import { TaskPanel } from '../tasks/TaskPanel'

type Props = {
  view: CouncilView
  taskId: string | undefined
  onForbidden: () => void
  onLost: (message: string) => void
  onChanged: () => void
}

// 홈 본문은 유지하고 기록 칸마다 패널만 다시 연다. 행사에서 뒤로 돌아와도 같은 업무가 다시 열린다.
export default function HomeTaskPanel({ taskId, onLost, ...props }: Props) {
  const [openId, setOpenId] = useState(taskId ?? null)
  return (
    <TaskPanel
      {...props}
      taskId={openId}
      onClose={() => setOpenId(null)}
      onLost={message => {
        setOpenId(null)
        onLost(message)
      }}
      onOpenEvent={id => openRecord('events', props.view.council.id, id, { overRecord: true })}
    />
  )
}
