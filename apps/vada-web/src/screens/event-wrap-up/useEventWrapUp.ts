import { useState } from 'react'
import { readListSource, readObjectSource } from '../../data-sources/catalog'
import { findDataSource } from '../../data-sources/definitions'
import type { DataRow } from '../../data-sources/definitions'
import { resolveParams } from '../../spec/params'
import { drawnTitleOf, elementByNodeId, evt02d } from '../../spec/screens'
import { paramsOf, targetScreenOf } from '../../spec/types'
import type { ItemListSpec, SummarySpec } from '../../spec/types'
import { NODE } from './spec'

export interface EventWrapUpProps {
  screenParams: Record<string, string>
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

export function useEventWrapUp({ screenParams, onNavigate }: EventWrapUpProps) {
  const [note, setNote] = useState<string | null>(null)
  const missing = (evt02d.params ?? []).filter(
    (param) => (screenParams[param.key] ?? '') === '',
  )
  if (missing.length > 0) {
    return {
      ready: false as const,
      screen: evt02d,
      message: missing.map((param) => param.missingNote).join(' '),
    }
  }

  const argumentsOf = (params: SummarySpec['params']) => resolveParams(params, { screenParams })
  const readSummary = (nodeId: string) => {
    const spec = elementByNodeId(evt02d, nodeId).spec as SummarySpec
    return { spec, row: readObjectSource(spec.dataSourceKey ?? '', argumentsOf(spec.params)) }
  }
  const state = readSummary(NODE.state)
  const banner = readSummary(NODE.banner)
  const basics = readSummary(NODE.basics)
  const countsTitle = elementByNodeId(evt02d, NODE.countsTitle).spec as SummarySpec
  const counts = NODE.counts.map((nodeId) => ({ nodeId, ...readSummary(nodeId) }))
  const remainingSpec = elementByNodeId(evt02d, NODE.remaining).spec as ItemListSpec
  const changesSpec = elementByNodeId(evt02d, NODE.changes).spec as ItemListSpec
  const remaining = readListSource(
    remainingSpec.dataSourceKey,
    argumentsOf(remainingSpec.params),
  )
  const changes = readListSource(changesSpec.dataSourceKey, argumentsOf(changesSpec.params))
  const columnField = (spec: ItemListSpec, at: number) =>
    (spec.columns ?? [])[at]?.fields?.[0] ?? ''

  function pressCount(spec: SummarySpec, row: DataRow) {
    const action = spec.action
    if (action === undefined) return
    if (action.type === 'pending') {
      setNote(action.note)
      return
    }
    onNavigate(
      targetScreenOf(action, row) ?? action.type,
      resolveParams(paramsOf(action), { screenParams }),
    )
  }

  function pressRemaining(row: DataRow) {
    const action = remainingSpec.itemAction
    if (action === undefined) return
    if (action.type === 'pending') {
      setNote(action.note)
      return
    }
    onNavigate(
      targetScreenOf(action, row) ?? action.type,
      resolveParams(paramsOf(action), { screenParams, row }),
    )
  }

  return {
    ready: true as const,
    screen: evt02d,
    screenParams,
    onNavigate,
    title: drawnTitleOf(evt02d, screenParams),
    note,
    setNote,
    state,
    banner,
    basics,
    countsTitle,
    counts,
    remainingSpec,
    remaining,
    changesSpec,
    changes,
    columnField,
    pressCount,
    pressRemaining,
    bannerTone: String(banner.row[banner.spec.toneField ?? '']),
    remainingEmptyMessage: findDataSource(remainingSpec.dataSourceKey).messages.empty,
    changesEmptyMessage: findDataSource(changesSpec.dataSourceKey).messages.empty,
  }
}

export type EventWrapUpModel = Extract<ReturnType<typeof useEventWrapUp>, { ready: true }>
