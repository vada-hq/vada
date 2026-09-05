import { and, eq, inArray, sql } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import { events, meetingParticipants, meetings } from '../db/schema.ts'
import { orNote, STATUS } from '../meetings/meetings.ts'
import { NotFound } from '../routes.ts'
import { day, weekdayStamp } from '../time.ts'

// 행사에 걸린 회의(EVT-MEET-01).
//
// **회의 전체 목록과 다른 것이다** — 저쪽(`meeting.groups`)은 행사별로 묶어 오고
// 카드에 담기는 조각도 더 많다. 여기는 한 행사의 회의만 줄로 온다.
//
// **단계의 말과 색은 회의 쪽에서 가져온다.** 같은 회의가 이 화면에서는 '예정'이고
// 저 화면에서는 다른 말이면, 같은 사실이 화면마다 다르게 읽힌다 — 업무가 `labels.ts`
// 하나를 네 화면이 나눠 쓰는 것과 같은 까닭이다.

/**
 * 이 목록이 세고 그리는 단계 넷. **차례가 곧 그리는 차례다.**
 *
 * `draft`는 아직 아무에게도 알리지 않은 회의라 없고(회의 목록도 뺀다), `cancelled`도
 * 없다 — 머리에 붙는 건수를 그림이 **이 넷으로** 그렸고(`진행 중 · 예정 · 정리 중 ·
 * 완료`), 목록이 세는 것과 그리는 것이 어긋나면 머리와 몸이 다른 말을 한다.
 * 취소된 회의는 전체 회의 목록에 그대로 있다(이 화면의 '전체 회의 보기'가 거기다).
 */
const LISTED = ['inProgress', 'scheduled', 'wrapUp', 'done'] as const

type Listed = (typeof LISTED)[number]

/** 이 학생회의 그 행사인가. */
async function eventOf(db: Db, orgId: string, eventId: string): Promise<boolean> {
  const rows = await db
    .select({ id: events.id })
    .from(events)
    .where(and(eq(events.orgId, orgId), eq(events.id, eventId)))
    .limit(1)
  return rows.length > 0
}

function rowsOf(db: Db, orgId: string, eventId: string) {
  return db
    .select({
      id: meetings.id,
      title: meetings.title,
      status: meetings.status,
      scheduledAt: meetings.scheduledAt,
      place: meetings.place,
    })
    .from(meetings)
    .where(
      and(
        eq(meetings.orgId, orgId),
        eq(meetings.eventId, eventId),
        inArray(meetings.status, [...LISTED]),
      ),
    )
}

/** 목록의 차례: 단계가 먼저, 그 안에서는 이른 것부터. 때가 없으면 뒤로 간다. */
function orderKey(row: { status: string; scheduledAt: Date | null; title: string }): string {
  const rank = LISTED.indexOf(row.status as Listed)
  return `${rank}${row.scheduledAt === null ? '9' : '0'}${row.scheduledAt?.toISOString() ?? ''}${row.title}`
}

export interface MeetingCounts {
  countsNote: string
}

/**
 * 묶음의 머리에 붙는 건수(EVT-MEET-01).
 *
 * **0건도 말한다.** 빠뜨리면 줄의 길이가 행사마다 달라지고, 없는 단계와 세지 않은
 * 단계를 사람이 가릴 수 없다.
 */
export async function eventMeetingCounts(
  db: Db,
  orgId: string,
  eventId: string,
): Promise<MeetingCounts> {
  if (!(await eventOf(db, orgId, eventId))) throw new NotFound('그 행사를 찾지 못했습니다')
  const rows = await rowsOf(db, orgId, eventId)
  const counted = new Map<string, number>()
  for (const row of rows) counted.set(row.status, (counted.get(row.status) ?? 0) + 1)
  return {
    countsNote: LISTED.map(
      (status) => `${STATUS[status].label} ${counted.get(status) ?? 0}건`,
    ).join(' · '),
  }
}

export interface EventMeetingRow {
  id: string
  status: string
  statusTone: string
  kindLabel: string
  title: string
  startAt: string
  place: string
  attendanceNote: string
}

/**
 * 이 행사에 연결된 회의(EVT-MEET-01).
 *
 * **계약이 이 자리에 '없다'를 두지 않았다**(응답 목록에 404가 없다). 그래서 남의
 * 학생회 행사를 물으면 거르고 남은 것이 없다고 답한다 — 없는 값을 지어내는 것이
 * 아니라, 우리 것 중에 그런 것이 없다는 사실이다.
 */
export async function eventMeetings(
  db: Db,
  orgId: string,
  eventId: string,
): Promise<EventMeetingRow[]> {
  const rows = (await rowsOf(db, orgId, eventId)).sort((left, right) =>
    orderKey(left).localeCompare(orderKey(right)),
  )
  const seen = await attendanceOf(
    db,
    orgId,
    rows.map((row) => row.id),
  )

  return rows.map((row) => {
    const status = STATUS[row.status as Listed]
    const counted = seen.get(row.id) ?? { total: 0, present: 0 }
    return {
      id: row.id,
      status: status.label,
      statusTone: status.tone,
      // 지금은 전부 행사에 매인 회의이지만 **화면이 지어낼 말이 아니다.**
      kindLabel: '행사 연결 회의',
      title: row.title,
      // 요일까지 붙는다. 시간대를 아는 자리는 `time.ts` 하나뿐이라 거기서 온 것만 잇는다.
      startAt: row.scheduledAt === null ? '일시 미정' : weekdayMoment(row.scheduledAt),
      place: orNote(row.place, '미정'),
      attendanceNote: attendanceNote(row.status as Listed, counted),
    }
  })
}

/** `2026. 07. 18 (토) 10:00` — 날짜와 요일이 함께 붙는 이 화면의 꼴. */
function weekdayMoment(when: Date): string {
  // `weekdayStamp`는 `07.18 (토) 10:00`이다. 앞의 날짜만 긴 꼴로 바꿔 단다 —
  // 요일과 시간대를 아는 것은 `time.ts`뿐이므로 그것이 만든 글에서 가져온다.
  return `${day(when)} ${weekdayStamp(when).replace(/^\d{2}\.\d{2} /, '')}`
}

/**
 * 참가 인원.
 *
 * **끝났는지에 따라 세는 말이 다르다** — 계약이 그 셋을 예로 들었다(`참가 8명` ·
 * `참가 예정 4명` · `참석 6명`). 끝난 회의는 실제로 온 사람을 세고, 아직 안 한
 * 회의는 오기로 한 사람을 센다. 화면이 그것을 유도할 수 없다.
 */
function attendanceNote(status: Listed, counted: { total: number; present: number }): string {
  if (status === 'done' || status === 'wrapUp') return `참석 ${counted.present}명`
  if (status === 'inProgress') return `참가 ${counted.total}명`
  return `참가 예정 ${counted.total}명`
}

async function attendanceOf(
  db: Db,
  orgId: string,
  ids: string[],
): Promise<Map<string, { total: number; present: number }>> {
  if (ids.length === 0) return new Map()
  const rows = await db
    .select({
      meetingId: meetingParticipants.meetingId,
      total: sql<number>`count(*)::int`,
      present: sql<number>`count(*) filter (where ${meetingParticipants.attendance} = 'present')::int`,
    })
    .from(meetingParticipants)
    .where(
      and(
        eq(meetingParticipants.orgId, orgId),
        inArray(meetingParticipants.meetingId, ids),
      ),
    )
    .groupBy(meetingParticipants.meetingId)
  return new Map(
    rows.map((row) => [row.meetingId, { total: Number(row.total), present: Number(row.present) }]),
  )
}
