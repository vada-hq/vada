import type { FormEvent, ReactNode } from 'react'
import { COUNCIL_UNITS, type CouncilUnit } from '@vada/contracts'
import { unitLabels } from '../councils/unit-labels'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { requiredText, useFormCheck, type FieldErrors } from '@/lib/use-form-check'
import { titleFields, type CouncilDraft, type TitleKey } from './council-settings-form'

type Props = {
  value: CouncilDraft
  canEdit: boolean
  saving: boolean
  busy: boolean
  note: ReactNode
  onEdit: (patch: Partial<CouncilDraft>) => void
  onEditTitle: (key: TitleKey, value: string) => void
  onSubmit: (event: FormEvent) => void
}

type TitleProps = {
  titles: CouncilDraft['titles']
  canEdit: boolean
  onEdit: (key: TitleKey, value: string) => void
  errors: FieldErrors
}
function TitleFields({ titles, canEdit, onEdit, errors }: TitleProps) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-xs font-medium text-gray-700">직급 표시 이름</legend>
      <div className="grid grid-cols-2 gap-3">
        {titleFields.map(([key, label]) => (
          <Field key={key} label={label} required={canEdit} error={errors[key]}>
            <Input
              value={titles[key]}
              readOnly={!canEdit}
              onChange={event => onEdit(key, event.target.value)}
            />
          </Field>
        ))}
      </div>
    </fieldset>
  )
}

type BasicProps = {
  value: CouncilDraft
  canEdit: boolean
  onEdit: (patch: Partial<CouncilDraft>) => void
  errors: FieldErrors
}
function BasicFields({ value, canEdit, onEdit, errors }: BasicProps) {
  return (
    <>
      <Field label="학생회 이름" required={canEdit} error={errors.name}>
        <Input
          value={value.name}
          readOnly={!canEdit}
          onChange={event => onEdit({ name: event.target.value })}
        />
      </Field>
      <Field label="단위" required={canEdit}>
        <NativeSelect
          value={value.unit}
          disabled={!canEdit}
          onChange={event => onEdit({ unit: event.target.value as CouncilUnit })}
        >
          {COUNCIL_UNITS.map(unit => (
            <option key={unit} value={unit}>
              {unitLabels[unit]}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="학교" required={canEdit} error={errors.schoolName}>
        <Input
          value={value.schoolName}
          readOnly={!canEdit}
          onChange={event => onEdit({ schoolName: event.target.value })}
        />
      </Field>
    </>
  )
}

// 모든 칸이 필수다(직급 표시 이름 넷 포함).
const councilErrors = (value: CouncilDraft) => ({
  name: requiredText(value.name, '학생회 이름을'),
  schoolName: requiredText(value.schoolName, '학교를'),
  ...Object.fromEntries(
    titleFields.map(([key, label]) => [key, requiredText(value.titles[key], `${label} 표시를`)]),
  ),
})

// 설정 > 학생회 정보 양식: 이름, 단위, 학교, 직급 표시 이름 4개. 저장은 누를 때 확인한다.
export default function CouncilInfoForm(props: Props) {
  const { value, canEdit, saving, busy, note, onEdit, onEditTitle, onSubmit } = props
  const { formRef, errors: fieldErrors, attempt } = useFormCheck(() => councilErrors(value))
  return (
    <Card className="p-6">
      <form
        ref={formRef}
        noValidate
        aria-label="학생회 정보"
        className="flex flex-col gap-4"
        onSubmit={event => {
          event.preventDefault()
          if (attempt()) onSubmit(event)
        }}
      >
        <h2 className="text-base font-semibold text-gray-900">학생회 정보</h2>
        <BasicFields value={value} canEdit={canEdit} onEdit={onEdit} errors={fieldErrors} />
        <TitleFields
          titles={value.titles}
          canEdit={canEdit}
          onEdit={onEditTitle}
          errors={fieldErrors}
        />
        {note}
        {canEdit && (
          <Button type="submit" className="self-start" busy={busy}>
            {saving ? '저장하는 중…' : '학생회 정보 저장'}
          </Button>
        )}
      </form>
    </Card>
  )
}
