import { and, eq } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import { purchaseRequestItems, purchaseRequests } from '../db/schema.ts'
import { requestedAmount } from '../finance/labels.ts'
import { AlreadyExists, Blocked, NotFound } from '../routes.ts'
import { objectOf, readCount, readWord, type Body } from './body.ts'
import { codeOf, REVIEW_RESULTS } from './options.ts'
import { itemsOf, requestOf, type ReviewResult } from './rows.ts'

// 검토 결과 보내기(FIN-REV-01의 `finance.purchaseRequest.sendReview`).
//
// **보내는 일은 하나인데 결과가 둘이다** — 명세가 그렇게 적었다. 보완이 하나라도 있으면 나가는 것이
// 보완 요청이고(단계는 검토 그대로, 걸린 때가 찍힌다), 아니면 검토가 끝난 것이다(구매로).
//
// **반려는 계약이 말하지 않는다.** 판정 값에는 있는데(`finance.reviewResults`) 요청이 어디로 가는지가
// 없다. 여기서는 '보완이 없으면 검토가 끝났다'로 읽는다 — 반려된 품목은 승인액 없이 남고 나머지를
// 사러 간다. 전부 반려면 승인액 0원으로 구매 단계에 선다. 그 자리는 사람이 정해야 한다(보고했다).

export interface Reviewer {
  memberId: string
}

interface Verdict {
  result: string | null
  approvedAmount: number | null
}

/** 판정 목록의 이름(FIN-REV-01의 itemList.fieldKey). 화면은 `reviews.<품목>.<칸>`으로 담는다. */
const LIST = 'reviews'

/**
 * 품목마다의 판정. **두 꼴로 온다** — 화면이 보낸 평평한 꼴과 계약이 적은 줄 배열. 어느 쪽이든
 * 같은 뜻으로 읽되 모르는 모양은 막는다.
 */
function verdictsOf(body: Body): Map<string, Verdict> {
  const found = new Map<string, Verdict>()
  const readOne = (row: Body): Verdict => ({
    result: readWord(row, 'result', '검토 결과'),
    approvedAmount: readCount(row, 'approvedAmount', '승인액'),
  })

  const raw = body[LIST]
  if (Array.isArray(raw)) {
    raw.forEach((row, index) => {
      if (row === null || typeof row !== 'object' || Array.isArray(row)) {
        throw new Blocked(`판정 ${index + 1}번째 줄의 모양이 아닙니다`)
      }
      const one = row as Body
      const id = readWord(one, 'id', '판정한 품목')
      if (id === null) throw new Blocked('어느 품목의 판정인지가 없습니다')
      found.set(id, readOne(one))
    })
    return found
  }
  if (raw !== undefined && raw !== null && typeof raw !== 'string') throw new Blocked('판정 목록의 모양이 아닙니다')

  const prefix = `${LIST}.`
  const rows = new Map<string, Body>()
  for (const [key, value] of Object.entries(body)) {
    if (!key.startsWith(prefix)) continue
    const rest = key.slice(prefix.length)
    const dot = rest.lastIndexOf('.')
    if (dot <= 0) continue
    const itemId = rest.slice(0, dot)
    const row = rows.get(itemId) ?? {}
    row[rest.slice(dot + 1)] = value
    rows.set(itemId, row)
  }
  for (const [itemId, row] of rows) found.set(itemId, readOne(row))
  return found
}

/**
 * 판정과 승인액을 요청자에게 보낸다.
 *
 * **판정의 단위가 품목이다.** 품목마다 판정이 있어야 하고 하나라도 없으면 막는다 — 반쯤 보낸 판정은
 * 판정이 아니다. 앞서 내린 판정이 있으면 그것이 함께 온 것으로 본다(검토는 한 번에 끝나지 않는다).
 * 안 보낸 승인액은 화면이 보여 주던 처음 값 — 앞선 승인액, 없으면 요청액 — 이다(`finance/review.ts`).
 *
 * **보완·반려된 품목에는 승인액이 없다.** 승인액을 더하는 자리(`totalApproved`·`budgetAvailable`)가
 * 그것을 승인된 돈으로 세기 때문이다.
 *
 * **이미 판정을 보낸 요청에는 또 보낼 수 없다**(409, 계약의 repeat: conflict) — 보완을 기다리는
 * 요청도 같다. 재제출이 오면 다시 보낼 수 있다.
 */
export async function sendReview(
  db: Db,
  orgId: string,
  who: Reviewer,
  body: unknown,
  now: Date,
): Promise<Record<string, never>> {
  const draft = objectOf(body, '검토 결과')
  const row = await requestOf(db, orgId, readWord(draft, 'requestId', '요청') ?? '')
  if (row === null) throw new NotFound('그 구매 요청을 찾지 못했습니다')
  if (row.stage === 'draft') throw new Blocked('아직 제출되지 않은 요청입니다')
  if (row.stage !== 'review') throw new AlreadyExists('이미 판정을 보낸 요청입니다')
  if (row.supplementRequestedAt !== null) {
    throw new AlreadyExists('이미 보완을 요청한 요청입니다. 재제출을 기다리는 중입니다')
  }

  const items = await itemsOf(db, orgId, row.id)
  if (items.length === 0) throw new Blocked('판정할 품목이 없습니다')
  const verdicts = verdictsOf(draft)
  const known = new Set(items.map((item) => item.id))
  for (const itemId of verdicts.keys()) {
    if (!known.has(itemId)) throw new Blocked('이 요청에 없는 품목의 판정입니다')
  }

  const decided = items.map((item) => {
    const given = verdicts.get(item.id)
    const result = codeOf(REVIEW_RESULTS, given?.result ?? item.reviewResult, '검토 결과') as ReviewResult | null
    if (result === null) throw new Blocked(`아직 판정하지 않은 품목이 있습니다: ${item.name}`)
    const approvedAmount =
      result === 'approved'
        ? (given?.approvedAmount ?? item.approvedAmount ?? requestedAmount(item.quantity, item.unitPrice))
        : null
    if (result === 'approved' && approvedAmount === null) {
      throw new Blocked(`승인액이 비어 있습니다: ${item.name}`)
    }
    return { id: item.id, result, approvedAmount }
  })
  const supplementing = decided.some((one) => one.result === 'supplement')

  await db.transaction(async (tx) => {
    for (const one of decided) {
      await tx
        .update(purchaseRequestItems)
        .set({ reviewResult: one.result, approvedAmount: one.approvedAmount })
        .where(and(eq(purchaseRequestItems.orgId, orgId), eq(purchaseRequestItems.id, one.id)))
    }
    await tx
      .update(purchaseRequests)
      .set(
        supplementing
          ? // 보완 요청. 단계는 검토 그대로이고 걸린 때가 찍힌다. 언제까지 다시 내라는지는
            // FIN-REV-01에 적는 자리가 없어 비워 둔다 — 지어내지 않는다.
            { supplementRequestedAt: now, reviewedByMemberId: who.memberId, updatedAt: now }
          : // 검토 끝. 승인된 것을 사러 간다.
            { stage: 'purchase', reviewedAt: now, reviewedByMemberId: who.memberId, updatedAt: now },
      )
      .where(and(eq(purchaseRequests.orgId, orgId), eq(purchaseRequests.id, row.id)))
  })
  return {}
}
