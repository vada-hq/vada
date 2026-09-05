import { and, asc, eq, inArray, ne } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import {
  departments,
  eventArchives,
  members,
  payments,
  purchaseOrders,
  purchaseRequestItems,
  purchaseRequests,
  tasks,
} from '../db/schema.ts'
import { quantityNote } from '../finance/labels.ts'
import { Blocked } from '../routes.ts'
import { archiveOf, type ArchiveRow } from './archive-facts.ts'
import { entryLine, HANDOVER_GROUPS, headerLine } from './archive-text.ts'

// 아카이브를 쓰는 두 자리(REC-02A의 '임시 저장'과 'AI 초안 생성').
//
// **줄은 처음 쓸 때 생긴다.** 아카이브 줄을 만드는 동작이 따로 없으므로, 아무것도
// 없는 행사에 처음 저장하면 그때 줄이 난다 — 읽는 자리는 줄이 없어도 빈 초안으로
// 답하므로 그 전에도 화면은 열린다.
//
// **발행된 문서는 고치지 않는다.** 자동 본문은 굳지만(`frozen`) 회고와 인수인계는
// 줄에서 읽히므로, 발행 뒤에 여기를 고치면 '원본이 바뀌어도 이 문서는 바뀌지 않는다'는
// 말이 거짓이 된다.

/** 이 요청을 보낸 구성원. 처음 줄을 만들 때 쓴 사람으로 남는다. */
export interface ArchiveWriter {
  memberId: string
}

/** 글 칸 하나. **빈 글은 저장하지 않는다** — 지운 것과 안 적은 것을 같게 둔다. */
function readWord(draft: Record<string, unknown>, key: string, label: string): string | null {
  const value = draft[key]
  if (value === null || value === undefined) return null
  if (typeof value !== 'string') throw new Blocked(`${label} 칸은 글로 적어 주세요`)
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

/** 이 학생회의 그 부서인가. 못 찾으면 막는다 — 조용히 비우면 고른 줄 알고 지나간다. */
async function departmentOf(db: Db, orgId: string, departmentId: string | null): Promise<string | null> {
  if (departmentId === null) return null
  const rows = await db
    .select({ id: departments.id })
    .from(departments)
    .where(and(eq(departments.orgId, orgId), eq(departments.id, departmentId)))
    .limit(1)
  if (rows[0] === undefined) throw new Blocked('이 학생회에 그런 부서가 없습니다')
  return departmentId
}

/** 발행된 문서에는 아무것도 쓰지 않는다. */
function mustBeUnpublished(row: ArchiveRow | null, what: string): void {
  if (row?.status === 'published') throw new Blocked(`이미 발행된 문서는 ${what} 수 없습니다`)
}

/**
 * 줄이 있으면 고치고 없으면 만든다. 두 길이 같은 값을 쓴다 — 울타리(학생회)는 고칠
 * 때도 다시 건다.
 */
async function upsert(
  db: Db,
  orgId: string,
  eventId: string,
  row: ArchiveRow | null,
  who: ArchiveWriter,
  at: Date,
  newId: () => string,
  values: Partial<typeof eventArchives.$inferInsert>,
): Promise<void> {
  if (row === null) {
    await db.insert(eventArchives).values({
      id: newId(),
      orgId,
      eventId,
      status: 'draft',
      authorMemberId: who.memberId,
      createdAt: at,
      updatedAt: at,
      ...values,
    })
    return
  }
  await db
    .update(eventArchives)
    .set({
      // 처음 쓴 사람이 안 남아 있으면 지금 쓰는 사람이다. 남아 있으면 그대로다.
      ...(row.authorMemberId === null ? { authorMemberId: who.memberId } : {}),
      updatedAt: at,
      ...values,
    })
    .where(and(eq(eventArchives.orgId, orgId), eq(eventArchives.id, row.id)))
}

/**
 * 임시 저장(`record.archive.saveDraft`). **덮어쓰기다** — 화면이 칸 전부를 한 번에
 * 보내므로 안 보낸 칸은 비운 것이다. 검토자 칸은 검토 단계가 빠지므로 읽지 않는다.
 */
export async function saveArchiveDraft(
  db: Db,
  orgId: string,
  eventId: string,
  draft: Record<string, unknown>,
  who: ArchiveWriter,
  at: Date,
  newId: () => string,
): Promise<Record<string, never>> {
  const { row } = await archiveOf(db, orgId, eventId)
  mustBeUnpublished(row, '고칠')
  await upsert(db, orgId, eventId, row, who, at, newId, {
    onSiteOperation: readWord(draft, 'onSiteOperation', '현장 운영'),
    retroGood: readWord(draft, 'retroGood', '잘된 점'),
    retroIssues: readWord(draft, 'retroIssues', '미흡했던 점과 원인'),
    retroImprovements: readWord(draft, 'retroImprovements', '다음 행사 개선안'),
    improvementDepartmentId: await departmentOf(
      db,
      orgId,
      readWord(draft, 'improvementDepartment', '담당 부서'),
    ),
    handover: readWord(draft, 'handover', '인수인계'),
    nextOwner: readWord(draft, 'nextOwner', '다음 담당자'),
  })
  return {}
}

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
