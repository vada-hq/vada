import { and, eq, isNull, sql, type SQL } from 'drizzle-orm'
import type { PgTable } from 'drizzle-orm/pg-core'
import type { Db } from '../db/client.ts'
import { events, meetings, members, tasks } from '../db/schema.ts'
import { NotFound } from '../routes.ts'
import { daysBetween } from '../time.ts'
// **이번 주가 어디서 시작하는지는 달력이 안다**(OPS-CAL-01의 머리가 '일 월 화 수 목
// 금 토'다). 여기 한 벌을 더 두면 한쪽만 고쳐지는 날 같은 주가 두 주가 된다.
import { sinceSunday } from './calendar.ts'

// 운영 공간의 첫 화면(OPS-00).
//
// **회의가 아니라 운영 공간의 것이다.** 여기서 세는 것은 업무·회의·행사·마감을
// 가로지르므로 어느 한 영역의 자리에 두면 그 영역이 남의 표를 읽게 된다.
//
// **공간 넷은 제품이 정한 고정 구조라 명세가 갖는다**(OPS-00의 카드 넷). 서버가
// 주는 것은 그 카드에 곁들이는 **건수**뿐이다.

export interface OpsIntro {
  description: string
}

/**
 * 운영 허브의 안내 문장(`ops.intro`).
 *
 * **보는 사람의 이름이 들어가므로 서버가 완성해서 준다.** 화면이 이름과 문장을
 * 이으면 그 잇는 방법이 화면의 것이 된다.
 */
export async function opsIntro(db: Db, orgId: string, memberId: string): Promise<OpsIntro> {
  const rows = await db
    .select({ name: members.name })
    .from(members)
    .where(and(eq(members.orgId, orgId), eq(members.id, memberId)))
    .limit(1)
  const row = rows[0]
  if (row === undefined) throw new NotFound('이 학생회의 구성원이 아닙니다')
  return {
    description:
      `${row.name}님이 확인할 업무·회의·행사·일정을 선택하세요. ` +
      '각 공간에서 역할과 참여 관계에 맞는 다음 행동을 제공합니다.',
  }
}

export interface OpsSpaceStats {
  taskInProgress: number
  taskReview: number
  meetingToday: number
  meetingCleanup: number
  eventInProgress: number
  eventPlanning: number
  calendarThisWeek: number
  calendarUpcoming: number
}

/** 한 줄짜리 셈. 세는 자리가 여럿이라 세는 말을 한 번만 적는다. */
async function countOf(db: Db, from: PgTable, where: SQL | undefined): Promise<number> {
  const rows = await db.select({ total: sql<number>`count(*)::int` }).from(from).where(where)
  return Number(rows[0]?.total ?? 0)
}

/**
 * 공간 넷이 곁들이는 건수(`ops.spaceStats`).
 *
 * **'상시 업무'는 행사에 안 걸린 업무다**(TASK-01이 보는 것). 행사 업무를 함께 세면
 * 업무 공간과 행사 공간이 같은 수를 그린다.
 *
 * **'마감'은 완료되지 않은 업무의 기한이다** — OPS-CAL-01이 달력 곁에 '마감은
 * 완료되지 않은 업무 기준'이라 적어 두었다. 상시 업무와 행사 업무를 함께 센다:
 * 달력은 학생회의 일정을 한곳에 모으는 자리라 어느 공간의 것인지를 가르지 않는다.
 *
 * **'이번 주'와 '다가오는'은 같은 자를 나눠 쓴다.** 이번 주에 걸린 마감과 그 뒤에
 * 오는 마감이고, 이미 지난 기한은 둘 다 아니다 — 다가오는 것이 아니기 때문이다.
 */
export async function opsSpaceStats(db: Db, orgId: string, now: Date): Promise<OpsSpaceStats> {
  const ours = eq(tasks.orgId, orgId)
  const [taskInProgress, taskReview] = await Promise.all([
    countOf(db, tasks, and(ours, isNull(tasks.eventId), eq(tasks.status, 'inProgress'))),
    countOf(db, tasks, and(ours, isNull(tasks.eventId), eq(tasks.status, 'review'))),
  ])
  const [eventInProgress, eventPlanning] = await Promise.all([
    countOf(db, events, and(eq(events.orgId, orgId), eq(events.status, 'inProgress'))),
    countOf(db, events, and(eq(events.orgId, orgId), eq(events.status, 'planning'))),
  ])
  const meetingCleanup = await countOf(
    db,
    meetings,
    and(eq(meetings.orgId, orgId), eq(meetings.status, 'wrapUp')),
  )

  // **오늘인지는 시간대가 정한다.** 저장소에 물으면 시간대 이름이 여기 또 적힌다 —
  // 날 수를 세는 일은 `time.ts` 하나가 든다.
  const scheduled = await db
    .select({ status: meetings.status, scheduledAt: meetings.scheduledAt })
    .from(meetings)
    .where(eq(meetings.orgId, orgId))
  const meetingToday = scheduled.filter(
    (one) =>
      one.scheduledAt !== null &&
      // 임시 저장한 회의는 아직 아무에게도 알리지 않은 것이고, 취소한 회의는
      // 예정이 아니다. 목록(`meeting.groups`)이 초안을 빼는 것과 같은 규칙이다.
      one.status !== 'draft' &&
      one.status !== 'cancelled' &&
      daysBetween(now, one.scheduledAt) === 0,
  ).length

  const due = await db
    .select({ status: tasks.status, dueDate: tasks.dueDate })
    .from(tasks)
    .where(eq(tasks.orgId, orgId))
  const start = -sinceSunday(now)
  const end = 6 + start
  const days = due
    .filter((one) => one.dueDate !== null && one.status !== 'done')
    .map((one) => daysBetween(now, one.dueDate!))

  return {
    taskInProgress,
    taskReview,
    meetingToday,
    meetingCleanup,
    eventInProgress,
    eventPlanning,
    calendarThisWeek: days.filter((at) => at >= start && at <= end).length,
    calendarUpcoming: days.filter((at) => at > end).length,
  }
}
