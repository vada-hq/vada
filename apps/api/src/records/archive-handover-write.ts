import { and, asc, eq, inArray, ne } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import {
  members,
  payments,
  purchaseOrders,
  purchaseRequestItems,
  purchaseRequests,
  tasks,
} from '../db/schema.ts'
import { quantityNote } from '../finance/labels.ts'
import { archiveOf } from './archive-facts.ts'
import { entryLine, HANDOVER_GROUPS, headerLine } from './archive-text.ts'
import { mustBeUnpublished, upsert, type ArchiveWriter } from './archive-draft-write.ts'

/** 기록에 찾은 것이 없을 때 그 자리에 적는 말. 지어내는 대신 사실을 적는다. */
const NO_ASSETS = '구매 기록에서 찾은 품목이 없습니다'
const NO_PARTNERS = '구매·업무 기록에서 찾은 협력처·담당자가 없습니다'

/**
 * 인수인계 초안(`record.archive.generateHandoverDraft`).
 *
 * **기록에 없는 자산·연락처·담당자를 새로 만들지 않는 것이 계약이다**(REC-02A에 적힌
 * 문장). 그래서 기계가 짓지 않고 표에서 **결정적으로** 모은다 — 산 품목이 재사용
 * 자산이고, 발주처·결제처가 협력처이며, 업무의 담당자가 담당자다. 연락처는 어느 표에도
 * 없으므로 한 줄도 나오지 않는다. 주의사항은 기록에서 모을 수 없어 머리글만 남긴다 —
 * 사람이 적을 자리다.
 *
 * **덮어쓰기다.** 초안은 행사마다 하나뿐이고 다시 만들면 그 하나가 바뀐다.
 * 사람이 고친 글도 바뀐다 — 명세가 그렇게 적었다.
 */
export async function generateHandoverDraft(
  db: Db,
  orgId: string,
  eventId: string,
  who: ArchiveWriter,
  at: Date,
  newId: () => string,
): Promise<Record<string, never>> {
  const { row } = await archiveOf(db, orgId, eventId)
  mustBeUnpublished(row, '초안을 만들')
  const text = await handoverDraftOf(db, orgId, eventId)
  await upsert(db, orgId, eventId, row, who, at, newId, {
    handover: text,
    handoverDraftedAt: at,
  })
  return {}
}

/** 초안의 글. 묶음 머리글과 `이름: 값` 줄은 읽는 쪽(`archive-text.ts`)과 같은 규칙이다. */
async function handoverDraftOf(db: Db, orgId: string, eventId: string): Promise<string> {
  // 낸 요청의 품목만 산 것이다 — 아직 안 낸 요청의 품목은 재사용할 자산이 아니다.
  const items = await db
    .select({
      name: purchaseRequestItems.name,
      quantity: purchaseRequestItems.quantity,
      unit: purchaseRequestItems.unit,
      vendor: purchaseRequestItems.vendor,
      orderId: purchaseRequestItems.orderId,
      paymentId: purchaseRequestItems.paymentId,
      requestId: purchaseRequests.id,
      requestTitle: purchaseRequests.title,
    })
    .from(purchaseRequestItems)
    .innerJoin(purchaseRequests, eq(purchaseRequestItems.requestId, purchaseRequests.id))
    .where(
      and(
        eq(purchaseRequestItems.orgId, orgId),
        eq(purchaseRequests.eventId, eventId),
        ne(purchaseRequests.stage, 'draft'),
      ),
    )
    .orderBy(asc(purchaseRequests.createdAt), asc(purchaseRequests.id), asc(purchaseRequestItems.sortOrder))

  const requestIds = [...new Set(items.map((item) => item.requestId))]
  const [orders, paid] =
    requestIds.length === 0
      ? [[], []]
      : await Promise.all([
          db
            .select({ id: purchaseOrders.id, vendor: purchaseOrders.vendor })
            .from(purchaseOrders)
            .where(and(eq(purchaseOrders.orgId, orgId), inArray(purchaseOrders.requestId, requestIds)))
            .orderBy(asc(purchaseOrders.orderedOn), asc(purchaseOrders.id)),
          db
            .select({ id: payments.id, vendor: payments.vendor })
            .from(payments)
            .where(and(eq(payments.orgId, orgId), inArray(payments.requestId, requestIds)))
            .orderBy(asc(payments.paidOn), asc(payments.id)),
        ])
  const orderVendor = new Map(orders.map((order) => [order.id, order.vendor]))
  const paymentVendor = new Map(paid.map((payment) => [payment.id, payment.vendor]))

  // 협력처마다 거기서 산 것. 품목이 적은 업체, 발주의 업체, 결제의 업체가 전부 협력처다.
  const partners = new Map<string, string[]>()
  const bought = (vendor: string | null | undefined, name: string) => {
    const known = (vendor ?? '').trim()
    if (known === '') return
    const names = partners.get(known) ?? []
    if (!names.includes(name)) names.push(name)
    partners.set(known, names)
  }
  const assets: string[] = []
  for (const item of items) {
    assets.push(
      `${item.name}${item.quantity === null ? '' : ` ${quantityNote(item.quantity, item.unit)}`} — 구매 요청 '${item.requestTitle}'`,
    )
    bought(item.vendor, item.name)
    bought(item.orderId === null ? null : orderVendor.get(item.orderId), item.name)
    bought(item.paymentId === null ? null : paymentVendor.get(item.paymentId), item.name)
  }
  // 품목이 안 걸린 발주·결제의 업체도 협력처다 — 무엇을 샀는지는 모르므로 이름만 적는다.
  for (const vendor of [...orders.map((order) => order.vendor), ...paid.map((payment) => payment.vendor)]) {
    if (!partners.has(vendor.trim()) && vendor.trim() !== '') partners.set(vendor.trim(), [])
  }

  // 업무의 담당자. 담당이 없는 업무는 넘길 사람이 없으므로 줄이 없다.
  const assigned = await db
    .select({ title: tasks.title, assignee: members.name })
    .from(tasks)
    .innerJoin(members, and(eq(tasks.assigneeMemberId, members.id), eq(members.orgId, orgId)))
    .where(and(eq(tasks.orgId, orgId), eq(tasks.eventId, eventId)))
    .orderBy(asc(tasks.createdAt), asc(tasks.id))

  const partnerLines = [
    ...[...partners.entries()].map(([vendor, names]) =>
      entryLine(vendor, names.length === 0 ? '거래처' : names.join(' · ')),
    ),
    ...assigned.map((task) => entryLine(task.title, task.assignee)),
  ]

  return [
    headerLine(HANDOVER_GROUPS.assets),
    ...(assets.length === 0 ? [NO_ASSETS] : assets),
    headerLine(HANDOVER_GROUPS.partners),
    ...(partnerLines.length === 0 ? [NO_PARTNERS] : partnerLines),
    headerLine(HANDOVER_GROUPS.cautions),
  ].join('\n')
}
