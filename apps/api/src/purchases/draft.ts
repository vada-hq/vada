import { and, eq, inArray, like } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import { budgetItems, organizations, purchaseRequestItems, purchaseRequests } from '../db/schema.ts'
import { dayOf } from '../finance/labels.ts'
import { Blocked, NotFound } from '../routes.ts'
import { moment } from '../time.ts'
import { objectOf, readCount, readDay, readWord, rowsOf } from './body.ts'
import { codeOf, ITEM_CATEGORIES, PURCHASE_TYPES, QUOTE_STATUSES, REQUEST_PRIORITIES } from './options.ts'
import {
  departmentOfMember,
  eventExists,
  itemsOf,
  requestOf,
  type ItemRow,
  type QuoteStatus,
  type RequestRow,
} from './rows.ts'

// 구매 요청 작성·수정(FIN-REQ-01) — 초안 읽기 하나 · 임시 저장 · 제출.
//
// **임시 저장과 제출은 같은 것을 보낸다.** 명세가 `payloadScope: purchaseRequestDraft` 하나로 묶어
// 두었고, 다른 것은 보내는 곳과 그 결과의 단계뿐이다 — 임시 저장하면 `draft`이고 제출하면 `review`다.
// 회의 만들기(`meetings/create.ts`)가 같은 모양이다.
//
// **어느 행사·어느 요청인지는 몸통이 실어 온다.** 계약의 두 자리에는 인자가 하나도 없는데 요청은
// 행사에 딸리고, 고치는 요청에는 이름표가 있어야 한다. FIN-EVID-01의 '처리 완료'가 requestId를
// 몸통에 실어 보내는 것과 같은 길이다(명세에 그 배선이 없다 — 보고했다).
//
// **덮어쓰기의 열쇠는 이름표다.** 처음 저장하면 줄이 생기고 그 id가 돌아간다 — 화면이 그것을 초안에
// 남겨 다음 저장에 실어 보내면 같은 줄이 바뀐다. 회의 초안은 '이 사람이 쓰던 초안'으로 덮어쓰는데,
// 구매 요청은 한 사람이 한 행사에 여럿 쓸 수 있어 그 규칙으로는 남의 것이 아니라 **제 옛 초안이**
// 조용히 지워진다.

/** 이 요청을 보낸 구성원. 새 요청의 요청자이고 부서는 이 사람의 소속이다. */
export interface Requester {
  memberId: string
}

// ── 읽기 ────────────────────────────────────────────────────────────────

export interface DraftItem {
  itemName: string
  itemCategory: string
  budgetItem: string
  purchaseType: string
  quantity?: number
  unit: string
  unitPrice?: number
  vendor?: string
  productUrl?: string
  option?: string
  deliveryNote?: string
  quoteStatus: string
}

export interface PurchaseDraft {
  title: string
  department: string
  neededOn: string
  priority: string
  purpose: string
  items: DraftItem[]
}

/** 아직 아무것도 적히지 않은 품목 한 줄. 견적 상태의 처음 값은 명세가 정했다(initialValue). */
const BLANK_ITEM: DraftItem = {
  itemName: '',
  itemCategory: '',
  budgetItem: '',
  purchaseType: '',
  unit: '',
  quoteStatus: 'none',
}

/**
 * 표의 품목을 화면이 채우는 칸으로.
 *
 * **아직 안 적은 수는 내지 않는다** — 빈 글로 주면 같은 조각이 때로 수, 때로 글이 된다(명세).
 * 없는 글 칸(판매처·URL·옵션·배송 요청)도 내지 않는다. 값은 코드 그대로다 — `supplies`를
 * '소모품'으로 풀어 주는 것은 화면의 일이다.
 */
