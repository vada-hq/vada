import { readObjectSourceOrNull } from '../../data-sources/catalog'
import { findDataSource } from '../../data-sources/definitions'
import { resolveParams } from '../../spec/params'
import { elementByNodeId } from '../../spec/screens'
import { ext01a } from '../../spec/screen-specs/ext01a'
import type { ButtonSpec, InputSpec, SubmitAction, SummarySpec } from '../../spec/types'
import { useFieldDraft } from '../../spec/useFieldDraft'
import { useSubmitAction } from '../../spec/useSubmitAction'
import type { ScopeDraft } from '../../state/scopes'
import { ATTENDANCE_CHECK_IN_NODE as NODE } from './config'

interface UseAttendanceCheckInOptions {
  screenParams: Record<string, string>
  draft: ScopeDraft
  onChangeDraft: (next: ScopeDraft) => void
  onScopeEvent: (scopeKey: string, event: 'complete' | 'cancel') => void
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

export function useAttendanceCheckIn({
  screenParams,
  draft,
  onChangeDraft,
  onScopeEvent,
  onNavigate,
}: UseAttendanceCheckInOptions) {
  const head = elementByNodeId(ext01a, NODE.head).spec as SummarySpec
  const guide = elementByNodeId(ext01a, NODE.guide).spec as SummarySpec
  const name = elementByNodeId(ext01a, NODE.name).spec as InputSpec
  const studentNumber = elementByNodeId(ext01a, NODE.studentNumber).spec as InputSpec
  const submit = elementByNodeId(ext01a, NODE.submit).spec as ButtonSpec
  const field = useFieldDraft({ elements: ext01a.elements, draft, onChangeDraft })
  const submitAction = useSubmitAction()
  const missingParam = (ext01a.params ?? []).find(
    (param) => param.optional !== true && (screenParams[param.key] ?? '') === '',
  )
  if (missingParam !== undefined) {
    return { state: 'missing' as const, message: missingParam.missingNote }
  }

  const form = readObjectSourceOrNull(
    head.dataSourceKey,
    resolveParams(head.params, { screenParams }),
  )
  if (form === null) {
    return {
      state: 'empty' as const,
      message: findDataSource(head.dataSourceKey).messages.empty,
    }
  }

  function pressSubmit() {
    field.runButton(submit, () => {
      void submitAction.run(submit.action as SubmitAction, {
        payload: draft.values,
        paramSources: { screenParams, fields: draft.values },
        onNavigate,
        onScopeEvent,
      })
    })
  }

  return {
    state: 'ready' as const,
    head,
    guide,
    inputs: [
      { nodeId: NODE.name, spec: name },
      { nodeId: NODE.studentNumber, spec: studentNumber },
    ],
    submit,
    field,
    submitAction,
    draft,
    form,
    pressSubmit,
  }
}

export type AttendanceCheckInModel = ReturnType<typeof useAttendanceCheckIn>
