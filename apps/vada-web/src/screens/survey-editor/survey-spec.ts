import { elementByNodeId, evt05 } from '../../spec/screens'
import type { ButtonSpec, InputSpec, ItemListSpec, SelectSpec, SummarySpec } from '../../spec/types'

// 참여 설문 편집의 명세·디자인 연결. 화면과 하위 컴포넌트가 같은 식별자를 쓴다.
export const SCREEN = 'EVT-05'

export const NODE = {
  statusChip: '25:515',
  preview: '25:517',
  activate: '25:523',
  unmetBadge: '25:525',
  editBasics: '25:570',
  startEvent: '25:572',
  basics: '25:578',
  basicsLink: '25:636',
  recruitGroup: '25:642',
  applyStart: '25:646',
  applyEnd: '25:653',
  applyMethod: '25:666',
  waitlist: '25:674',
  duesCheck: '25:682',
  duesNote: '25:690',
  completionNote: '25:695',
  conditions: '25:700',
  unmetNote: '25:704',
  questions: '25:844',
  questionRow: '25:848',
  addQuestion: '25:963',
  questionPanel: '25:976',
} as const

export const ASSET = {
  workspaceStatus: { startAt: '25:560' } as Record<string, string>,
  preview: '25:518',
  basicsInfo: '25:581',
  basicsFold: '25:588',
  basicsLink: '25:637',
  applyEndAlert: '25:655',
  applyEndNote: '25:661',
  duesNote: '25:691',
  // 조건 줄 앞머리. design은 줄마다 다른 노드로 뽑았지만 그림은 두 가지뿐이라
  // 첫 벌만 지목한다(대조는 같은 그림을 묶어 본다).
  conditionMet: '25:711',
  conditionUnmet: '25:754',
  // 문항 줄의 손잡이. 잠긴 문항의 것이 한 단계 옅다 - 다른 그림이다.
  questionGripLocked: '25:850',
  questionGrip: '25:882',
  questionRemove: '25:896',
} as const

// 경로 조각 사이의 화살표. 명세는 조각이 무엇인지만 말하고 그 사이의 그림은
// design이 갖는다(MY-REQ-01과 같은 방식).
export const BREADCRUMB_SEPARATORS = ['25:498', '25:503', '25:508']

export const buttonAt = (nodeId: string) => elementByNodeId(evt05, nodeId).spec as ButtonSpec
export const summaryAt = (nodeId: string) => elementByNodeId(evt05, nodeId).spec as SummarySpec
export const inputAt = (nodeId: string) => elementByNodeId(evt05, nodeId).spec as InputSpec
export const selectAt = (nodeId: string) => elementByNodeId(evt05, nodeId).spec as SelectSpec
export const listAt = (nodeId: string) => elementByNodeId(evt05, nodeId).spec as ItemListSpec
