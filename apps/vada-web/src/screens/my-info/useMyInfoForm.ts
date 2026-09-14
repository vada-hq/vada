import { useState } from 'react'
import { readObjectSource } from '../../data-sources/catalog'
import { draftFromRow } from '../../spec/draft-values'
import { elementByNodeId, myInfo01 } from '../../spec/screens'
import type { ButtonSpec, InputSpec, SelectSpec, SubmitAction, SummarySpec } from '../../spec/types'
import { useFieldDraft } from '../../spec/useFieldDraft'
import { useSubmitAction } from '../../spec/useSubmitAction'
import type { ScopeDraft } from '../../state/scopes'
import { MY_INFO_NODE as NODE } from './config'

interface UseMyInfoFormOptions {
  scopeDraft: ScopeDraft
  onChangeDraft: (next: ScopeDraft) => void
  onNavigate: (screenId: string, params?: Record<string, string>) => void
  onScopeEvent: (scopeKey: string, event: 'complete' | 'cancel') => void
}

export function useMyInfoForm({
  scopeDraft,
  onChangeDraft,
  onNavigate,
  onScopeEvent,
}: UseMyInfoFormOptions) {
  const submitAction = useSubmitAction()
  const [saved, setSaved] = useState(false)
  const [seed] = useState<ScopeDraft>(() =>
    draftFromRow(readObjectSource(myInfo01.draftFrom!.dataSourceKey, {})),
  )
  const draft = Object.keys(scopeDraft.values).length === 0 ? seed : scopeDraft
  const field = useFieldDraft({
    elements: myInfo01.elements,
    draft,
    onChangeDraft,
    screenParams: {},
  })
  const save = elementByNodeId(myInfo01, NODE.save).spec as ButtonSpec
  const belonging = elementByNodeId(myInfo01, NODE.belonging).spec as SummarySpec
  const belongs = readObjectSource(belonging.dataSourceKey!, {})

  function inputAt(nodeId: string) {
    return elementByNodeId(myInfo01, nodeId).spec as InputSpec
  }

  function selectAt(nodeId: string) {
    return elementByNodeId(myInfo01, nodeId).spec as SelectSpec
  }

  function pressSave() {
    field.runButton(save, () => {
      setSaved(false)
      void submitAction
        .run(save.action as SubmitAction, {
          payload: draft.values,
          onNavigate,
          onScopeEvent,
        })
        .then((answer) => setSaved(answer !== undefined))
    })
  }

  return {
    submitAction,
    saved,
    setSaved,
    draft,
    field,
    save,
    belonging,
    belongs,
    inputAt,
    selectAt,
    pressSave,
  }
}

export type MyInfoFormModel = ReturnType<typeof useMyInfoForm>
