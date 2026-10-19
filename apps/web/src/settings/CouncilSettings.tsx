import { useState, type FormEvent } from 'react'
import { COUNCIL_UNITS, UpdateCohortSchema, UpdateCouncilSettingsSchema, type CouncilUnit, type CouncilView } from '@vada/contracts'
import { unitLabels } from '../councils/CreateCouncilForm'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { postJson } from '@/lib/api'

type Form = 'council' | 'cohort'
type Message = { form: Form; kind: 'notice' | 'error'; text: string }
const errors: Record<string, string> = {
  COHORT_NOT_CURRENT: '기간에 오늘이 들어 있어야 해요. 그렇지 않으면 모든 운영진이 학생회를 열 수 없어요.',
  FORBIDDEN: '권한이 바뀌었어요. 화면을 새로 불러왔어요.',
}
const failure = '저장하지 못했어요. 다시 시도해 주세요.'
const titleFields = [['president', '회장'], ['vicePresident', '부회장'], ['head', '부장'], ['viceHead', '부부장']] as const

type Props = { view: CouncilView; onSaved: (view: CouncilView) => void; onForbidden: () => void }

// 설정 > 학생회 정보: 이름, 단위, 학교, 직급 표시 이름 4개, 지금 기수의 이름과 기간. 회장단만 고치고, 나머지 운영진은 보기만 한다.
export default function CouncilSettings({ view, onSaved, onForbidden }: Props) {
  const canCouncil = view.permissions.includes('council.update')
  const canCohort = view.permissions.includes('cohort.update')
  const [council, setCouncil] = useState({ name: view.council.name, unit: view.council.unit, schoolName: view.council.schoolName,
    titles: { ...view.council.titles } })
  const [cohort, setCohort] = useState({ name: view.cohort.name, startsOn: view.cohort.startsOn, endsOn: view.cohort.endsOn })
  const [saving, setSaving] = useState<Form | null>(null)
  const [message, setMessage] = useState<Message | null>(null)
  // 버튼은 서버와 같은 스키마로 판단한다.
  const councilParsed = UpdateCouncilSettingsSchema.safeParse(council)
  const cohortParsed = UpdateCohortSchema.safeParse(cohort)

  async function save(event: FormEvent, form: Form) {
    event.preventDefault()
    const parsed = form === 'council' ? councilParsed : cohortParsed
    if (!parsed.success || saving) return
    setSaving(form)
    setMessage(null)
    const result = await postJson<CouncilView>(`/api/organizations/${encodeURIComponent(view.council.id)}/${form === 'council' ? 'settings' : 'cohort'}`, parsed.data)
    setSaving(null)
    if (result.ok) {
      setMessage({ form, kind: 'notice', text: '저장했어요.' })
      onSaved(result.data)
      return
    }
    if (result.status === 403) onForbidden()
    setMessage({ form, kind: 'error', text: errors[result.code] ?? failure })
  }
  const note = (form: Form) => message?.form === form && <StateMessage kind={message.kind}>{message.text}</StateMessage>

  return <div className="mx-auto flex max-w-3xl flex-col gap-4">
    {!canCouncil && <p className="text-sm text-gray-500">회장단만 고칠 수 있어요.</p>}
    <Card className="p-6">
      <form aria-label="학생회 정보" className="flex flex-col gap-4" onSubmit={event => { void save(event, 'council') }}>
        <h2 className="text-base font-semibold text-gray-900">학생회 정보</h2>
        <Label className="flex flex-col gap-2">학생회 이름
          <Input value={council.name} readOnly={!canCouncil} onChange={event => setCouncil({ ...council, name: event.target.value })} />
        </Label>
        <Label className="flex flex-col gap-2">단위
          <NativeSelect value={council.unit} disabled={!canCouncil} onChange={event => setCouncil({ ...council, unit: event.target.value as CouncilUnit })}>
            {COUNCIL_UNITS.map(unit => <option key={unit} value={unit}>{unitLabels[unit]}</option>)}
          </NativeSelect>
        </Label>
        <Label className="flex flex-col gap-2">학교
          <Input value={council.schoolName} readOnly={!canCouncil} onChange={event => setCouncil({ ...council, schoolName: event.target.value })} />
        </Label>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-xs font-medium text-gray-700">직급 표시 이름</legend>
          <div className="grid grid-cols-2 gap-3">
            {titleFields.map(([key, label]) => <Label key={key} className="flex flex-col gap-1.5 text-gray-500">{label}
              <Input value={council.titles[key]} readOnly={!canCouncil}
                onChange={event => setCouncil({ ...council, titles: { ...council.titles, [key]: event.target.value } })} />
            </Label>)}
          </div>
        </fieldset>
        {note('council')}
        {canCouncil && <Button type="submit" className="self-start" disabled={!councilParsed.success || saving !== null}>
          {saving === 'council' ? '저장하는 중…' : '학생회 정보 저장'}</Button>}
      </form>
    </Card>
    <Card className="p-6">
      <form aria-label="지금 기수" className="flex flex-col gap-4" onSubmit={event => { void save(event, 'cohort') }}>
        <h2 className="text-base font-semibold text-gray-900">지금 기수</h2>
        <Label className="flex flex-col gap-2">기수 이름
          <Input value={cohort.name} readOnly={!canCohort} onChange={event => setCohort({ ...cohort, name: event.target.value })} />
        </Label>
        <div className="grid grid-cols-2 gap-3">
          <Label className="flex flex-col gap-2">임기 시작
            <Input type="date" value={cohort.startsOn} readOnly={!canCohort} onChange={event => setCohort({ ...cohort, startsOn: event.target.value })} />
          </Label>
          <Label className="flex flex-col gap-2">임기 끝
            <Input type="date" value={cohort.endsOn} readOnly={!canCohort} onChange={event => setCohort({ ...cohort, endsOn: event.target.value })} />
          </Label>
        </div>
        {note('cohort')}
        {canCohort && <Button type="submit" className="self-start" disabled={!cohortParsed.success || saving !== null}>
          {saving === 'cohort' ? '저장하는 중…' : '기수 저장'}</Button>}
      </form>
    </Card>
  </div>
}
