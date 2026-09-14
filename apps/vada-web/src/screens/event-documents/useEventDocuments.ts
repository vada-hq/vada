import { useState } from 'react'
import { readListSource, readObjectSource } from '../../data-sources/catalog'
import { findDataSource } from '../../data-sources/definitions'
import { getOptionSource } from '../../option-sources/definitions'
import { resolveParams } from '../../spec/params'
import { elementByNodeId, evtDoc01 } from '../../spec/screens'
import type { ItemListSpec, SelectSpec, SummarySpec } from '../../spec/types'
import { EVENT_DOCUMENT_NODE as NODE } from './config'

export function useEventDocuments(screenParams: Record<string, string>) {
  const filter = elementByNodeId(evtDoc01, NODE.filter).spec as SelectSpec
  const [status, setStatus] = useState(filter.initialValue ?? '')
  const [note, setNote] = useState<string | null>(null)
  const missing = (evtDoc01.params ?? []).filter(
    (param) => (screenParams[param.key] ?? '') === '',
  )

  if (missing.length > 0) {
    return {
      ready: false as const,
      message: missing.map((param) => param.missingNote).join(' '),
    }
  }

  const stats = elementByNodeId(evtDoc01, NODE.stats).spec as SummarySpec
  const statsRow = readObjectSource(
    stats.dataSourceKey ?? '',
    resolveParams(stats.params, { screenParams }),
  )
  const optionSource = getOptionSource(filter.optionsSource.key)
  const options = optionSource.type === 'static' ? optionSource.options : []
  const counts = filter.optionCounts
    ? readObjectSource(
        filter.optionCounts.dataSourceKey,
        resolveParams(filter.optionCounts.params, { screenParams }),
      )
    : null
  const table = elementByNodeId(evtDoc01, NODE.table).spec as ItemListSpec
  const rows = readListSource(
    table.dataSourceKey,
    resolveParams(table.params, { screenParams, fields: { [filter.fieldKey]: status } }),
  )

  function pressRow() {
    if (table.itemAction?.type === 'pending') setNote(table.itemAction.note)
  }

  return {
    ready: true as const,
    filter,
    status,
    setStatus,
    note,
    setNote,
    stats,
    statsRow,
    optionSource,
    options,
    counts,
    table,
    rows,
    emptyMessage: findDataSource(table.dataSourceKey).messages.empty,
    pressRow,
  }
}

export type ReadyEventDocuments = Extract<ReturnType<typeof useEventDocuments>, { ready: true }>
