import { useState, type FormEvent } from 'react'
import {
  CreateCouncilSchema,
  koreanYearOf,
  operatingYearsOf,
  type CouncilUnit,
  type CreateCouncilResponse,
  type MyCouncil,
} from '@vada/contracts'
import { postJson } from '@/lib/api'
import { CREATE_COUNCIL_ERRORS, CREATE_COUNCIL_FAILED } from '@/lib/messages'

// 운영 연도는 고르기 값(글자)으로 두고 보낼 때 숫자로 바꾼다. 기수 이름과 기간은 서버가 운영 연도로 채운다(DEC-87).
export type CreateCouncilDraft = {
  name: string
  unit: CouncilUnit
  schoolName: string
  year: string
}

// 기본 운영 연도는 올해(한국 날짜)다.
function initialDraft(): CreateCouncilDraft {
  return { name: '', unit: 'department', schoolName: '', year: koreanYearOf(new Date()) }
}

// 학생회 만들기의 상태와 서버 부르기: 고치는 값, 만드는 중, 오류 문구. 화면(CreateCouncilForm)은 이것을 그리기만 한다.
export function useCreateCouncil(onCreated: (council: MyCouncil) => void) {
  const [form, setForm] = useState(initialDraft)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  // 운영 연도 선택지. 연 때의 오늘로 두고 누를 때 다시 센다(양식을 연 채 해가 바뀌면 선택지도 바뀐다).
  const [years, setYears] = useState(() => operatingYearsOf(new Date()))
  const refreshYears = () => setYears(operatingYearsOf(new Date()))
  // 서버와 같은 스키마로 판단한다. 칸 확인이 다루지 않는 길이 상한은 화면이 이 결과로 칸 아래에 보인다.
  const parsed = CreateCouncilSchema.safeParse({ ...form, year: Number(form.year) })
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
  return { form, set, years, refreshYears, saving, error, parsed, submit }
}
