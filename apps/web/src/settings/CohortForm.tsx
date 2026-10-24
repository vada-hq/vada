import type { FormEvent, ReactNode } from 'react'
import { termErrors } from '../councils/term'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { useFormCheck, type FieldErrors } from '@/lib/use-form-check'
import type { CohortDraft } from './council-settings-form'

type Props = {
  value: CohortDraft
  canEdit: boolean
  saving: boolean
  busy: boolean
  note: ReactNode
  onEdit: (patch: Partial<CohortDraft>) => void
  onSubmit: (event: FormEvent) => void
}

type TermProps = {
  value: CohortDraft
  canEdit: boolean
  onEdit: (patch: Partial<CohortDraft>) => void
  errors: FieldErrors
}
function TermFields({ value, canEdit, onEdit, errors }: TermProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label="임기 시작" required={canEdit} error={errors.startsOn}>
        <Input
          type="date"
          value={value.startsOn}
          readOnly={!canEdit}
          onChange={event => onEdit({ startsOn: event.target.value })}
        />
      </Field>
      <Field label="임기 끝" required={canEdit} error={errors.endsOn}>
        <Input
          type="date"
          value={value.endsOn}
          readOnly={!canEdit}
          onChange={event => onEdit({ endsOn: event.target.value })}
        />
      </Field>
    </div>
  )
}

// 설정 > 지금 기수 양식: 기수 이름과 임기. 고칠 권한이 있을 때만 필수 표시와 저장이 있다. 저장은 누를 때 확인한다.
export default function CohortForm({
  value,
  canEdit,
  saving,
  busy,
  note,
  onEdit,
  onSubmit,
}: Props) {
  const { formRef, errors: fieldErrors, attempt } = useFormCheck(() => termErrors(value))
  return (
    <Card className="p-6">
      <form
        ref={formRef}
        noValidate
        aria-label="지금 기수"
        className="flex flex-col gap-4"
        onSubmit={event => {
          event.preventDefault()
          if (attempt()) onSubmit(event)
        }}
      >
        <h2 className="text-base font-semibold text-gray-900">지금 기수</h2>
        <Field label="기수 이름" required={canEdit} error={fieldErrors.cohortName}>
          <Input
            value={value.name}
            readOnly={!canEdit}
            onChange={event => onEdit({ name: event.target.value })}
          />
        </Field>
        <TermFields value={value} canEdit={canEdit} onEdit={onEdit} errors={fieldErrors} />
        {note}
        {canEdit && (
          <Button type="submit" className="self-start" busy={busy}>
            {saving ? '저장하는 중…' : '기수 저장'}
          </Button>
        )}
      </form>
    </Card>
  )
}
