import type { ArchiveRow } from './archive-facts.ts'
import type { ArchiveStatus } from './completed.ts'

export function archiveWord(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim()
  return trimmed === '' ? null : trimmed
}

export function archiveStatusOf(row: ArchiveRow | null): ArchiveStatus {
  return (row?.status ?? 'draft') as ArchiveStatus
}
