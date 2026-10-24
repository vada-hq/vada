import type { HomeResponse, PurchaseRequestSummary } from '@vada/contracts'
import { NO_ASSIGNEE_LABEL } from '../tasks/task-view'
import { mineRows, withoutIds } from './home-view'

export type AttentionTone = 'danger' | 'warning' | 'info'
// 맨 위 숫자 카드 하나. target은 눌렀을 때 내려갈 부분의 id다.
export type Attention = {
  key: string
  label: string
  count: number
  tone: AttentionTone
  target: string
}
type Maybe = Attention | false | undefined

// 역할 부분의 것: 받은 결재(재정부), 막힌 곳(부서 없는 학생회 업무도 한 곳으로 센다)과 지난 업무(회장단), 담당자 없음(부장).
function roleItems(home: HomeResponse): Maybe[] {
  const mineIds = new Set(mineRows(home.mine).map(task => task.id))
  const departments = home.departments ?? []
  const first = departments[0]
  return [
    home.received && {
      key: 'received',
      label: '받은 결재',
      count: home.received.total,
      tone: 'warning',
      target: 'home-received',
    },
    home.council && {
      key: 'blocked',
      label: '막힌 곳',
      count: home.council.blocked.length,
      tone: 'warning',
      target: 'home-blocked',
    },
    home.council && {
      key: 'overdue',
      label: '지난 업무',
      count: withoutIds(home.council.overdue, mineIds).total,
      tone: 'danger',
      target: 'home-overdue',
    },
    first && {
      key: 'unassigned',
      label: NO_ASSIGNEE_LABEL,
      count: departments.reduce((sum, item) => sum + item.counts.unassigned, 0),
      tone: 'warning',
      target: `home-department-${first.id}`,
    },
  ]
}

// 내 것: 지난 내 업무, 오늘 마감, 반려된 요청, 이번 주 행사(회장단은 행사를 학생회 부분에서 본다).
function personalItems(
  home: HomeResponse,
  requests: PurchaseRequestSummary[],
  weekEvents: number,
): Maybe[] {
  const { counts } = home.mine
  const answered = requests.filter(item => item.status === 'rejected' || item.status === 'partial')
  return [
    {
      key: 'mine-overdue',
      label: '지난 내 업무',
      count: counts.overdue,
      tone: 'danger',
      target: 'home-mine',
    },
    {
      key: 'mine-today',
      label: '오늘 마감',
      count: counts.today,
      tone: 'info',
      target: 'home-mine',
    },
    {
      key: 'rejected',
      label: '반려된 요청',
      count: answered.length,
      tone: 'danger',
      target: 'home-requests',
    },
    !home.council && {
      key: 'week',
      label: '이번 주 행사',
      count: weekEvents,
      tone: 'info',
      target: 'home-week',
    },
  ]
}

// 남이 기다리는 것과 늦은 것부터(DEC-69 차례). 그 사람에게 없는 부분의 것은 넣지 않는다.
export function attentionOf(
  home: HomeResponse,
  requests: PurchaseRequestSummary[],
  weekEvents: number,
): Attention[] {
  return [...roleItems(home), ...personalItems(home, requests, weekEvents)].filter(
    (item): item is Attention => Boolean(item),
  )
}
