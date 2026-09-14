import type { DataRow } from '../../data-sources/definitions'

export function matchesQuery(row: DataRow, query: string): boolean {
  if (query.trim() === '') return true
  const needle = query.trim().toLowerCase()
  return Object.values(row).some((value) => String(value).toLowerCase().includes(needle))
}
