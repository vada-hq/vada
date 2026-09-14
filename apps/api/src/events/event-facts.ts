import { and, eq } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import { departments, events, members } from '../db/schema.ts'

export interface EventFacts {
  id: string
  title: string
  status: string
  startAt: Date | null
  place: string | null
  capacityType: string
  capacityCount: number | null
  hostDepartment: string | null
  hostMember: string | null
  createdAt: Date
  updatedAt: Date
}

export async function eventFacts(
  db: Db,
  orgId: string,
  eventId: string,
): Promise<EventFacts | null> {
  const rows = await db
    .select({
      id: events.id,
      title: events.title,
      status: events.status,
      startAt: events.startAt,
      place: events.place,
      capacityType: events.capacityType,
      capacityCount: events.capacityCount,
      hostDepartment: departments.name,
      hostMember: members.name,
      createdAt: events.createdAt,
      updatedAt: events.updatedAt,
    })
    .from(events)
    .leftJoin(
      departments,
      and(eq(events.hostDepartmentId, departments.id), eq(departments.orgId, orgId)),
    )
    .leftJoin(members, and(eq(events.hostMemberId, members.id), eq(members.orgId, orgId)))
    .where(and(eq(events.orgId, orgId), eq(events.id, eventId)))
    .limit(1)
  return rows[0] ?? null
}
