import {
  dateFromKorean,
  koreanOf,
  type CreateEventRequest,
  type EventDetail,
  type UpdateEventRequest,
} from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { can } from '../access/permissions.js'
import type { Tx } from '../db/types.js'
import { ApiError } from '../http/errors.js'
import { postKkirukNotice } from '../chat/kkiruk-post.js'
import { memberNamesOf } from '../team/display-name.js'
import { createRecord, updateRecord } from '../records/records.js'
import { assertLinkableTask } from '../tasks/link.js'
import { lockEventsShared } from '../policy/locks.js'
import { changeNoticeOf, createdNoticeOf } from './change-notice.js'
import { decide, factsOf } from './policy.js'
import { eventDetailOf } from './detail.js'
import { eventRowOf } from './queries.js'

// 쓰기 거래는 학생회 행 잠금 → 운영진 확인(inCouncilChange) → 행사 행 읽기 → 권한표 순서다. 이 함수들은 앞의 둘이 끝난 거래에서 부른다.
// 학생회 행 잠금이 같은 학생회의 쓰기를 한 번에 하나로 줄 세우므로, 잠금 뒤에 읽은 책임자가 이 거래가 끝날 때까지 바뀌지 않는다.
// 403이 다른 실패보다 먼저다. 다른 학생회 행사는 없는 것과 같아 404다.

const fromKorean = (value: string | null) => (value ? dateFromKorean(value) : null)

// 쓰기의 응답과, 같은 거래에서 공지방에 쓴 끼룩이 글(없으면 null). 라우트가 커밋 뒤에 그 글의 휴대폰 알림을 보낸다.
export type EventWrite = { event: EventDetail; noticeId: string | null }

// 그 행사의 공지방(없으면 우리 학생회 공지방)에 끼룩이 글 하나. 글이 없으면 쓰지 않는다.
const noticeOf = (tx: Tx, actor: Actor, eventId: string, body: string | null) =>
  body
    ? postKkirukNotice(tx, { councilId: actor.councilId, cohortId: actor.cohortId, eventId }, body)
    : null

export async function createEvent(
  tx: Tx,
  actor: Actor,
  input: CreateEventRequest,
  now: Date,
): Promise<EventWrite> {
  if (!can(actor, 'event.create')) throw new ApiError('FORBIDDEN')
  // 업무를 이으면 행사와 연결 한 줄이 한 거래에서 생긴다. 업무는 그대로이고 완료할 때 끝남이 된다. 거절이면 아무것도 생기지 않는다.
  if (input.taskId) await assertLinkableTask(tx, actor, input.taskId, now)
  const id = await createRecord(tx, {
    kind: 'event',
    councilId: actor.councilId,
    actor: actor.memberId,
    ...(input.taskId ? { taskId: input.taskId } : {}),
    values: {
      name: input.name,
      startsAt: fromKorean(input.startsAt),
      endsAt: fromKorean(input.endsAt),
      place: input.place,
      // 만든 사람이 책임자다(DEC-79). 만든 사람은 잠근 학생회 행 아래에서 방금 지금 운영진으로 확인됐다.
      ownerId: actor.memberId,
    },
  })
  // 행사가 생기면 공지방에 끼룩이 글이 올라 회장단이 안다(DEC-93). 만든 사람은 방금 지금 운영진으로 확인됐다.
  const maker = (await memberNamesOf(tx, actor.councilId, [actor.memberId])).get(actor.memberId)!
  const noticeId = await noticeOf(tx, actor, id, createdNoticeOf(maker, input.name))
  return { event: await eventDetailOf(tx, actor, id, now), noticeId }
}

// 이름, 일시, 장소 고치기. 회장단과 책임자가 한다(DEC-79). 같은 값이면 판을 만들지 않는다.
export async function updateEvent(
  tx: Tx,
  actor: Actor,
  target: { eventId: string; now: Date },
  input: UpdateEventRequest,
): Promise<EventWrite> {
  const row = await eventRowOf(tx, actor, target.eventId)
  // 행사 행을 FOR SHARE로 잠근 뒤 같은 거래에서 사실을 읽어 판정한다(완료와 겹치면 하나로 정해진다).
  await lockEventsShared(tx, [row.id])
  const facts = await factsOf(tx, actor, row, {
    now: target.now,
    actions: ['event.update'],
  })
  const refused = decide(actor, facts, 'event.update')
  if (refused) throw new ApiError(refused)
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
  // 이름, 일시, 장소가 바뀌면 같은 거래에서 공지방에 끼룩이 글 하나(DEC-90, DEC-93). 같은 값이면 글이 없다.
  const after = {
    name: input.name,
    startsAt: fromKorean(input.startsAt),
    endsAt: fromKorean(input.endsAt),
    place: input.place,
  }
  const noticeId = await noticeOf(tx, actor, row.id, changeNoticeOf(row, after, target.now))
  return { event: await eventDetailOf(tx, actor, row.id, target.now), noticeId }
}
