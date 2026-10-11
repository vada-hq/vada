import type { BudgetChange, BudgetHistoryEntry, BudgetPlanResponse, SaveBudgetPlanRequest } from '@vada/contracts'
import { won } from '../purchases/purchase-view'
import { completedEventMessage } from '../events/event-phase'
import { budgetInput, budgetText } from '../settlement/settlement-view'

// 학기와 바로 뒤 방학을 한 기간으로 둔다. 3/1~8/31은 1학기, 9/1~다음 해 2월 말일은 2학기다.
export function semesterOf(day: string) {
  const year = Number(day.slice(0, 4))
  const month = Number(day.slice(5, 7))
  if (month >= 3 && month <= 8) return { name: `${year}년 1학기`, startsOn: `${year}-03-01`, endsOn: `${year}-08-31` }
  const first = month >= 9 ? year : year - 1
  const lastDay = new Date(Date.UTC(first + 1, 2, 0)).getUTCDate()
  return { name: `${first}년 2학기`, startsOn: `${first}-09-01`, endsOn: `${first + 1}-02-${lastDay}` }
}
const nextDay = (day: string) => new Date(Date.parse(`${day}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10)
// 새 기간 기본값. 기간이 있으면 가장 늦은 끝일 다음 날부터 그날이 든 학기 끝까지다.
export function defaultNewPeriod(periods: { endsOn: string }[], today: string) {
  if (!periods.length) return semesterOf(today)
  const startsOn = nextDay(periods.reduce((latest, period) => period.endsOn > latest ? period.endsOn : latest, periods[0]!.endsOn))
  const semester = semesterOf(startsOn)
  return { name: semester.name, startsOn, endsOn: semester.endsOn }
}
// 처음 고를 기간. 오늘이 든 기간, 없으면 목록의 첫 기간(서버가 시작일이 늦은 순으로 준다).
export const currentPeriodId = (periods: { id: string; startsOn: string; endsOn: string }[], today: string) =>
  (periods.find(period => period.startsOn <= today && today <= period.endsOn) ?? periods[0])?.id ?? null
export const rateText = (spent: number, budget: number | null) => budget === null || budget === 0 ? null : `집행 ${Math.round((spent / budget) * 100)}%`
// 수입 줄의 예산 대비 실제 수입. 예산이 0원이면 없다.
export const shareText = (received: number, amount: number) => amount === 0 ? null : `예산의 ${Math.round((received / amount) * 100)}%`
// 2026-09-01 → 2026.9.1
export const periodDayText = (day: string) => `${Number(day.slice(0, 4))}.${Number(day.slice(5, 7))}.${Number(day.slice(8, 10))}`

export type DraftLine = { key: string; id: string | null; name: string; amount: string }
// feeIncome: 참가비 수입이 들어간 행사. 기간에서 뺄 수 없다(후보에는 없다).
export type DraftEvent = { eventId: string; name: string; version: number; settled: boolean; budget: number | null; amount: string; feeIncome: boolean }
export type PlanDraft = { name: string; startsOn: string; endsOn: string; incomes: DraftLine[]; operating: DraftLine[]; events: DraftEvent[] }
const amountText = (value: number | null) => value === null ? '' : value.toLocaleString('ko-KR')
let keys = 0
export const newLine = (): DraftLine => ({ key: `new-${++keys}`, id: null, name: '', amount: '' })
export const eventDraft = (entry: { eventId: string; name: string; version: number; settled: boolean; budget: number | null; feeIncome?: boolean }):
  DraftEvent => ({ ...entry, feeIncome: entry.feeIncome ?? false, amount: amountText(entry.budget) })
export function draftOf(plan: BudgetPlanResponse): PlanDraft {
  const line = ({ id, name, amount }: { id: string; name: string; amount: number }): DraftLine => ({ key: id, id, name, amount: amountText(amount) })
  return { name: plan.period.name, startsOn: plan.period.startsOn, endsOn: plan.period.endsOn, incomes: plan.incomes.map(line),
    operating: plan.operating.map(line), events: plan.events.map(eventDraft) }
}
// 칸의 글을 본문으로 바꾼다. 형식이 틀린 금액은 NaN·null로 넘겨 같은 스키마가 저장 버튼을 끄게 한다.
// 행사 줄은 금액을 바꿨을 때만 보낸다. 보내지 않은 줄은 서버가 버전을 보지 않으므로, 다른 곳에서 바뀐 줄 때문에 막히지 않는다.
// 정산된 행사는 칸이 없어 보내지 않는다.
export function planInput(draft: PlanDraft, version: number): SaveBudgetPlanRequest {
  const line = ({ id, name, amount }: DraftLine) => ({ id, name, amount: budgetInput(amount) as number })
  const event = (entry: DraftEvent) => {
    const budget = budgetInput(entry.amount)
    return entry.settled || budget === entry.budget ? { eventId: entry.eventId, version: entry.version } : { eventId: entry.eventId, version: entry.version, budget }
  }
  return { version, name: draft.name, startsOn: draft.startsOn, endsOn: draft.endsOn, incomes: draft.incomes.map(line), operating: draft.operating.map(line),
    events: draft.events.map(event) }
}
// 저장에 실패해 편성을 새로 받았을 때 입력을 그 위에 다시 얹는다.
// 다른 사람이 편성을 저장했으면(기간 버전이 바뀜) 겹쳐 쓰지 않도록 새 편성으로 다시 시작한다.
// 행사 재정 탭에서 바뀐 행사 줄(행사 재정 버전이 바뀜)은 새 값으로 바꾸고, 나머지 입력은 그대로 둔다.
export function rebaseDraft(draft: PlanDraft, before: BudgetPlanResponse, after: BudgetPlanResponse): PlanDraft {
  if (after.period.version !== before.period.version) return draftOf(after)
  const latest = new Map([...after.candidates, ...after.events].map(entry => [entry.eventId, entry]))
  return { ...draft, events: draft.events.map(line => {
    const fresh = latest.get(line.eventId)
    return fresh && fresh.version !== line.version ? eventDraft(fresh) : line
  }) }
}
// 입력하는 대로 바뀌는 합계. 형식이 맞는 금액만 더한다.
export function draftTotals(draft: PlanDraft) {
  const valueOf = (text: string) => {
    const value = budgetInput(text)
    return value !== null && Number.isFinite(value) ? value : 0
  }
  const income = draft.incomes.reduce((sum, line) => sum + valueOf(line.amount), 0)
  const budget = draft.events.reduce((sum, entry) => sum + (entry.settled ? entry.budget ?? 0 : valueOf(entry.amount)), 0)
    + draft.operating.reduce((sum, line) => sum + valueOf(line.amount), 0)
  return { income, budget, unallocated: income - budget }
}

const groupLabels = { income: '수입', event: '행사', operating: '운영' } as const
function changeText(change: BudgetChange) {
  const group = groupLabels[change.group]
  const amount = (value: number | null | undefined) => change.group === 'event' ? budgetText(value ?? null) : won(value ?? 0)
  if (change.action === 'added') return `${group} ${change.name} ${change.group === 'event' ? '넣음' : '더함'}(${amount(change.to)})`
  if (change.action === 'removed') return `${group} ${change.name} ${change.group === 'event' ? '뺌' : '지움'}`
  const name = change.previousName ? `${change.previousName} → ${change.name}` : change.name
  return change.from === change.to ? `${group} ${name}` : `${group} ${name} ${amount(change.from)} → ${amount(change.to)}`
}
// 처리 기록 한 줄.
export function budgetHistoryText(entry: BudgetHistoryEntry) {
  const changes = entry.changes
  if (entry.action === 'created') return `기간 만듦: ${String(changes.name)} (${String(changes.startsOn)} ~ ${String(changes.endsOn)})`
  if (entry.action === 'closed') {
    const { balance, carryover } = changes as { balance: number; carryover: { period: string } | null }
    return `기간 마감: 남은 돈 ${won(balance)}${carryover ? ` → ${carryover.period} 수입으로 넘김` : ''}`
  }
  if (entry.action === 'reopened') return `마감 다시 엶: ${entry.reason ?? ''}`
  const labels = { name: '이름', startsOn: '시작일', endsOn: '끝일' } as const
  const parts = (Object.keys(labels) as (keyof typeof labels)[]).flatMap(key => {
    const change = changes[key] as { from: string; to: string } | undefined
    return change ? [`${labels[key]} ${change.from} → ${change.to}`] : []
  })
  for (const change of (changes.lines as BudgetChange[] | undefined) ?? []) parts.push(changeText(change))
  return `편성 수정: ${parts.join(' · ')}`
}

export type ClosingRequirement = { key: 'earlier' | 'events' | 'evidence' | 'balance' | 'next'; label: string; hint: string; done: boolean }
// 마감하려면 모두 맞아야 한다. 끝일은 이 목록을 보이는 조건이라 넣지 않는다. 해결 방법은 안 맞을 때만 보인다.
export function closingRequirements(plan: BudgetPlanResponse): ClosingRequirement[] {
  const { closing } = plan
  const { balance } = plan.totals
  const unsettled = plan.events.filter(line => !line.settled)
  return [
    { key: 'earlier', label: closing.earlierOpen ? `마감하지 않은 앞 기간: ${closing.earlierOpen.name}` : '앞 기간이 모두 마감됐어요',
      hint: '앞 기간부터 마감해 주세요.', done: closing.earlierOpen === null },
    { key: 'events', label: unsettled.length ? `정산하지 않은 행사 ${unsettled.length}개: ${unsettled.map(line => line.name).join(', ')}`
      : '넣은 행사가 모두 정산됐어요', hint: '행사 재정 탭에서 정산해 주세요.', done: unsettled.length === 0 },
    { key: 'evidence', label: closing.missingEvidence ? `증빙이 없는 상시 운영 지출 ${closing.missingEvidence}건` : '상시 운영 지출의 증빙이 모두 있어요',
      hint: '사용 내역에서 증빙을 올려 주세요.', done: closing.missingEvidence === 0 },
    { key: 'balance', label: balance < 0 ? `실제 지출이 실제 수입보다 ${won(-balance)} 많아요` : `남은 돈 ${won(balance)}`,
      hint: '빠진 수입 기록이 없는지 확인해 주세요.', done: balance >= 0 },
    // 남은 돈이 있을 때만 넘길 기간이 필요하다.
    ...(balance > 0 ? [{ key: 'next' as const, label: closing.next ? `남은 돈을 넘길 기간: ${closing.next.name}` : '남은 돈을 넘길 다음 기간이 없어요',
      hint: '새 기간을 먼저 만들어 주세요.', done: closing.next !== null }] : []),
  ]
}
export const readyToClose = (plan: BudgetPlanResponse) => plan.closing.ended && closingRequirements(plan).every(item => item.done)
// 이월금 수입 항목의 기본값. 이름에 "이월"이 든 첫 줄이고, 없으면 고르지 않는다('').
export const defaultCarryoverLine = (lines: { id: string; name: string }[]) => lines.find(line => line.name.includes('이월'))?.id ?? ''
// 마감한 날(한국 날짜). 예: 2027.3.5
export const closedDay = (at: string) => periodDayText(new Date(at).toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' }))

export const budgetErrors: Record<string, string> = {
  FORBIDDEN: '권한이 없어요. 재정 부서나 회장단만 할 수 있어요.',
  NOT_FOUND: '찾을 수 없어요. 새로 불러와 주세요.',
  VERSION_CONFLICT: '다른 곳에서 먼저 바뀌었어요. 새로 불러왔어요.',
  PERIOD_OVERLAP: '다른 회계 기간과 날짜가 겹쳐요.',
  PERIOD_NAME_TAKEN: '같은 이름의 회계 기간이 있어요.',
  EVENT_IN_OTHER_PERIOD: '다른 회계 기간에 넣은 행사예요. 그 기간에서 먼저 빼 주세요.',
  EVENT_SETTLED: '정산이 끝난 행사의 예산은 바꿀 수 없어요.',
  EVENT_COMPLETED: completedEventMessage,
  LINE_IN_USE: '지출이나 수입이 고른 항목은 지울 수 없어요.',
  FEE_INCOME: '참가비 수입이 들어간 행사는 뺄 수 없어요. 행사 정산을 다시 연 뒤 빼 주세요.',
  EXPENSES_OUTSIDE_PERIOD: '운영 항목을 고른 지출이 기간 밖으로 나가요. 날짜를 확인해 주세요.',
  INCOMES_OUTSIDE_PERIOD: '이 기간의 수입이 기간 밖으로 나가요. 날짜를 확인해 주세요.',
  EXPORT_TOO_LARGE: '기록이 너무 많아 엑셀로 만들 수 없어요.',
  NOT_READY_TO_CLOSE: '아직 마감할 수 없어요. 남은 항목을 확인해 주세요.',
  INVALID_STATE: '지금 상태에서는 할 수 없어요. 새로 불러왔어요.',
  LATER_PERIOD_CLOSED: '다음 기간이 마감돼 있어 다시 열 수 없어요.',
  PERIOD_CLOSED: '마감한 기간이라 바꿀 수 없어요.',
  PERIOD_BEFORE_CLOSED: '마감한 기간이나 이월금을 받은 기간보다 앞선 날짜예요.',
  BUDGET_LINE_INVALID: '이월금 수입 항목을 다시 골라 주세요.',
  INVALID_INPUT: '입력값을 확인해 주세요.',
}
export const budgetFailure = '처리하지 못했어요. 다시 시도해 주세요.'
export const budgetMessage = (code: unknown) => typeof code === 'string' ? budgetErrors[code] ?? budgetFailure : budgetFailure
