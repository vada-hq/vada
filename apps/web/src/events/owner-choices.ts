import type { TeamResponse } from '@vada/contracts'
import type { Choice } from '@/tasks/task-form-options'
import { NO_OWNER_LABEL } from './event-view'

// 책임자로 고를 수 있는 사람: 이 학생회의 지금 운영진 누구나, 그리고 '책임자 없음'이다.
export const ownerChoices = (team: TeamResponse): Choice[] => [
  { id: null, label: NO_OWNER_LABEL },
  ...team.members.map(member => ({ id: member.id, label: member.name })),
]
