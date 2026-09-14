import { and, eq } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import { meetingAgendas, meetingParticipants } from '../db/schema.ts'
import type { MakeMeeting } from './create-types.ts'
import type { MeetingDraft } from './create-input.ts'

/** 참가자와 안건을 통째로 갈아 끼운다. 남기면 지운 사람이 되살아난다. */
export async function replaceMeetingParts(
  db: Db,
  orgId: string,
  meetingId: string,
  read: MeetingDraft,
  make: MakeMeeting,
): Promise<void> {
  // 지울 때도 학생회를 함께 건다 — 이음매마다 울타리를 다시 세운다.
  await db
    .delete(meetingParticipants)
    .where(
      and(eq(meetingParticipants.orgId, orgId), eq(meetingParticipants.meetingId, meetingId)),
    )
  await db
    .delete(meetingAgendas)
    .where(and(eq(meetingAgendas.orgId, orgId), eq(meetingAgendas.meetingId, meetingId)))

  if (read.people.length > 0) {
    await db.insert(meetingParticipants).values(
      read.people.map((memberId) => ({ id: make.id(), orgId, meetingId, memberId })),
    )
  }
  if (read.agendas.length > 0) {
    await db.insert(meetingAgendas).values(
      read.agendas.map((agenda, at) => ({
        id: make.id(),
        orgId,
        meetingId,
        sortOrder: at,
        title: agenda.title,
        description: agenda.description,
      })),
    )
  }
}
