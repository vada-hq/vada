import { useState } from 'react'
import { readListSource, readObjectSource } from '../../data-sources/catalog'
import { resolveParams } from '../../spec/params'
import { drawnTitleOf, evt05 } from '../../spec/screens'
import { useSubmitAction } from '../../spec/useSubmitAction'
import type { ButtonSpec, SubmitAction } from '../../spec/types'
import type { ScopeDraft } from '../../state/scopes'
import { NODE, buttonAt, listAt, summaryAt } from './survey-spec'
import { scalar } from './survey-values'
import { useSurveyDraft } from './useSurveyDraft'

export interface SurveyEditorProps {
  screenParams: Record<string, string>
  draft: ScopeDraft
  onChangeDraft: (next: ScopeDraft) => void
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

export function useSurveyEditor({
  screenParams,
  draft: scopeDraft,
  onChangeDraft,
  onNavigate,
}: SurveyEditorProps) {
  const submitAction = useSubmitAction()
  const [note, setNote] = useState<string | null>(null)
  const [removed, setRemoved] = useState<string[]>([])
  const surveyDraft = useSurveyDraft({ screenParams, draft: scopeDraft, onChangeDraft })

  if (surveyDraft.missing.length > 0) {
    return {
      ready: false as const,
      screen: evt05,
      onNavigate,
      message: surveyDraft.missing.map((param) => param.missingNote).join(' '),
    }
  }

  const press = (spec: ButtonSpec) => () => {
    if (spec.action.type === 'navigate') {
      onNavigate(spec.action.targetScreenId, resolveParams(spec.action.params, { screenParams }))
      return
    }
    if (spec.action.type === 'pending') setNote(spec.action.note)
  }
  const statusChip = summaryAt(NODE.statusChip)
  const surveyRow = readObjectSource(
    statusChip.dataSourceKey,
    resolveParams(statusChip.params, { screenParams }),
  )
  const activate = buttonAt(NODE.activate)
  const gate = activate.action.type === 'submit' ? activate.action.executeWhen : undefined
  const blockedNote =
    gate?.type === 'sourceAllows'
      ? scalar(
          readObjectSource(gate.dataSourceKey, resolveParams(gate.params, { screenParams })),
          gate.blockedNoteField,
        )
      : ''
  const unmetBadge = summaryAt(NODE.unmetBadge)
  const activationRow = readObjectSource(
    unmetBadge.dataSourceKey,
    resolveParams(unmetBadge.params, { screenParams }),
  )
  const basics = summaryAt(NODE.basics)
  const basicsRow = readObjectSource(
    basics.dataSourceKey,
    resolveParams(basics.params, { screenParams }),
  )
  const conditions = listAt(NODE.conditions)
  const conditionGroups = readListSource(
    conditions.dataSourceKey,
    resolveParams(conditions.params, { screenParams }),
  )
  const questions = listAt(NODE.questions)
  const questionRows = readListSource(
    questions.dataSourceKey,
    resolveParams(questions.params, { screenParams }),
  ).filter((row) => !removed.includes(String(row.id)))

  function pressActivate() {
    if (activate.action.type !== 'submit') return
    if (blockedNote !== '') {
      setNote(blockedNote)
      return
    }
    setNote(null)
    void submitAction.run(activate.action as SubmitAction, {
      payload: surveyDraft.draft.values,
      onNavigate,
      paramSources: { screenParams },
    })
  }

  const breadcrumbItems = (evt05.breadcrumb?.items ?? []).map((item) =>
    item.field === undefined
      ? (item.value ?? '')
      : scalar(
          readObjectSource(
            evt05.breadcrumb!.dataSourceKey,
            resolveParams(evt05.breadcrumb!.params, { screenParams }),
          ),
          item.field,
        ),
  )

  return {
    ready: true as const,
    screen: evt05,
    title: drawnTitleOf(evt05, screenParams),
    screenParams,
    onNavigate,
    note,
    setNote,
    submitAction,
    draft: surveyDraft.draft,
    setFieldValue: surveyDraft.setFieldValue,
    press,
    statusChip,
    surveyRow,
    activate,
    blockedNote,
    unmetBadge,
    activationRow,
    basicsRow,
    conditionGroups,
    questionRows,
    removeQuestion: (id: string) => setRemoved((previous) => [...previous, id]),
    panel: summaryAt(NODE.questionPanel),
    breadcrumbItems,
    pressActivate,
  }
}

export type SurveyEditorModel = Extract<ReturnType<typeof useSurveyEditor>, { ready: true }>
