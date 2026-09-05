import { and, asc, eq } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import { members, payments, purchaseOrders } from '../db/schema.ts'
import {
  BLANK,
  dayOf,
  joinParts,
  orNote,
  quantityNote,
  requestedAmount,
  statusOf,
  won,
  type PurchaseStage,
} from '../finance/labels.ts'
import { moment } from '../time.ts'
import { labelOf, REVIEW_RESULTS } from './options.ts'
import { itemsOf, requestOf, type ReviewResult } from './rows.ts'

// 구매 요청 상세·진행 상태(FIN-REQ-02) — 겉면 · 품목별 처리 결과 · 처리 기록.
//
// **요청자가 보는 쪽이다.** 같은 요청을 재정부도 보지만(FIN-REV-01, `finance/review.ts`) 출처가
// 다르다 — 예산 사용 가능액처럼 요청자에게 보이지 않는 값이 저쪽에만 온다. 상태의 말과 색은
// 저쪽과 같은 규칙에서 나온다(`finance/labels.ts`) — 같은 요청이 화면마다 다른 상태로 보이면 안 된다.

export interface PurchaseRequestDetail {
  code: string
  status: string
  statusTone: string
  title: string
  amountNote: string
  eventName: string
  department: string
  requester: string
  neededOn: string
  stage: string
}

/**
 * 표의 단계를 진행 단계 줄의 열쇠로. **steps 요소의 items[].key와 같은 말이어야 한다**(명세).
 *
 * 표는 `proof`라 부르고 줄은 `evidence`라 부른다 — 옮기는 일은 서버가 한다. 아직 안 낸 요청은
 * 첫 칸(요청 제출)에 서 있다.
 */
const STEP: Record<PurchaseStage, string> = {
  draft: 'submitted',
  review: 'review',
  purchase: 'purchase',
  proof: 'evidence',
  settled: 'done',
}

export async function purchaseRequestDetail(
  db: Db,
  orgId: string,
  requestId: string,
): Promise<PurchaseRequestDetail | null> {
  const row = await requestOf(db, orgId, requestId)
  if (row === null) return null
  const items = await itemsOf(db, orgId, row.id)
  const status = statusOf(row.stage, row.supplementRequestedAt)
  return {
    code: orNote(row.code, '번호 미정'),
    status: status.label,
    statusTone: status.tone,
    title: row.title,
    // 요청 전체의 요청액. 적을 때의 값(수량 × 단가)을 더한 것이다 — 아직 없는 것은 더할 것이 없다.
    amountNote: won(items.reduce((sum, item) => sum + (requestedAmount(item.quantity, item.unitPrice) ?? 0), 0)),
    eventName: orNote(row.eventName, '상시 지출'),
    department: orNote(row.departmentName, '부서 미정'),
    requester: orNote(row.requesterName, '요청자 미정'),
    neededOn: orNote(dayOf(row.neededOn), '필요한 날짜 미정'),
    stage: STEP[row.stage],
  }
}

export interface PurchaseRequestItemResult {
  id: string
  name: string
  quantityNote: string
  amountNote: string
  result: string
  resultTone: string
  note: string
}

/** 판정마다의 색. 판정 칩의 색(`design/tones.ts`의 VERDICT_CHOICE)과 같은 배합이다. */
const RESULT_TONE: Record<ReviewResult, string> = {
  approved: 'green',
  supplement: 'yellow',
  rejected: 'red',
}

/** 아직 판정하지 않은 품목. 요청이 검토를 기다리는 것과 같은 말이다. */
const PENDING = { label: '검토 대기', tone: 'gray' }

/**
 * 품목마다의 처리 결과(`finance.purchaseRequestItems`).
 *
 * **재정부가 남긴 말이 없으면 줄표다** — 빈 칸과 할 말이 없다는 것은 다르다(명세).
 */
export async function purchaseRequestItemResults(
  db: Db,
  orgId: string,
  requestId: string,
): Promise<PurchaseRequestItemResult[] | null> {
  const row = await requestOf(db, orgId, requestId)
  if (row === null) return null
  return (await itemsOf(db, orgId, row.id)).map((item) => {
    const asked = requestedAmount(item.quantity, item.unitPrice)
    return {
      id: item.id,
      name: item.name,
      quantityNote: quantityNote(item.quantity, item.unit),
      amountNote: asked === null ? '금액 미정' : won(asked),
      result: item.reviewResult === null ? PENDING.label : (labelOf(REVIEW_RESULTS, item.reviewResult) ?? item.reviewResult),
      resultTone: item.reviewResult === null ? PENDING.tone : RESULT_TONE[item.reviewResult],
      note: orNote(item.reviewNote, BLANK),
    }
  })
}

