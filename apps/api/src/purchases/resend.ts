import type { CreatePurchaseRequest, PurchaseRequestDetail } from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import {
  bodyHashOf,
  memberCommandKey,
  resentResultId,
  type ReceiptKey,
} from '../commands/receipt.js'
import type { Tx } from '../db/types.js'
import { requestDetailOf } from './queries.js'

// 번호를 뺀 본문의 해시. 빠진 칸이 있으면 그 칸만 다른 본문이 같은 번호로 통과한다.
// 비운 칸과 저장되는 값이 같은 칸(요청한 사람의 나, 업무 없음)은 같은 본문으로 친다.
const requestBodyHashOf = (secret: string, input: CreatePurchaseRequest, actor: Actor) =>
  bodyHashOf(secret, [
    input.title,
    input.eventId,
    input.body,
    input.neededBy,
    input.requestedBy ?? actor.memberId,
    input.sourceMessageId,
    input.taskId ?? null,
    JSON.stringify(
      input.items.map(item => [
        item.name,
        item.quantity,
        item.link,
        item.options,
        item.estimatedUnitPrice ?? null,
        item.estimatedShippingFee ?? null,
      ]),
    ),
  ])

type RequestCommand = { key: ReceiptKey; bodyHash: string; now: Date }

// 번호를 보내지 않은 옛 화면의 요청은 전처럼 영수증 없이 받는다. 계약이 번호를 필수로 바꾸면 이 갈래를 지운다.
export function requestCommandOf(
  actor: Actor,
  input: CreatePurchaseRequest,
  command: { now: Date; receiptKey: string },
): RequestCommand | undefined {
  if (!input.commandId) return undefined
  return {
    key: memberCommandKey('request_create', actor, input.commandId),
    bodyHash: requestBodyHashOf(command.receiptKey, input, actor),
    now: command.now,
  }
}

// 이 번호의 요청이 이미 있으면 새로 만들지 않고 그 요청의 지금 상세를 준다(취소했으면 취소된 상세).
export async function resendRequest(
  tx: Tx,
  actor: Actor,
  sent: RequestCommand,
): Promise<PurchaseRequestDetail | undefined> {
  const resultId = await resentResultId(tx, sent)
  return resultId ? requestDetailOf(tx, actor, resultId) : undefined
}
