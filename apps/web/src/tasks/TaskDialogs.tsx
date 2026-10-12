import { useState } from 'react'
import type { TaskDetail } from '@vada/contracts'
import { useOrganizationMembers } from '../organization/useOrganizationMembers'
import TaskDetailDialog from './TaskDetailDialog'
import TaskFormDialog from './TaskFormDialog'

type Props = {
  organizationId: string
  // 부서가 있는 구성원. 아니면 보기만 한다.
  manageEvents: boolean
  target: { eventId: string; taskId: string } | null
  onClose: () => void
  // 상태를 바꾸거나 고치거나 지우면 부른다.
  onChanged: () => void
  // 상세의 [행사로 가기]
  onOpenEvent: (eventId: string) => void
}

// 업무 상세와 그 자리 수정(내 업무 M4, 운영 현황 M6). 상세에서 [수정]을 누르면 같은 자리에서 수정 대화상자를 연다.
export default function TaskDialogs({ organizationId, manageEvents, target, onClose, onChanged, onOpenEvent }: Props) {
  const [editing, setEditing] = useState<TaskDetail | null>(null)
  // 수정을 열 때 구성원 목록을 불러온다(부서·담당자 고르기).
  const directory = useOrganizationMembers(organizationId, editing !== null)
  return <>
    <TaskDetailDialog organizationId={organizationId} target={target} manageEvents={manageEvents} onClose={onClose} onChanged={onChanged}
      onDeleted={() => { onClose(); onChanged() }} onEdit={task => { onClose(); setEditing(task); directory.refresh() }}
      onOpenEvent={eventId => { onClose(); onOpenEvent(eventId) }} />
    <TaskFormDialog open={editing !== null} organizationId={organizationId} eventId={editing?.event.id ?? ''} task={editing} directory={directory.data}
      directoryError={directory.loadError} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); onChanged() }} />
  </>
}
