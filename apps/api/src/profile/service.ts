import { eq } from 'drizzle-orm'
import { member, memberLogin } from '../db/schema.js'
import { ApiError } from '../http/errors.js'
import { updateRecord } from '../records/records.js'
import type { Db, Tx } from '../db/types.js'

// 로그인에 이어진 운영진의 이름. 아직 학생회를 만들거나 들어오지 않아 이어진 운영진이 없으면 null이다.
export async function myName(db: Pick<Db, 'select'>, userId: string): Promise<string | null> {
  const [row] = await db
    .select({ name: member.name })
    .from(memberLogin)
    .innerJoin(member, eq(member.id, memberLogin.memberId))
    .where(eq(memberLogin.userId, userId))
  return row?.name ?? null
}

// 내 이름 고치기: 운영진 하나의 이름이라 그 사람이 든 모든 학생회에서 바뀐다(DEC-87). 바꾼 사람은 나로 판에 남고(RULE-2),
// 같은 이름이면 판을 만들지 않는다. 운영진 행을 잠가 같은 사람의 고치기를 한 번에 하나씩 처리한다. 이어진 운영진이 없으면 404다.
export async function renameMe(tx: Tx, userId: string, name: string) {
  const [current] = await tx
    .select({ id: member.id, name: member.name })
    .from(memberLogin)
    .innerJoin(member, eq(member.id, memberLogin.memberId))
    .where(eq(memberLogin.userId, userId))
    .for('no key update', { of: member })
  if (!current) throw new ApiError('NOT_FOUND')
  if (current.name === name) return
  await updateRecord(tx, {
    kind: 'member',
    id: current.id,
    actor: current.id,
    reason: null,
    changes: { name },
  })
}
