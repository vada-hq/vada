import { and, eq, inArray } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import { purchaseRequestItems, purchaseRequests } from '../db/schema.ts'
import { dayOf, joinParts, orNote, quantityNote, requestedAmount, won } from '../finance/labels.ts'
import { Blocked, NotFound } from '../routes.ts'
import { objectOf, readWord, type Body } from './body.ts'
import { ITEM_CATEGORIES, labelOf } from './options.ts'
import { itemOf, itemsOf, requestOf, type ItemRow, type RequestRow } from './rows.ts'

// 보완 요청 확인·재제출(FIN-SUP-01) — 읽기 넷과 쓰기 둘.
//
// **보완은 단계가 아니다.** 보완이 걸린 요청도 검토 중이고, 걸렸다는 사실은 `supplementRequestedAt`이
// 말한다(`db/schema.ts`). 그래서 재제출은 그 때를 지우는 일이다 — 지우면 상태가 '검토 대기'로 돌아가고
// (`finance/labels.ts`의 statusOf), 보완이던 품목은 판정 없는 품목이 되어 재정부가 다시 본다.
//
// **다시 받을 칸과 파일 자리는 비어 있다.** 명세는 '무엇을 묻는지는 그 품목의 구매 유형이 정한다'고
// 적었지만 유형별 목록을 들지 않았고, 재정부가 무엇을 다시 묻는지 적는 자리가 FIN-REV-01에 없다
// (판정과 승인액뿐). 지어내지 않는다 — 정해지는 날 여기 한 곳이 바뀐다.

export interface Requester {
  memberId: string
}

// ── 읽기 ────────────────────────────────────────────────────────────────

export interface SupplementRequestHead {
  reviewerNote: string
  requestedAtNote: string
  dueNote: string
}

/**
 * 이 요청에 걸린 보완 요청의 머리(`finance.supplementRequest`). **걸려 있지 않으면 없다**(404) —
 * 재제출한 뒤에도 같다. 문구는 명세의 예를 따른다('요청 담당자 김바다' · '보완 요청일 …' ·
 * '재제출 권장 기한 …'). 기한은 FIN-REV-01에 적는 자리가 없어 비어 있을 수 있고, 그때는 그 사실을 말한다.
 */
export async function supplementRequest(db: Db, orgId: string, requestId: string): Promise<SupplementRequestHead> {
  const row = await requestOf(db, orgId, requestId)
  if (row === null) throw new NotFound('그 구매 요청을 찾지 못했습니다')
  if (row.supplementRequestedAt === null) throw new NotFound('이 요청에 걸린 보완 요청이 없습니다')
  const due = dayOf(row.supplementDueOn)
  return {
    reviewerNote: row.reviewerName === null ? '요청 담당자 미정' : `요청 담당자 ${row.reviewerName}`,
    requestedAtNote: `보완 요청일 ${dayOf(row.supplementRequestedAt)}`,
    dueNote: due === null ? '재제출 기한 미정' : `재제출 권장 기한 ${due}`,
  }
}

export interface SupplementItem {
  id: string
  title: string
  categoryNote: string
  reason: string
  name: string
  quantityNote: string
  unitPriceNote: string
  amountNote: string
  budgetItem: string
}

const asSupplement = (item: ItemRow) => item.reviewResult === 'supplement'

/**
 * 보완이 걸린 품목들(`finance.supplementItems`) — 판정이 보완인 품목이다. 분류는 코드가 아니라
 * 명세의 말로 온다('인쇄물 · 홍보비'). 사유는 재정부가 쓴 글인데 그 글을 적는 자리가 FIN-REV-01에
 * 없어 비어 있을 수 있다 — 그때는 그 사실을 말한다.
 */
export async function supplementItems(db: Db, orgId: string, requestId: string): Promise<SupplementItem[] | null> {
  const row = await requestOf(db, orgId, requestId)
  if (row === null) return null
  return (await itemsOf(db, orgId, row.id)).filter(asSupplement).map((item) => {
    const asked = requestedAmount(item.quantity, item.unitPrice)
    return {
      id: item.id,
      title: `보완 품목 — ${item.name}`,
      categoryNote: orNote(joinParts([labelOf(ITEM_CATEGORIES, item.category), item.budgetItemName]), '분류 미정'),
      reason: orNote(item.reviewNote, '보완 사유가 적혀 있지 않습니다'),
      name: item.name,
      quantityNote: quantityNote(item.quantity, item.unit),
      unitPriceNote: item.unitPrice === null ? '단가 미정' : won(item.unitPrice),
      amountNote: asked === null ? '금액 미정' : won(asked),
      budgetItem: orNote(item.budgetItemName, '예산 항목 미정'),
    }
  })
}

export interface SupplementField {
  key: string
  label: string
  placeholder: string
}

/**
 * 이 보완 품목에서 다시 받아야 할 칸(`finance.supplementInputFields`). **아직 빈 목록이다** — 위를 보라.
 * 없는 품목은 없다고 답한다.
 */
