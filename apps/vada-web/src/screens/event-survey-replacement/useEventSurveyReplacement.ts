import { useState } from 'react'
import { readFieldRows, readObjectSource } from '../../data-sources/catalog'
import { scalarValue as scalar } from '../../data-sources/values'
import { getOptionSource } from '../../option-sources/definitions'
import { resolveParams } from '../../spec/params'
import { drawnTitleOf, elementByNodeId, evt05b } from '../../spec/screens'
import { useFieldDraft } from '../../spec/useFieldDraft'
import { useSubmitAction } from '../../spec/useSubmitAction'
import { columnFieldOf } from '../../spec/types'
import type { ButtonSpec, ItemListSpec, SelectSpec, SummarySpec } from '../../spec/types'
import type { ScopeDraft } from '../../state/scopes'
import { NODE } from './spec'

export interface EventSurveyReplacementProps {
  screenParams: Record<string, string>
  draft: ScopeDraft
  onChangeDraft: (next: ScopeDraft) => void
  onNavigate: (screenId: string, params?: Record<string, string>) => void
  onScopeEvent: (scopeKey: string, event: 'complete' | 'cancel') => void
}

export function useEventSurveyReplacement({
  screenParams,
  draft: scopeDraft,
  onChangeDraft,
  onNavigate,
  onScopeEvent,
}: EventSurveyReplacementProps) {
  const submitAction = useSubmitAction()
  const [note, setNote] = useState<string | null>(null)
  const mode = elementByNodeId(evt05b, NODE.mode).spec as SelectSpec
  const modeSource = getOptionSource(mode.optionsSource.key)
  const modeOptions = modeSource.type === 'static' ? modeSource.options : []
  const [seed] = useState<ScopeDraft>(() => {
    if (mode.initialValue === null) return { values: {}, labels: {} }
    const chosen = modeOptions.find((option) => option.value === mode.initialValue)
    return {
      values: { [mode.fieldKey]: mode.initialValue },
      labels: chosen === undefined ? {} : { [mode.fieldKey]: chosen.label },
    }
  })
  const draft = Object.keys(scopeDraft.values).length === 0 ? seed : scopeDraft
  const field = useFieldDraft({ elements: evt05b.elements, draft, onChangeDraft, screenParams })

  const missing = (evt05b.params ?? []).filter(
    (param) => (screenParams[param.key] ?? '') === '',
  )
  if (missing.length > 0) {
    return {
      ready: false as const,
      screen: evt05b,
      message: missing.map((param) => param.missingNote).join(' '),
    }
  }

  const buttonAt = (nodeId: string) => elementByNodeId(evt05b, nodeId).spec as ButtonSpec
  const summaryAt = (nodeId: string) => elementByNodeId(evt05b, nodeId).spec as SummarySpec
  const press = (spec: ButtonSpec) => () => {
    if (spec.action.type === 'navigate') {
      if (spec.action.scopeEvent !== undefined && evt05b.stateScopeKey !== undefined) {
        onScopeEvent(evt05b.stateScopeKey, spec.action.scopeEvent)
      }
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
  const head = summaryAt(NODE.head)
  const impact = summaryAt(NODE.impact)
  const impactRow = readObjectSource(
    impact.dataSourceKey,
    resolveParams(impact.params, { screenParams }),
  )
  const notes = elementByNodeId(evt05b, NODE.notes).spec as ItemListSpec
  const noteField = columnFieldOf(notes, 0)
  const noteRows = readFieldRows(
    notes.dataSourceKey,
    notes.itemsField,
    resolveParams(notes.params, { screenParams }),
  )
  const breadcrumbItems = evt05b.breadcrumb?.items.map((item) =>
    item.field === undefined
      ? (item.value ?? '')
      : scalar(
          readObjectSource(
            evt05b.breadcrumb!.dataSourceKey,
            resolveParams(evt05b.breadcrumb!.params, { screenParams }),
          ),
          item.field,
        ),
  )
  return {
    ready: true as const,
    screen: evt05b,
    screenParams,
    onNavigate,
    onScopeEvent,
    submitAction,
    note,
    setNote,
    mode,
    modeOptions,
    chosen: draft.values[mode.fieldKey] ?? null,
    draft,
    field,
    press,
    editBasics: buttonAt(NODE.editBasics),
    startEvent: buttonAt(NODE.startEvent),
    statusChip,
    surveyRow,
    head,
    impact,
    impactRow,
    notes,
    noteRows,
    noteField,
    cancel: buttonAt(NODE.cancel),
    replace: buttonAt(NODE.replace),
    breadcrumbItems,
    title: drawnTitleOf(evt05b, screenParams),
  }
}

export type EventSurveyReplacementModel = Extract<
  ReturnType<typeof useEventSurveyReplacement>,
  { ready: true }
>
