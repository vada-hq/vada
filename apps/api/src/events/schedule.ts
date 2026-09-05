import { and, eq, sql } from 'drizzle-orm'
import optionSourcesJson from '../../../../specs/figma/vada-wireframe/option-sources.json' with { type: 'json' }
import type { Db } from '../db/client.ts'
import { events, meetings, members, tasks } from '../db/schema.ts'
import { STATUS as MEETING_STATUS, listed as meetingListed, orNote } from '../meetings/meetings.ts'
import { Blocked } from '../routes.ts'
import { isOverdue, NO_DUE, STATUS as TASK_STATUS, type TaskStatus } from '../tasks/labels.ts'
import { clock, day, daysBetween, dottedStamp, weekdayStamp } from '../time.ts'

// 행사 일정(EVT-SCHED-01).
//
// **원본이 아니라 비친 것이다.** 표가 없다 — `db/schema.ts` 머리가 그 까닭을 적어
// 두었고, 화면의 꼬리말이 원본 셋을 그대로 든다: "행사 일시·장소는 기본정보,
// 회의 일시는 관련 회의, 업무 마감은 행사 업무가 단일 원본입니다."
//
// 그래서 여기서 하는 일은 **모으고 줄 세우고 거르는 것**뿐이고, 줄마다 어디가
// 원본인지를 함께 말한다(originNote). 고치는 일은 그 원본에서 한다.
//
// **말은 원본의 것을 쓴다.** 업무의 단계는 `tasks/labels.ts`가, 회의의 단계는
// `meetings/meetings.ts`가 든다 — 여기서 다시 적으면 같은 업무가 보드에서는
// '진행 중'이고 일정에서는 다른 말이 된다.

export interface Now {
  now: () => Date
}

export interface ScheduleRow {
  id: string
  dateLabel: string
  tone: string
  title: string
  kindLabel: string
  kindTone: string
  description: string
  ownerNote: string
  originNote: string
}

/** 좁혀 보는 값은 **명세가 갖고 있다**(event.scheduleFilter). 두 벌을 들면 갈린다. */
const FILTERS: readonly string[] = (
  optionSourcesJson.sources.find((source) => source.key === 'event.scheduleFilter') as
    | { options: Array<{ value: string }> }
    | undefined
)?.options.map((option) => option.value) ?? []

/**
 * 줄의 갈래.
 *
 * 좁혀 보는 칩 셋(`마감`·`회의`·`행사 당일`)이 화면 꼬리말의 원본 셋과 하나씩
 * 맞물린다 — 업무 마감·관련 회의·행사 기본정보. 색은 그림이 그린 대로다:
 * 행사 당일만 파랗고 나머지는 무채색이며, 마감 딱지만 노랗다.
 */
const KIND = {
  deadline: { label: '업무', tone: 'gray', origin: '원본 · 행사 업무' },
  meeting: { label: '회의', tone: 'gray', origin: '원본 · 관련 회의' },
  eventDay: { label: '행사', tone: 'blue', origin: '원본 · 행사 기본정보' },
} as const

type Kind = keyof typeof KIND

/** 담당이 없다는 사실. **빈 자리가 아니라 배정해야 한다는 알림이다**(그림의 말 그대로). */
const NO_OWNER = '담당 · 미지정 · 배정 필요'

function ownerNote(name: string | null): string {
  return name === null || name.trim() === '' ? NO_OWNER : `담당 · ${name}`
}

/** `08. 20` — 줄 앞머리의 때. 날짜가 없는 줄은 그 사실이 말로 온다. */
function dateLabel(when: Date | null, missing: string): string {
  return when === null ? missing : day(when).slice(6)
}

