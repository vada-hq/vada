import { and, asc, gt, gte, isNull, lt } from 'drizzle-orm'
import { HOME_WEEK_ROWS, koreanOf, type HomeWeek, type HomeWeekItem } from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { meeting, record } from '../db/schema.js'
import type { Db } from '../db/types.js'
import { factsOf, meetingRowsOf } from '../meetings/queries.js'
import { actionsOf } from '../meetings/policy.js'
import { rangeOf, schedulesOf } from './upcoming.js'

type Reader = Pick<Db, 'select'>
type Range = ReturnType<typeof rangeOf>
// 'YYYY-MM-DDTHH:mm'의 날짜 길이
const DATE_LENGTH = 10

// 다음 회의: 시작이 오늘~7일째이고 끝나지 않았으며 취소·확정 전인 회의 가운데 가장 이른 하나.
// 회장단은 모든 회의를 다루므로 관계로 거를 수 없어, 학생회 회의(주관 부서 없음)이거나 내가 참가자·만든 사람인 것만 둔다.
async function nextMeetingOf(db: Reader, actor: Actor, now: Date, range: Range) {
  const rows = await meetingRowsOf(
    db,
    actor,
    and(
      isNull(meeting.cancelledAt),
      isNull(record.confirmedAt),
      gt(meeting.endsAt, now),
      gte(meeting.heldAt, range.from),
      lt(meeting.heldAt, range.until),
    ),
  ).orderBy(asc(meeting.heldAt), asc(meeting.id))
  const row = rows.find(
    item =>
      item.meeting.hostDepartmentId === null ||
      item.isAttendee ||
      item.createdBy === actor.memberId,
  )
  if (!row) return null
  const heldAt = koreanOf(row.meeting.heldAt)
  const item: HomeWeekItem = {
    kind: 'meeting',
    meeting: {
      id: row.meeting.id,
      title: row.meeting.title,
      heldAt,
      agendaCount: row.agendaCount,
      actions: actionsOf(actor, factsOf(row)),
    },
  }
  return { date: heldAt.slice(0, DATE_LENGTH), at: row.meeting.heldAt, item }
}

// 외부·마감 일정: 가까운 일정과 같은 원천·범위(읽을 수 있는 일정 모두, DEC-102)에서 두 종류만 남긴다.
async function weekSchedulesOf(db: Reader, actor: Actor, range: Range) {
  return (await schedulesOf(db, actor, range)).flatMap(({ at, item }) => {
    if (item.kind !== 'schedule_item') return []
    const { type } = item.item
    if (type !== 'external' && type !== 'deadline') return []
    const entry: HomeWeekItem = {
      kind: 'schedule',
      item: { ...item.item, type },
      date: item.date,
      time: item.time,
    }
    return [{ date: item.date, at, item: entry }]
  })
}

type Entry = { date: string; at: Date | null; item: HomeWeekItem }
// 날짜순, 같은 날은 종일이 먼저(가까운 일정의 byWhen과 같다)
const byWhen = (a: Entry, b: Entry) =>
  a.date.localeCompare(b.date) || (a.at?.getTime() ?? 0) - (b.at?.getTime() ?? 0)

// ⑤ 이번 주. 줄이 넘치면 회의 줄은 남기고 일정을 날짜순으로 채운다.
export async function weekOf(db: Reader, actor: Actor, now: Date): Promise<HomeWeek> {
  const range = rangeOf(now)
  const next = await nextMeetingOf(db, actor, now, range)
  const schedules = (await weekSchedulesOf(db, actor, range)).sort(byWhen)
  const kept = schedules.slice(0, HOME_WEEK_ROWS - (next ? 1 : 0))
  return {
    items: [...kept, ...(next ? [next] : [])].sort(byWhen).map(entry => entry.item),
    total: schedules.length + (next ? 1 : 0),
  }
}
