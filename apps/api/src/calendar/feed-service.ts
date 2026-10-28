import { createHash, randomBytes } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import type { Actor } from '../access/actor.js'
import { calendarFeed } from '../db/schema.js'
import type { Tx } from '../db/types.js'

const TOKEN_BYTES = 32
export type FeedOptions = { trustedOrigin: string; clock?: () => Date }
export const feedHash = (token: string) => createHash('sha256').update(token).digest('hex')
const ownFeed = (actor: Actor) =>
  and(eq(calendarFeed.memberId, actor.memberId), eq(calendarFeed.councilId, actor.councilId))

export async function feedOf(tx: Tx, actor: Actor) {
  const [row] = await tx
    .select({ createdAt: calendarFeed.createdAt })
    .from(calendarFeed)
    .where(ownFeed(actor))
  return { feed: row ? { createdAt: row.createdAt.toISOString() } : null }
}

export async function replaceFeed(
  tx: Tx,
  actor: Actor,
  options: { now: Date; trustedOrigin: string },
) {
  const token = randomBytes(TOKEN_BYTES).toString('base64url')
  const createdAt = options.now
  const tokenHash = feedHash(token)
  await tx
    .insert(calendarFeed)
    .values({ memberId: actor.memberId, councilId: actor.councilId, tokenHash, createdAt })
    .onConflictDoUpdate({
      target: [calendarFeed.memberId, calendarFeed.councilId],
      set: { tokenHash, createdAt },
    })
  return {
    feed: { createdAt: createdAt.toISOString() },
    url: new URL(`/api/public/calendar/${token}.ics`, options.trustedOrigin).href,
  }
}

export async function deleteFeed(tx: Tx, actor: Actor) {
  await tx.delete(calendarFeed).where(ownFeed(actor))
  return { feed: null }
}
