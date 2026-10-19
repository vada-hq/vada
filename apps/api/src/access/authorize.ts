import { eq } from 'drizzle-orm'
import type { Action } from '@vada/contracts'
import { council } from '../db/schema.js'
import { ApiError } from '../http/errors.js'
import type { Db, Tx } from '../records/records.js'
import { actorOf, type Actor } from './actor.js'
import { can } from './permissions.js'

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// 경로의 학생회 번호. 형식이 틀리면 그 학생회의 운영진일 수 없으므로 403이다(학생회가 있는지 드러내지 않는다).
export function councilIdOf(value: string | undefined) {
  if (!value || !uuid.test(value)) throw new ApiError('FORBIDDEN', 403)
  return value.toLowerCase()
}

// 경로의 운영진·부서 번호. 형식이 틀리면 없는 번호로 본다.
export function recordIdOf(value: string | undefined) {
  if (!value || !uuid.test(value)) throw new ApiError('NOT_FOUND', 404)
  return value.toLowerCase()
}

// 읽기: 지금 소속을 찾고 권한표를 묻는다. 운영진이 아니거나 권한이 없으면 403이다.
export async function authorize(db: Pick<Db, 'select'>, userId: string, councilId: string, action: Action, now: Date): Promise<Actor> {
  const actor = await actorOf(db, userId, councilId, now)
  if (!actor || !can(actor, action)) throw new ApiError('FORBIDDEN', 403)
  return actor
}

// 바꾸기: 학생회 행을 잠가 같은 학생회의 조직 변경을 한 번에 하나씩 처리한다. 잠근 뒤 요청한 사람의 소속과 권한을 다시 본다.
// FOR NO KEY UPDATE라서 이 학생회를 가리키는 기록을 넣을 때의 외래 키 검사(FOR KEY SHARE)는 기다리지 않는다.
export async function authorizeChange(tx: Tx, userId: string, councilId: string, action: Action, now: Date): Promise<Actor> {
  await tx.select({ id: council.id }).from(council).where(eq(council.id, councilId)).for('no key update')
  return authorize(tx, userId, councilId, action, now)
}
