import { elementByNodeId } from '../../spec/screens'
import { evt04 } from '../../spec/screen-specs/evt04'
import type { ButtonSpec, InputSpec, ItemListSpec, SelectSpec } from '../../spec/types'

export const SCREEN = 'EVT-04'
export const EMPTY_SCREEN = 'EVT-04C'
export const NODE = {
  survey: '20:7605', qr: '20:7607', export: '20:7622', editBasics: '20:7671',
  startEvent: '20:7673', staffTab: '20:7678', participantsTab: '20:7681', search: '20:7689',
  affiliation: '20:7691', applyStatus: '20:7695', payStatus: '20:7699',
  attendStatus: '20:7703', table: '20:7707',
} as const
export const ASSET = {
  workspaceStatus: { startAt: '20:7661' } as Record<string, string>, qr: '20:7608', export: '20:7623',
  chevron: { affiliation: '20:7693', applyStatus: '20:7697', payStatus: '20:7701', attendStatus: '20:7705' },
  nameAlert: '20:7727', rowMenu: '20:7739',
} as const
export const EMPTY_ASSET = { icon: '20:7496', addIcon: '20:7506' } as const
export const COLUMN_WIDTH = ['flex-1', 'w-32 shrink-0', 'w-32 shrink-0', 'w-24 shrink-0', 'w-24 shrink-0', 'w-24 shrink-0'] as const

export function participantSpecs() {
  return {
    buttonAt: (nodeId: string) => elementByNodeId(evt04, nodeId).spec as ButtonSpec,
    filterAt: (nodeId: string) => elementByNodeId(evt04, nodeId).spec as SelectSpec,
    search: elementByNodeId(evt04, NODE.search).spec as InputSpec,
    table: elementByNodeId(evt04, NODE.table).spec as ItemListSpec,
  }
}
