import { sql } from 'drizzle-orm'
import type { Actor } from '../access/actor.js'
import type { Tx } from '../db/types.js'
import { clockNow } from '../records/records.js'
import { meetingDetailOf } from './queries.js'
import { lockedMeeting } from './service.js'

export async function confirmMeeting(tx: Tx, actor: Actor, target: { id: string; now: Date }) {
  await lockedMeeting(tx, actor, target.id, 'meeting.confirm')
  // clockNow는 행마다 달라진다. 한 번 계산한 시각을 살아 있는 기록 전체에 쓴다(RULE-52).
  await tx.execute(sql`WITH t AS (SELECT ${clockNow} AS at), live_agenda AS (
    SELECT id FROM agenda_item WHERE meeting_id = ${target.id} AND cancelled_at IS NULL
  ) UPDATE record SET confirmed_by = ${actor.memberId}, confirmed_at = t.at
    FROM t WHERE record.council_id = ${actor.councilId} AND (
      record.id = ${target.id}
      OR record.id IN (SELECT id FROM live_agenda)
      OR record.id IN (
        SELECT id FROM decision WHERE origin_kind = 'agenda_item'
          AND origin_id IN (SELECT id FROM live_agenda) AND cancelled_at IS NULL
      )
    )`)
  return meetingDetailOf(tx, actor, target.id, target.now)
}
