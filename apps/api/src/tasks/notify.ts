import { eq } from 'drizzle-orm'
import { koreanDateOf, taskTag, taskUrl } from '@vada/contracts'
import { member, record, task } from '../db/schema.js'
import type { Db } from '../db/types.js'
import { sqlState } from '../http/on-error.js'
import { loginAccountsOf } from '../push/accounts.js'
import { createFanout } from '../push/fanout.js'
import type { PushMessage, PushSender } from '../push/sender.js'
import type { AssignmentNotice } from './service.js'

const TITLE = '업무를 맡았어요'

// " · 10월 25일까지". 마감은 한국 날짜로 읽는다.
function dueText(dueAt: Date) {
  const [, month, day] = koreanDateOf(dueAt).split('-')
  return ` · ${Number(month)}월 ${Number(day)}일까지`
}

async function messageOf(db: Db, notice: AssignmentNotice): Promise<PushMessage | null> {
  const [found] = await db
    .select({
      title: task.title,
      dueAt: task.dueAt,
      councilId: record.councilId,
      cancelledAt: task.cancelledAt,
    })
    .from(task)
    .innerJoin(record, eq(record.id, task.id))
    .where(eq(task.id, notice.taskId))
  const [assigner] = await db
    .select({ name: member.name })
    .from(member)
    .where(eq(member.id, notice.assignerId))
  // 그 사이 지워졌으면 열 수 없는 업무라 보내지 않는다.
  if (!found?.councilId || !assigner || found.cancelledAt) return null
  return {
    title: TITLE,
    body: `${assigner.name}: ${found.title}${found.dueAt ? dueText(found.dueAt) : ''}`,
    url: taskUrl(found.councilId, notice.taskId),
    tag: taskTag(notice.taskId),
  }
}

// 업무를 맡긴 뒤의 휴대폰 알림. 커밋 뒤에 떼어 부르고 응답은 기다리지 않는다(notify는 던지지 않는다).
// 받는 사람은 새 담당자 한 사람이다(이전 담당자는 받지 않는다). 재시작 중이면 그 알림은 사라진다(기능 003 '위험').
export function createTaskPush(db: Db, send: PushSender) {
  const fanout = createFanout(db, send)
  return {
    async notify(notice: AssignmentNotice) {
      try {
        const message = await messageOf(db, notice)
        if (!message) return
        const accounts = await loginAccountsOf(db, [notice.recipientId])
        await fanout.deliver(new Map(accounts.map(account => [account.userId, message])))
      } catch (error) {
        console.warn(JSON.stringify({ event: 'push_send_failed', sqlState: sqlState(error) }))
      }
    },
  }
}
export type TaskPush = ReturnType<typeof createTaskPush>
