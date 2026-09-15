import { useState } from 'react'
import { readListSource, readObjectSource } from '../../data-sources/catalog'
import { findDataSource } from '../../data-sources/definitions'
import type { DataRow } from '../../data-sources/definitions'
import { resolveParams } from '../../spec/params'
import { elementByNodeId } from '../../spec/screens'
import { rec01 } from '../../spec/screen-specs/rec01'
import { paramsOf, targetScreenOf } from '../../spec/types'
import type { DisplayAction, InputSpec, ItemListSpec, PendingSpec, SummarySpec } from '../../spec/types'
import { RECORDS_ARCHIVE_NODE as NODE } from './config'

export function useRecordsArchive(
  onNavigate: (screenId: string, params?: Record<string, string>) => void,
) {
  const alert = elementByNodeId(rec01, NODE.alert).spec as SummarySpec
  const query = elementByNodeId(rec01, NODE.query).spec as InputSpec
  const filter = elementByNodeId(rec01, NODE.filter).spec as PendingSpec
  const list = elementByNodeId(rec01, NODE.list).spec as ItemListSpec
  const [queryValue, setQueryValue] = useState(query.initialValue ?? '')
  const [note, setNote] = useState<string | null>(null)

  const alertRow = readObjectSource(alert.dataSourceKey)
  const rows = readListSource(
    list.dataSourceKey,
    resolveParams(list.params, { fields: { [query.fieldKey]: queryValue } }),
  )
  const [status, archive, title, date, host, highlights, completed, blocked] =
    list.columns ?? []

  function open(action: DisplayAction, row: DataRow) {
    if (action.type === 'pending') {
      setNote(action.note)
      return
    }
    const target = targetScreenOf(action, row)
    if (target !== null) onNavigate(target, resolveParams(paramsOf(action), { row }))
  }

  return {
    alert,
    query,
    filter,
    list,
    queryValue,
    setQueryValue,
    note,
    alertRow,
    rows,
    columns: { status, archive, title, date, host, highlights, completed, blocked },
    emptyMessage: findDataSource(list.dataSourceKey).messages.empty,
    open,
  }
}

export type RecordsArchiveModel = ReturnType<typeof useRecordsArchive>
