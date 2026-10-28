import { MEETING_AGENDA_LIMIT } from '@vada/contracts'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { FormSection, type MeetingFieldsProps } from './MeetingFormFields'
import type { AgendaDraft } from './meeting-form'

export function MeetingAgendaFields({ value, errors, onChange }: MeetingFieldsProps) {
  const patch = (index: number, change: Partial<AgendaDraft>) =>
    onChange({
      agenda: value.agenda.map((item, position) =>
        position === index ? { ...item, ...change } : item,
      ),
    })
  return (
    <FormSection number="5" title="안건">
      {value.agenda.map((item, index) => (
        <div key={item.key} className="flex min-w-0 flex-col gap-4 rounded-sm border p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-medium">안건 {index + 1}</h3>
            <Button
              type="button"
              variant="ghost"
              touch
              aria-label={`안건 ${index + 1} 빼기`}
              onClick={() =>
                onChange({ agenda: value.agenda.filter((_, position) => position !== index) })
              }
            >
              빼기
            </Button>
          </div>
          <Field label={`안건 ${index + 1} 제목`} required error={errors[`agenda.${index}.title`]}>
            <Input
              className="max-sm:min-h-11"
              value={item.title}
              onChange={event => patch(index, { title: event.target.value })}
            />
          </Field>
          <Field label={`안건 ${index + 1} 설명`} optional error={errors[`agenda.${index}.body`]}>
            <Textarea
              value={item.body}
              onChange={event => patch(index, { body: event.target.value })}
            />
          </Field>
        </div>
      ))}
      {value.agenda.length < MEETING_AGENDA_LIMIT && (
        <Button
          type="button"
          variant="outline"
          touch
          className="self-start"
          onClick={() =>
            onChange({
              agenda: [...value.agenda, { key: crypto.randomUUID(), title: '', body: '' }],
            })
          }
        >
          안건 추가
        </Button>
      )}
    </FormSection>
  )
}