function draftItemOf(item: ItemRow): DraftItem {
  return {
    itemName: item.name,
    itemCategory: item.category ?? '',
    budgetItem: item.budgetItemId ?? '',
    purchaseType: item.purchaseType ?? '',
    ...(item.quantity === null ? {} : { quantity: item.quantity }),
    unit: item.unit ?? '',
    ...(item.unitPrice === null ? {} : { unitPrice: item.unitPrice }),
    ...(item.vendor === null ? {} : { vendor: item.vendor }),
    ...(item.productUrl === null ? {} : { productUrl: item.productUrl }),
    ...(item.option === null ? {} : { option: item.option }),
    ...(item.deliveryNote === null ? {} : { deliveryNote: item.deliveryNote }),
    quoteStatus: item.quoteStatus,
  }
}

/**
 * 작성하거나 고치는 요청 한 건(`finance.purchaseRequestDraft`).
 *
 * **requestId가 비면 새로 쓰는 것이다.** 그때도 서버가 이미 아는 것 — 작성자의 소속 부서 — 은
 * 채워져 오고, 품목 한 줄이 비어 있는 채로 온다(list.minItems가 1이다).
 */
export async function purchaseRequestDraft(
  db: Db,
  orgId: string,
  who: Requester,
  eventId: string,
  requestId: string,
): Promise<PurchaseDraft> {
  if (!(await eventExists(db, orgId, eventId))) throw new NotFound('그 행사를 찾지 못했습니다')
  if (requestId === '') {
    const department = await departmentOfMember(db, orgId, who.memberId)
    return {
      title: '',
      department: department.name ?? '',
      neededOn: '',
      priority: '',
      purpose: '',
      items: [BLANK_ITEM],
    }
  }
  const row = await requestOf(db, orgId, requestId)
  // 다른 행사의 요청을 이 행사로 열면 그 행사의 것이 아니다.
  if (row === null || row.eventId !== eventId) throw new NotFound('그 구매 요청을 찾지 못했습니다')
  const items = await itemsOf(db, orgId, row.id)
  return {
    title: row.title,
    department: row.departmentName ?? '',
    neededOn: dayOf(row.neededOn) ?? '',
    priority: row.priority ?? '',
    purpose: row.purpose ?? '',
    items: items.map(draftItemOf),
  }
}

// ── 쓰기 ────────────────────────────────────────────────────────────────

interface ReadItem {
  name: string | null
  category: string | null
  purchaseType: string | null
  budgetItemId: string | null
  quantity: number | null
  unit: string | null
  unitPrice: number | null
  vendor: string | null
  productUrl: string | null
  option: string | null
  deliveryNote: string | null
  quoteStatus: QuoteStatus
}

interface ReadDraft {
  eventId: string
  requestId: string | null
  title: string | null
  neededOn: Date | null
  priority: string | null
  purpose: string | null
  items: ReadItem[]
}

/**
 * 몸통을 읽는다. **값은 코드여야 하고 예산 항목은 그 행사의 것이어야 한다.**
 *
 * 임시 저장은 다 채우지 않아도 되므로 비어 있는 것은 막지 않는다 — 다만 적힌 값은 받을 수 있는
 * 값이어야 한다. 조용히 비우면 사람은 고른 줄 알고 지나간다.
 */
