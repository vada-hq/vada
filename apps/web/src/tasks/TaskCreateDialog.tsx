import { useState } from 'react'
import type { CouncilView, EventSummary, TaskDetail, TeamResponse } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { EVENTS_LOAD_FAILED, TASK_TEAM_FAILED } from '@/lib/messages'
import { useFormCheck } from '@/lib/use-form-check'
import { useTeam } from '@/team/useTeam'
import { useEvents } from '../events/useEvents'
import type { TaskDialogHandlers } from './task-requests'
import { ChoiceSelect } from './ChoiceSelect'
import { taskErrors } from './task-fields'
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
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>업무 만들기</DialogTitle>
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

// 업무를 어디에 둘지: 행사, 담당 부서, 담당자(모두 선택).
function PlacementFields({
  form,
  saving,
}: {
  form: ReturnType<typeof useTaskCreateForm>
  saving: boolean
}) {
  return (
    <>
      <ChoiceSelect
        label="행사"
        optional
        choices={form.events}
        value={form.eventId}
        disabled={saving}
        onChange={form.pickEvent}
      />
      <ChoiceSelect
        label="담당 부서"
        optional
        choices={form.departments}
        value={form.departmentId}
        disabled={saving}
        onChange={form.pickDepartment}
      />
      <ChoiceSelect
        label="담당자"
        optional
        choices={form.assignees}
        value={form.assigneeId}
        disabled={saving}
        onChange={form.setAssigneeId}
      />
    </>
  )
}

function CreateForm({ view, team, events, saving, setSaving, ...props }: FormProps) {
  const form = useTaskCreateForm(view, team, events, props.eventId)
  const create = useTaskCreate(view.council.id, form.request, { ...props, setSaving })
  const { formRef, errors: fieldErrors, attempt } = useFormCheck(() => taskErrors(form.fields))

  return (
    <form
      ref={formRef}
      noValidate
      aria-label="업무 만들기"
      className="flex flex-col gap-4"
      onSubmit={event => {
        event.preventDefault()
        if (attempt()) void create.submit()
      }}
    >
      <TaskFields
        values={form.fields}
        disabled={saving}
        onChange={form.setFields}
        errors={fieldErrors}
      />
      <PlacementFields form={form} saving={saving} />
      {create.problem && <StateMessage kind="error">{create.problem}</StateMessage>}
      <DialogFooter>
        <Button type="button" variant="outline" disabled={saving} onClick={props.onClose}>
          닫기
        </Button>
        <Button type="submit" disabled={saving}>
          만들기
        </Button>
      </DialogFooter>
    </form>
  )
}
