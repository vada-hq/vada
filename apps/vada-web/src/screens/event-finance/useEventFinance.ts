import { useState } from 'react'
import { readListSource, readObjectSource } from '../../data-sources/catalog'
import { findDataSource } from '../../data-sources/definitions'
import type { DataRow } from '../../data-sources/definitions'
import { getOptionSource } from '../../option-sources/definitions'
import { resolveParams } from '../../spec/params'
import { drawnTitleOf, elementByNodeId, evtFin01 } from '../../spec/screens'
import { noteOf, targetScreenOf } from '../../spec/types'
import type { ButtonSpec, ItemListSpec, SelectSpec, SummarySpec } from '../../spec/types'
import { NODE } from './spec'

export interface EventFinanceProps {
  screenParams: Record<string, string>
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

export function useEventFinance({ screenParams, onNavigate }: EventFinanceProps) {
  const tabSpec = elementByNodeId(evtFin01, NODE.tab).spec as SelectSpec
  const [tab, setTab] = useState(tabSpec.initialValue ?? '')
  const [note, setNote] = useState<string | null>(null)
  const missing = (evtFin01.params ?? []).filter(
    (param) => (screenParams[param.key] ?? '') === '',
  )
  if (missing.length > 0) {
    return {
      ready: false as const,
      screen: evtFin01,
      message: missing.map((param) => param.missingNote).join(' '),
    }
  }

  const buttonAt = (nodeId: string) => elementByNodeId(evtFin01, nodeId).spec as ButtonSpec
  const totals = elementByNodeId(evtFin01, NODE.totals).spec as SummarySpec
  const totalRow = readObjectSource(
    totals.dataSourceKey ?? '',
    resolveParams(totals.params, { screenParams }),
  )
  const alerts = elementByNodeId(evtFin01, NODE.alerts).spec as SummarySpec
  const alertRow = readObjectSource(
    alerts.dataSourceKey ?? '',
    resolveParams(alerts.params, { screenParams }),
  )
  const tabSource = getOptionSource(tabSpec.optionsSource.key)
  const tabOptions = tabSource.type === 'static' ? tabSource.options : []
  const columns = NODE.columns.map((nodeId) => {
    const spec = elementByNodeId(evtFin01, nodeId).spec as ItemListSpec
    return {
      nodeId,
      spec,
      cards: readListSource(spec.dataSourceKey, resolveParams(spec.params, { screenParams })),
      emptyMessage: findDataSource(spec.dataSourceKey).messages.empty,
    }
  })

  const press = (spec: ButtonSpec) => () => {
    if (spec.action.type === 'pending') {
      setNote(spec.action.note)
      return
    }
    if (spec.action.type === 'navigate') {
      onNavigate(
        targetScreenOf(spec.action, {}) ?? spec.action.type,
        resolveParams(spec.action.params, { screenParams }),
      )
    }
  }

  function selectTab(value: string, description: string | undefined) {
    setTab(value)
    setNote(description ?? null)
  }

  function pressCard(column: ItemListSpec, card: DataRow) {
    if (column.itemAction === undefined) return
    if (column.itemAction.type === 'navigate') {
      onNavigate(
        targetScreenOf(column.itemAction, card) ?? column.itemAction.type,
        resolveParams(column.itemAction.params, { row: card }),
      )
      return
    }
    setNote(noteOf(column.itemAction))
  }

  return {
    ready: true as const,
    screen: evtFin01,
    screenParams,
    onNavigate,
    title: drawnTitleOf(evtFin01, screenParams),
    note,
    setNote,
    tab,
    tabSpec,
    tabSource,
    tabOptions,
    selectTab,
    totals,
    totalRow,
    alerts,
    alertRow,
    columns,
    press,
    pressCard,
    myRequests: buttonAt(NODE.myRequests),
    newRequest: buttonAt(NODE.newRequest),
  }
}

export type EventFinanceModel = Extract<ReturnType<typeof useEventFinance>, { ready: true }>
