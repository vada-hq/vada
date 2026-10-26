import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { FieldErrors } from '@/lib/use-form-check'
import type { Choice } from '@/tasks/task-form-options'
import { EventField } from './EventField'
import { RequesterField } from './RequesterField'
import { TaskField } from './TaskField'
import type { RequestValues } from './request-form'

type Props = {
  councilId: string
  values: RequestValues
  saving: boolean
  errors: FieldErrors
  requesters: Choice[] | null | undefined
  pickTask: boolean
  picked: Choice | null
  onChange: (patch: Partial<RequestValues>) => void
  onPick: (choice: Choice | null) => void
  onForbidden: () => void
}

export function RequestBasics({
  councilId,
  values,
  saving,
  errors,
  requesters,
  pickTask,
  picked,
  onChange,
  onPick,
  onForbidden,
}: Props) {
  return (
    <section aria-label="기본 정보" className="flex flex-col gap-4 rounded-sm border bg-white p-4">
      <h2 className="text-base font-semibold">기본 정보</h2>
      <Field label="제목" required error={errors.title}>
        <Input
          value={values.title}
          disabled={saving}
          onChange={event => onChange({ title: event.target.value, titleEdited: true })}
        />
      </Field>
      <RequesterField
        choices={requesters ?? null}
        value={values.requestedBy}
        disabled={saving}
        onChange={requestedBy => onChange({ requestedBy })}
      />
      <EventField
        councilId={councilId}
        value={values.eventId}
        disabled={saving}
        onChange={eventId => onChange({ eventId })}
        onForbidden={onForbidden}
      />
      {pickTask && (
        <TaskField
          councilId={councilId}
          value={picked}
          disabled={saving}
          onChange={onPick}
          onForbidden={onForbidden}
        />
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="필요한 때" optional>
          <Input
            type="date"
            value={values.neededBy}
            disabled={saving}
            onChange={event => onChange({ neededBy: event.target.value })}
          />
        </Field>
      </div>
      <Field label="내용" optional error={errors.body}>
        <Textarea
          value={values.body}
          disabled={saving}
          onChange={event => onChange({ body: event.target.value })}
        />
      </Field>
    </section>
  )
}
