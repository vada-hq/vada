import { eq } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import { users } from '../db/schema.ts'
import { Blocked } from '../errors.ts'

/**
 * 회장 줄에 적을 이름.
 *
 * **모르면 만들지 않는다.** 소셜 로그인이 이름을 주지 않은 계정이 있을 수 있고,
 * 그때 이메일이나 빈 글을 넣으면 조직도에 그것이 사람 이름으로 그려진다.
 */
export async function founderName(db: Db, userId: string): Promise<string> {
  const rows = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
  const name = rows[0]?.name?.trim() ?? ''
  if (name === '') {
    throw new Blocked('계정에 이름이 없어 회장으로 등록할 수 없습니다')
  }
  return name
}
