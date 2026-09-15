import { useState } from 'react'
import { readObjectSource } from '../../data-sources/catalog'
import { draftFromRow } from '../../spec/draft-values'
import { resolveParams } from '../../spec/params'
import { evt02b } from '../../spec/screen-specs/evt02b'
import type { ButtonSpec, SubmitAction } from '../../spec/types'
import { useFieldDraft } from '../../spec/useFieldDraft'
import { useSubmitAction } from '../../spec/useSubmitAction'
import type { ScopeDraft } from '../../state/scopes'
import { eventBasicsSpecs } from './spec'

interface EventBasicsDraftOptions {
  screenParams: Record<string, string>
  draft: ScopeDraft
  onChangeDraft: (next: ScopeDraft) => void
  onNavigate: (screenId: string, params?: Record<string, string>) => void
  onScopeEvent: (scopeKey: string, event: 'complete' | 'cancel') => void
}

/** 편집 초안의 시드, 필드 변경, 저장과 화면 이동을 관리한다. */
export function useEventBasicsDraft({
  screenParams,
  draft: scopeDraft,
  onChangeDraft,
  onNavigate,
  onScopeEvent,
}: EventBasicsDraftOptions) {
  const submitAction = useSubmitAction()
  const specs = eventBasicsSpecs()
  const missing = (evt02b.params ?? []).filter(
    (param) => (screenParams[param.key] ?? '') === '',
  )
  const [seed] = useState<ScopeDraft>(() =>
    missing.length > 0
      ? { values: {}, labels: {} }
      : draftFromRow(
          readObjectSource(
            evt02b.draftFrom!.dataSourceKey,
            resolveParams(evt02b.draftFrom!.params, { screenParams }),
          ),
        ),
  )
  const draft = Object.keys(scopeDraft.values).length === 0 ? seed : scopeDraft
  const field = useFieldDraft({ elements: evt02b.elements, draft, onChangeDraft, screenParams })
  const valueOf = (fieldKey: string) => draft.values[fieldKey] ?? ''
  const setValue = (fieldKey: string, next: string) =>
    field.setFieldValue(fieldKey, next === '' ? null : next)

  function goBack(spec: ButtonSpec) {
    if (spec.action.type === 'navigate') {
      onNavigate(spec.action.targetScreenId, resolveParams(spec.action.params, { screenParams }))
    }
  }

  function pressSave() {
    field.runButton(specs.save, () => {
      void submitAction.run(specs.save.action as SubmitAction, {
        payload: draft.values,
        onNavigate,
        paramSources: { screenParams },
        onScopeEvent,
      })
    })
  }

  return {
    missing,
    draft,
    field,
    specs,
    submitAction,
    valueOf,
    setValue,
    goBack,
    pressSave,
  }
}

export type EventBasicsDraftModel = ReturnType<typeof useEventBasicsDraft>
