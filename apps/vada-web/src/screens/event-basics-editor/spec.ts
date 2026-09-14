import { elementByNodeId, evt02b } from '../../spec/screens'
import type { ButtonSpec, GroupSpec, InputSpec, SelectSpec, SummarySpec } from '../../spec/types'

export const SCREEN = 'EVT-02B'

export const NODE = {
  head: '20:5159',
  close: '20:5164',
  infoGroup: '20:5169',
  title: '20:5172',
  intro: '20:5177',
  purpose: '20:5182',
  whenGroup: '20:5190',
  startAt: '20:5195',
  endAt: '20:5199',
  endUnset: '20:5203',
  placeGroup: '20:5214',
  place: '20:5218',
  placeUnset: '20:5223',
  address: '20:5233',
  placeDetail: '20:5236',
  joinGroup: '20:5242',
  audience: '20:5246',
  feeType: '20:5251',
  feeNote: '20:5268',
  paidAmount: '20:5270',
  unpaidAmount: '20:5275',
  payGuide: '20:5280',
  capacityType: '20:5285',
  capacity: '20:5300',
  hostGroup: '20:5308',
  hostDepartment: '20:5313',
  hostPerson: '20:5318',
  contact: '20:5323',
  notice: '20:5328',
  cancel: '20:5341',
  save: '20:5343',
} as const

export const ASSET = { close: '20:5164' } as const
export const AUTO_HINT =
  'inline-block self-start rounded border border-blue-100 bg-blue-50 px-2 py-0.5 text-xs text-blue-500'
export const SUB_BLOCK = 'flex flex-col gap-3 rounded-md border border-blue-100 p-3'
export const SECTION_TITLE = 'text-xs font-semibold text-gray-700'

export function eventBasicsSpecs() {
  const inputAt = (nodeId: string) => elementByNodeId(evt02b, nodeId).spec as InputSpec
  const selectAt = (nodeId: string) => elementByNodeId(evt02b, nodeId).spec as SelectSpec
  const groupAt = (nodeId: string) => elementByNodeId(evt02b, nodeId).spec as GroupSpec
  return {
    head: elementByNodeId(evt02b, NODE.head).spec as SummarySpec,
    close: elementByNodeId(evt02b, NODE.close).spec as ButtonSpec,
    cancel: elementByNodeId(evt02b, NODE.cancel).spec as ButtonSpec,
    save: elementByNodeId(evt02b, NODE.save).spec as ButtonSpec,
    feeNote: elementByNodeId(evt02b, NODE.feeNote).spec as SummarySpec,
    footerNote: evt02b.meta?.footerNote,
    inputAt,
    selectAt,
    groupAt,
  }
}
