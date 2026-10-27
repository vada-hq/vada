import type { EventDetail, EventSettlement, RegistrationForm, TaskSummary } from '@vada/contracts'
import { REMAINING_LABEL } from './settlement-view'

// 개요의 '챙길 것' 한 칸. 누르면 그 일을 하는 탭으로 간다.
// 빈 일시·장소는 여기에 넣지 않는다. 이름 아래 한 줄에서 바로 채우므로 두 번 보이게 된다.
export type AttentionKey = 'overdue' | 'unassigned' | 'settlement' | 'complete'
export interface Attention {
  key: AttentionKey
  title: string
  // 큰 글자로 보일 수. 수가 아닌 칸(완료)은 null이다.
  value: string | null
  detail: string
  tone: 'danger' | 'warning' | 'info'
}

// 제목은 앞의 둘만 보이고 나머지는 수로 줄인다(카드 한 칸에 들어가게).
const SHOWN_TITLES = 2
function titlesOf(tasks: TaskSummary[]) {
  const shown = tasks.slice(0, SHOWN_TITLES).map(task => task.title)
  const rest = tasks.length - shown.length
  return rest > 0 ? `${shown.join(' · ')} 외 ${rest}개` : shown.join(' · ')
}

function taskAttention(tasks: TaskSummary[]): Attention[] {
  const overdue = tasks.filter(task => task.overdue)
  // 담당자 없음은 업무 화면의 '담당자 없음'(서버 unassignedCondition)과 머리의 건강도와 같다: 담당자가 없거나 떠났거나 부서가 없다.
  const unassigned = tasks.filter(task => !task.assignee?.current || task.department === null)
  const items: Attention[] = []
  if (overdue.length > 0)
    items.push({
      key: 'overdue',
      title: '마감이 지난 업무',
      value: `${overdue.length}개`,
      detail: titlesOf(overdue),
      tone: 'danger',
    })
  if (unassigned.length > 0)
    items.push({
      key: 'unassigned',
      title: '담당자 없는 업무',
      value: `${unassigned.length}개`,
      detail: titlesOf(unassigned),
      tone: 'warning',
    })
  return items
}

// 정산이 끝나 완료할 수 있으면(서버가 event.complete를 줌) 완료를 알리고, 끝난 행사의 남은 정산은 챙긴다.
// 끝나기 전의 남은 것은 아직 진행 중인 일이다(홈 회장단 카드와 같다, screens.md).
function settlementAttention(event: EventDetail, settlement: EventSettlement): Attention | null {
  if (event.actions.includes('event.complete'))
    return {
      key: 'complete',
      title: '정산이 끝났어요',
      value: null,
      detail: '',
      tone: 'info',
    }
  if (event.status !== 'ended') return null
  const left = settlement.remaining.filter(row => row.count > 0)
  if (!settlement.settled && left.length > 0)
    return {
      key: 'settlement',
      title: '정산에 남은 것',
      value: `${left.reduce((sum, row) => sum + row.count, 0)}개`,
      detail: left.map(row => REMAINING_LABEL[row.kind]).join(' · '),
      tone: 'warning',
    }
  return null
}

// 개요 맨 위 '챙길 것': 막힌 업무와 끝난 행사의 정산. 없으면 빈 목록이다.
export function attentionOf(
  event: EventDetail,
  openTasks: TaskSummary[],
  settlement: EventSettlement | null,
): Attention[] {
  const items = taskAttention(openTasks)
  const money = settlement && settlementAttention(event, settlement)
  if (money) items.push(money)
  return items
}

// 다음에 할 업무: 지난 것, 마감이 가까운 것, 마감 없는 것 순. 같은 자리는 서버 순서를 지킨다.
const RANK = { overdue: 0, due: 1, noDue: 2 }
export function nextTasks(openTasks: TaskSummary[], limit: number) {
  const rank = (task: TaskSummary) =>
    task.overdue ? RANK.overdue : task.dueDate ? RANK.due : RANK.noDue
  return [...openTasks]
    .sort(
      (a, b) =>
        rank(a) - rank(b) || (a.dueDate && b.dueDate ? a.dueDate.localeCompare(b.dueDate) : 0),
    )
    .slice(0, limit)
}

// 행사의 신청 양식을 더한 수. 정원은 모든 양식에 있을 때만 더한다(하나라도 없으면 정원이 없는 셈이다).
export function registrationTotals(forms: RegistrationForm[]) {
  return {
    applicants: forms.reduce((sum, form) => sum + form.applicantCount, 0),
    attended: forms.reduce((sum, form) => sum + form.attendedCount, 0),
    capacity: forms.every(form => form.capacity !== null)
      ? forms.reduce((sum, form) => sum + (form.capacity ?? 0), 0)
      : null,
  }
}

// 새 행사의 준비 단계 하나. 끝났으면 done이고, 아니면 그 일을 하는 곳으로 가는 길이 있다.
export type SetupKey = 'when' | 'tasks' | 'budget' | 'registration'
export interface SetupStep {
  key: SetupKey
  title: string
  done: boolean
  // 행사마다 필요하지 않을 수 있는 단계(예산, 참가 신청). 이것만 남으면 준비 단계를 숨긴다.
  optional: boolean
}

// 준비 시작하기: 일시·장소, 업무, 예산, 참가 신청(필요할 때). 만들기가 이름만 받으므로 새 행사는 모두 비어 있다.
// 아직 열리지 않은 행사(날짜 미정, 예정)에서 꼭 할 단계(일시·장소, 업무)가 남았을 때만 보인다.
// 예산과 참가 신청은 없는 행사도 있어, 그것만 남았다고 목록을 계속 두지 않는다.
export function setupSteps(
  event: EventDetail,
  forms: RegistrationForm[],
  settlement: EventSettlement,
): SetupStep[] | null {
  if (event.status !== 'tbd' && event.status !== 'upcoming') return null
  const steps: SetupStep[] = [
    {
      key: 'when',
      title: '일시와 장소 정하기',
      done: event.startsAt !== null && event.place !== null,
      optional: false,
    },
    {
      key: 'tasks',
      title: '업무 나누기',
      done: event.tasks.total > 0,
      optional: false,
    },
    {
      key: 'budget',
      title: '예산 잡기',
      done: settlement.budget.items.length > 0,
      optional: true,
    },
    {
      key: 'registration',
      title: '참가 신청 받기',
      done: forms.length > 0,
      optional: true,
    },
  ]
  return steps.every(step => step.done || step.optional) ? null : steps
}

// 업무도 신청도 돈도 아직 없는 행사. 이때는 빈 수 카드를 늘어놓지 않고 준비 단계만 보인다.
export function isBlank(
  event: EventDetail,
  forms: RegistrationForm[],
  settlement: EventSettlement,
) {
  return (
    event.tasks.total === 0 &&
    forms.length === 0 &&
    settlement.budget.items.length === 0 &&
    settlement.actual.expense === 0
  )
}
