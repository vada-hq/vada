import type { DataRow } from '../../data-sources/definitions'

export function scalar(row: DataRow, field: string | undefined): string {
  const value = row[field ?? '']
  if (value === undefined || Array.isArray(value)) {
    return ''
  }
  return String(value)
}

export function rowsOf(row: DataRow, field: string): DataRow[] {
  const value = row[field]
  return Array.isArray(value) ? value : []
}
