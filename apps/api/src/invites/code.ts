import { randomInt } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { inviteCode } from '../db/schema.js'
import type { Db } from '../db/types.js'

// 초대 코드 8자. 헷갈리는 0·1·I·O를 뺀 32글자에서 뽑는다(DB CHECK ^[2-9A-HJ-NP-Z]{8}$, 지금 vada와 같다).
export const INVITE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
export const newInviteCode = () =>
  Array.from({ length: 8 }, () => INVITE_ALPHABET[randomInt(INVITE_ALPHABET.length)]).join('')

const MAX_ATTEMPTS = 5
// 아직 쓰이지 않은 코드. 겹칠 확률은 32^8분의 1이라 몇 번만 다시 뽑는다.
export async function freshInviteCode(db: Pick<Db, 'select'>): Promise<string> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const code = newInviteCode()
    const [taken] = await db
      .select({ code: inviteCode.code })
      .from(inviteCode)
      .where(eq(inviteCode.code, code))
    if (!taken) return code
  }
  throw new Error('Invite code collision')
}
