import { elementByNodeId } from '../../spec/screens'
import { opsMeet06b } from '../../spec/screen-specs/opsMeet06b'
import type { ButtonSpec, ItemListSpec, SummarySpec } from '../../spec/types'

export const SCREEN = 'OPS-MEET-06B'
export const BASE = 'OPS-MEET-06A'

export const NODE = {
  blockedNote: '20:1802',
  complete: '20:1804',
  facts: '20:1824',
  summaryHeader: '20:1849',
  aiDisclaimer: '20:1858',
  generate: '20:1861',
  writeByHand: '20:1869',
  agendas: '20:1877',
  agendaFollowUps: '20:1904',
  panelHeader: '20:1995',
  picker: '20:2000',
  panel: '20:2016',
  progressHeader: '20:2055',
  conditions: '20:2060',
} as const

export const BASE_NODE = { banner: '20:1592' } as const

export const ASSET = {
  banner: '20:1812',
  complete: '20:1805',
  generate: '20:1862',
  followUp: '20:1908',
  linkTask: '20:2040',
  conditionDone: '20:2062',
  conditionTodo: '20:2068',
  conditionOptional: '20:2090',
} as const

export const BREADCRUMB_SEPARATORS = ['20:1785', '20:1790', '20:1795']

export function summaryAt(nodeId: string): SummarySpec {
  return elementByNodeId(opsMeet06b, nodeId).spec as SummarySpec
}

export function listAt(nodeId: string): ItemListSpec {
  return elementByNodeId(opsMeet06b, nodeId).spec as ItemListSpec
}

export function buttonAt(nodeId: string): ButtonSpec {
  return elementByNodeId(opsMeet06b, nodeId).spec as ButtonSpec
}
