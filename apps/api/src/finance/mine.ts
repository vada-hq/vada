import { and, asc, eq, inArray } from 'drizzle-orm'
import optionSourcesJson from '../../../../specs/figma/vada-wireframe/option-sources.json' with { type: 'json' }
import type { Db } from '../db/client.ts'
import {
  departments,
  events,
  members,
  purchaseRequestItems,
  purchaseRequests,
} from '../db/schema.ts'
import {
  COUNT_KEYS,
  countKeyOf,
  dayOf,
  joinParts,
  orNote,
  requestedAmount,
  statusOf,
  won,
  type CountKey,
  type PurchaseStage,
} from './labels.ts'

// 내 구매 요청(MY-REQ-01).
//
// **누가 냈는지로 거르는 것은 서버가 한다** — 화면은 받아온 것을 다시 자르지 않는다.
// 세는 것도 같다: 무엇을 어느 칸에 넣는지가 곧 조직의 절차라, 화면이 세면 그 절차가
// 화면에 적히게 된다.
//
// **아직 안 낸 요청은 오지 않는다.** 머리글이 '내가 **제출한** 구매 요청'이라 적었고,
// 임시 저장한 것은 재정부에 넘어간 적이 없다.

const ROLE_LABEL = new Map<string, string>(
  (
    optionSourcesJson.sources.find((source) => source.key === 'org.baseRoles') as
      | { options: Array<{ value: string; label: string }> }
      | undefined
  )?.options.map((option) => [option.value, option.label]) ?? [],
)

/** 그 행사가 이 학생회의 것인가. 아니면 없다고 답한다. */
export async function eventExists(db: Db, orgId: string, eventId: string): Promise<boolean> {
  if (eventId === '') return false
  const rows = await db
    .select({ id: events.id })
    .from(events)
    .where(and(eq(events.orgId, orgId), eq(events.id, eventId)))
    .limit(1)
  return rows.length > 0
}

function mine(orgId: string, eventId: string, memberId: string) {
  return and(
    eq(purchaseRequests.orgId, orgId),
    eq(purchaseRequests.eventId, eventId),
    eq(purchaseRequests.requesterMemberId, memberId),
  )
}

const ROW = {
  id: purchaseRequests.id,
  code: purchaseRequests.code,
  title: purchaseRequests.title,
  stage: purchaseRequests.stage,
  neededOn: purchaseRequests.neededOn,
  submittedAt: purchaseRequests.submittedAt,
  supplementRequestedAt: purchaseRequests.supplementRequestedAt,
}

export interface MyPurchaseRequest {
  id: string
  code: string
  title: string
  amountNote: string
  itemCountNote: string
  requestedAt: string
  neededOn: string
  status: string
  statusTone: string
}

export async function myPurchaseRequests(
  db: Db,
  orgId: string,
  eventId: string,
  memberId: string,
): Promise<MyPurchaseRequest[]> {
  const rows = (await db
    .select(ROW)
    .from(purchaseRequests)
    .where(mine(orgId, eventId, memberId))
    // 낸 차례대로. 임시 저장한 것은 낸 적이 없으므로 아래에서 걸러진다.
    .orderBy(asc(purchaseRequests.submittedAt), asc(purchaseRequests.id))) as Array<{
    id: string
    code: string | null
    title: string
    stage: PurchaseStage
    neededOn: Date | null
    submittedAt: Date | null
    supplementRequestedAt: Date | null
  }>

  const submitted = rows.filter((row) => row.stage !== 'draft')
  const items = await itemsOf(
    db,
    orgId,
    submitted.map((row) => row.id),
  )

  return submitted.map((row) => {
    const mineItems = items.filter((item) => item.requestId === row.id)
    const status = statusOf(row.stage, row.supplementRequestedAt)
    return {
      id: row.id,
      code: orNote(row.code, '번호 미정'),
      title: row.title,
      amountNote: won(
        mineItems.reduce(
          (sum, item) => sum + (requestedAmount(item.quantity, item.unitPrice) ?? 0),
          0,
        ),
      ),
      // 품목이 몇인지가 세는 말까지 붙어서 온다.
      itemCountNote: `${mineItems.length}종`,
      requestedAt: orNote(dayOf(row.submittedAt), '미제출'),
      neededOn: orNote(dayOf(row.neededOn), '필요한 날짜 미정'),
      status: status.label,
      statusTone: status.tone,
    }
  })
}

async function itemsOf(db: Db, orgId: string, requestIds: readonly string[]) {
  if (requestIds.length === 0) return []
  return db
    .select({
      requestId: purchaseRequestItems.requestId,
      quantity: purchaseRequestItems.quantity,
      unitPrice: purchaseRequestItems.unitPrice,
    })
    .from(purchaseRequestItems)
    .where(
      and(
        eq(purchaseRequestItems.orgId, orgId),
        inArray(purchaseRequestItems.requestId, [...requestIds]),
      ),
    )
}

export type MyPurchaseRequestSummary = Record<CountKey, string> & { scopeNote: string }

/**
 * 머리.
 *
 * **누가 보고 있는지를 서버가 문장으로 잇는다** — 셸도 그 사람을 알지만 무엇을
 * 어떻게 부를지는 서버가 정한다(EVT-FIN-01의 itemsNote와 같은 계열).
 */
export async function myPurchaseRequestSummary(
  db: Db,
  orgId: string,
  eventId: string,
  memberId: string,
): Promise<MyPurchaseRequestSummary> {
  const who = await db
    .select({ name: members.name, role: members.role, department: departments.name })
    .from(members)
    .leftJoin(
      departments,
      and(eq(members.departmentId, departments.id), eq(departments.orgId, orgId)),
    )
    .where(and(eq(members.orgId, orgId), eq(members.id, memberId)))
    .limit(1)

  const rows = (await db
    .select({
      stage: purchaseRequests.stage,
      supplementRequestedAt: purchaseRequests.supplementRequestedAt,
    })
    .from(purchaseRequests)
    .where(mine(orgId, eventId, memberId))) as Array<{
    stage: PurchaseStage
    supplementRequestedAt: Date | null
  }>

  const counts = new Map<CountKey, number>(COUNT_KEYS.map((key) => [key, 0]))
  for (const row of rows) {
    const key = countKeyOf(row.stage, row.supplementRequestedAt)
    if (key !== null) counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  const me = who[0]
  return {
    scopeNote: joinParts([
      '이 행사에서 내가 제출한 구매 요청',
      me?.name ?? null,
      me?.department ?? null,
      me === undefined ? null : (ROLE_LABEL.get(me.role) ?? me.role),
    ]),
    ...(Object.fromEntries(
      COUNT_KEYS.map((key) => [key, String(counts.get(key) ?? 0)]),
    ) as Record<CountKey, string>),
  }
}
