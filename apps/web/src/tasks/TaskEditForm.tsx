import { useState } from 'react'
import { UpdateTaskSchema, type EventSummary, type TaskDetail } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { useUnsavedInput } from '@/lib/leave-guard'
import { sameJson } from '@/lib/same-json'
import { useFormCheck, withContract } from '@/lib/use-form-check'
import { useEvents } from '../events/useEvents'
import { fieldsOf, fieldsRequest, TASK_CONTRACT_MESSAGES, taskErrors } from './task-fields'
import { eventChoices, linkableEventsOf } from './task-form-options'
import { useTaskOptions } from './useTaskOptions'
import { ChoiceSelect } from './ChoiceSelect'
import { TaskFields } from './TaskFields'

// 행사는 바꿨을 때만 보낸다(안 바꾸면 서버가 행사 권한을 다시 묻지 않는다).
type EditRequest = ReturnType<typeof fieldsRequest> & { eventId?: string | null }

type Props = {
  councilId: string
  onForbidden: () => void
  task: TaskDetail
  saving: boolean
  problem: string | undefined
  // 성공하면 true
  onSave: (request: EditRequest) => Promise<boolean>
  onCancel: () => void
}

// 고를 행사: 이 업무의 부서로 이을 수 있는 것만이다(DEC-94). 행사 목록과 이을 수 있는 행사를 다 읽기 전에는 ready가 아니다.
function useLinkableEvents(
  councilId: string,
  task: Pick<TaskDetail, 'department'>,
  onForbidden: () => void,
): { ready: boolean; list: EventSummary[] } {
  const events = useEvents(councilId, onForbidden)
  const options = useTaskOptions(councilId, undefined, onForbidden)
  if (events.state.kind !== 'ready' || options.state.kind !== 'ready')
    return { ready: false, list: [] }
  const { linkableEvents } = options.state.options
  const departmentId = task.department?.id ?? null
  return {
    ready: true,
    list: linkableEventsOf(events.state.data.events, linkableEvents, departmentId),
  }
}

// 제목, 내용, 마감, 행사 고치기. 저장 버튼은 끄지 않고 누를 때 확인한다.
export function TaskEditForm({ councilId, onForbidden, task, saving, problem, ...rest }: Props) {
  const [values, setValues] = useState(fieldsOf(task))
  const [eventId, setEventId] = useState(task.event?.id ?? null)
  const { ready, list } = useLinkableEvents(councilId, task, onForbidden)
  const changed = eventId !== (task.event?.id ?? null)
  // 고치던 값이 서버 값과 다르면 새로고침이나 다른 곳으로 떠날 때 묻는다(떠날 때 확인).
  useUnsavedInput(changed || !sameJson(values, fieldsOf(task)))
  const request: EditRequest = { ...fieldsRequest(values), ...(changed ? { eventId } : {}) }
  const parsed = UpdateTaskSchema.safeParse(request)
  const valid = parsed.success
  const {
    formRef,
    errors: fieldErrors,
    attempt,
  } = useFormCheck(() => withContract(taskErrors(values), parsed, TASK_CONTRACT_MESSAGES))
  return (
    <form
      ref={formRef}
      noValidate
      aria-label="업무 고치기"
      className="flex flex-col gap-4"
      onSubmit={event => {
        event.preventDefault()
        if (attempt() && valid && !saving) void rest.onSave(request)
      }}
    >
      <TaskFields values={values} disabled={saving} onChange={setValues} errors={fieldErrors} />
      <ChoiceSelect
        label="행사"
        optional
        choices={eventChoices(list, task.event)}
        value={eventId}
        disabled={saving || !ready}
        onChange={setEventId}
      />
      {problem && <StateMessage kind="error">{problem}</StateMessage>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" busy={saving} onClick={rest.onCancel}>
          취소
        </Button>
        <Button type="submit" busy={saving}>
          저장
        </Button>
      </div>
    </form>
  )
}