/** 줄 세우는 열쇠: 이른 것이 먼저, 때가 없으면 뒤로. 행사 목록이 쓰는 규칙과 같다. */
function orderKey(when: Date | null, title: string): string {
  return `${when === null ? '9' : '0'}${when?.toISOString() ?? ''}${title}`
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'] as const

/**
 * 그 시간대에서 본 요일(0=일).
 *
 * **시간대를 아는 자리는 `time.ts` 하나뿐이다.** 요일 이름도 거기서만 나오므로,
 * 그것이 만든 글(`07.18 (토) 10:00`)에서 읽는다 — 여기서 `getDay()`를 부르면
 * 기계의 시간대로 세게 되고 한국 새벽의 일정이 전날로 밀린다.
 */
function weekdayIndex(when: Date): number {
  const found = /\((.)\)/.exec(weekdayStamp(when))
  return found === null ? -1 : WEEKDAYS.indexOf(found[1] as (typeof WEEKDAYS)[number])
}

/**
 * '이번 주'가 언제까지인가.
 *
 * **명세가 정하지 않았다.** 그림은 칩만 그렸고 무엇이 한 주인지는 적지 않았다.
 * 앞으로 이레로 잡으면 어제 지난 마감이 이번 주에서 빠지므로, **월요일에 시작해
 * 일요일에 끝나는 달력의 한 주**로 잡는다. 이 규칙은 한 자리에만 있다.
 */
function inThisWeek(when: Date | null, now: Date): boolean {
  if (when === null) return false
  const fromMonday = (weekdayIndex(now) + 6) % 7
  const gap = daysBetween(now, when)
  return gap >= -fromMonday && gap <= 6 - fromMonday
}

/**
 * 한 행사의 일정 줄들(EVT-SCHED-01).
 *
 * **거르는 것도 서버가 한다** — 받아온 것을 화면에서 거르면 명세의 params와 다른
 * 것을 구현하게 된다.
 *
 * **계약이 이 자리에 '없다'를 두지 않았다**(응답 목록에 404가 없다). 남의 학생회
 * 행사를 물으면 거르고 남은 것이 없다고 답한다.
 */
export async function eventSchedule(
  db: Db,
  orgId: string,
  eventId: string,
  filter: string | undefined,
  clockOf: Now,
): Promise<ScheduleRow[]> {
  const wanted = readFilter(filter)
  const now = clockOf.now()

  const rows: Array<{ at: Date | null; row: ScheduleRow; kind: Kind }> = [
    ...(await taskRows(db, orgId, eventId, now)),
    ...(await meetingRows(db, orgId, eventId)),
    ...(await eventRows(db, orgId, eventId)),
  ]

  return rows
    .filter((one) => {
      if (wanted === 'all') return true
      if (wanted === 'thisWeek') return inThisWeek(one.at, now)
      return one.kind === wanted
    })
    .sort((left, right) =>
      orderKey(left.at, left.row.title).localeCompare(orderKey(right.at, right.row.title)),
    )
    .map((one) => one.row)
}

/**
 * 좁혀 보는 값. **안 넘기면 좁히지 않고, 없는 값은 막는다.**
 *
 * 이 값은 화면 안의 칸에 살아서 그릇이 미리 받을 때는 아직 없다 — 그때 막으면
 * 화면이 그려지기도 전에 통째로 오류가 된다(업무 보드가 같은 자리에서 같은 규칙을
 * 쓴다). 틀리게 넘긴 것은 막는다: 그대로 넘기면 아무것도 안 걸러진 목록이 걸러진
 * 것인 줄 그려진다.
 */
function readFilter(asked: string | undefined): string {
  const wanted = (asked ?? '').trim()
  if (wanted === '') return 'all'
  if (FILTERS.includes(wanted)) return wanted
  throw new Blocked('명세에 없는 일정 거르개입니다')
}

async function taskRows(db: Db, orgId: string, eventId: string, now: Date) {
  const rows = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      description: tasks.description,
      status: tasks.status,
      dueDate: tasks.dueDate,
      assignee: members.name,
    })
    .from(tasks)
    // 이어 붙인 표도 자기 학생회를 확인한다. 벽은 두 겹이 낫다.
    .leftJoin(members, and(eq(tasks.assigneeMemberId, members.id), eq(members.orgId, orgId)))
    .where(and(eq(tasks.orgId, orgId), eq(tasks.eventId, eventId)))

  return rows.map((row) => ({
    at: row.dueDate,
    kind: 'deadline' as const,
    row: {
      id: `task:${row.id}`,
      dateLabel: dateLabel(row.dueDate, NO_DUE),
      tone: 'gray',
      title: row.title,
      kindLabel: KIND.deadline.label,
      kindTone: KIND.deadline.tone,
      // 상태가 앞에 붙고, 늦었으면 그 사실이 그다음이다. **둘은 다른 사실이다** —
      // 끝난 업무는 기한이 지나도 지연이 아니다(`labels.ts`가 그 규칙을 든다).
      description: [
        TASK_STATUS[row.status as TaskStatus].label,
        ...(isOverdue(row.dueDate, row.status as TaskStatus, now) ? ['지연'] : []),
        ...(row.description === null || row.description.trim() === '' ? [] : [row.description]),
      ].join(' · '),
      ownerNote: ownerNote(row.assignee),
      originNote: KIND.deadline.origin,
    },
  }))
}

