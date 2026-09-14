import { and, eq, isNull, sql } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import { paymentDocuments } from '../db/schema.ts'

export async function missingProofCount(db: Db, orgId: string): Promise<number> {
  const rows = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(paymentDocuments)
    .where(and(eq(paymentDocuments.orgId, orgId), isNull(paymentDocuments.registeredAt)))
  return Number(rows[0]?.total ?? 0)
}
