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
  errors: FieldErrors
}

// 학생회 만들기의 입력칸: 이름, 단위, 학교, 첫 기수의 이름과 임기.
export default function CouncilFields({ form, set, errors }: Props) {
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
      <Field label="기수 이름" required error={errors.cohortName}>
        <Input value={form.cohortName} onChange={set('cohortName')} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="임기 시작" required error={errors.startsOn}>
          <Input type="date" value={form.startsOn} onChange={set('startsOn')} />
        </Field>
        <Field label="임기 끝" required error={errors.endsOn}>
          <Input type="date" value={form.endsOn} onChange={set('endsOn')} />
        </Field>
      </div>
    </>
  )
}
