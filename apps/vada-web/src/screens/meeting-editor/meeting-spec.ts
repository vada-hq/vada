import { elementByNodeId, opsMeet02 } from '../../spec/screens'
import type { ListSpec } from '../../spec/types'

// 회의 편집 화면의 명세·디자인 연결. UI 컴포넌트들이 같은 노드 식별자를 쓴다.
export const SCREEN = 'OPS-MEET-02'

export const NODE = {
  heading: '18:2338',
  typeGroup: '18:2343',
  meetingType: '18:2352',
  linkedEventId: '18:2370',
  basicGroup: '18:2378',
  title: '18:2388',
  hostName: '18:2394',
  departmentId: '18:2400',
  statusLabel: '18:2408',
  purpose: '18:2415',
  scheduleGroup: '18:2420',
  date: '18:2430',
  startTime: '18:2435',
  endTime: '18:2440',
  mode: '18:2445',
  place: '18:2454',
  onlineLink: '18:2460',
  peopleGroup: '18:2467',
  selectedCount: '18:2477',
  isPrivate: '18:2479',
  memberQuery: '18:2492',
  participants: '18:2500',
  hostRoleNote: '18:2574',
  minutesNote: '18:2582',
  agendaGroup: '18:2584',
  agendaItems: '18:2599',
  cancel: '18:2774',
  saveDraft: '18:2776',
  create: '18:2778',
} as const

// 안건 항목의 칸. 명세가 적은 것은 첫째 안건의 노드이고, 화면도 첫째에만 끈을 단다.
export const AGENDA_NODE = {
  agendaTitle: '18:2619',
  agendaNote: '18:2625',
  attachmentName: '18:2629',
  duration: '18:2649',
} as const

// 어떤 자리에 어떤 그림이 오는지는 명세가 아니라 design이 갖는다. 되풀이되는 자리는
// 첫 것의 nodeId를 본으로 쓴다 - 같은 그림이면 하나만 그려도 대조가 통과한다.
export const ASSET = {
  chevron: '18:2376',
  search: '18:2489',
  addMember: '18:2496',
  avatar: '18:2502',
  removeRow: '18:2532',
  hostRoleNote: '18:2575',
  addAgenda: '18:2595',
  dragHandle: '18:2602',
  fileIcon: '18:2631',
  upload: '18:2643',
  createCheck: '18:2779',
} as const

export function specOf(nodeId: string) {
  const agenda = elementByNodeId(opsMeet02, NODE.agendaItems).spec as ListSpec
  const inItem = agenda.itemFields?.find((entry) => entry.source?.nodeId === nodeId)
  return inItem === undefined ? elementByNodeId(opsMeet02, nodeId).spec : inItem.spec
}