async function readDraftBody(db: Db, orgId: string, body: unknown): Promise<ReadDraft> {
  const draft = objectOf(body, '구매 요청')
  const eventId = readWord(draft, 'eventId', '행사')
  if (eventId === null) throw new Blocked('어느 행사의 요청인지가 없습니다')
  if (!(await eventExists(db, orgId, eventId))) throw new Blocked('이 학생회에 그런 행사가 없습니다')

  const items: ReadItem[] = rowsOf(draft, 'items', '품목').map((row, index) => {
    const at = `${index + 1}번째 품목의`
    return {
      name: readWord(row, 'itemName', `${at} 품목명`),
      category: codeOf(ITEM_CATEGORIES, readWord(row, 'itemCategory', `${at} 품목 카테고리`), '품목 카테고리'),
      purchaseType: codeOf(PURCHASE_TYPES, readWord(row, 'purchaseType', `${at} 구매 유형`), '구매 유형'),
      budgetItemId: readWord(row, 'budgetItem', `${at} 예산 항목`),
      quantity: readCount(row, 'quantity', `${at} 수량`),
      unit: readWord(row, 'unit', `${at} 단위`),
      unitPrice: readCount(row, 'unitPrice', `${at} 예상 단가`),
      vendor: readWord(row, 'vendor', `${at} 판매처`),
      productUrl: readWord(row, 'productUrl', `${at} 상품 URL`),
      option: readWord(row, 'option', `${at} 상품 옵션`),
      deliveryNote: readWord(row, 'deliveryNote', `${at} 배송 요청사항`),
      // 견적 상태의 처음 값은 명세가 정했다(initialValue: none). 안 보내면 그 값이다.
      quoteStatus: (codeOf(QUOTE_STATUSES, readWord(row, 'quoteStatus', `${at} 견적서 확보 상태`), '견적서 확보 상태') ??
        'none') as QuoteStatus,
    }
  })

  // **그 행사의 예산 항목이어야 한다.** 남의 학생회 것도 다른 행사 것도 이 요청이 쓸 예산이 아니다.
  // 표도 막지만(복합 외래 키) 여기서 먼저 막아야 '받을 수 없는 값'(422)이지 서버의 고장이 아니다.
  const wanted = [...new Set(items.map((item) => item.budgetItemId).filter((id): id is string => id !== null))]
  if (wanted.length > 0) {
    const ours = await db
      .select({ id: budgetItems.id })
      .from(budgetItems)
      .where(and(eq(budgetItems.orgId, orgId), eq(budgetItems.eventId, eventId), inArray(budgetItems.id, wanted)))
    const known = new Set(ours.map((row) => row.id))
    if (wanted.some((id) => !known.has(id))) throw new Blocked('이 행사의 예산 항목이 아닙니다')
  }

  return {
    eventId,
    requestId: readWord(draft, 'requestId', '요청'),
    title: readWord(draft, 'title', '요청 제목'),
    neededOn: readDay(draft, 'neededOn', '필요한 날짜'),
    priority: codeOf(REQUEST_PRIORITIES, readWord(draft, 'priority', '우선순위'), '우선순위'),
    purpose: readWord(draft, 'purpose', '구매 목적'),
    items,
  }
}

/**
 * 제출이 요구하는 칸. **명세가 필수라 적은 것 그대로다**(FIN-REQ-01의 required) — 제목·필요한
 * 날짜·구매 목적, 품목마다 품목명·카테고리·예산 항목·구매 유형·수량·단위·단가. 우선순위는 필수가
 * 아니다. 비면 어느 칸인지 말하고 막는다.
 */
function mustBeComplete(read: ReadDraft): void {
  if (read.title === null) throw new Blocked('요청 제목 칸이 비어 있습니다')
  if (read.neededOn === null) throw new Blocked('필요한 날짜 칸이 비어 있습니다')
  if (read.purpose === null) throw new Blocked('구매 목적 칸이 비어 있습니다')
  if (read.items.length === 0) throw new Blocked('품목이 하나도 없습니다')
  read.items.forEach((item, index) => {
    const at = `${index + 1}번째 품목의`
    if (item.name === null) throw new Blocked(`${at} 품목명이 비어 있습니다`)
    if (item.category === null) throw new Blocked(`${at} 품목 카테고리가 비어 있습니다`)
    if (item.budgetItemId === null) throw new Blocked(`${at} 예산 항목이 비어 있습니다`)
    if (item.purchaseType === null) throw new Blocked(`${at} 구매 유형이 비어 있습니다`)
    if (item.quantity === null) throw new Blocked(`${at} 수량이 비어 있습니다`)
    if (item.unit === null) throw new Blocked(`${at} 단위가 비어 있습니다`)
    if (item.unitPrice === null) throw new Blocked(`${at} 예상 단가가 비어 있습니다`)
  })
}

