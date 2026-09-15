import { useState } from 'react'
import { readListSource, readObjectSource } from '../../data-sources/catalog'
import { getOptionSource } from '../../option-sources/definitions'
import { resolveParams } from '../../spec/params'
import { elementByNodeId, navigateTarget } from '../../spec/screens'
import { fin00 } from '../../spec/screen-specs/fin00'
import { fin00b } from '../../spec/screen-specs/fin00b'
import { paramsOf, targetScreenOf } from '../../spec/types'
import type { ButtonSpec, DisplayAction, ItemListSpec, SelectSpec, SummarySpec } from '../../spec/types'
import { CARDS, NODE, SCREEN, VARIANT_BUDGET_CARD } from './spec'

interface FinanceOverviewOptions {
  screenId: string
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

/** 재정 범위, 명세 조각, 조회 결과와 이동 동작을 한 모델로 만든다. */
export function useFinanceOverview({ screenId, onNavigate }: FinanceOverviewOptions) {
  const planning = screenId === VARIANT_BUDGET_CARD.screen
  const cards = planning
    ? [
        { ...VARIANT_BUDGET_CARD, from: fin00b },
        ...CARDS.slice(1).map((card) => ({ ...card, screen: SCREEN, from: fin00 })),
      ]
    : CARDS.map((card) => ({ ...card, screen: SCREEN, from: fin00 }))
  const scopeSpec = elementByNodeId(fin00, NODE.scope).spec as SelectSpec
  const [scope, setScope] = useState(scopeSpec.initialValue ?? '')
  const [note, setNote] = useState<string | null>(null)
  const totalBudget = elementByNodeId(fin00, NODE.totalBudget).spec as SummarySpec
  const overview = readObjectSource(totalBudget.dataSourceKey)
  const period = elementByNodeId(fin00, NODE.period).spec as SummarySpec
  const intro = elementByNodeId(fin00, NODE.intro).spec as SummarySpec
  const execution = elementByNodeId(fin00, NODE.execution).spec as SummarySpec
  const breakdown = elementByNodeId(fin00, NODE.breakdown).spec as ItemListSpec
  const recent = elementByNodeId(fin00, NODE.recent).spec as ItemListSpec
  const ledgerLink = elementByNodeId(fin00, NODE.ledgerLink).spec as ButtonSpec
  const proof = elementByNodeId(fin00, NODE.proof).spec as SummarySpec
  const scopeSource = getOptionSource(scopeSpec.optionsSource.key)
  const scopeOptions = scopeSource.type === 'static' ? scopeSource.options : []
  const breakdownRows = readListSource(
    breakdown.dataSourceKey,
    resolveParams(breakdown.params, { fields: { [scopeSpec.fieldKey]: scope } }),
  )
  const recentRows = readListSource(recent.dataSourceKey)
  const proofRow = readObjectSource(proof.dataSourceKey)
  const [executionNote, plannedNote, spentBar, plannedBar] = execution.items ?? []

  const press = (action: DisplayAction) => () => {
    if (action.type === 'pending') {
      setNote(action.note)
      return
    }
    onNavigate(targetScreenOf(action, {}) ?? action.type, resolveParams(paramsOf(action), {}))
  }

  const pressButton = (spec: ButtonSpec) => () => {
    if (spec.action.type === 'pending') {
      setNote(spec.action.note)
      return
    }
    if (spec.action.type === 'navigate') {
      onNavigate(navigateTarget(spec.action), resolveParams(spec.action.params, {}))
    }
  }

  return {
    screen: fin00,
    breadcrumb: fin00.breadcrumb,
    cards,
    scope,
    setScope,
    note,
    overview,
    period,
    intro,
    execution,
    breakdown,
    recent,
    ledgerLink,
    proof,
    scopeSpec,
    scopeSource,
    scopeOptions,
    breakdownRows,
    recentRows,
    proofRow,
    executionNote,
    plannedNote,
    spentBar,
    plannedBar,
    press,
    pressButton,
  }
}

export type FinanceOverviewModel = ReturnType<typeof useFinanceOverview>
