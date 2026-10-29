import {
  EVENT_COLORS,
  HOME_COUNCIL_EVENT_CARDS,
  HOME_EVENT_LIMIT,
  dateFromKorean,
  type EventSummary,
  type HomeEventLane,
  type HomeEventLanes,
} from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import type { Db } from '../db/types.js'
import { registrationStatusOf } from '../registrations/state.js'
import {
  openEventCountsOf,
  openEventIdsByCreation,
  openEventsAmong,
  openEventsOf,
} from '../events/queries.js'
import type { OpenTask } from '../tasks/open-tasks.js'
import { laneFormsOf, type LaneForm } from './event-lane-forms.js'
import { milestoneOf } from './event-milestone.js'
import type { financeBudgetOf } from './finance-budget.js'

type Reader = Pick<Db, 'select'>
type Budget = Awaited<ReturnType<typeof financeBudgetOf>>

// 일정 미정은 맨 뒤
const NO_MILESTONE = Number.POSITIVE_INFINITY
const dateOf = (value: string | null) => (value ? dateFromKorean(value) : null)

// 신청: 받는 중·정원 참인 양식 가운데 마감이 가장 이른 것(상태는 양식 화면과 같은 registrationStatusOf)
function registrationOf(forms: LaneForm[], now: Date): HomeEventLane['registration'] {
  const live = forms
    .map(form => ({
      form,
      status: registrationStatusOf(
        { ...form, applicantCount: form.count, eventCompleted: false },
        now,
      ),
    }))
    .filter(({ status }) => status === 'open' || status === 'full')
    // 받는 중·정원 참은 멈추지 않은 양식이라 마감이 있다(DB CHECK).
    .sort((a, b) => a.form.closesAt!.getTime() - b.form.closesAt!.getTime())
  const [first] = live
  if (!first) return null
  const { form } = first
  return {
    formId: form.id,
    count: form.count,
    capacity: form.capacity,
    full: first.status === 'full',
  }
}

// 늦은 부서: 이 행사의 지난 업무를 부서로 묶는다(부서 없음 = 학생회 업무). 지남 많은 순 → 이름순.
function lateOf(open: OpenTask[], eventId: string): HomeEventLane['late'] {
  const groups = new Map<string, HomeEventLane['late'][number]>()
  for (const { summary } of open) {
    if (summary.event?.id !== eventId || !summary.overdue) continue
    const key = summary.department?.id ?? ''
    const group = groups.get(key) ?? { department: summary.department, overdue: 0 }
    group.overdue += 1
    groups.set(key, group)
  }
  return [...groups.values()].sort(
    (a, b) =>
      b.overdue - a.overdue || (a.department?.name ?? '').localeCompare(b.department?.name ?? ''),
  )
}

// 예산: 회계 기간이 없으면 싣지 않는다(정할 수도 없다). 지출 예산 항목이 없으면 미정, 사용 가능이 음수면 초과.
function budgetOf(budget: Budget, eventId: string): HomeEventLane['budget'] {
  if (budget.summary.overview === null) return null
  if (budget.summary.missing.some(row => row.id === eventId)) return { kind: 'undecided' }
  const entered = budget.entered.find(row => row.event.id === eventId)
  return entered && entered.available < 0 ? { kind: 'over', amount: -entered.available } : null
}

// 행사 색 고정 규칙(시연 동안, 저장 없음): 완료하지 않은 행사를 만든 차례로 팔레트를 돌려 쓴다.
// 열린 행사가 여섯 이하면 겹치지 않는다. id 해시는 셋 가운데 둘이 겹칠 확률이 약 44%라 쓰지 않는다(c2-final).
async function colorsOf(db: Reader, actor: Actor) {
  const ids = await openEventIdsByCreation(db, actor)
  return new Map(ids.map((id, index) => [id, EVENT_COLORS[index % EVENT_COLORS.length]!]))
}

function laneOf(
  event: EventSummary,
  context: {
    forms: LaneForm[]
    open: OpenTask[]
    budget: Budget
    color: HomeEventLane['event']['color']
    now: Date
  },
): HomeEventLane {
  const forms = context.forms.filter(form => form.eventId === event.id)
  return {
    event: {
      id: event.id,
      name: event.name,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      status: event.status,
      color: context.color,
    },
    milestone: milestoneOf(
      {
        startsAt: dateOf(event.startsAt),
        endsAt: dateOf(event.endsAt),
        ongoing: event.status === 'ongoing',
        forms: forms.filter(form => !form.paused),
      },
      context.now,
    ),
    registration: registrationOf(forms, context.now),
    undecided: event.place === null ? ['place'] : [],
    late: lateOf(context.open, event.id),
    budget: budgetOf(context.budget, event.id),
  }
}

// 고를 행사와 끝나지 않은 행사 수. eventIds가 있으면(부장 홈: 우리 부서가 맡은 행사) 그 가운데 끝나지 않은 것만이다.
async function candidatesOf(db: Reader, actor: Actor, now: Date, eventIds?: string[]) {
  if (eventIds) {
    const among = (await openEventsAmong(db, actor, now, eventIds)).filter(
      row => row.status !== 'ended',
    )
    return { events: among.slice(0, HOME_EVENT_LIMIT), total: among.length }
  }
  const { events } = await openEventsOf(db, actor, now, { limit: HOME_EVENT_LIMIT, endedLimit: 0 })
  const counts = await openEventCountsOf(db, actor, now)
  return { events, total: counts.planning + counts.ongoing }
}

// ② 행사: 끝나지 않은 행사(진행 중·예정·날짜 미정)를 HOME_EVENT_LIMIT개까지 읽어 다음 일정이 가까운 순으로 셋을 고른다.
// 일정 미정은 맨 뒤이고, 같은 자리는 행사 목록 차례(진행 중 → 예정 → 미정)를 지킨다.
// 부장 홈은 open을 우리 부서 업무로, eventIds를 우리 부서가 맡은 행사로 좁혀 준다(늦은 부서도 우리 부서만).
export async function eventLanesOf(
  db: Reader,
  actor: Actor,
  now: Date,
  input: { open: OpenTask[]; budget: Budget; eventIds?: string[] },
): Promise<HomeEventLanes> {
  const { events, total } = await candidatesOf(db, actor, now, input.eventIds)
  const forms = await laneFormsOf(
    db,
    actor,
    events.map(event => event.id),
  )
  const colors = await colorsOf(db, actor)
  const lanes = events.map(event =>
    laneOf(event, {
      forms,
      open: input.open,
      budget: input.budget,
      color: colors.get(event.id) ?? EVENT_COLORS[0],
      now,
    }),
  )
  // 정렬은 안정이라 같은 날은 행사 목록 차례가 남는다.
  const sorted = lanes.sort(
    (a, b) => (a.milestone?.days ?? NO_MILESTONE) - (b.milestone?.days ?? NO_MILESTONE),
  )
  return { events: sorted.slice(0, HOME_COUNCIL_EVENT_CARDS), total }
}
