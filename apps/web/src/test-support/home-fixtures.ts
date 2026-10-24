import type {
  ChatMessage,
  EventSummary,
  HomeList,
  HomeResponse,
  HomeTask,
  HomeTaskGroup,
  PurchaseRequestSummary,
} from '@vada/contracts'
import { json } from './mock-api'

export const homeEvent = (id: string, extra: Partial<EventSummary> = {}): EventSummary => ({
  id,
  name: `행사 ${id}`,
  startsAt: '2026-10-20T10:00',
  endsAt: '2026-10-20T12:00',
  place: null,
  owner: { id: 'p1', name: '김회장', current: true },
  status: 'ongoing',
  ...extra,
})

export const homeRequest = (id: string): PurchaseRequestSummary => ({
  id,
  title: `요청 ${id}`,
  status: 'pending',
  requestedBy: { id: 'p2', name: '박부원' },
  neededBy: null,
  itemCount: 1,
  createdAt: '2026-10-20T03:00:00.000Z',
  event: null,
})

export const noTasks: HomeList = { tasks: [], total: 0 }

export const homeTask = (
  id: string,
  group: HomeTaskGroup,
  extra: Partial<HomeTask> = {},
): HomeTask => ({
  id,
  title: `업무 ${id}`,
  status: 'todo',
  dueDate: '2026-10-25',
  overdue: group === 'overdue',
  department: null,
  event: null,
  assignee: { id: 'p1', name: '김새내', current: true },
  actions: ['task.status'],
  group,
  ...extra,
})

const noCounts = { overdue: 0, today: 0, soon: 0, later: 0, noDue: 0 }

export const homeResponse = (extra: Partial<HomeResponse> = {}): HomeResponse => ({
  today: '2026-10-23',
  mine: { tasks: [], counts: noCounts },
  ...extra,
})

// 줄의 묶음으로 수를 세고, 줄보다 수가 많은 경우는 counts로 덮어쓴다.
export const homeWithTasks = (tasks: HomeTask[], counts: Partial<typeof noCounts> = {}) => {
  const own = { ...noCounts }
  for (const task of tasks) own[task.group] += 1
  return homeResponse({ mine: { tasks, counts: { ...own, ...counts } } })
}

type Extras = {
  requests?: PurchaseRequestSummary[]
  notices?: ChatMessage[]
  events?: EventSummary[]
}
// 홈이 응답 밖에서 같이 읽는 내 요청, 공지, 행사 목록. 시험이 정하지 않으면 비어 있다.
export function onHomeExtras(
  api: { on: (method: string, path: string, handler: () => Response) => void },
  extras: Extras = {},
  councilId = 'c1',
) {
  const base = `/api/organizations/${councilId}`
  api.on('GET', `${base}/purchase-requests?view=mine`, () =>
    json({ requests: extras.requests ?? [], truncated: false }),
  )
  api.on('GET', `${base}/notices`, () => json({ notices: extras.notices ?? [] }))
  api.on('GET', `${base}/events`, () => json({ events: extras.events ?? [], truncated: false }))
}

export const homeNotice = (id: string, extra: Partial<ChatMessage> = {}): ChatMessage => ({
  id,
  senderId: 'p1',
  senderName: '김회장',
  body: `공지 ${id}`,
  sentAt: '2026-10-22T03:00:00.000Z',
  isNotice: true,
  photos: [],
  ...extra,
})
