import { useState, type FormEvent } from 'react'
import {
  COUNCIL_UNITS,
  statusOf,
  UpdateCohortSchema,
  UpdateCouncilSettingsSchema,
  type CouncilUnit,
  type CouncilView,
} from '@vada/contracts'
import { unitLabels } from '../councils/CreateCouncilForm'
import { endsBeforeStart, TERM_ORDER_MESSAGE } from '../councils/term'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { postJson } from '@/lib/api'
import { COUNCIL_SETTINGS_ERRORS, SAVE_FAILED } from '@/lib/messages'

type Form = 'council' | 'cohort'
type Message = { form: Form; kind: 'notice' | 'error'; text: string }
const titleFields = [
  ['president', '회장'],
  ['vicePresident', '부회장'],
  ['head', '부장'],
  ['viceHead', '부부장'],
] as const

type Props = { view: CouncilView; onSaved: (view: CouncilView) => void; onForbidden: () => void }
const councilFrom = (view: CouncilView) => ({
  name: view.council.name,
  unit: view.council.unit,
  schoolName: view.council.schoolName,
  titles: { ...view.council.titles },
})
const cohortFrom = (view: CouncilView) => ({
  name: view.cohort.name,
  startsOn: view.cohort.startsOn,
  endsOn: view.cohort.endsOn,
})

