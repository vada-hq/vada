import { eq } from 'drizzle-orm'
import { purchaseRequestTag, purchaseRequestUrl, type PurchaseStatus } from '@vada/contracts'
import { lineItem, member, record, request } from '../db/schema.js'
import type { Db } from '../db/types.js'
import { sqlState } from '../http/on-error.js'
import { loginAccountsOf } from '../push/accounts.js'
import { createFanout } from '../push/fanout.js'
import type { PushMessage, PushSender } from '../push/sender.js'
import { itemCountColumns } from './last-outcome.js'
import { requestStatusOf } from './policy.js'
import type { PurchaseNotice } from './service.js'
import { joinedDisplayNameOf } from '../team/display-name.js'

const NEW_REQUEST_TITLE = '구매 요청이 왔어요'
// 결과 알림의 제목. 마지막 대기 품목이 결재된 뒤라 대기는 없다.
const ITEM_CANCELLED_TITLE = '구매 품목이 취소됐어요'
const RESULT_TITLES: Partial<Record<PurchaseStatus, string>> = {
  approved: '구매 요청이 승인됐어요',
  partial: '구매 요청이 일부 승인됐어요',
  rejected: '구매 요청이 반려됐어요',
}

// 알림에 쓰는 요청의 사실. 알림을 만들 때가 아니라 보낼 때의 값을 읽는다.
async function requestFactsOf(db: Db, requestId: string) {
  const [found] = await db
    .select({
      title: request.title,
      cancelledAt: request.cancelledAt,
      councilId: record.councilId,
      requester: joinedDisplayNameOf(member, record.councilId),
      ...itemCountColumns(),
    })
    .from(request)
    .innerJoin(record, eq(record.id, request.id))
    .innerJoin(member, eq(member.id, request.requestedBy))
    .innerJoin(lineItem, eq(lineItem.requestId, request.id))
    .where(eq(request.id, requestId))
    .groupBy(request.id, record.id, member.id)
  return found?.councilId ? { ...found, councilId: found.councilId } : null
}
type Facts = NonNullable<Awaited<ReturnType<typeof requestFactsOf>>>

// "A: 제목 · 품목 2개". 잠금 화면에 보이므로 요청한 사람, 제목, 품목 수만 담는다.
// 그 사이 취소됐으면 결재할 것이 없어 보내지 않는다.
function newRequestMessage(found: Facts, requestId: string): PushMessage | null {
  if (found.cancelledAt) return null
  return {
    title: NEW_REQUEST_TITLE,
    body: `${found.requester}: ${found.title} · 품목 ${found.items}개`,
    url: purchaseRequestUrl(found.councilId, requestId),
    tag: purchaseRequestTag(requestId),
  }
}

// "B: 제목". 결재한 사람과 제목만 담는다. 아직 대기가 남았거나 취소됐으면 보내지 않는다. 품목 취소는 요청 상태와 무관하게 보낸다.
async function resultMessage(db: Db, found: Facts, notice: PurchaseNotice) {
  const title = notice.itemCancelled
    ? ITEM_CANCELLED_TITLE
    : RESULT_TITLES[requestStatusOf(found.cancelledAt !== null, found)]
  if (!title || !notice.decidedBy) return null
  const [decider] = await db
    .select({ name: joinedDisplayNameOf(member, found.councilId) })
    .from(member)
    .where(eq(member.id, notice.decidedBy))
  if (!decider) return null
  return {
    title,
    body: `${decider.name}: ${found.title}`,
    url: purchaseRequestUrl(found.councilId, notice.requestId),
    tag: purchaseRequestTag(notice.requestId),
  }
}

async function messageOf(db: Db, notice: PurchaseNotice): Promise<PushMessage | null> {
  const found = await requestFactsOf(db, notice.requestId)
  if (!found) return null
  return notice.decidedBy
    ? resultMessage(db, found, notice)
    : newRequestMessage(found, notice.requestId)
}

// 구매 요청의 휴대폰 알림(새 요청, 결재 결과). 커밋 뒤에 떼어 부르고 응답은 기다리지 않는다(notify는 던지지 않는다).
// 받는 사람은 알림 기록을 남긴 사람이다. 재시작 중이면 그 알림은 사라진다(기능 003 '위험').
export function createPurchasePush(db: Db, send: PushSender) {
  const fanout = createFanout(db, send)
  return {
    async notify(notice: PurchaseNotice) {
      try {
        const message = await messageOf(db, notice)
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