/**
 * 고치려는 줄. 이름표가 없으면 새로 쓰는 것이다(null).
 *
 * **내가 쓴 요청만 고친다.** 계약의 권한 영역은 `member`(구성원이면 된다)지만, 임시 저장한 요청은
 * 아직 아무에게도 보이지 않은 그 사람의 글이다 — 남이 덮어쓰면 그 사람은 제 초안이 왜 바뀌었는지
 * 알 길이 없다. 남의 학생회 요청은 없는 것이다(404).
 */
async function targetOf(db: Db, orgId: string, who: Requester, read: ReadDraft): Promise<RequestRow | null> {
  if (read.requestId === null) return null
  const row = await requestOf(db, orgId, read.requestId)
  if (row === null) throw new NotFound('그 구매 요청을 찾지 못했습니다')
  if (row.requesterMemberId !== who.memberId) throw new Blocked('내가 쓴 요청만 고칠 수 있습니다')
  if (row.eventId !== read.eventId) throw new Blocked('그 요청은 다른 행사의 것입니다')
  return row
}

/** 한 벌로 묶는 자리. `db.transaction`이 넘겨주는 그것이다. */
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]

/**
 * 요청 한 줄과 품목을 쓴다. **품목은 통째로 갈아 끼운다** — 남기면 지운 줄이 되살아난다.
 * 아직 안 낸 요청이라 품목에 판정·발주·결제가 딸려 있지 않으므로 잃는 것이 없다.
 */
async function writeRequest(
  tx: Tx,
  orgId: string,
  who: Requester,
  read: ReadDraft,
  row: RequestRow | null,
  department: string | null,
  at: Date,
  newId: () => string,
  extra: Partial<typeof purchaseRequests.$inferInsert>,
): Promise<string> {
  const values = {
    // 표가 이름을 요구하지만 임시 저장은 이름 없이도 보관한다 — 빈 글이 '아직 안 적었다'다.
    title: read.title ?? '',
    purpose: read.purpose,
    priority: read.priority,
    neededOn: read.neededOn,
    updatedAt: at,
    ...extra,
  }
  let id: string
  if (row === null) {
    id = newId()
    await tx.insert(purchaseRequests).values({
      id,
      orgId,
      eventId: read.eventId,
      // 요청자와 부서는 서버가 안다. 몸통에 실린 부서 이름은 읽기 전용 칸에 그린 글이다.
      departmentId: department,
      requesterMemberId: who.memberId,
      stage: 'draft',
      createdAt: at,
      ...values,
    })
  } else {
    id = row.id
    await tx
      .update(purchaseRequests)
      .set(values)
      // 고칠 때도 학생회를 다시 건다. 위에서 찾았다고 여기서 빼면 울타리가 한 겹이 된다.
      .where(and(eq(purchaseRequests.orgId, orgId), eq(purchaseRequests.id, id)))
  }

  await tx
    .delete(purchaseRequestItems)
    .where(and(eq(purchaseRequestItems.orgId, orgId), eq(purchaseRequestItems.requestId, id)))
  if (read.items.length > 0) {
    await tx.insert(purchaseRequestItems).values(
      read.items.map((item, sortOrder) => ({
        id: newId(),
        orgId,
        requestId: id,
        sortOrder,
        name: item.name ?? '',
        category: item.category,
        purchaseType: item.purchaseType,
        budgetItemId: item.budgetItemId,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice,
        vendor: item.vendor,
        productUrl: item.productUrl,
        option: item.option,
        deliveryNote: item.deliveryNote,
        quoteStatus: item.quoteStatus,
      })),
    )
  }
  return id
}

/** 사람이 부르는 번호의 꼴. 개발용 응답의 예 `PR-2026-0031`을 따른다. */
const CODE_PREFIX = 'PR'
const CODE_DIGITS = 4

