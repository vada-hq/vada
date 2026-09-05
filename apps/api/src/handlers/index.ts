import type { Handlers } from '../deps.ts'
import { documentHandlers } from './documents.ts'
import { eventHandlers } from './events.ts'
import { joiningHandlers } from './joining.ts'
import { financeHandlers } from './finance.ts'
import { homeHandlers } from './home.ts'
import { meetingHandlers } from './meetings.ts'
import { opsHandlers } from './ops.ts'
import { orgHandlers } from './org.ts'
import { participantHandlers } from './participants.ts'
import { outsideHandlers } from './outside.ts'
import { recordHandlers } from './record.ts'
import { shellHandlers } from './shell.ts'
import { taskHandlers } from './tasks.ts'

/**
 * 계약이 든 자리에 놓는 답 전부.
 *
 * **영역을 하나 더할 때 고치는 줄이 둘이다** — 가져오는 줄과 펼치는 줄. 답 자체는
 * 그 영역의 파일에만 있으므로 두 영역을 나란히 붙여도 서로의 글을 건드리지 않는다.
 *
 * 같은 이름을 두 영역이 답하면 나중 것이 앞엣것을 덮는다. 그것을 막는 검사가
 * `handlers/index.test.ts`에 있다 — 덮이는 자리는 조용하기 때문이다.
 */
export const HANDLERS: Handlers = {
  ...shellHandlers,
  ...orgHandlers,
  ...joiningHandlers,
  ...outsideHandlers,
  ...eventHandlers,
  ...meetingHandlers,
  ...taskHandlers,
  ...documentHandlers,
  ...opsHandlers,
  ...financeHandlers,
  ...recordHandlers,
  ...participantHandlers,
  ...homeHandlers,
}

/** 영역마다 따로. 겹치는 이름이 없는지 재는 검사가 이것을 쓴다. */
export const BY_AREA: Record<string, Handlers> = {
  shell: shellHandlers,
  org: orgHandlers,
  joining: joiningHandlers,
  outside: outsideHandlers,
  events: eventHandlers,
  meetings: meetingHandlers,
  tasks: taskHandlers,
  documents: documentHandlers,
  ops: opsHandlers,
  finance: financeHandlers,
  record: recordHandlers,
  participants: participantHandlers,
  home: homeHandlers,
}
