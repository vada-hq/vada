import { elementByNodeId, finReq01 } from '../../spec/screens'
import type { ButtonSpec, GroupSpec, InputSpec, ListSpec, SelectSpec, SummarySpec } from '../../spec/types'

export const SCREEN = 'FIN-REQ-01'

export const NODE = {
  heading: '30:314',
  baseGroup: '30:319',
  title: '30:326',
  department: '30:332',
  neededOn: '30:339',
  priority: '30:344',
  purpose: '30:351',
  itemCount: '30:363',
  items: '30:357',
  aside: '30:776',
  submit: '30:807',
  saveDraft: '30:809',
  cancel: '30:811',
} as const

export const ITEM_NODE = {
  root: '30:371',
  itemName: '30:380',
  itemCategory: '30:386',
  budgetItem: '30:394',
  purchaseType: '30:403',
  quantity: '30:412',
  unit: '30:418',
  unitPrice: '30:424',
  total: '30:430',
  detailGroup: '30:435',
  vendor: '30:440',
  productUrl: '30:445',
  option: '30:450',
  deliveryNote: '30:455',
  quoteStatus: '30:462',
} as const

export const ASSET = {
  addItem: '30:366',
  priorityChevron: '30:349',
  submitNote: '30:815',
  itemCategoryChevron: '30:392',
  budgetItemChevron: '30:400',
  purchaseTypeChevron: '30:409',
} as const

export function purchaseRequestSpecs() {
  const buttonAt = (nodeId: string) => elementByNodeId(finReq01, nodeId).spec as ButtonSpec
  const screenField = (nodeId: string) =>
    elementByNodeId(finReq01, nodeId).spec as InputSpec | SelectSpec
  return {
    buttonAt,
    screenField,
    list: elementByNodeId(finReq01, NODE.items).spec as ListSpec,
    heading: elementByNodeId(finReq01, NODE.heading).spec as SummarySpec,
    baseGroup: elementByNodeId(finReq01, NODE.baseGroup).spec as GroupSpec,
    count: elementByNodeId(finReq01, NODE.itemCount).spec as SummarySpec,
    aside: elementByNodeId(finReq01, NODE.aside).spec as SummarySpec,
  }
}
