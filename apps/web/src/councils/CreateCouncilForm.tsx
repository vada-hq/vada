import { useState, type FormEvent } from 'react'
import { COUNCIL_UNITS, CreateCouncilSchema, koreanOf, type CouncilUnit, type CreateCouncilResponse, type MyCouncil } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { postJson } from '@/lib/api'
import { endsBeforeStart, TERM_ORDER_MESSAGE } from './term'

export const unitLabels: Record<CouncilUnit, string> = { department: '학과', college: '단과대', university: '총학생회' }
const errors: Record<string, string> = {
  COHORT_NOT_CURRENT: '임기에 오늘이 들어 있어야 해요. 기간을 확인해 주세요.',
  EMAIL_IN_USE: '이 Google 계정의 이메일을 다른 계정이 쓰고 있어요. 다른 계정으로 로그인해 주세요.',
}

type Props = { onCreated: (council: MyCouncil) => void; onCancel: () => void }

// 학생회 만들기(바탕 spec G6): 이름, 단위, 학교, 첫 기수의 이름과 임기. 기본 임기는 올해(한국 날짜) 1/1~12/31이다.
export default function CreateCouncilForm({ onCreated, onCancel }: Props) {
  const [year] = useState(() => koreanOf(new Date()).slice(0, 4))
  const [form, setForm] = useState({ name: '', unit: 'department' as CouncilUnit, schoolName: '', cohortName: year,
    startsOn: `${year}-01-01`, endsOn: `${year}-12-31` })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  // 버튼은 서버와 같은 스키마로 판단한다.
  const parsed = CreateCouncilSchema.safeParse(form)
  const set = (key: keyof typeof form) => (event: { target: { value: string } }) => setForm(current => ({ ...current, [key]: event.target.value }))

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!parsed.success || saving) return
    setSaving(true)
    setError('')
    const result = await postJson<CreateCouncilResponse>('/api/organizations/create', parsed.data)
    if (result.ok) return onCreated(result.data.council)
    setSaving(false)
    setError(errors[result.code] ?? '학생회를 만들지 못했어요. 다시 시도해 주세요.')
  }

  return <form aria-label="학생회 만들기" className="flex flex-col gap-4" onSubmit={event => { void submit(event) }}>
    <div className="flex flex-col gap-1">
      <h2 className="text-lg font-semibold">학생회 만들기</h2>
      <p className="text-sm text-gray-500">만든 사람이 회장이 되고, 재정부가 함께 생겨요.</p>
    </div>
    <Label className="flex flex-col gap-2">학생회 이름
      <Input value={form.name} placeholder="예: 소프트웨어학부 학생회" onChange={set('name')} />
    </Label>
    <Label className="flex flex-col gap-2">단위
      <NativeSelect value={form.unit} onChange={set('unit')}>
        {COUNCIL_UNITS.map(unit => <option key={unit} value={unit}>{unitLabels[unit]}</option>)}
      </NativeSelect>
    </Label>
    <Label className="flex flex-col gap-2">학교
      <Input value={form.schoolName} placeholder="예: 한양대학교 ERICA" onChange={set('schoolName')} />
    </Label>
    <Label className="flex flex-col gap-2">기수 이름
      <Input value={form.cohortName} onChange={set('cohortName')} />
    </Label>
    <div className="grid grid-cols-2 gap-3">
      <Label className="flex flex-col gap-2">임기 시작
        <Input type="date" value={form.startsOn} onChange={set('startsOn')} />
      </Label>
      <Label className="flex flex-col gap-2">임기 끝
        <Input type="date" value={form.endsOn} onChange={set('endsOn')} />
      </Label>
    </div>
    {endsBeforeStart(form) && <StateMessage kind="error">{TERM_ORDER_MESSAGE}</StateMessage>}
    {error && <StateMessage kind="error">{error}</StateMessage>}
    <div className="flex gap-2">
      <Button type="button" variant="outline" disabled={saving} onClick={onCancel}>취소</Button>
      <Button type="submit" className="flex-1" disabled={!parsed.success || saving}>{saving ? '만드는 중…' : '학생회 만들기'}</Button>
    </div>
  </form>
}
