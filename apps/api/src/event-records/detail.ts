import type { EventRecord } from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import type { Db } from '../db/types.js'
import { completedEventIdsAmong, completionApprovalsOf } from '../events/completion.js'
import { eventHistoryOf } from '../events/history.js'
import { eventRowOf, summariesOf, taskCountsByEvent } from '../events/queries.js'
import { ApiError } from '../http/errors.js'
import { settlementOf } from '../settlement/queries.js'
import {
  departmentsByEvent,
  percentOf,
  registrationCountsByEvent,
  sourceCountsByEvent,
} from './counts.js'
import { timelineOf } from './timeline.js'

type Reader = Pick<Db, 'select'>

// 완료한 이 학생회 행사와 그 마지막 완료 결재. 다른 학생회 행사와 없는 행사(eventRowOf), 완료하지 않았거나 완료를 취소한 행사는 404다.
async function completedEventOf(db: Reader, actor: Actor, eventId: string) {
  const row = await eventRowOf(db, actor, eventId)
  // 결재는 이 학생회의 것만 본다(목록과 같은 조건).
  const approvals = await completionApprovalsOf(db, eventId, actor.councilId)
  const last = approvals.at(-1)
  const completed = (await completedEventIdsAmong(db, [eventId], actor.councilId)).has(eventId)
  if (!completed || last?.outcome !== 'completed') throw new ApiError('NOT_FOUND')
  return { row, approvals, last }
}

const NO_REGISTRATIONS = { total: 0, cancelled: 0, attended: 0 }
const NO_TASKS = { open: 0, total: 0 }

// 성과 대목: 신청·출석, 돈(정산 탭의 settlementOf를 그대로 부른다), 업무. 신청자 정보는 수만 읽는다.
async function outcomeOf(db: Reader, actor: Actor, eventId: string, now: Date) {
  const scope = { councilId: actor.councilId, eventIds: [eventId] }
  const registrations =
    (await registrationCountsByEvent(db, scope)).get(eventId) ?? NO_REGISTRATIONS
  const settlement = await settlementOf(db, actor, eventId, now)
  const tasks =
    (await taskCountsByEvent(db, [eventId], undefined, actor.councilId)).get(eventId) ?? NO_TASKS
  const [budget, actual] = [settlement.budget.expense, settlement.actual.expense]
  const outcome: EventRecord['outcome'] = {
    registrations: {
      ...registrations,
      rate: percentOf(registrations.attended, registrations.total - registrations.cancelled),
    },
    money: { budget, actual, difference: settlement.difference, rate: percentOf(actual, budget) },
    tasks: { done: tasks.total - tasks.open, total: tasks.total },
  }
  return outcome
}

// 행사 기록 상세(REC-02)의 자동 대목: 개요, 성과, 타임라인, 근거 자료. 열 때마다 센다(DEC-110).
export async function eventRecordOf(
  db: Reader,
  actor: Actor,
  eventId: string,
  now: Date,
): Promise<EventRecord> {
  const { row, approvals, last } = await completedEventOf(db, actor, eventId)
  const [summary] = await summariesOf(db, actor, [row], now)
  const scope = { councilId: actor.councilId, eventIds: [eventId] }
  const outcome = await outcomeOf(db, actor, eventId, now)
  const { id, name, startsAt, endsAt, place, owner } = summary!
  return {
    overview: {
      id,
      name,
      startsAt,
      endsAt,
      place,
      owner,
      departments: (await departmentsByEvent(db, scope)).get(eventId) ?? [],
      completedAt: last.at,
      completedBy: last.by,
    },
    outcome,
    timeline: await timelineOf(
      db,
      { councilId: actor.councilId, eventId },
      { history: await eventHistoryOf(db, eventId), approvals },
    ),
    sources: {
      tasks: outcome.tasks.total,
      ...(await sourceCountsByEvent(db, scope)).get(eventId)!,
    },
  }
}
