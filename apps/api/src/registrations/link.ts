import { createHash, randomBytes } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { registrationLink } from '../db/schema.js'
import type { Db } from '../db/types.js'
import { idList } from './personal-values.js'

const TOKEN_BYTES = 16

// 개인 링크 토큰: 무작위 128비트를 base64url로 쓴다(OWASP: 암호학적 무작위). 한 번만 주고 DB에는 해시만 둔다.
export const newToken = () => randomBytes(TOKEN_BYTES).toString('base64url')

// 토큰의 SHA-256(소문자 16진 64자). DB CHECK와 같은 모양이고, 출석 QR 글자는 이것을 대문자로 쓴다(qrTextOf).
export const hashOfToken = (token: string) => createHash('sha256').update(token).digest('hex')

export async function addLink(db: Pick<Db, 'insert'>, registrationId: string, token: string) {
  await db.insert(registrationLink).values({ registrationId, tokenHash: hashOfToken(token) })
}

// 취소하거나 신청자 정보를 비우면 줄을 지운다: 그 뒤 같은 토큰은 404다.
export async function removeLinks(db: Pick<Db, 'execute'>, registrationIds: string[]) {
  await db.execute(
    sql`DELETE FROM registration_link WHERE registration_id IN ${idList(registrationIds)}`,
  )
}
