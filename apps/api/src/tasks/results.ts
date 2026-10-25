import { asc, eq, sql } from 'drizzle-orm'
import type { TaskResult, TaskResultKind } from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { visibleMessage } from '../chat/messages.js'
import { can } from '../access/permissions.js'
import {
  chatRoom,
  event,
  message,
  record,
  registrationForm,
  request,
  taskResult,
} from '../db/schema.js'
import type { Db } from '../db/types.js'
import { eventFactsOf, listActionsOf } from '../registrations/policy.js'
import { stagesOf } from './result-sync.js'

type Reader = Pick<Db, 'select'>

// 공지 결과물의 제목으로 보이는 첫 줄의 길이(글자)
const TITLE_MAX = 60

// 업무 상세의 결과물: 이 업무에서 만든 것을 만든 순으로, 제목은 지금 제목이고 단계는 그때그때 센다(저장하지 않는다).
// 제목은 요청의 제목, 양식과 행사의 이름, 공지의 첫 줄이다.
// 공지의 첫 줄은 이 사람이 대화에서 볼 수 있는 메시지일 때만 싣는다(DEC-59, visibleMessage). 볼 수 없으면 비운다.
const messageTitle = (actor: Actor) =>
  sql<string | null>`case when ${visibleMessage(actor)}
    then left(split_part(${message.body}, chr(10), 1), ${TITLE_MAX}) end`
export async function resultsOf(db: Reader, actor: Actor, taskId: string): Promise<TaskResult[]> {
  const rows = await db
    .select({
      id: taskResult.resultId,
      kind: taskResult.resultKind,
      title: sql<string>`coalesce(${request.title}, ${registrationForm.name}, ${event.name}, ${messageTitle(actor)}, '')`,
    })
    .from(taskResult)
    .innerJoin(record, eq(record.id, taskResult.resultId))
    .leftJoin(request, eq(request.id, taskResult.resultId))
    .leftJoin(registrationForm, eq(registrationForm.id, taskResult.resultId))
    .leftJoin(event, eq(event.id, taskResult.resultId))
    .leftJoin(message, eq(message.id, taskResult.resultId))
    .leftJoin(chatRoom, eq(chatRoom.id, message.roomId))
    .where(eq(taskResult.taskId, taskId))
    .orderBy(asc(record.createdAt), asc(taskResult.resultId))
  const results = rows.map(row => ({ id: row.id, kind: row.kind as TaskResultKind }))
  const stages = await stagesOf(db, results)
  return rows.map(row => ({
    kind: row.kind as TaskResultKind,
    id: row.id,
    title: row.title,
    stage: stages.get(row.id) ?? 'none',
  }))
}

// 이 업무에서 만들 수 있는 결과물 종류. 업무를 이을 수 있고(canLinkResult를 부르는 쪽이 넘긴다) 그 결과물을 만들 권한이 있을 때다.
// 요청 purchase.request, 양식은 업무의 행사에 만들 수 있을 때(행사 책임자·담당 부서·회장단이고 완료 전, 그 행사에 만든다),
// 공지는 모든 운영진(공지방에 누구나 보낸다, DEC-90), 행사 event.create다. 만든 행사를 업무의 행사로 바꾸지 않는다(권한 맥락이 바뀐다).
export async function canMakeOf(
  db: Reader,
  actor: Actor,
  task: { linkable: boolean; eventId: string | null; eventOwnerId: string | null },
): Promise<TaskResultKind[]> {
  if (!task.linkable) return []
  const kinds: TaskResultKind[] = []
  if (can(actor, 'purchase.request')) kinds.push('request')
  if (task.eventId && (await canMakeForm(db, actor, task.eventId, task.eventOwnerId)))
    kinds.push('registration_form')
  kinds.push('message')
  if (can(actor, 'event.create')) kinds.push('event')
  return kinds
}

async function canMakeForm(db: Reader, actor: Actor, eventId: string, eventOwnerId: string | null) {
  const facts = await eventFactsOf(db, actor, { eventId, eventOwnerId })
  return listActionsOf(actor, facts).includes('form.create')
}
