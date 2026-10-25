import { useId } from 'react'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import type { FieldErrors } from '@/lib/use-form-check'
import type { CouncilDraftState } from './useCouncilDraft'
import { unitChoices, unitLabels } from './unit-labels'

type Props = Pick<CouncilDraftState, 'draft' | 'set' | 'years'> & { errors: FieldErrors }

// 학생회 만들기 1단계의 칸: 학생회 유형(세로 라디오, 고르면 칸이 바뀌는 질문이라 세로다), 학교, 학생회 이름, 운영 연도(DEC-87).
// 대표 범위는 지금 학교만이다(단과대학·학부·학과는 기능 020 조각 6).
export default function CouncilFields({ draft, set, years, errors }: Props) {
  const unitId = useId()
  return (
    <>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 flex items-baseline gap-1">
          <span className="text-xs font-medium text-gray-700">학생회 유형</span>
          <span aria-hidden className="text-sm leading-4 text-red-600">
            *
          </span>
        </legend>
        {unitChoices.map(unit => (
          <div key={unit} className="flex items-center gap-2">
            <input
              id={`${unitId}-${unit}`}
              type="radio"
              name={unitId}
              value={unit}
              className="size-4 accent-blue-600"
              checked={draft.unit === unit}
              onChange={set('unit')}
            />
            <Label htmlFor={`${unitId}-${unit}`} className="text-sm font-normal text-gray-800">
              {unitLabels[unit]}
            </Label>
          </div>
        ))}
      </fieldset>
      <Field label="학교" required error={errors.schoolName}>
        <Input value={draft.schoolName} onChange={set('schoolName')} />
      </Field>
      <Field label="학생회 이름" required error={errors.name}>
        <Input value={draft.name} onChange={set('name')} />
      </Field>
      <Field label="운영 연도" required error={errors.year}>
        <NativeSelect value={draft.year} onChange={set('year')}>
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
