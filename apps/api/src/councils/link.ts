import { eq } from 'drizzle-orm'
import { member, memberLogin, users } from '../db/schema.js'
import { ApiError } from '../http/errors.js'
import { createRecord, updateRecord } from '../records/records.js'
import type { Tx } from '../db/types.js'

// 로그인 잇기(바탕 spec G1): 로그인 계정(users)과 운영진(member)을 하나씩 잇고 운영진 번호를 돌려준다.
// 이메일은 식별자가 아니다(OpenID Connect 5.7). 이어진 뒤에는 이메일이 바뀌어도 같은 Google 계정이면 같은 사람이다.
// 학생회를 만들거나 초대로 들어올 때만 부른다. 처음 잇는 운영진 기록은 시스템이 만든 것으로 둔다(만든 사람 없음).
// memberName(만들기와 들어오기의 '내 이름')은 처음 이을 때만 쓴다: 새 운영진의 이름이 되고, 같은 이메일의 운영진에 이으면 그 이름으로 바꾼다.
// 이미 이어졌으면 무시한다. 이름은 학생회마다가 아니라 운영진 하나라서 뒤에 고치는 길은 내 이름 고치기(profile)다(DEC-87).
export async function linkMember(tx: Tx, userId: string, memberName?: string): Promise<string> {
  // 같은 계정의 잇기를 한 번에 하나씩 한다(두 탭에서 동시에 만들거나 들어올 때). 로그인 세션을 넣는 일은 막지 않는다(FOR NO KEY UPDATE).
  const [user] = await tx
    .select({ name: users.name, email: users.email, verified: users.emailVerified })
    .from(users)
    .where(eq(users.id, userId))
    .for('no key update')
  // 계정 행을 기다린 사이 탈퇴가 계정을 지웠으면 로그인하지 않은 요청과 같다(withdrawal/service.ts).
  if (!user) throw new ApiError('UNAUTHENTICATED')
  const [linked] = await tx
    .select({ memberId: memberLogin.memberId })
    .from(memberLogin)
    .where(eq(memberLogin.userId, userId))
  if (linked) return linked.memberId
  const email = user.email.toLowerCase()
  // 같은 이메일의 운영진이 있고 아직 잇지 않았으면 그 운영진에 잇는다. 로그인의 이메일이 확인된 것일 때만이다(better-auth의 계정 잇기 규칙과 같다).
  const [existing] = await tx
    .select({ id: member.id, name: member.name, linkedTo: memberLogin.userId })
    .from(member)
    .leftJoin(memberLogin, eq(memberLogin.memberId, member.id))
    .where(eq(member.email, email))
  // 다른 계정에 이어진 운영진이 같은 이메일을 쓰고 있거나, 확인되지 않은 이메일로는 그 운영진을 이을 수 없다.
  // 운영진 이메일은 겹칠 수 없어(마이그레이션의 UNIQUE) 새 운영진도 만들지 못하므로 둘 다 409다.
  if (existing && (existing.linkedTo || !user.verified)) throw new ApiError('EMAIL_IN_USE')
  const memberId =
    existing?.id ??
    (await createRecord(tx, {
      kind: 'member',
      councilId: null,
      actor: null,
      values: { name: memberName ?? user.name, email },
    }))
  await tx.insert(memberLogin).values({ memberId, userId })
  if (existing) await renameOnLink(tx, existing, memberName)
  return memberId
}

// 같은 이메일의 운영진에 처음 이을 때 '내 이름'이 지금 이름과 다르면 바꾼다. 바꾼 사람은 그 운영진 자신이다.
// 이메일로 찾은 운영진은 탈퇴하지 않은 사람이라(탈퇴하면 이메일이 빈다) 이름이 있다. 칸 타입만 비울 수 있다.
async function renameOnLink(
  tx: Tx,
  linked: { id: string; name: string | null },
  memberName?: string,
) {
  if (memberName === undefined || memberName === linked.name) return
  await updateRecord(tx, {
    kind: 'member',
    id: linked.id,
    actor: linked.id,
    reason: null,
    changes: { name: memberName },
  })
}