async function meetingRows(db: Db, orgId: string, eventId: string) {
  const rows = await db
    .select({
      id: meetings.id,
      title: meetings.title,
      purpose: meetings.purpose,
      status: meetings.status,
      scheduledAt: meetings.scheduledAt,
      creator: members.name,
    })
    .from(meetings)
    .leftJoin(members, and(eq(meetings.creatorMemberId, members.id), eq(members.orgId, orgId)))
    .where(
      and(
        eq(meetings.orgId, orgId),
        eq(meetings.eventId, eventId),
        // **임시 저장한 회의는 아직 아무에게도 알리지 않은 것이다**(회의 목록도 뺀다).
        sql`${meetings.status} <> 'draft'`,
      ),
    )

  return rows.map((row) => ({
    at: row.scheduledAt,
    kind: 'meeting' as const,
    row: {
      id: `meeting:${row.id}`,
      dateLabel: dateLabel(row.scheduledAt, '일시 미정'),
      tone: 'gray',
      title: row.title,
      kindLabel: KIND.meeting.label,
      kindTone: KIND.meeting.tone,
      description: [
        meetingListed(row.status) ? MEETING_STATUS[row.status].label : row.status,
        ...(row.purpose === null || row.purpose.trim() === '' ? [] : [row.purpose]),
      ].join(' · '),
      ownerNote: ownerNote(row.creator),
      originNote: KIND.meeting.origin,
    },
  }))
}

/**
 * 행사 그 자체가 놓이는 한 줄.
 *
 * **행사 당일만 도드라진다** — 무엇이 기준이 되는 일정인지는 조직 운영이 정하므로
 * 색도 데이터가 갖는다고 계약이 적었다. 지금 그 기준은 행사 당일 하나다.
 */
async function eventRows(db: Db, orgId: string, eventId: string) {
  const rows = await db
    .select({
      id: events.id,
      title: events.title,
      startAt: events.startAt,
      endAt: events.endAt,
      place: events.place,
      host: members.name,
    })
    .from(events)
    .leftJoin(members, and(eq(events.hostMemberId, members.id), eq(members.orgId, orgId)))
    .where(and(eq(events.orgId, orgId), eq(events.id, eventId)))
    .limit(1)

  return rows.map((row) => ({
    at: row.startAt,
    kind: 'eventDay' as const,
    row: {
      id: `event:${row.id}`,
      dateLabel: dateLabel(row.startAt, '일시 미정'),
      tone: KIND.eventDay.tone,
      title: row.title,
      kindLabel: KIND.eventDay.label,
      kindTone: KIND.eventDay.tone,
      description: [
        row.startAt === null
          ? '일시 미정'
          : `${dottedStamp(row.startAt)}${row.endAt === null ? '' : ` ~ ${clock(row.endAt)}`}`,
        orNote(row.place, '장소 미정'),
      ].join(' · '),
      ownerNote: ownerNote(row.host),
      originNote: KIND.eventDay.origin,
    },
  }))
}
