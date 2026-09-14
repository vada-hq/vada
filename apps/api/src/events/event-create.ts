import type { Db } from '../db/client.ts'
import { events } from '../db/schema.ts'
import { Blocked } from '../errors.ts'

export async function createEvent(
  db: Db,
  orgId: string,
  draft: { title?: unknown },
  make: { id: () => string; now: () => Date },
): Promise<{ id: string }> {
  const title = typeof draft.title === 'string' ? draft.title.trim() : ''
  if (title === '') throw new Blocked('행사명을 적어 주세요')
  const id = make.id()
  const at = make.now()
  await db.insert(events).values({ id, orgId, title, createdAt: at, updatedAt: at })
  return { id }
}
