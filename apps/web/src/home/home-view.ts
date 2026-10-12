import type { HomeDepartment, HomeEvent, HomeItem, HomeItemKind, HomeResponse, HomeTaskCounts, MembershipPermissions } from '@vada/contracts'
import { todayInSeoul } from '../purchases/purchase-view'
import { dDayText, dueText } from '../tasks/task-view'

export type HomeView = 'events' | 'departments'
// 행사 화면에서 열 탭. EventWorkspace의 탭 이름과 같다.
export type HomeTab = 'tasks' | 'purchases' | 'registrations' | 'finance'
export type HomeTarget = { type: 'task'; eventId: string; taskId: string } | { type: 'expense'; expenseId: string } | { type: 'review' }
  | { type: 'event'; eventId: string; tab: HomeTab }
type Data = Pick<HomeResponse, 'today' | 'events' | 'departments'>

const dayNumber = (day: string) => Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10))) / 86_400_000
// 그날(한국 날짜 YYYY-MM-DD)부터 today까지 지난 날수
export const daysSince = (day: string, today: string) => dayNumber(today) - dayNumber(day)
const won = (amount: number) => `${amount.toLocaleString('ko-KR')}원`

// 위쪽 종류별 수. 업무 → 돈 → 행사 마무리 순이다. 0은 감춘다.
const summaryOrder: HomeItemKind[] = ['task_overdue', 'tasks_unassigned', 'purchases_pending', 'purchases_late', 'expense_no_evidence',
  'fees_unconfirmed', 'settlement_pending', 'completion_pending']
const summaryLabels: Record<HomeItemKind, string> = { task_overdue: '지연 업무', tasks_unassigned: '담당자 없는 업무',
  purchases_pending: '구매 승인 대기', purchases_late: '필요한 날 지난 구매', expense_no_evidence: '증빙 없는 지출', fees_unconfirmed: '입금 확인 전',
  settlement_pending: '정산 전 행사', completion_pending: '완료 전 행사' }
export const summaryChips = (counts: Record<HomeItemKind, number>) => summaryOrder.filter(kind => counts[kind] > 0)
  .map(kind => `${summaryLabels[kind]} ${counts[kind]}${kind === 'fees_unconfirmed' ? '명' : ''}`)

// 할 차례(spec 정책 3). 업무는 그 업무의 담당 부서, 돈 관련 일은 재정 부서(없으면 회장단), 행사 완료는 회장단이다.
// 빈 배열은 "담당 부서 없음"이다. 목록에 없는 부서는 버린다.
export function ownerIdsOf(item: HomeItem, departments: HomeDepartment[]): string[] {
  const known = (id: string | undefined) => id !== undefined && departments.some(department => department.id === id) ? [id] : []
  const leadership = departments.filter(department => department.isLeadership).map(department => department.id)
  if (item.kind === 'task_overdue') return known(item.task.department?.id)
  if (item.kind === 'tasks_unassigned') return known(item.department?.id)
  if (item.kind === 'completion_pending') return leadership
  const finance = departments.filter(department => department.handlesFinance).map(department => department.id)
  return finance.length ? finance : leadership
}
function ownerNames(item: HomeItem, departments: HomeDepartment[]) {
  const names = ownerIdsOf(item, departments).map(id => departments.find(department => department.id === id)!.name)
  return names.length ? names.join('·') : '담당 부서 없음'
}
// 목록의 key. 같은 종류 안에서 겹치지 않는다.
export function itemKey(item: HomeItem) {
  if (item.kind === 'task_overdue') return `${item.kind}:${item.task.id}`
  if (item.kind === 'expense_no_evidence') return `${item.kind}:${item.expense.id}`
  if (item.kind === 'tasks_unassigned') return `${item.kind}:${item.eventId}:${item.department?.id ?? ''}`
  return `${item.kind}:${item.eventId}`
}

