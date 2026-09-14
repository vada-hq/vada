import type { DataRow } from '../../data-sources/definitions'
export { scalarValue as scalar } from '../../data-sources/values'

export function rowsOf(row: DataRow, field: string): DataRow[] {
  const value = row[field]
  return Array.isArray(value) ? value : []
}
