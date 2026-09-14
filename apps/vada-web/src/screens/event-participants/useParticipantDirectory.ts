import { useState } from 'react'
import { readListSource, readObjectSource } from '../../data-sources/catalog'
import type { Option } from '../../option-sources/definitions'
import { resolveParams } from '../../spec/params'
import type { ButtonSpec } from '../../spec/types'
import { participantSpecs } from './spec'

export function useParticipantDirectory({
  screenParams, onNavigate,
}: {
  screenParams: Record<string, string>
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}) {
  const [query, setQueryState] = useState('')
  const [filters, setFilters] = useState<Record<string, Option>>({})
  const [page, setPage] = useState(1)
  const [picked, setPicked] = useState<string[]>([])
  const [note, setNote] = useState<string | null>(null)
  const specs = participantSpecs()
  const paging = specs.table.paging!
  const fieldValues = {
    [specs.search.fieldKey]: query,
    ...Object.fromEntries(Object.entries(filters).map(([key, option]) => [key, option.value])),
  }
  const rows = readListSource(specs.table.dataSourceKey, {
    ...resolveParams(specs.table.params, { screenParams, fields: fieldValues }),
    [paging.pageParam]: String(page),
  })
  const pageInfo = readObjectSource(
    paging.dataSourceKey,
    resolveParams(paging.params, { screenParams, fields: fieldValues }),
  )
  const pageCount = Number(pageInfo[paging.pageCountField])

  const run = (spec: { action: ButtonSpec['action'] }) => () => {
    if (spec.action.type === 'navigate') {
      onNavigate(spec.action.targetScreenId, resolveParams(spec.action.params, { screenParams }))
      return
    }
    if (spec.action.type === 'pending') setNote(spec.action.note)
  }
  const setQuery = (next: string) => {
    setQueryState(next)
    setPage(1)
  }
  const filterOf = (nodeId: string) => {
    const spec = specs.filterAt(nodeId)
    return {
      spec,
      value: filters[spec.fieldKey] ?? null,
      onSelect: (option: Option) => {
        setFilters((previous) => ({ ...previous, [spec.fieldKey]: option }))
        setPage(1)
      },
      sourceParams: resolveParams(spec.optionsSource.params, { screenParams }),
    }
  }

  return {
    screenParams, specs, query, setQuery, page, setPage, picked, setPicked, note, setNote,
    paging, rows, pageInfo, pageCount, run, filterOf, onNavigate,
  }
}

export type ParticipantDirectoryModel = ReturnType<typeof useParticipantDirectory>
