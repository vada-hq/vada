import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import type { Actor } from '../access/actor.js'
import { ApiError } from '../http/errors.js'

const KEY_BYTES = 32
const LIFETIME_MS = 3_600_000
// 인스턴스가 바뀌면 토큰도 무효다. 기록은 DB에 남고, 화면은 새 열람을 시작할 수 있다.
export function createListAccess() {
  const key = randomBytes(KEY_BYTES)
  const signature = (value: string) => createHmac('sha256', key).update(value).digest('base64url')
  return (target: {
    actor: Actor
    eventId: string
    session: string
    now: Date
    token?: string | undefined
  }) => {
    const { actor, eventId, session, now } = target
    const scope = createHash('sha256')
      .update(
        JSON.stringify([actor.memberId, actor.membershipId, actor.councilId, eventId, session]),
      )
      .digest('base64url')
    if (!target.token) {
      const payload = `${scope}.${now.getTime() + LIFETIME_MS}.${randomBytes(KEY_BYTES).toString('base64url')}`
      return { token: `${payload}.${signature(payload)}`, first: true }
    }
    const [bound, expires, nonce, signed, extra] = target.token.split('.')
    const payload = `${bound}.${expires}.${nonce}`
    const expected = signature(payload)
    if (
      extra !== undefined ||
      bound !== scope ||
      !signed ||
      !/^[A-Za-z0-9_-]+$/.test(signed) ||
      Buffer.byteLength(signed) !== Buffer.byteLength(expected) ||
      !timingSafeEqual(Buffer.from(signed), Buffer.from(expected)) ||
      !Number.isSafeInteger(Number(expires)) ||
      Number(expires) <= now.getTime()
    )
      throw new ApiError('INVALID_INPUT')
    return { token: target.token, first: false }
  }
}
