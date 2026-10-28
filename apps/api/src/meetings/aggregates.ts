import { sql } from 'drizzle-orm'
import { meeting, record } from '../db/schema.js'

export const currentVersionOf = (id: typeof record.id | typeof meeting.id) =>
  sql<number>`(select v.version_no from record_version v where v.record_id = ${id} and upper_inf(v.valid))`.mapWith(
    Number,
  )

// 목록 SELECT 안에서 세어 회의마다 추가 조회하거나 참가자·안건 결합으로 수가 곱해지지 않게 한다.
export function aggregatesOf(memberId: string) {
  return {
    attendeeCount:
      sql<number>`(select count(*) from meeting_attendee ma where ma.meeting_id = ${meeting.id})`.mapWith(
        Number,
      ),
    isAttendee: sql<boolean>`exists(select 1 from meeting_attendee ma where ma.meeting_id = ${meeting.id} and ma.member_id = ${memberId}::uuid)`,
    agendaCount:
      sql<number>`(select count(*) from agenda_item ai where ai.meeting_id = ${meeting.id} and ai.cancelled_at is null)`.mapWith(
        Number,
      ),
    hasNotes: sql<boolean>`exists(select 1 from agenda_item ai where ai.meeting_id = ${meeting.id} and ai.cancelled_at is null and nullif(btrim(ai.notes), '') is not null)`,
    hasTasks: sql<boolean>`exists(select 1 from task t join agenda_item ai on ai.id = t.origin_id where ai.meeting_id = ${meeting.id} and t.origin_kind = 'agenda_item' and t.cancelled_at is null)`,
  }
}
