import { useId, useState } from 'react'
import type { MeetingOptionsResponse } from '@vada/contracts'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { MeetingFieldsProps } from './MeetingFormFields'
import { FormSection } from './MeetingFormFields'

export function MeetingParticipants({
  value,
  errors,
  onChange,
  options,
  creatorId,
}: MeetingFieldsProps & { options: MeetingOptionsResponse; creatorId: string | null }) {
  const [search, setSearch] = useState('')
  const errorId = useId()
  const members = options.members.filter(person => person.name.includes(search.trim()))
  const toggle = (id: string, checked: boolean) =>
    onChange({
      attendeeIds: checked
        ? [...value.attendeeIds, id]
        : value.attendeeIds.filter(member => member !== id),
    })
  return (
    <FormSection number="4" title="참가자">
      <p className="text-right text-sm tabular-nums">선택됨 {value.attendeeIds.length}명</p>
      <Field label="참가자 검색">
        <Input
          type="search"
          className="max-sm:min-h-11"
          value={search}
          onChange={event => setSearch(event.target.value)}
        />
      </Field>
      <div
        className="grid max-h-64 min-w-0 gap-x-4 overflow-y-auto sm:grid-cols-2"
        role="group"
        aria-label="참가자 선택"
        tabIndex={-1}
        aria-invalid={Boolean(errors.attendeeIds) || undefined}
        aria-describedby={errors.attendeeIds ? errorId : undefined}
      >
        {members.map(person => (
          <Label
            key={person.id}
            className="flex min-h-11 min-w-0 cursor-pointer items-center gap-3 text-sm"
          >
            <input
              type="checkbox"
              className="size-4 shrink-0 accent-blue-600"
              checked={value.attendeeIds.includes(person.id)}
              disabled={person.id === creatorId}
              onChange={event => toggle(person.id, event.target.checked)}
            />
            <span className="wrap-anywhere">{person.name}</span>
          </Label>
        ))}
        {members.length === 0 && <p className="text-sm text-muted-foreground">맞는 참가자 없음</p>}
      </div>
      {errors.attendeeIds && (
        <p id={errorId} role="alert" className="text-sm text-red-600">
          {errors.attendeeIds}
        </p>
      )}
    </FormSection>
  )
}
