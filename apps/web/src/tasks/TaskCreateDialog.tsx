import { useState } from 'react'
import type { CouncilView, TaskDetail } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { TASK_TEAM_FAILED } from '@/lib/messages'
import { useTeam } from '@/team/useTeam'
import { emptyFields, fieldsRequest } from './task-fields'
import {
  assigneeChoices,
  defaultDepartmentId,
  departmentChoices,
  keepAssignee,
} from './task-form-options'
import type { TaskDialogHandlers } from './task-requests'
import { ChoiceSelect } from './ChoiceSelect'
import { TaskFields } from './TaskFields'
import { useTaskCreate } from './useTaskCreate'

type Props = Pick<TaskDialogHandlers, 'onLost' | 'onForbidden'> & {
  view: CouncilView
  // 열림 상태는 부모가 가진다([만들기] 버튼이 연다).
  open: boolean
  onClose: () => void
  // 만든 업무를 받는다. 부모가 목록을 다시 읽고 대화상자를 닫는다.
  onCreated: (task: TaskDetail) => void
}

// 업무 만들기 대화상자. 닫혀 있으면 아무것도 읽지 않는다.
export function TaskCreateDialog({ open, ...props }: Props) {
  if (!open) return null
  return <OpenCreateDialog {...props} />
}

function OpenCreateDialog(props: Omit<Props, 'open'>) {
  const team = useTeam(props.view.council.id, props.onForbidden)
  const [saving, setSaving] = useState(false)
  return (
    <Dialog
      open
      onOpenChange={open => {
        if (!open && !saving) props.onClose()
      }}
    >
      <DialogContent aria-describedby="task-create-description">
        <DialogHeader>
          <DialogTitle>업무 만들기</DialogTitle>
          <DialogDescription id="task-create-description">
            맡은 사람의 휴대폰에 알림이 가요.
          </DialogDescription>
        </DialogHeader>
        {team.data ? (
          <CreateForm {...props} team={team.data} saving={saving} setSaving={setSaving} />
        ) : (
          <StateMessage kind={team.loadFailed ? 'error' : 'loading'}>
            {team.loadFailed ? TASK_TEAM_FAILED : '불러오는 중이에요'}
          </StateMessage>
        )}
      </DialogContent>
    </Dialog>
  )
}

type FormProps = Omit<Props, 'open'> & {
  team: NonNullable<ReturnType<typeof useTeam>['data']>
  saving: boolean
  setSaving: (saving: boolean) => void
}

function CreateForm({ view, team, saving, setSaving, ...props }: FormProps) {
  const [fields, setFields] = useState(emptyFields)
  const [departmentId, setDepartmentId] = useState(defaultDepartmentId(view))
  const [assigneeId, setAssigneeId] = useState(() =>
    keepAssignee(assigneeChoices(view, team, defaultDepartmentId(view)), null),
  )
  const request = { ...fieldsRequest(fields), departmentId, assigneeId }
  const create = useTaskCreate(view.council.id, request, { ...props, setSaving })

  return (
    <form
      aria-label="업무 만들기"
      className="flex flex-col gap-4"
      onSubmit={event => {
        event.preventDefault()
        void create.submit()
      }}
    >
      <TaskFields values={fields} disabled={saving} onChange={setFields} />
      <ChoiceSelect
        label="담당 부서"
        choices={departmentChoices(view, team)}
        value={departmentId}
        disabled={saving}
        onChange={next => {
          setDepartmentId(next)
          setAssigneeId(keepAssignee(assigneeChoices(view, team, next), assigneeId))
        }}
      />
      <ChoiceSelect
        label="담당자"
        choices={assigneeChoices(view, team, departmentId)}
        value={assigneeId}
        disabled={saving}
        onChange={setAssigneeId}
      />
      {create.problem && <StateMessage kind="error">{create.problem}</StateMessage>}
      <DialogFooter>
        <Button type="button" variant="outline" disabled={saving} onClick={props.onClose}>
          취소
        </Button>
        <Button type="submit" disabled={!create.valid || saving}>
          만들기
        </Button>
      </DialogFooter>
    </form>
  )
}
