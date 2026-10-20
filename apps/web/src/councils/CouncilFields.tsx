import { COUNCIL_UNITS } from '@vada/contracts'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import type { CreateCouncilDraft } from './useCreateCouncil'
import { unitLabels } from './unit-labels'

type Props = {
  form: CreateCouncilDraft
  set: (key: keyof CreateCouncilDraft) => (event: { target: { value: string } }) => void
}

// 학생회 만들기의 입력칸: 이름, 단위, 학교, 첫 기수의 이름과 임기.
export default function CouncilFields({ form, set }: Props) {
  return (
    <>
      <Label className="flex flex-col gap-2">
        학생회 이름
        <Input value={form.name} placeholder="예: 소프트웨어학부 학생회" onChange={set('name')} />
      </Label>
      <Label className="flex flex-col gap-2">
        단위
        <NativeSelect value={form.unit} onChange={set('unit')}>
          {COUNCIL_UNITS.map(unit => (
            <option key={unit} value={unit}>
              {unitLabels[unit]}
            </option>
          ))}
        </NativeSelect>
      </Label>
      <Label className="flex flex-col gap-2">
        학교
        <Input
          value={form.schoolName}
          placeholder="예: 한양대학교 ERICA"
          onChange={set('schoolName')}
        />
      </Label>
      <Label className="flex flex-col gap-2">
        기수 이름
        <Input value={form.cohortName} onChange={set('cohortName')} />
      </Label>
      <div className="grid grid-cols-2 gap-3">
        <Label className="flex flex-col gap-2">
          임기 시작
          <Input type="date" value={form.startsOn} onChange={set('startsOn')} />
        </Label>
        <Label className="flex flex-col gap-2">
          임기 끝
          <Input type="date" value={form.endsOn} onChange={set('endsOn')} />
        </Label>
      </div>
    </>
  )
}
