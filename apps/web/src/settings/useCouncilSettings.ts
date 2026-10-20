import { useState, type FormEvent } from 'react'
import {
  statusOf,
  UpdateCohortSchema,
  UpdateCouncilSettingsSchema,
  type CouncilView,
} from '@vada/contracts'
import { postJson } from '@/lib/api'
import { COUNCIL_SETTINGS_ERRORS, SAVE_FAILED } from '@/lib/messages'
import type { Form, Message } from './council-settings-form'
import { useCouncilDrafts } from './useCouncilDrafts'

// 설정 화면의 상태와 서버 부르기: 고치는 값, 저장 중인 쪽, 저장 결과 문구. 화면(CouncilSettings)은 이것을 그리기만 한다.
export function useCouncilSettings(
  view: CouncilView,
  onSaved: (view: CouncilView) => void,
  onForbidden: () => void,
) {
  const [saving, setSaving] = useState<Form | null>(null)
  const [message, setMessage] = useState<Message | null>(null)
  // 다시 고치기 시작하면 "저장했어요."는 더 이상 맞지 않는다.
  const drafts = useCouncilDrafts(view, form =>
    setMessage(current => (current?.form === form && current.kind === 'notice' ? null : current)),
  )
  // 버튼은 서버와 같은 스키마로 판단한다.
  const councilParsed = UpdateCouncilSettingsSchema.safeParse(drafts.council)
  const cohortParsed = UpdateCohortSchema.safeParse(drafts.cohort)

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
  return {
    ...drafts,
    saving,
    message,
    councilValid: councilParsed.success,
    cohortValid: cohortParsed.success,
    save,
  }
}
