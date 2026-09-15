import { useState } from 'react'
import { readListSource, readObjectSource } from '../../data-sources/catalog'
import type { Option } from '../../option-sources/definitions'
import { resolveParams } from '../../spec/params'
import { elementByNodeId } from '../../spec/screens'
import { finLedger01 } from '../../spec/screen-specs/finLedger01'
import type { InputSpec, ItemListSpec, SelectSpec, SummarySpec } from '../../spec/types'
import {
  FINANCE_LEDGER_FILTERS as FILTERS,
  FINANCE_LEDGER_NODE as NODE,
  FINANCE_LEDGER_TILES as TILES,
} from './config'

export function financeLedgerFilterSpec(nodeId: string) {
  return elementByNodeId(finLedger01, nodeId).spec as SelectSpec
}

export function useFinanceLedger(screenParams: Record<string, string>) {
  const search = elementByNodeId(finLedger01, NODE.search).spec as InputSpec
  const ledger = elementByNodeId(finLedger01, NODE.ledger).spec as ItemListSpec
  const scope = elementByNodeId(finLedger01, NODE.scope).spec as SummarySpec
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState<Record<string, Option | null>>({})

  const fieldValues: Record<string, string> = { [search.fieldKey]: query }
  for (const filter of FILTERS) {
    const spec = financeLedgerFilterSpec(filter.node)
    fieldValues[spec.fieldKey] = picked[spec.fieldKey]?.value ?? ''
  }

  const rows = readListSource(
    ledger.dataSourceKey,
    resolveParams(ledger.params, { screenParams, fields: fieldValues }),
  )
  const scopeRow = readObjectSource(
    scope.dataSourceKey,
    resolveParams(scope.params, { screenParams, fields: fieldValues }),
  )
  const tiles = TILES.map((nodeId) => {
    const spec = elementByNodeId(finLedger01, nodeId).spec as SummarySpec
    const row = readObjectSource(
      spec.dataSourceKey,
      resolveParams(spec.params, { fields: fieldValues }),
    )
    return { nodeId, spec, row, item: (spec.items ?? [])[0] }
  })

  function selectFilter(fieldKey: string, option: Option) {
    setPicked((current) => ({ ...current, [fieldKey]: option }))
  }

  return {
    search,
    ledger,
    scope,
    query,
    setQuery,
    picked,
    rows,
    scopeRow,
    tiles,
    selectFilter,
  }
}

export type FinanceLedgerModel = ReturnType<typeof useFinanceLedger>