// 설정 > 학생회 정보: 이름, 단위, 학교, 직급 표시 이름 4개, 지금 기수의 이름과 기간. 회장단만 고치고, 나머지 운영진은 보기만 한다.
export default function CouncilSettings({ view, onSaved, onForbidden }: Props) {
  const canCouncil = view.permissions.includes('council.update')
  const canCohort = view.permissions.includes('cohort.update')
  const [council, setCouncil] = useState(() => councilFrom(view))
  const [cohort, setCohort] = useState(() => cohortFrom(view))
  const [saving, setSaving] = useState<Form | null>(null)
  const [message, setMessage] = useState<Message | null>(null)
  // 이 화면이 열린 채 학생회가 다시 읽히면(권한 오류 뒤 다시 읽기, 다른 곳의 저장) 서버의 새 값으로 다시 채운다. 내용이 바뀐 쪽만 채워, 같은 내용의 다시 읽기나 다른 쪽에서 고치던 값은 건드리지 않는다.
  const councilKey = JSON.stringify(view.council)
  const cohortKey = JSON.stringify(view.cohort)
  const [seen, setSeen] = useState({ council: councilKey, cohort: cohortKey })
  if (seen.council !== councilKey || seen.cohort !== cohortKey) {
    setSeen({ council: councilKey, cohort: cohortKey })
    if (seen.council !== councilKey) setCouncil(councilFrom(view))
    if (seen.cohort !== cohortKey) setCohort(cohortFrom(view))
  }
  // 다시 고치기 시작하면 "저장했어요."는 더 이상 맞지 않는다.
  const editing = (form: Form) =>
    setMessage(current => (current?.form === form && current.kind === 'notice' ? null : current))
  const editCouncil = (patch: Partial<typeof council>) => {
    setCouncil(current => ({ ...current, ...patch }))
    editing('council')
  }
  const editTitle = (key: (typeof titleFields)[number][0], value: string) => {
    setCouncil(current => ({ ...current, titles: { ...current.titles, [key]: value } }))
    editing('council')
  }
  const editCohort = (patch: Partial<typeof cohort>) => {
    setCohort(current => ({ ...current, ...patch }))
    editing('cohort')
  }
  // 버튼은 서버와 같은 스키마로 판단한다.
  const councilParsed = UpdateCouncilSettingsSchema.safeParse(council)
  const cohortParsed = UpdateCohortSchema.safeParse(cohort)

  async function save(event: FormEvent, form: Form) {
    event.preventDefault()
    const parsed = form === 'council' ? councilParsed : cohortParsed
    if (!parsed.success || saving) return
    setSaving(form)
    setMessage(null)
    const result = await postJson<CouncilView>(
      `/api/organizations/${encodeURIComponent(view.council.id)}/${form === 'council' ? 'settings' : 'cohort'}`,
      parsed.data,
    )
    setSaving(null)
    if (result.ok) {
      setMessage({ form, kind: 'notice', text: '저장했어요.' })
      onSaved(result.data)
      return
    }
    if (result.status === statusOf('FORBIDDEN')) onForbidden()
    setMessage({ form, kind: 'error', text: COUNCIL_SETTINGS_ERRORS[result.code] ?? SAVE_FAILED })
  }
  const note = (form: Form) =>
    message?.form === form && <StateMessage kind={message.kind}>{message.text}</StateMessage>

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      {!canCouncil && <p className="text-sm text-gray-500">회장단만 고칠 수 있어요.</p>}
      <Card className="p-6">
        <form
          aria-label="학생회 정보"
          className="flex flex-col gap-4"
          onSubmit={event => {
            void save(event, 'council')
          }}
        >
          <h2 className="text-base font-semibold text-gray-900">학생회 정보</h2>
          <Label className="flex flex-col gap-2">
            학생회 이름
            <Input
              value={council.name}
              readOnly={!canCouncil}
              onChange={event => editCouncil({ name: event.target.value })}
            />
          </Label>
          <Label className="flex flex-col gap-2">
            단위
            <NativeSelect
              value={council.unit}
              disabled={!canCouncil}
              onChange={event => editCouncil({ unit: event.target.value as CouncilUnit })}
            >
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
              value={council.schoolName}
              readOnly={!canCouncil}
              onChange={event => editCouncil({ schoolName: event.target.value })}
            />
          </Label>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-xs font-medium text-gray-700">직급 표시 이름</legend>
            <div className="grid grid-cols-2 gap-3">
              {titleFields.map(([key, label]) => (
                <Label key={key} className="flex flex-col gap-1.5 text-gray-500">
                  {label}
                  <Input
                    value={council.titles[key]}
                    readOnly={!canCouncil}
                    onChange={event => editTitle(key, event.target.value)}
                  />
                </Label>
              ))}
            </div>
          </fieldset>
          {note('council')}
          {canCouncil && (
            <Button
              type="submit"
              className="self-start"
              disabled={!councilParsed.success || saving !== null}
            >
              {saving === 'council' ? '저장하는 중…' : '학생회 정보 저장'}
            </Button>
          )}
        </form>
      </Card>
      <Card className="p-6">
        <form
          aria-label="지금 기수"
          className="flex flex-col gap-4"
          onSubmit={event => {
            void save(event, 'cohort')
          }}
        >
          <h2 className="text-base font-semibold text-gray-900">지금 기수</h2>
          <Label className="flex flex-col gap-2">
            기수 이름
            <Input
              value={cohort.name}
              readOnly={!canCohort}
              onChange={event => editCohort({ name: event.target.value })}
            />
          </Label>
          <div className="grid grid-cols-2 gap-3">
            <Label className="flex flex-col gap-2">
              임기 시작
              <Input
                type="date"
                value={cohort.startsOn}
                readOnly={!canCohort}
                onChange={event => editCohort({ startsOn: event.target.value })}
              />
            </Label>
            <Label className="flex flex-col gap-2">
              임기 끝
              <Input
                type="date"
                value={cohort.endsOn}
                readOnly={!canCohort}
                onChange={event => editCohort({ endsOn: event.target.value })}
              />
            </Label>
          </div>
          {canCohort && endsBeforeStart(cohort) && (
            <StateMessage kind="error">{TERM_ORDER_MESSAGE}</StateMessage>
          )}
          {note('cohort')}
          {canCohort && (
            <Button
              type="submit"
              className="self-start"
              disabled={!cohortParsed.success || saving !== null}
            >
              {saving === 'cohort' ? '저장하는 중…' : '기수 저장'}
            </Button>
          )}
        </form>
      </Card>
    </div>
  )
}
