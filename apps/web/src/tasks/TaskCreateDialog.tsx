import { useState } from 'react'
import type { CouncilView, EventSummary, TaskDetail, TeamResponse } from '@vada/contracts'
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
import { MissingHint, missingLabels } from '@/components/ui/field'
import { EVENTS_LOAD_FAILED, TASK_TEAM_FAILED } from '@/lib/messages'
import { useTeam } from '@/team/useTeam'
import { useEvents } from '../events/useEvents'
import type { TaskDialogHandlers } from './task-requests'
import { ChoiceSelect } from './ChoiceSelect'
import { TaskFields } from './TaskFields'
import { useTaskCreate } from './useTaskCreate'
import { useTaskCreateForm } from './useTaskCreateForm'

type Props = Pick<TaskDialogHandlers, 'onLost' | 'onForbidden'> & {
  view: CouncilView
  // 열림 상태는 부모가 가진다([만들기] 버튼이 연다).
  open: boolean
  // 행사의 업무 탭에서 열었으면 만들 업무가 이어질 행사
  eventId?: string | undefined
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
  const councilId = props.view.council.id
  const team = useTeam(councilId, props.onForbidden)
  const events = useEvents(councilId, props.onForbidden)
  const [saving, setSaving] = useState(false)
  const failedText = team.loadFailed
    ? TASK_TEAM_FAILED
    : events.state.kind === 'failed'
      ? EVENTS_LOAD_FAILED
      : null
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
        {team.data && events.state.kind === 'ready' ? (
          <CreateForm
            {...props}
            team={team.data}
            events={events.state.data.events}
            saving={saving}
            setSaving={setSaving}
          />
        ) : (
          <StateMessage kind={failedText ? 'error' : 'loading'}>
            {failedText ?? '불러오는 중이에요'}
          </StateMessage>
        )}
      </DialogContent>
    </Dialog>
  )
}

type FormProps = Omit<Props, 'open'> & {
  team: TeamResponse
  events: EventSummary[]
  saving: boolean
  setSaving: (saving: boolean) => void
}

function CreateForm({ view, team, events, saving, setSaving, ...props }: FormProps) {
  const form = useTaskCreateForm(view, team, events, props.eventId)
  const create = useTaskCreate(view.council.id, form.request, { ...props, setSaving })

  return (
    <form
      aria-label="업무 만들기"
      className="flex flex-col gap-4"
      onSubmit={event => {
        event.preventDefault()
        void create.submit()
      }}
    >
      <TaskFields values={form.fields} disabled={saving} onChange={form.setFields} />
      <ChoiceSelect
        label="행사"
        choices={form.events}
        value={form.eventId}
        disabled={saving}
        onChange={form.pickEvent}
      />
      <ChoiceSelect
        label="담당 부서"
        choices={form.departments}
        value={form.departmentId}
        disabled={saving}
        onChange={form.pickDepartment}
      />
      <ChoiceSelect
        label="담당자"
        choices={form.assignees}
        value={form.assigneeId}
        disabled={saving}
        onChange={form.setAssigneeId}
      />
      {create.problem && <StateMessage kind="error">{create.problem}</StateMessage>}
      <DialogFooter>
        <MissingHint missing={missingLabels([['제목', form.fields.title]])} />
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
