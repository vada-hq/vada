import { elementByNodeId, finPlan01 } from '../../spec/screens'
import type { ButtonSpec, GroupSpec, InputSpec, ListSpec, SelectSpec, SummarySpec } from '../../spec/types'

export const SCREEN = 'FIN-PLAN-01'
export const EVENT_OF_ROW = 'eventItemEvent'
export const SECTION = 'flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-5'
export const ROW = 'flex items-end gap-4 bg-white'

export const NODE = {
  cancel: '601:2',
  save: '601:7',
  heading: '600:97',
  period: '602:2',
  periodStart: '602:6',
  periodEnd: '602:12',
  sources: '602:18',
  items: '603:2',
  event: '603:113',
  eventItems: '603:110',
  incomeTotal: '603:161',
  itemTotal: '606:2',
  eventTotal: '608:2',
} as const

export const ITEM_NODE = {
  sourceName: '602:22',
  sourceAmount: '602:28',
  itemName: '603:6',
  itemAmount: '603:12',
  itemDepartment: '603:18',
  eventItemDepartment: '619:2',
  eventItemName: '603:121',
  eventItemAmount: '603:127',
} as const

export const ASSET = {
  departmentChevron: '603:23',
  eventChevron: '603:118',
} as const

export function itemFieldOf(list: ListSpec, fieldKey: string): InputSpec | SelectSpec {
  const found = (list.itemFields ?? []).find(
    (entry) =>
      (entry.spec.type === 'input' || entry.spec.type === 'select') &&
      entry.spec.fieldKey === fieldKey,
  )
  if (found === undefined) throw new Error(`목록 '${list.fieldKey}'에 '${fieldKey}' 칸이 없습니다.`)
  return found.spec as InputSpec | SelectSpec
}

export function budgetPlanSpecs() {
  return {
    heading: elementByNodeId(finPlan01, NODE.heading).spec as SummarySpec,
    period: elementByNodeId(finPlan01, NODE.period).spec as GroupSpec,
    sources: elementByNodeId(finPlan01, NODE.sources).spec as ListSpec,
    items: elementByNodeId(finPlan01, NODE.items).spec as ListSpec,
    eventItems: elementByNodeId(finPlan01, NODE.eventItems).spec as ListSpec,
    event: elementByNodeId(finPlan01, NODE.event).spec as SelectSpec,
    buttonAt: (nodeId: string) => elementByNodeId(finPlan01, nodeId).spec as ButtonSpec,
    inputAt: (nodeId: string) => elementByNodeId(finPlan01, nodeId).spec as InputSpec,
    summaryAt: (nodeId: string) => elementByNodeId(finPlan01, nodeId).spec as SummarySpec,
  }
}
