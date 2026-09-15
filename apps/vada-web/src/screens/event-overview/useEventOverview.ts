import { useState } from 'react'
import { readListSource, readObjectSource } from '../../data-sources/catalog'
import type { DataRow } from '../../data-sources/definitions'
import { resolveParams } from '../../spec/params'
import { drawnTitleOf, elementByNodeId } from '../../spec/screens'
import { evt02 } from '../../spec/screen-specs/evt02'
import { paramsOf, targetScreenOf } from '../../spec/types'
import type { ButtonSpec, ItemListSpec, SummarySpec } from '../../spec/types'
import { NODE } from './spec'

export interface EventOverviewProps {
  screenParams: Record<string, string>
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

export function useEventOverview({ screenParams, onNavigate }: EventOverviewProps) {
  const [note, setNote] = useState<string | null>(null)
  const missing = (evt02.params ?? []).filter(
    (param) => (screenParams[param.key] ?? '') === '',
  )
  if (missing.length > 0) {
    return {
      ready: false as const,
      screen: evt02,
      message: missing.map((param) => param.missingNote).join(' '),
    }
  }

  const argumentsOf = (params: SummarySpec['params']) => resolveParams(params, { screenParams })
  const readSummary = (nodeId: string) => {
    const spec = elementByNodeId(evt02, nodeId).spec as SummarySpec
    return {
      spec,
      row: readObjectSource(spec.dataSourceKey ?? '', argumentsOf(spec.params)),
    }
  }
  const briefing = readSummary(NODE.briefing)
  const basics = readSummary(NODE.basics)
  const recruit = readSummary(NODE.recruit)
  const stats = readSummary(NODE.stats)
  const highlights = NODE.highlights.map((nodeId) => ({ nodeId, ...readSummary(nodeId) }))
  const recruitEdit = elementByNodeId(evt02, NODE.recruitEdit).spec as ButtonSpec
  const checklistSpec = elementByNodeId(evt02, NODE.checklist).spec as ItemListSpec
  const changesSpec = elementByNodeId(evt02, NODE.changes).spec as ItemListSpec

  const readChecklist = () =>
    readListSource(checklistSpec.dataSourceKey, argumentsOf(checklistSpec.params))
  const readChanges = () => readListSource(changesSpec.dataSourceKey, argumentsOf(changesSpec.params))

  function pressHighlight(spec: SummarySpec, row: DataRow) {
    if (spec.action?.type === 'navigate') {
      onNavigate(
        targetScreenOf(spec.action, row) ?? spec.action.type,
        resolveParams(spec.action.params, { screenParams }),
      )
      return
    }
    if (spec.action?.type === 'pending') setNote(spec.action.note)
  }

  function pressRecruitEdit() {
    if (recruitEdit.action.type === 'pending') {
      setNote(recruitEdit.action.note)
    } else if (
      recruitEdit.action.type === 'navigate' &&
      'targetScreenId' in recruitEdit.action
    ) {
      onNavigate(
        recruitEdit.action.targetScreenId,
        resolveParams(recruitEdit.action.params, { screenParams }),
      )
    }
  }

  function pressChecklist(row: DataRow) {
    const action = checklistSpec.itemAction
    if (action === undefined) return
    if (action.type === 'pending') {
      setNote(action.note)
      return
    }
    const target = targetScreenOf(action, row)
    if (target === null) {
      setNote(
        `이 항목이 어디로 가는지 명세의 갈래에 없습니다: ${String(
          row[(action as { targetField?: string }).targetField ?? ''] ?? '',
        )}`,
      )
      return
    }
    onNavigate(target, argumentsOf(paramsOf(action)))
  }

  return {
    ready: true as const,
    screen: evt02,
    screenParams,
    onNavigate,
    title: drawnTitleOf(evt02, screenParams),
    note,
    setNote,
    briefing,
    basics,
    recruit,
    stats,
    highlights,
    recruitEdit,
    checklistSpec,
    changesSpec,
    readChecklist,
    readChanges,
    pressHighlight,
    pressRecruitEdit,
    pressChecklist,
  }
}

export type EventOverviewModel = Extract<
  ReturnType<typeof useEventOverview>,
  { ready: true }
>
