import { elementByNodeId, rec02a } from '../../spec/screens'
import type { ButtonSpec, GroupSpec, InputSpec, ItemListSpec, SelectSpec, SummarySpec } from '../../spec/types'

export const SCREEN = 'REC-02A'
export const INITIAL_SECTION_KEY = 'onSite'

export const NODE = {
  statusChip: '30:4083',
  saveDraft: '30:4085',
  requestReview: '30:4087',
  banner: '30:4094',
  toc: '30:4106',
  autoFilled: '30:4146',
  onSite: '30:4173',
  retroGroup: '30:4182',
  retroGood: '30:4187',
  retroIssues: '30:4191',
  retroImprovements: '30:4195',
  improvementDepartment: '30:4199',
  handoverGroup: '30:4203',
  aiDisclaimer: '30:4211',
  generateDraft: '30:4213',
  handover: '30:4221',
  nextOwner: '30:4224',
  gate: '30:4232',
  gateConditions: '30:4237',
  gateNote: '30:4286',
  review: '30:4288',
  reviewer: '30:4291',
  reviewComment: '30:4294',
} as const

export const ASSET = {
  breadcrumbSeparators: ['30:4066', '30:4071', '30:4076'],
  requestReview: '30:4088',
  banner: '30:4095',
  generateDraft: '30:4214',
  condition: '30:4239',
} as const

export const SECTION_TONE: Record<string, { label: string; status: string }> = {
  gray: { label: 'text-gray-400', status: 'text-gray-300' },
  orange: { label: 'text-gray-600', status: 'text-orange-500' },
}
export const CONDITION_ICON: Record<string, string> = { orange: ASSET.condition }

export function archiveEditorSpecs() {
  const buttonAt = (nodeId: string) => elementByNodeId(rec02a, nodeId).spec as ButtonSpec
  const summaryAt = (nodeId: string) => elementByNodeId(rec02a, nodeId).spec as SummarySpec
  const inputAt = (nodeId: string) => elementByNodeId(rec02a, nodeId).spec as InputSpec
  const selectAt = (nodeId: string) => elementByNodeId(rec02a, nodeId).spec as SelectSpec
  const listAt = (nodeId: string) => elementByNodeId(rec02a, nodeId).spec as ItemListSpec
  const groupAt = (nodeId: string) => elementByNodeId(rec02a, nodeId).spec as GroupSpec
  return {
    buttonAt,
    summaryAt,
    inputAt,
    selectAt,
    listAt,
    groupAt,
    statusChip: summaryAt(NODE.statusChip),
    saveDraft: buttonAt(NODE.saveDraft),
    requestReview: buttonAt(NODE.requestReview),
    generateDraft: buttonAt(NODE.generateDraft),
    banner: summaryAt(NODE.banner),
    toc: listAt(NODE.toc),
    autoFilled: summaryAt(NODE.autoFilled),
    gate: summaryAt(NODE.gate),
    conditions: listAt(NODE.gateConditions),
    reviewComment: summaryAt(NODE.reviewComment),
  }
}
