import {
  HOME_COUNCIL_EVENT_CARDS,
  HOME_LIST_LIMIT,
  dateFromKorean,
  type EventSummary,
  type HomeBoardEventRef,
  type HomeCouncilBoard,
} from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import type { Db } from '../db/types.js'
import { nextScheduleOf } from '../events/header.js'
import { openEventCountsOf, openEventsOf, taskCountsByEvent } from '../events/queries.js'
import { settlingOf } from '../settlement/settling.js'
import { currentFinanceMembers } from '../purchases/finance-members.js'
import type { OpenTask } from '../tasks/open-tasks.js'
import { unassignedMembersOf } from './council.js'
import { followUpRowsOf } from './follow-up.js'
import { opsOf } from './ops.js'
import { opsPeopleOf } from './ops-contacts.js'
import { todoOf } from './todo.js'
import { weekOf } from './week.js'
import { eventLanesOf } from './event-lanes.js'
import type { financeBudgetOf } from './finance-budget.js'

type Reader = Pick<Db, 'select'>

// 응답의 일시는 한국 시각 글이라 행사 머리의 셈(Date를 받음)에 넘길 때 되돌린다. 분까지라 셈하는 날짜는 같다.
const dateOf = (value: string | null) => (value ? dateFromKorean(value) : null)

// 책임자를 빼고 싣는다(DEC-95).
const refOf = ({ id, name, startsAt, endsAt, status }: EventSummary): HomeBoardEventRef => ({
  id,
  name,
  startsAt,
  endsAt,
  status,
})

const tasksOfEvent = (open: OpenTask[], eventId: string) =>
  open.filter(row => row.summary.event?.id === eventId)

// 전체 행사 진행 현황: 끝나지 않은 행사 카드와 상태별 수. 업무 수·다음 일정은 행사 업무 탭·행사 머리와 같은 셈이다.
async function eventCardsOf(db: Reader, actor: Actor, now: Date, open: OpenTask[]) {
  const { events } = await openEventsOf(db, actor, now, {
    limit: HOME_COUNCIL_EVENT_CARDS,
    endedLimit: 0,
  })
  const totals = await taskCountsByEvent(
    db,
    events.map(item => item.id),
  )
  const cards = events.map(item => {
    const mine = tasksOfEvent(open, item.id)
    const total = totals.get(item.id) ?? { open: 0, total: 0 }
    return {
      event: refOf(item),
      tasks: {
        done: total.total - total.open,
        total: total.total,
        overdue: mine.filter(row => row.summary.overdue).length,
        unassigned: mine.filter(row => row.unassigned).length,
      },
      next: nextScheduleOf(mine, dateOf(item.startsAt), now),
    }
  })
  return { cards, counts: await openEventCountsOf(db, actor, now) }
}

// 후속 정리 중인 행사: 재정 '행사 정산' 탭과 같은 읽기(settlingOf)에 끝나지 않은 업무 수와 끝난 지 며칠을 붙인다.
async function followUpOf(db: Reader, actor: Actor, now: Date) {
  const { events, total } = await settlingOf(db, actor, now, HOME_LIST_LIMIT)
  return {
    events: await followUpRowsOf(db, events, now),
    total,
  }
}

// 회장단 홈(HOME-01C, DEC-95). 새로 세지 않고 원래 화면의 도우미를 부른다(DEC-69). open은 학생회 전체의 열린 업무다.
export async function councilBoardOf(
  db: Reader,
  actor: Actor,
  now: Date,
  { open, budget }: { open: OpenTask[]; budget: Awaited<ReturnType<typeof financeBudgetOf>> },
): Promise<HomeCouncilBoard> {
  const financeStaffed = (await currentFinanceMembers(db, actor, now)).length > 0
  const unassignedMembers = await unassignedMembersOf(db, actor)
  const people = await opsPeopleOf(db, actor)
  const followUp = await followUpOf(db, actor, now)
  return {
    financeStaffed,
    events: await eventCardsOf(db, actor, now, open),
    followUp,
    unassignedMembers,
    ops: await opsOf(db, actor, now, { open, people, unassignedMembers, financeStaffed }),
    todo: await todoOf(db, actor, now, { open, people, followUp }),
    week: await weekOf(db, actor, now),
    lanes: await eventLanesOf(db, actor, now, { open, budget }),
  }
}