export async function supplementInputFields(db: Db, orgId: string, itemId: string): Promise<SupplementField[] | null> {
  return (await itemOf(db, orgId, itemId)) === null ? null : []
}

/** 이 보완 품목에서 받아야 할 파일(`finance.supplementAttachments`). 칸과 같은 사정으로 빈 목록이다. */
export async function supplementAttachments(db: Db, orgId: string, itemId: string): Promise<SupplementField[] | null> {
  return (await itemOf(db, orgId, itemId)) === null ? null : []
}

// ── 쓰기 ────────────────────────────────────────────────────────────────

interface Answers {
  corrections: Record<string, string>
  attachments: Record<string, string>
}

const SETS = ['corrections', 'attachments'] as const

/**
 * 한 품목의 답변. 화면이 `품목.묶음.칸` 꼴로 담는다(FIN-SUP-01의 valueKey) — 칸의 이름은 데이터가
 * 주므로 여기서 미리 알 수 없고, 그대로 담는다. **빈 글은 저장하지 않는다.** 아무것도 안 적었으면
 * null이다.
 */
function answersOf(body: Body, itemId: string): Answers | null {
  const answers: Answers = { corrections: {}, attachments: {} }
  let any = false
  for (const [key, value] of Object.entries(body)) {
    for (const set of SETS) {
      const prefix = `${itemId}.${set}.`
      if (!key.startsWith(prefix)) continue
      const field = key.slice(prefix.length)
      if (field === '' || value === null || value === undefined) continue
      if (typeof value !== 'string') throw new Blocked(`보완 답변 '${field}' 칸은 글로 적어 주세요`)
      const trimmed = value.trim()
      if (trimmed === '') continue
      answers[set][field] = trimmed
      any = true
    }
  }
  return any ? answers : null
}

/**
 * 답을 적을 요청. **요청자만 적는다** — 보완은 그 사람에게 걸린 것이다. 보완이 걸려 있지 않으면
 * 적을 것이 없다.
 */
async function pendingOf(db: Db, orgId: string, who: Requester, body: Body): Promise<{ row: RequestRow; asked: ItemRow[] }> {
  const requestId = readWord(body, 'requestId', '요청') ?? ''
  const row = await requestOf(db, orgId, requestId)
  if (row === null) throw new NotFound('그 구매 요청을 찾지 못했습니다')
  if (row.requesterMemberId !== who.memberId) throw new Blocked('내가 쓴 요청의 보완만 답할 수 있습니다')
  if (row.supplementRequestedAt === null) throw new Blocked('보완이 걸린 요청이 아닙니다')
  const asked = (await itemsOf(db, orgId, row.id)).filter(asSupplement)
  return { row, asked }
}

async function storeAnswers(db: Db, orgId: string, body: Body, asked: ItemRow[]): Promise<void> {
  for (const item of asked) {
    await db
      .update(purchaseRequestItems)
      .set({ supplementAnswers: answersOf(body, item.id) })
      .where(and(eq(purchaseRequestItems.orgId, orgId), eq(purchaseRequestItems.id, item.id)))
  }
}

/**
 * 보완 답변 임시 저장(`finance.purchaseRequest.saveSupplement`). **덮어쓰기다** — 품목마다 답 한 벌이고
 * 다시 저장하면 그 벌이 바뀐다. 요청은 그대로다.
 */
export async function saveSupplement(
  db: Db,
  orgId: string,
  who: Requester,
  body: unknown,
): Promise<Record<string, never>> {
  const draft = objectOf(body, '보완 답변')
  const { asked } = await pendingOf(db, orgId, who, draft)
  await db.transaction((tx) => storeAnswers(tx as unknown as Db, orgId, draft, asked))
  return {}
}

/**
 * 재제출(`finance.purchaseRequest.resubmitSupplement`). 답을 남기고 **보완을 푼다** — 걸린 때와 기한이
 * 지워져 상태가 검토 대기로 돌아가고, 보완이던 품목은 판정과 승인액이 비워져 재정부가 다시 본다.
 * 승인됐던 품목은 그대로다. 두 번 눌린 것은 멱등 키가 앞서 가린다(계약).
 */
export async function resubmitSupplement(
  db: Db,
  orgId: string,
  who: Requester,
  body: unknown,
  now: Date,
): Promise<Record<string, never>> {
  const draft = objectOf(body, '보완 답변')
  const { row, asked } = await pendingOf(db, orgId, who, draft)
  await db.transaction(async (tx) => {
    const writer = tx as unknown as Db
    await storeAnswers(writer, orgId, draft, asked)
    if (asked.length > 0) {
      await writer
        .update(purchaseRequestItems)
        .set({ reviewResult: null, approvedAmount: null })
        .where(
          and(
            eq(purchaseRequestItems.orgId, orgId),
            inArray(
              purchaseRequestItems.id,
              asked.map((item) => item.id),
            ),
          ),
        )
    }
    await writer
      .update(purchaseRequests)
      .set({ supplementRequestedAt: null, supplementDueOn: null, updatedAt: now })
      .where(and(eq(purchaseRequests.orgId, orgId), eq(purchaseRequests.id, row.id)))
  })
  return {}
}
