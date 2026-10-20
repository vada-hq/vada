import { useState, type FormEvent } from 'react'
import {
  CreateCouncilSchema,
  koreanYearOf,
  type CouncilUnit,
  type CreateCouncilResponse,
  type MyCouncil,
} from '@vada/contracts'
import { postJson } from '@/lib/api'
import { CREATE_COUNCIL_ERRORS, CREATE_COUNCIL_FAILED } from '@/lib/messages'

export type CreateCouncilDraft = {
  name: string
  unit: CouncilUnit
  schoolName: string
  cohortName: string
  startsOn: string
  endsOn: string
}

// 기본 임기는 올해(한국 날짜) 1/1~12/31이다.
function initialDraft(): CreateCouncilDraft {
  const year = koreanYearOf(new Date())
  return {
    name: '',
    unit: 'department',
    schoolName: '',
    cohortName: year,
    startsOn: `${year}-01-01`,
    endsOn: `${year}-12-31`,
  }
}

// 학생회 만들기의 상태와 서버 부르기: 고치는 값, 만드는 중, 오류 문구. 화면(CreateCouncilForm)은 이것을 그리기만 한다.
export function useCreateCouncil(onCreated: (council: MyCouncil) => void) {
  const [form, setForm] = useState(initialDraft)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  // 버튼은 서버와 같은 스키마로 판단한다.
  const parsed = CreateCouncilSchema.safeParse(form)
  const set = (key: keyof CreateCouncilDraft) => (event: { target: { value: string } }) =>
    setForm(current => ({ ...current, [key]: event.target.value }))

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!parsed.success || saving) return
    setSaving(true)
    setError('')
    const result = await postJson<CreateCouncilResponse>('/api/organizations/create', parsed.data)
    if (result.ok) return onCreated(result.data.council)
    setSaving(false)
    setError(CREATE_COUNCIL_ERRORS[result.code] ?? CREATE_COUNCIL_FAILED)
  }
  return { form, set, saving, error, valid: parsed.success, submit }
}
