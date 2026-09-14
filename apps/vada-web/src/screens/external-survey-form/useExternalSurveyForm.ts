import { readObjectSourceOrNull } from '../../data-sources/catalog'
import { findDataSource } from '../../data-sources/definitions'
import { resolveParams } from '../../spec/params'
import { elementByNodeId, ext02a } from '../../spec/screens'
import type { ButtonSpec, GroupSpec, InputSpec, SelectSpec, SummarySpec } from '../../spec/types'
import { useFieldDraft } from '../../spec/useFieldDraft'
import { useSubmitAction } from '../../spec/useSubmitAction'
import type { ScopeDraft } from '../../state/scopes'
import { NODE } from './spec'

export interface ExternalSurveyFormProps {
  screenParams: Record<string, string>
  draft: ScopeDraft
  onChangeDraft: (next: ScopeDraft) => void
  onNavigate: (screenId: string, params?: Record<string, string>) => void
  onScopeEvent: (scopeKey: string, event: 'complete' | 'cancel') => void
}

export function useExternalSurveyForm({
  screenParams,
  draft,
  onChangeDraft,
  onNavigate,
  onScopeEvent,
}: ExternalSurveyFormProps) {
  const submitAction = useSubmitAction()
  const field = useFieldDraft({ elements: ext02a.elements, draft, onChangeDraft, screenParams })

  const schedule = elementByNodeId(ext02a, NODE.schedule).spec as SummarySpec
  const fee = elementByNodeId(ext02a, NODE.fee).spec as SummarySpec
  const consent = elementByNodeId(ext02a, NODE.consent).spec as GroupSpec
  const consentCheck = elementByNodeId(ext02a, NODE.consentCheck).spec as InputSpec
  const submit = elementByNodeId(ext02a, NODE.submit).spec as ButtonSpec

  const inputAt = (nodeId: string) => elementByNodeId(ext02a, nodeId).spec as InputSpec
  const selectAt = (nodeId: string) => elementByNodeId(ext02a, nodeId).spec as SelectSpec

  const valueOf = (fieldKey: string) => draft.values[fieldKey] ?? ''
  const setValue = (fieldKey: string, next: string) =>
    field.setFieldValue(fieldKey, next === '' ? null : next)

  // 토큰이 없으면 무엇의 폼인지 알 수 없다. 아무 설문이나 대신 열지 않는다.
  const missing = (ext02a.params ?? []).filter(
    (param) => (screenParams[param.key] ?? '') === '',
  )
  if (missing.length > 0) {
    return {
      ready: false as const,
      message: missing.map((param) => param.missingNote).join(' '),
    }
  }

  // 토큰이 가리키는 설문이 없는 것과 토큰이 아예 없는 것은 다른 일이다. 뒤엣것은
  // 명세의 missingNote가, 앞엣것은 카탈로그의 empty가 말한다.
  const form = readObjectSourceOrNull(
    schedule.dataSourceKey,
    resolveParams(schedule.params, { screenParams }),
  )
  if (form === null) {
    return {
      ready: false as const,
      message: findDataSource(schedule.dataSourceKey).messages.empty,
    }
  }

  const meta = ext02a.meta

  return {
    ready: true as const,
    screenParams,
    draft,
    onNavigate,
    onScopeEvent,
    submitAction,
    field,
    schedule,
    fee,
    consent,
    consentCheck,
    submit,
    inputAt,
    selectAt,
    valueOf,
    setValue,
    form,
    meta,
  }
}

export type ExternalSurveyFormModel = Extract<
  ReturnType<typeof useExternalSurveyForm>,
  { ready: true }
>
