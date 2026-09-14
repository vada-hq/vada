import { and, eq, inArray } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import { members } from '../db/schema.ts'
import { Blocked } from '../errors.ts'
import { stillHere } from '../org/membership.ts'

export interface Ids {
  newId: () => string
}

/** 몸통의 글 한 칸. 없거나 글이 아니면 빈 글이다 — 빈 것을 어떻게 볼지는 부르는 쪽이 정한다. */
export function staffWordOf(draft: Record<string, unknown>, key: string): string {
  const value = draft[key]
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * 전부 이 학생회의 구성원인가.
 *
 * 남의 학생회 사람은 이 조직에 들 수 없다 — 표도 막지만(복합 외래 키) 표가 막으면
 * 500이고, 여기서 막으면 무엇이 잘못됐는지 말할 수 있다.
 */
export async function assertStaffMembers(db: Db, orgId: string, ids: readonly string[]): Promise<void> {
  const wanted = [...new Set(ids)]
  if (wanted.length === 0) return
  const rows = await db
    .select({ id: members.id })
    .from(members)
    .where(and(eq(members.orgId, orgId), stillHere, inArray(members.id, wanted)))
  const known = new Set(rows.map((row) => row.id))
  if (wanted.some((id) => !known.has(id))) {
    throw new Blocked('이 학생회의 구성원이 아닌 사람이 있습니다')
  }
}
