import { useState } from 'react'
import { readListSource, readObjectSource } from '../../data-sources/catalog'
import { findDataSource } from '../../data-sources/definitions'
import type { DataRow } from '../../data-sources/definitions'
import { resolveParams } from '../../spec/params'
import { elementByNodeId, myReq01 } from '../../spec/screens'
import { targetScreenOf } from '../../spec/types'
import type { ButtonSpec, ItemListSpec, SummarySpec } from '../../spec/types'
import { MY_REQUESTS_NODE as NODE } from './config'

export function useMyRequests(
  screenParams: Record<string, string>,
  onNavigate: (screenId: string, params?: Record<string, string>) => void,
) {
  const [note, setNote] = useState<string | null>(null)
  const missing = (myReq01.params ?? []).filter(
    (param) => (screenParams[param.key] ?? '') === '',
  )
  if (missing.length > 0) {
    return {
      ready: false as const,
      message: missing.map((param) => param.missingNote).join(' '),
    }
  }

  const breadcrumb = myReq01.breadcrumb
  const breadcrumbRow = breadcrumb?.dataSourceKey
    ? readObjectSource(
        breadcrumb.dataSourceKey,
        resolveParams(breadcrumb.params, { screenParams }),
      )
    : null
  const heading = elementByNodeId(myReq01, NODE.heading).spec as SummarySpec
  const scopeNote = elementByNodeId(myReq01, NODE.scopeNote).spec as SummarySpec
  const counts = elementByNodeId(myReq01, NODE.counts).spec as SummarySpec
  const summaryRow = readObjectSource(
    counts.dataSourceKey ?? '',
    resolveParams(counts.params, { screenParams }),
  )
  const table = elementByNodeId(myReq01, NODE.table).spec as ItemListSpec
  const rows = readListSource(
    table.dataSourceKey,
    resolveParams(table.params, { screenParams }),
  )
  const back = elementByNodeId(myReq01, NODE.back).spec as ButtonSpec
  const newRequest = elementByNodeId(myReq01, NODE.newRequest).spec as ButtonSpec

  function pressButton(spec: ButtonSpec) {
    if (spec.action.type !== 'navigate') return
    onNavigate(
      targetScreenOf(spec.action, {}) ?? spec.action.type,
      resolveParams(spec.action.params, { screenParams }),
    )
  }

  function pressRow(row: DataRow) {
    if (table.itemAction?.type !== 'navigate') return
    onNavigate(
      targetScreenOf(table.itemAction, row) ?? table.itemAction.type,
      resolveParams(table.itemAction.params, { row }),
    )
  }

  return {
    ready: true as const,
    note,
    setNote,
    breadcrumb,
    breadcrumbItems: breadcrumb?.items.map((item) =>
      item.field === undefined ? (item.value ?? '') : String(breadcrumbRow?.[item.field] ?? ''),
    ),
    heading,
    scopeNote,
    counts,
    summaryRow,
    table,
    rows,
    emptyMessage: findDataSource(table.dataSourceKey).messages.empty,
    back,
    newRequest,
    pressButton,
    pressRow,
  }
}

export type ReadyMyRequests = Extract<ReturnType<typeof useMyRequests>, { ready: true }>