/**
 * 다음 요청 번호. **`PR-연도-일련번호`이고 일련번호는 이 학생회가 그 해에 낸 순서다.**
 *
 * 학생회마다 따로 센다 — 번호는 그 학생회 안에서 요청을 부르는 말이고 옆 학생회와 겹쳐도 부를 데가
 * 다르다. 해마다 다시 센다 — 개발용 응답의 꼴이 연도를 앞세웠고, 학생회는 해를 단위로 산다.
 * 연도는 제출한 때를 서버가 못 박은 시간대로 본 것이다(`time.ts`).
 *
 * **가장 큰 번호 다음이다.** 개수로 세면 지워진 번호(행사와 함께 사라진 요청)가 되살아나 두 요청이
 * 같은 번호를 갖는다. 같은 학생회의 두 제출이 겹쳐도 번호가 겹치지 않게 학생회 줄을 잠그고 센다.
 */
async function nextCode(tx: Tx, orgId: string, at: Date): Promise<string> {
  await tx.select({ id: organizations.id }).from(organizations).where(eq(organizations.id, orgId)).for('update')
  const prefix = `${CODE_PREFIX}-${moment(at).slice(0, 4)}-`
  const rows = await tx
    .select({ code: purchaseRequests.code })
    .from(purchaseRequests)
    .where(and(eq(purchaseRequests.orgId, orgId), like(purchaseRequests.code, `${prefix}%`)))
  let last = 0
  for (const row of rows) {
    const serial = Number(row.code?.slice(prefix.length))
    if (Number.isInteger(serial) && serial > last) last = serial
  }
  return `${prefix}${String(last + 1).padStart(CODE_DIGITS, '0')}`
}

/**
 * 임시 저장(`finance.purchaseRequest.saveDraft`). **덮어쓰기다** — 이름표가 오면 그 줄을 고치고,
 * 없으면 새 줄을 만들어 그 이름표를 돌려준다. 이미 낸 요청은 여기로 고칠 수 없다.
 */
export async function savePurchaseDraft(
  db: Db,
  orgId: string,
  who: Requester,
  body: unknown,
  newId: () => string,
  now: Date,
): Promise<{ id: string }> {
  const read = await readDraftBody(db, orgId, body)
  const row = await targetOf(db, orgId, who, read)
  if (row !== null && row.stage !== 'draft') throw new Blocked('이미 제출한 요청은 임시 저장할 수 없습니다')
  const department = row === null ? (await departmentOfMember(db, orgId, who.memberId)).id : null
  const id = await db.transaction((tx) => writeRequest(tx, orgId, who, read, row, department, now, newId, {}))
  return { id }
}

/**
 * 제출(`finance.purchaseRequest.submit`). 임시 저장과 같은 것을 보내되 **필수 칸이 다 차야 하고**,
 * 요청은 검토로 넘어가며 번호가 붙는다. 이미 낸 요청을 또 낼 수는 없다 — 두 번 눌린 것은 멱등 키가
 * 앞서 가린다(계약).
 */
export async function submitPurchaseRequest(
  db: Db,
  orgId: string,
  who: Requester,
  body: unknown,
  newId: () => string,
  now: Date,
): Promise<{ id: string }> {
  const read = await readDraftBody(db, orgId, body)
  mustBeComplete(read)
  const row = await targetOf(db, orgId, who, read)
  if (row !== null && row.stage !== 'draft') throw new Blocked('이미 제출된 요청입니다')
  const department = row === null ? (await departmentOfMember(db, orgId, who.memberId)).id : null
  const id = await db.transaction(async (tx) => {
    const code = await nextCode(tx, orgId, now)
    return writeRequest(tx, orgId, who, read, row, department, now, newId, {
      stage: 'review',
      submittedAt: now,
      code,
    })
  })
  return { id }
}
