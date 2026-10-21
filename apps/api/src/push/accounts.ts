import { inArray } from 'drizzle-orm'
import { memberLogin } from '../db/schema.js'
import type { Db } from '../db/types.js'

// 사람 번호 → 로그인 계정. 한 사람이 계정을 여럿 가질 수 있다. 알림을 보내는 쪽(대화, 업무)이 같이 쓴다.
export async function loginAccountsOf(db: Db, memberIds: string[]) {
  if (!memberIds.length) return []
  return db
    .select({ memberId: memberLogin.memberId, userId: memberLogin.userId })
    .from(memberLogin)
    .where(inArray(memberLogin.memberId, memberIds))
}
