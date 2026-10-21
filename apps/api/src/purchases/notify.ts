import { count, eq } from 'drizzle-orm'
import { purchaseRequestTag, purchaseRequestUrl } from '@vada/contracts'
import { lineItem, member, record, request } from '../db/schema.js'
import type { Db } from '../db/types.js'
import { sqlState } from '../http/on-error.js'
import { loginAccountsOf } from '../push/accounts.js'
import { createFanout } from '../push/fanout.js'
import type { PushMessage, PushSender } from '../push/sender.js'
import type { NewRequestNotice } from './service.js'

const NEW_REQUEST_TITLE = '구매 요청이 왔어요'

// "A: 제목 · 품목 2개". 잠금 화면에 보이므로 요청한 사람, 제목, 품목 수만 담는다.
async function newRequestMessage(db: Db, notice: NewRequestNotice): Promise<PushMessage | null> {
  const [found] = await db
    .select({
      title: request.title,
      cancelledAt: request.cancelledAt,
      councilId: record.councilId,
      requester: member.name,
      items: count(lineItem.id),
    })
    .from(request)
    .innerJoin(record, eq(record.id, request.id))
    .innerJoin(member, eq(member.id, request.requestedBy))
    .innerJoin(lineItem, eq(lineItem.requestId, request.id))
    .where(eq(request.id, notice.requestId))
    .groupBy(request.id, record.id, member.id)
  // 그 사이 취소됐으면 결재할 것이 없어 보내지 않는다.
  if (!found?.councilId || found.cancelledAt) return null
  return {
    title: NEW_REQUEST_TITLE,
    body: `${found.requester}: ${found.title} · 품목 ${found.items}개`,
    url: purchaseRequestUrl(found.councilId, notice.requestId),
    tag: purchaseRequestTag(notice.requestId),
  }
}

// 새 구매 요청의 휴대폰 알림. 커밋 뒤에 떼어 부르고 응답은 기다리지 않는다(notify는 던지지 않는다).
// 받는 사람은 알림 기록을 남긴 재정부의 부서원이다. 재시작 중이면 그 알림은 사라진다(기능 003 '위험').
export function createPurchasePush(db: Db, send: PushSender) {
  const fanout = createFanout(db, send)
  return {
    async notify(notice: NewRequestNotice) {
      try {
        const message = await newRequestMessage(db, notice)
        if (!message) return
        const accounts = await loginAccountsOf(db, notice.recipientIds)
        await fanout.deliver(new Map(accounts.map(account => [account.userId, message])))
      } catch (error) {
        console.warn(JSON.stringify({ event: 'push_send_failed', sqlState: sqlState(error) }))
      }
    },
  }
}
export type PurchasePush = ReturnType<typeof createPurchasePush>