// 줄 하나의 글. 행사별은 할 차례(부서, 업무는 담당자까지)를, 부서별은 행사 이름을 앞에 둔다.
export function rowOf(item: HomeItem, view: HomeView, data: Data): { title: string; detail: string } {
  const eventName = item.eventId === null ? '상시 운영 지출' : data.events.find(home => home.event.id === item.eventId)?.event.name ?? ''
  const who = item.kind === 'task_overdue' ? [item.task.assignee?.name ?? '담당자 없음'] : []
  // 업무는 그 업무에 적힌 부서 이름을 쓴다. 돈·완료는 할 차례인 부서 이름이다.
  const owner = item.kind === 'task_overdue' ? item.task.department?.name ?? '담당 부서 없음'
    : item.kind === 'tasks_unassigned' ? item.department?.name ?? '담당 부서 없음' : ownerNames(item, data.departments)
  const context = [view === 'events' ? owner : eventName, ...who]
  const line = (...parts: string[]) => [...context, ...parts].join(' · ')
  const ago = (day: string, today: string, many: (days: number) => string) => {
    const days = daysSince(day, data.today)
    return days <= 0 ? today : many(days)
  }
  switch (item.kind) {
    case 'task_overdue': return { title: item.task.title, detail: line(`${daysSince(item.task.dueOn!, data.today)}일 지남`) }
    case 'tasks_unassigned': return { title: `담당자 없는 업무 ${item.count}건`, detail: line() }
    case 'purchases_pending': return { title: `구매 승인 대기 ${item.count}건`,
      detail: line(ago(todayInSeoul(new Date(item.since)), '오늘 제출', days => `${days}일 전 제출`)) }
    case 'purchases_late': return { title: `필요한 날 지난 구매 ${item.count}건`, detail: line(`필요한 날 ${dueText(item.neededBy)}`) }
    case 'expense_no_evidence': return { title: `증빙 없음 · ${item.expense.description}`,
      detail: line(won(item.expense.amount), `${item.expense.payer.name} 결제`, dueText(item.expense.paidOn)) }
    case 'fees_unconfirmed': return { title: `입금 확인 전 ${item.count}명`, detail: line() }
    case 'settlement_pending': {
      const { missingEvidence, pendingRequests, unrecordedItems } = item.blockers
      const blocking = [missingEvidence ? `증빙 없는 지출 ${missingEvidence}` : '', pendingRequests ? `승인 대기 ${pendingRequests}` : '',
        unrecordedItems ? `지출 기록 전 품목 ${unrecordedItems}` : ''].filter(Boolean)
      return { title: ago(item.endedOn, '정산 전 · 오늘 끝남', days => `정산 전 · 끝난 지 ${days}일`),
        detail: line(...(blocking.length ? blocking : ['정산할 수 있어요'])) }
    }
    case 'completion_pending': return { title: '정산 끝, 완료 전', detail: line(ago(item.endedOn, '오늘 끝남', days => `끝난 지 ${days}일`)) }
  }
}

// 줄을 누르면 갈 곳(spec 화면 표). 업무·지출은 홈에서 상세를 연다.
export function targetOf(item: HomeItem, permissions: Pick<MembershipPermissions, 'approvePurchases' | 'manageEvents'>): HomeTarget {
  switch (item.kind) {
    case 'task_overdue': return { type: 'task', eventId: item.eventId, taskId: item.task.id }
    case 'expense_no_evidence': return { type: 'expense', expenseId: item.expense.id }
    case 'tasks_unassigned': return { type: 'event', eventId: item.eventId, tab: 'tasks' }
    case 'purchases_pending':
    case 'purchases_late': return permissions.approvePurchases ? { type: 'review' } : { type: 'event', eventId: item.eventId, tab: 'purchases' }
    case 'fees_unconfirmed': return { type: 'event', eventId: item.eventId, tab: permissions.manageEvents ? 'registrations' : 'finance' }
    case 'settlement_pending':
    case 'completion_pending': return { type: 'event', eventId: item.eventId, tab: 'finance' }
  }
}

// 행사별: 행사 순서대로, 상시 운영 지출의 증빙 없음은 맨 뒤 카드
export function eventGroupsOf(data: HomeResponse): { key: string; home: HomeEvent | null; items: HomeItem[] }[] {
  const groups = data.events.map(home => ({ key: home.event.id, home, items: data.items.filter(item => item.eventId === home.event.id) }))
  const operating = data.items.filter(item => item.eventId === null)
  return operating.length ? [...groups, { key: 'operating', home: null, items: operating }] : groups
}
// 부서별: 부서 순서대로 할 차례인 줄을 모은다. 담당 부서 없음은 줄이나 업무가 있을 때만 맨 뒤에 둔다.
export function departmentGroupsOf(data: HomeResponse): { key: string; name: string; tasks: HomeTaskCounts; items: HomeItem[] }[] {
  const groups = data.departments.map(department => ({ key: department.id, name: department.name, tasks: department.tasks,
    items: data.items.filter(item => ownerIdsOf(item, data.departments).includes(department.id)) }))
  const unowned = data.items.filter(item => ownerIdsOf(item, data.departments).length === 0)
  const { open, done } = data.unownedTasks
  return unowned.length || open || done ? [...groups, { key: 'none', name: '담당 부서 없음', tasks: data.unownedTasks, items: unowned }] : groups
}
export const taskCountsText = ({ open, overdue, done }: HomeTaskCounts) => `할 일 ${open} · 지연 ${overdue} · 완료 ${done}`

// 행사 카드 둘째 줄: 날짜(D-n)와 담당 부서·책임자
export function eventLineOf(home: HomeEvent, today: string) {
  const { startsAt, ownerDepartment, owner } = home.event
  const day = startsAt ? `${dueText(startsAt.slice(0, 10))} (${dDayText(startsAt, today)})` : '날짜 미정'
  return [day, ownerDepartment?.name, owner?.name].filter(Boolean).join(' · ')
}
// 상태 칩: 업무 완료 수, 신청 수(정원), 받는 중이고 마감 전이면 신청 마감, 정산함. now는 한국 시각 YYYY-MM-DDTHH:mm이다.
export function statusChipsOf(home: HomeEvent, now: string) {
  const chips: string[] = []
  if (home.tasks.total) chips.push(`업무 ${home.tasks.done}/${home.tasks.total}`)
  const form = home.registration
  if (form) {
    chips.push(form.capacity === null ? `신청 ${form.registered}명` : `신청 ${form.registered}/${form.capacity}명`)
    if (form.accepting && now < form.closesAt) chips.push(`신청 마감 ${dueText(form.closesAt.slice(0, 10))}`)
  }
  if (home.settled) chips.push('정산함')
  return chips
}
