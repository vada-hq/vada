import { and, eq, inArray } from 'drizzle-orm'
import type { ChatMessage } from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { can } from '../access/permissions.js'
import { evidenceLink, expense, lineItem, record, request } from '../db/schema.js'
import type { Db } from '../db/types.js'
import { itemCountColumns } from '../purchases/last-outcome.js'
import { requestBlocks } from './source-message.js'

type Reader = Pick<Db, 'select'>
type Made = ChatMessage['made'][number]

// 메시지를 근거로 만든 기록(DEC-71) 가운데 보는 사람이 읽을 수 있는 것. 요청·지출 읽기와 같은 조건이다:
// 이 학생회의 운영진(council.view)이면 이 학생회의 요청·지출을 모두 읽는다(purchases·expenses의 상세 라우트).
// 연결 표는 학생회를 맞추지 않으므로 기록의 학생회로 거른다.
const linkedTo = (actor: Actor, messageIds: string[]) =>
  and(inArray(evidenceLink.messageId, messageIds), eq(record.councilId, actor.councilId))
const linkColumns = {
  messageId: evidenceLink.messageId,
  id: record.id,
  createdAt: record.createdAt,
}

// 상태(막는지)는 품목의 마지막 결재로 센다. 요청마다 품목이 있어 한 줄로 묶는다.
async function requestRows(db: Reader, actor: Actor, messageIds: string[]) {
  const rows = await db
    .select({
      ...linkColumns,
      title: request.title,
      cancelledAt: request.cancelledAt,
      ...itemCountColumns(),
    })
    .from(evidenceLink)
    .innerJoin(request, eq(request.id, evidenceLink.recordId))
    .innerJoin(record, eq(record.id, request.id))
    .innerJoin(lineItem, eq(lineItem.requestId, request.id))
    .where(and(linkedTo(actor, messageIds), eq(request.type, 'purchase')))
    .groupBy(evidenceLink.messageId, record.id, request.id)
  return rows.map(row => ({
    messageId: row.messageId,
    id: row.id,
    createdAt: row.createdAt,
    title: row.title,
    blocking: requestBlocks(row.cancelledAt, row),
  }))
}

async function expenseRows(db: Reader, actor: Actor, messageIds: string[]) {
  const rows = await db
    .select({ ...linkColumns, title: expense.description, cancelledAt: expense.cancelledAt })
    .from(evidenceLink)
    .innerJoin(expense, eq(expense.id, evidenceLink.recordId))
    .innerJoin(record, eq(record.id, expense.id))
    .where(linkedTo(actor, messageIds))
  return rows.map(({ cancelledAt, ...row }) => ({ ...row, blocking: cancelledAt === null }))
}

// 메시지마다 만든 차례(만든 시각, 번호)의 요청·지출. 화면은 메시지 아래에 '구매 요청 · {제목}', '지출 · {내역}'으로 보인다.
export async function madeOf(db: Reader, actor: Actor, messageIds: string[]) {
  const byMessage = new Map<string, Made[]>()
  if (!messageIds.length || !can(actor, 'council.view')) return byMessage
  const requests = await requestRows(db, actor, messageIds)
  const expenses = await expenseRows(db, actor, messageIds)
  const rows = [
    ...requests.map(row => ({ ...row, kind: 'purchase_request' as const })),
    ...expenses.map(row => ({ ...row, kind: 'expense' as const })),
  ].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id))
  for (const { messageId, kind, id, title, blocking } of rows)
    byMessage.set(messageId, [...(byMessage.get(messageId) ?? []), { kind, id, title, blocking }])
  return byMessage
}
