import {
  HOME_COUNCIL_EVENT_CARDS,
  HOME_LIST_LIMIT,
  dateFromKorean,
  type EventSummary,
  type HomeAttention,
  type HomeBoardEventRef,
  type HomeCouncilBoard,
} from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import type { Db } from '../db/types.js'
import { endedDaysOf, nextScheduleOf } from '../events/header.js'
import { openEventCountsOf, openEventsOf, taskCountsByEvent } from '../events/queries.js'
import { settlingOf } from '../settlement/settling.js'
import type { OpenTask } from '../tasks/open-tasks.js'
import { unassignedMembersOf } from './council.js'

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
  const counts = await taskCountsByEvent(
    db,
    events.map(row => row.event.id),
  )
  return {
    events: events.map(({ event, settlement }) => ({
      event: refOf(event),
      endedDays: endedDaysOf(
        { startsAt: dateOf(event.startsAt), endsAt: dateOf(event.endsAt) },
        now,
      ),
      remaining: { tasks: counts.get(event.id)?.open ?? 0, settlement: settlement.remaining },
    })),
    total,
  }
}

// 확인이 필요한 운영 상황: 지남(마감 순) → 담당자 없음(마감 순). 열린 업무는 마감 순으로 읽어 왔다.
// 지남이면서 담당자 없는 업무는 지남에 한 번만 둔다(업무 화면의 두 칩을 합친 수와 같다).
function attentionOf(open: OpenTask[]) {
  const items: HomeAttention[] = [
    ...open
      .filter(row => row.summary.overdue)
      .map(row => ({ task: row.summary, reason: 'overdue' as const })),
    ...open
      .filter(row => row.unassigned && !row.summary.overdue)
      .map(row => ({ task: row.summary, reason: 'unassigned' as const })),
  ]
  return { items: items.slice(0, HOME_LIST_LIMIT), total: items.length }
}

// 회장단 홈(HOME-01C, DEC-95). 새로 세지 않고 원래 화면의 도우미를 부른다(DEC-69). open은 학생회 전체의 열린 업무다.
export async function councilBoardOf(
  db: Reader,
  actor: Actor,
  now: Date,
  open: OpenTask[],
): Promise<HomeCouncilBoard> {
  return {
    events: await eventCardsOf(db, actor, now, open),
    followUp: await followUpOf(db, actor, now),
    attention: attentionOf(open),
    unassignedMembers: await unassignedMembersOf(db, actor),
  }
}
