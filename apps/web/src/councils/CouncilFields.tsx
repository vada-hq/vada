import { COUNCIL_UNITS } from '@vada/contracts'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import type { FieldErrors } from '@/lib/use-form-check'
import type { CreateCouncilDraft } from './useCreateCouncil'
import { unitLabels } from './unit-labels'

type Props = {
  form: CreateCouncilDraft
  set: (key: keyof CreateCouncilDraft) => (event: { target: { value: string } }) => void
  // 운영 연도 선택지(작년·올해·내년)
  years: number[]
  errors: FieldErrors
}

// 학생회 만들기의 입력칸: 이름, 단위, 학교, 운영 연도(작년·올해·내년, DEC-87).
export default function CouncilFields({ form, set, years, errors }: Props) {
  return (
    <>
      <Field label="학생회 이름" required error={errors.name}>
        <Input value={form.name} onChange={set('name')} />
      </Field>
      <Field label="단위" required>
        <NativeSelect value={form.unit} onChange={set('unit')}>
          {COUNCIL_UNITS.map(unit => (
            <option key={unit} value={unit}>
              {unitLabels[unit]}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="학교" required error={errors.schoolName}>
        <Input value={form.schoolName} onChange={set('schoolName')} />
      </Field>
      <Field label="운영 연도" required error={errors.year}>
        <NativeSelect value={form.year} onChange={set('year')}>
          {years.map(year => (
            <option key={year} value={String(year)}>
              {year}년
            </option>
          ))}
        </NativeSelect>
      </Field>
    </>
  )
}
