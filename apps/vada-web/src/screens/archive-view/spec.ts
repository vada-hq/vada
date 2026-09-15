import type { DataRow } from '../../data-sources/definitions'
import { elementByNodeId } from '../../spec/screens'
import { rec02 } from '../../spec/screen-specs/rec02'
import type { ItemListSpec, SummarySpec } from '../../spec/types'

export const SCREEN = 'REC-02'
export const INITIAL_SECTION = 0
export const NODE = {
  head: '30:3595', toc: '30:3615', overview: '30:3649', outcome: '30:3679',
  timeline: '30:3704', onSite: '30:3757', evidence: '30:3782', evidenceNote: '30:3819',
  retro: '30:3821', handover: '30:3887', nextOwner: '30:3921', checklistHead: '30:3925',
  checklist: '30:3930',
} as const
export const ASSET = {
  breadcrumbSeparators: ['30:3582', '30:3587'],
  retro: ['30:3830', '30:3846', '30:3870'],
} as const

export const summaryAt = (nodeId: string) =>
  elementByNodeId(rec02, nodeId).spec as SummarySpec
export const listAt = (nodeId: string) => elementByNodeId(rec02, nodeId).spec as ItemListSpec
export function rowsOf(row: DataRow, field: string | undefined): DataRow[] {
  const value = row[field ?? '']
  return Array.isArray(value) ? value : []
}
