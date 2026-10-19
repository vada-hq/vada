import { eq } from 'drizzle-orm'
import { member, memberLogin, users } from '../db/schema.js'
import { ApiError } from '../http/errors.js'
import { createRecord, type Tx } from '../records/records.js'

// 로그인 잇기(바탕 spec G1): 로그인 계정(users)과 운영진(member)을 하나씩 잇고 운영진 번호를 돌려준다.
// 이메일은 식별자가 아니다(OpenID Connect 5.7). 이어진 뒤에는 이메일이 바뀌어도 같은 Google 계정이면 같은 사람이다.
// 학생회를 만들거나 초대로 들어올 때만 부른다. 처음 잇는 운영진 기록은 시스템이 만든 것으로 둔다(만든 사람 없음).
export async function linkMember(tx: Tx, userId: string): Promise<string> {
  // 같은 계정의 잇기를 한 번에 하나씩 한다(두 탭에서 동시에 만들거나 들어올 때). 로그인 세션을 넣는 일은 막지 않는다(FOR NO KEY UPDATE).
  const [user] = await tx.select({ name: users.name, email: users.email, verified: users.emailVerified }).from(users).where(eq(users.id, userId)).for('no key update')
  if (!user) throw new Error('Session user missing')
  const [linked] = await tx.select({ memberId: memberLogin.memberId }).from(memberLogin).where(eq(memberLogin.userId, userId))
  if (linked) return linked.memberId
  const email = user.email.toLowerCase()
  // 같은 이메일의 운영진이 있고 아직 잇지 않았으면 그 운영진에 잇는다. 로그인의 이메일이 확인된 것일 때만이다(better-auth의 계정 잇기 규칙과 같다).
  const [existing] = await tx.select({ id: member.id, linkedTo: memberLogin.userId }).from(member)
    .leftJoin(memberLogin, eq(memberLogin.memberId, member.id)).where(eq(member.email, email))
  // 다른 계정에 이어진 운영진이 같은 이메일을 쓰고 있거나, 확인되지 않은 이메일로는 그 운영진을 이을 수 없다.
  // 운영진 이메일은 겹칠 수 없어(physical-model.md) 새 운영진도 만들지 못하므로 둘 다 409다.
  if (existing && (existing.linkedTo || !user.verified)) throw new ApiError('EMAIL_IN_USE', 409)
  const memberId = existing?.id ?? await createRecord(tx, { kind: 'member', councilId: null, actor: null, values: { name: user.name, email } })
  await tx.insert(memberLogin).values({ memberId, userId })
  return memberId
}