export interface PurchaseRequestHistoryLine {
  id: string
  action: string
  actorNote: string
}

interface Moment {
  id: string
  action: string
  actor: string | null
  at: Date
  /** 같은 순간에 둘이 있으면 흐름의 차례대로. */
  order: number
}

/**
 * 이 요청에 무슨 일이 있었는지(`finance.purchaseRequestHistory`).
 *
 * **표에 남은 때에서만 줄이 나온다** — 제출·검토 완료·보완 요청·발주·결제·처리 완료. 일어난 일을
 * 따로 적는 표가 없으므로 없는 때는 줄이 없다: 재제출은 때를 남기지 않아 줄이 없고, 보완 요청의 줄은
 * 재제출로 그 때가 지워지면 함께 사라진다(보고했다). 처리 완료는 누가 했는지가 표에 없어 때만 온다.
 *
 * 시간순으로 온다 — 화면이 다시 정렬하지 않는다(명세).
 */
export async function purchaseRequestHistory(
  db: Db,
  orgId: string,
  requestId: string,
): Promise<PurchaseRequestHistoryLine[] | null> {
  const row = await requestOf(db, orgId, requestId)
  if (row === null) return null

  const moments: Moment[] = []
  if (row.submittedAt !== null) {
    moments.push({ id: 'submitted', action: '요청 제출', actor: row.requesterName, at: row.submittedAt, order: 0 })
  }
  if (row.reviewedAt !== null) {
    moments.push({ id: 'reviewed', action: '재정부 검토 완료', actor: row.reviewerName, at: row.reviewedAt, order: 1 })
  }
  if (row.supplementRequestedAt !== null) {
    moments.push({
      id: 'supplement',
      action: '보완 요청',
      actor: row.reviewerName,
      at: row.supplementRequestedAt,
      order: 2,
    })
  }

  const orders = await db
    .select({ id: purchaseOrders.id, vendor: purchaseOrders.vendor, orderedOn: purchaseOrders.orderedOn, orderer: members.name })
    .from(purchaseOrders)
    .leftJoin(members, and(eq(purchaseOrders.ordererMemberId, members.id), eq(members.orgId, orgId)))
    .where(and(eq(purchaseOrders.orgId, orgId), eq(purchaseOrders.requestId, row.id)))
    .orderBy(asc(purchaseOrders.orderedOn), asc(purchaseOrders.id))
  for (const order of orders) {
    // 아직 주문하지 않은 발주는 일어난 일이 아니다.
    if (order.orderedOn === null) continue
    moments.push({ id: `order:${order.id}`, action: `발주 · ${order.vendor}`, actor: order.orderer, at: order.orderedOn, order: 3 })
  }

  const paid = await db
    .select({ id: payments.id, vendor: payments.vendor, paidOn: payments.paidOn, payer: members.name })
    .from(payments)
    .leftJoin(members, and(eq(payments.payerMemberId, members.id), eq(members.orgId, orgId)))
    .where(and(eq(payments.orgId, orgId), eq(payments.requestId, row.id)))
    .orderBy(asc(payments.paidOn), asc(payments.id))
  for (const payment of paid) {
    if (payment.paidOn === null) continue
    moments.push({ id: `payment:${payment.id}`, action: `결제 · ${payment.vendor}`, actor: payment.payer, at: payment.paidOn, order: 4 })
  }

  if (row.evidenceCompletedAt !== null) {
    moments.push({ id: 'settled', action: '처리 완료', actor: null, at: row.evidenceCompletedAt, order: 5 })
  }

  moments.sort((a, b) => a.at.getTime() - b.at.getTime() || a.order - b.order)
  return moments.map((one) => ({
    id: one.id,
    action: one.action,
    // 누가 언제 했는지가 한 줄로 온다 — 사람과 시각을 잇는 방식은 조직의 표기다(명세).
    actorNote: joinParts([one.actor, moment(one.at)]),
  }))
}
