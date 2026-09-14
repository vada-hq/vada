import { and, eq } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import { attendanceQrs } from '../db/schema.ts'

export interface QrFacts {
  active: boolean
  opensAt: Date | null
  closesAt: Date | null
}

export async function attendanceQrOf(
  db: Db,
  orgId: string,
  eventId: string,
): Promise<QrFacts | null> {
  const rows = await db
    .select({
      active: attendanceQrs.active,
      opensAt: attendanceQrs.opensAt,
      closesAt: attendanceQrs.closesAt,
    })
    .from(attendanceQrs)
    .where(and(eq(attendanceQrs.orgId, orgId), eq(attendanceQrs.eventId, eventId)))
    .limit(1)
  return rows[0] ?? null
}
