import type { Context } from 'hono'
import { NotFound } from '../errors.ts'

/** 현재 조직에서 요청을 보낸 구성원의 식별자를 읽는다. */
export function memberIdOf(c: Context): string {
  const memberId = c.get('sender')?.membership?.memberId
  if (memberId === undefined) throw new NotFound('이 학생회의 구성원이 아닙니다')
  return memberId
}
