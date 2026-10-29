import { eq } from 'drizzle-orm'
import { koreanDateOf, taskTag, taskUrl } from '@vada/contracts'
import { member, record, task } from '../db/schema.js'
import type { Db } from '../db/types.js'
import { sqlState } from '../http/on-error.js'
import { loginAccountsOf } from '../push/accounts.js'
import { createFanout, type SkipReason } from '../push/fanout.js'
import { createPendingPush, type PendingPush } from '../push/pending.js'
import type { PushMessage, PushSender } from '../push/sender.js'
import type { AssignmentNotice } from './service.js'
import { joinedDisplayNameOf, recordCouncilSql } from '../team/display-name.js'

// 바꾼 뒤 이만큼 모았다가 보낸다. 그 안에 되돌리거나 다시 고르면 처음 바꾼 사람은 받지 않는다(기능 018).
export const ASSIGNMENT_NOTICE_DELAY_MS = 10_000

// 타이머를 주입해 시험이 고정 대기 없이 시간을 건너뛴다. 돌려주는 함수는 예약을 취소한다.
export type AfterTimer = (ms: number, run: () => Promise<void>) => () => void

export const realTimer: AfterTimer = (ms, run) => {
  const handle = setTimeout(() => void run(), ms)
  handle.unref()
  return () => clearTimeout(handle)
}

const TITLE = '업무를 맡았어요'

// " · 10월 25일까지". 마감은 한국 날짜로 읽는다.
function dueText(dueAt: Date) {
  const [, month, day] = koreanDateOf(dueAt).split('-')
  return ` · ${Number(month)}월 ${Number(day)}일까지`
}

// 보낼 때의 DB를 다시 읽어 판단한다: 지금 담당자가 받는 사람일 때만 만든다.
async function messageOf(db: Db, notice: AssignmentNotice): Promise<PushMessage | SkipReason> {
  const [found] = await db
    .select({
      title: task.title,
      dueAt: task.dueAt,
      councilId: record.councilId,
      cancelledAt: task.cancelledAt,
      assigneeId: task.assigneeId,
    })
    .from(task)
    .innerJoin(record, eq(record.id, task.id))
    .where(eq(task.id, notice.taskId))
  const [assigner] = await db
    .select({ name: joinedDisplayNameOf(member, recordCouncilSql(notice.taskId)) })
    .from(member)
    .where(eq(member.id, notice.assignerId))
  // 그 사이 지워졌으면 열 수 없는 업무라 보내지 않는다.
  if (!found?.councilId || !assigner) return 'deleted'
  if (found.cancelledAt) return 'cancelled'
  if (!found.assigneeId) return 'unassigned'
  if (found.assigneeId !== notice.recipientId) return 'reassigned'
  return {
    title: TITLE,
    body: `${assigner.name}: ${found.title}${found.dueAt ? dueText(found.dueAt) : ''}`,
    url: taskUrl(found.councilId, notice.taskId),
    tag: taskTag(notice.taskId),
  }
}

function skipAssignment(notice: AssignmentNotice, original: string | null): SkipReason | undefined {
  if (!notice.recipientId) return 'unassigned'
  if (notice.recipientId === notice.assignerId) return 'self'
  if (notice.recipientId === original) return 'reverted'
  return undefined
}

async function deliver(
  db: Db,
  fanout: ReturnType<typeof createFanout>,
  notice: AssignmentNotice,
  original: string | null,
) {
  try {
    const skipped = skipAssignment(notice, original)
    if (skipped) return fanout.skip('task', skipped)
    const message = await messageOf(db, notice)
    if (typeof message === 'string') return fanout.skip('task', message)
    const accounts = await loginAccountsOf(db, [notice.recipientId!])
    await fanout.deliver(new Map(accounts.map(account => [account.userId, message])), {
      kind: 'task',
      recipients: 1,
    })
  } catch (error) {
    console.warn(JSON.stringify({ event: 'push_send_failed', sqlState: sqlState(error) }))
  }
}

// 업무를 맡긴 뒤의 휴대폰 알림. 커밋 뒤에 떼어 부르고 응답은 기다리지 않는다(notify는 던지지 않는다).
// 업무마다 타이머 하나로 모은다. 바꿀 때마다 다시 시작하고, 처음(모으기 전) 담당자는 처음 알림의 이전 담당자다.
// 종료할 때 대기 타이머를 바로 내보낸다. 모으기는 인스턴스가 하나일 때만 맞다(기능 018 '위험').
export function createTaskPush(
  db: Db,
  send: PushSender,
  after: AfterTimer,
  pending: PendingPush = createPendingPush(),
) {
  const fanout = createFanout(db, send)
  const waiting = new Map<
    string,
    { original: string | null; cancel: () => void; run: () => Promise<void> }
  >()
  function flush() {
    const jobs = [...waiting.values()]
    waiting.clear()
    for (const job of jobs) {
      job.cancel()
      void job.run()
    }
  }
  pending.onFlush(flush)
  return {
    flush,
    notify(notice: AssignmentNotice) {
      const earlier = waiting.get(notice.taskId)
      earlier?.cancel()
      const original = earlier ? earlier.original : notice.previous
      const run = () => {
        waiting.delete(notice.taskId)
        // 비웠거나 맡긴 사람 자신이거나 처음 담당자로 돌아왔으면 아무도 받지 않는다.
        return pending.track(deliver(db, fanout, notice, original))
      }
      const cancel = after(ASSIGNMENT_NOTICE_DELAY_MS, run)
      waiting.set(notice.taskId, { original, cancel, run })
    },
  }
}
export type TaskPush = ReturnType<typeof createTaskPush>
