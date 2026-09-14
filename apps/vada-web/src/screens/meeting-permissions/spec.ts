import type { DataRow } from '../../data-sources/definitions'
import { elementByNodeId, opsMeet04b } from '../../spec/screens'
import type { ButtonSpec, InputSpec, ItemListSpec, PendingSpec, SummarySpec } from '../../spec/types'

export const SCREEN = 'OPS-MEET-04B'

export const NODE = {
  done: '20:747',
  notice: '20:754',
  ownerHeading: '20:766',
  owner: '20:769',
  peopleHeader: '20:788',
  query: '20:801',
  filter: '20:803',
  people: '20:804',
} as const

export const ASSET = {
  doneCheck: '20:748',
  notice: '20:755',
  ownerAvatar: '20:770',
  search: '20:798',
  personAvatar: '20:806',
} as const

export const BREADCRUMB_SEPARATORS = ['20:731', '20:736', '20:741']

export function permissionSpecs() {
  return {
    done: elementByNodeId(opsMeet04b, NODE.done).spec as ButtonSpec,
    notice: elementByNodeId(opsMeet04b, NODE.notice).spec as SummarySpec,
    ownerHeading: elementByNodeId(opsMeet04b, NODE.ownerHeading).spec as SummarySpec,
    owner: elementByNodeId(opsMeet04b, NODE.owner).spec as SummarySpec,
    peopleHeader: elementByNodeId(opsMeet04b, NODE.peopleHeader).spec as SummarySpec,
    query: elementByNodeId(opsMeet04b, NODE.query).spec as InputSpec,
    filter: elementByNodeId(opsMeet04b, NODE.filter).spec as PendingSpec,
    people: elementByNodeId(opsMeet04b, NODE.people).spec as ItemListSpec,
  }
}

export function scalar(row: DataRow, field: string | undefined): string {
  const value = field === undefined ? undefined : row[field]
  if (value === undefined || Array.isArray(value)) {
    throw new Error(`OPS-MEET-04B의 '${field}' 조각은 한 줄의 값이어야 합니다.`)
  }
  return String(value)
}
