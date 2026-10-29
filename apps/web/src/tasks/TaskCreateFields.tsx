import type { Dispatch, SetStateAction } from 'react'
import { TASK_BODY_MAX, TASK_TITLE_MAX, type TaskCreateOptionsResponse } from '@vada/contracts'
import { Field } from '@/components/ui/field'
import { DateField } from '@/components/ui/date-field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { FieldErrors } from '@/lib/use-form-check'
import { ChoiceSelect } from './ChoiceSelect'
import type { Choice } from './task-form-options'
import type { TaskCreateValues } from './task-fields'
import { TASK_CREATE_TEXT as text } from './task-text'
import { COUNCIL_TASK_LABEL, NO_ASSIGNEE_LABEL } from './task-view'

type Props = {
  values: TaskCreateValues
  onValues: Dispatch<SetStateAction<TaskCreateValues>>
  onDepartment: (id: string | null) => void
  options: TaskCreateOptionsResponse
  events: Choice[]
  busy: boolean
  errors: FieldErrors
}

const sectionClass = 'flex flex-col gap-4 border-t pt-5 first:border-t-0 first:pt-0'
const headingClass = 'text-sm font-semibold text-muted-foreground'
const inputClass = 'max-sm:min-h-11'

function Definition({ values, onValues, busy, errors }: Props) {
  return (
    <section aria-label={text.definition} className={sectionClass}>
      <h3 className={headingClass}>{text.definition}</h3>
      <Field label={text.taskTitle} required error={errors.title}>
        <Input
          autoFocus
          className={inputClass}
          maxLength={TASK_TITLE_MAX}
          value={values.title}
          disabled={busy}
          onChange={event => onValues(before => ({ ...before, title: event.target.value }))}
        />
      </Field>
      <Field label={text.body} optional error={errors.body}>
        <Textarea
          maxLength={TASK_BODY_MAX}
          value={values.body}
          disabled={busy}
          onChange={event => onValues(before => ({ ...before, body: event.target.value }))}
        />
      </Field>
    </section>
  )
}

function Assignment(props: Props) {
  const { values, options, onValues, busy, errors } = props
  const department = options.departments.find(item => item.id === values.departmentId)
  const departments = options.departments.map(item => ({
    id: item.id,
    label: item.name ?? COUNCIL_TASK_LABEL,
  }))
  const assignees = (department?.assignees ?? []).map(item => ({
    id: item.id,
    label: item.name ?? NO_ASSIGNEE_LABEL,
  }))
  return (
    <section aria-label={text.assignment} className={sectionClass}>
      <h3 className={headingClass}>{text.assignment}</h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 [&_select]:max-sm:min-h-11">
        <ChoiceSelect
          label={text.department}
          choices={departments}
          value={values.departmentId}
          disabled={busy}
          onChange={props.onDepartment}
          error={errors.departmentId}
        />
        <ChoiceSelect
          label={text.assignee}
          choices={assignees}
          value={values.assigneeId}
          optional
          disabled={busy}
          error={errors.assigneeId}
          onChange={assigneeId => onValues(before => ({ ...before, assigneeId }))}
        />
        <Field label={text.dueDate} optional error={errors.dueDate}>
          <DateField
            clearable
            value={values.dueDate}
            disabled={busy}
            onChange={dueDate => onValues(before => ({ ...before, dueDate }))}
          />
        </Field>
      </div>
    </section>
  )
}

// 업무 추가 창의 칸. 부품 확인 화면도 같은 묶음·선택칸을 쓴다.
export function TaskCreateFields(props: Props) {
  return (
    <div className="flex flex-col gap-5 break-keep wrap-anywhere">
      <Definition {...props} />
      <Assignment {...props} />
      <section aria-label={text.context} className={sectionClass}>
        <h3 className={headingClass}>{text.context}</h3>
        <div className="[&_select]:max-sm:min-h-11">
          <ChoiceSelect
            label={text.event}
            choices={props.events}
            value={props.values.eventId}
            optional
            disabled={props.busy}
            error={props.errors.eventId}
            onChange={eventId => props.onValues(before => ({ ...before, eventId }))}
          />
        </div>
      </section>
    </div>
  )
}
