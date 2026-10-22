import {
  dateFromKorean,
  koreanOf,
  type CreateEventRequest,
  type EventDetail,
  type SetEventOwnerRequest,
  type UpdateEventRequest,
} from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { can } from '../access/permissions.js'
import { lockCurrentMembers } from '../chat/current-members.js'
import type { Tx } from '../db/types.js'
import { ApiError } from '../http/errors.js'
import { createRecord, updateRecord } from '../records/records.js'
import { eventDetailOf, eventRowOf } from './queries.js'

// 쓰기 거래는 학생회 행 잠금 → 운영진 확인(inCouncilChange) → 행사 행 읽기 → 권한표 순서다. 이 함수들은 앞의 둘이 끝난 거래에서 부른다.
// 학생회 행 잠금이 같은 학생회의 쓰기를 한 번에 하나로 줄 세우므로, 잠금 뒤에 읽은 책임자가 이 거래가 끝날 때까지 바뀌지 않는다.
// 403이 다른 실패보다 먼저다. 다른 학생회 행사는 없는 것과 같아 404다.

const fromKorean = (value: string | null) => (value ? dateFromKorean(value) : null)

// 책임자는 지금 이 학생회의 운영진이어야 한다. 소속 줄을 잠가 확인과 쓰기 사이에 내보내지지 않게 한다.
async function assertOwner(tx: Tx, actor: Actor, ownerId: string | null, now: Date) {
  if (!ownerId) return
  const alive = await lockCurrentMembers(tx, actor.councilId, [ownerId], now)
  if (!alive.has(ownerId)) throw new ApiError('MEMBER_INVALID')
}

export async function createEvent(
  tx: Tx,
  actor: Actor,
  input: CreateEventRequest,
  now: Date,
): Promise<EventDetail> {
  if (!can(actor, 'event.create')) throw new ApiError('FORBIDDEN')
  await assertOwner(tx, actor, input.ownerId, now)
  const id = await createRecord(tx, {
    kind: 'event',
    councilId: actor.councilId,
    actor: actor.memberId,
    values: {
      name: input.name,
      startsAt: fromKorean(input.startsAt),
      endsAt: fromKorean(input.endsAt),
      place: input.place,
      ownerId: input.ownerId,
    },
  })
  return eventDetailOf(tx, actor, id, now)
}

// 이름, 일시, 장소 고치기. 책임자만 한다(회장단도 물려받지 않는다). 같은 값이면 판을 만들지 않는다.
export async function updateEvent(
  tx: Tx,
  actor: Actor,
  target: { eventId: string; now: Date },
  input: UpdateEventRequest,
): Promise<EventDetail> {
  const row = await eventRowOf(tx, actor, target.eventId)
  const context = row.ownerId ? { eventOwnerId: row.ownerId } : {}
  if (!can(actor, 'event.update', context)) throw new ApiError('FORBIDDEN')
  const same = (value: Date | null, wanted: string | null) =>
    (value ? koreanOf(value) : null) === wanted
  const changes = {
    ...(input.name !== row.name ? { name: input.name } : {}),
    ...(same(row.startsAt, input.startsAt) ? {} : { startsAt: fromKorean(input.startsAt) }),
    ...(same(row.endsAt, input.endsAt) ? {} : { endsAt: fromKorean(input.endsAt) }),
    ...(input.place !== row.place ? { place: input.place } : {}),
  }
  if (Object.keys(changes).length)
    await updateRecord(tx, {
      kind: 'event',
      id: row.id,
      actor: actor.memberId,
      reason: null,
      changes,
    })
  return eventDetailOf(tx, actor, row.id, target.now)
}

// 책임자 바꾸기와 비우기. 회장단만 한다. 같은 사람이면 판도 확인도 없다(떠난 책임자를 같은 값으로 다시 보내도 409가 아니다).
export async function setEventOwner(
  tx: Tx,
  actor: Actor,
  target: { eventId: string; now: Date },
  input: SetEventOwnerRequest,
): Promise<EventDetail> {
  if (!can(actor, 'event.set_owner')) throw new ApiError('FORBIDDEN')
  const row = await eventRowOf(tx, actor, target.eventId)
  if (input.ownerId !== row.ownerId) {
    await assertOwner(tx, actor, input.ownerId, target.now)
    await updateRecord(tx, {
      kind: 'event',
      id: row.id,
      actor: actor.memberId,
      reason: null,
      changes: { ownerId: input.ownerId },
    })
  }
  return eventDetailOf(tx, actor, row.id, target.now)
}
