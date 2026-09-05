import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import {
  budgetItems,
  departments,
  payments,
  purchaseRequestItems,
  purchaseRequests,
} from '../db/schema.ts'
import {
  countKeyOf,
  dayOf,
  joinParts,
  orNote,
  requestedAmount,
  statusOf,
  won,
  type PurchaseStage,
} from '../finance/labels.ts'
import { eventExists } from '../finance/mine.ts'
import { Blocked } from '../routes.ts'

// 행사 재정 — 개요(EVT-FIN-01)의 셋.
//
// **재정 화면들과 같은 표를 같은 셈으로 본다.** 구매 요청 한 줄이 검토 → 구매 → 증빙 →
// 정산을 지나고(`purchase_requests.stage`), 그 줄의 말과 색은 `finance/labels.ts`가
// 든다. 여기서 새로 정하는 규칙은 없다 — 행사 하나로 좁혀 세는 것뿐이다.
//
// **사용 가능액의 셈은 정해진 것이다**(docs/decisions/budget-screen.md): 배정 − 실결제 −
// 아직 안 낸 승인액. `finance/requests.ts`의 `budgetAvailable`이 같은 셈을 들고 검토
// 화면(FIN-REV-01)이 그 값을 그린다 — 같은 행사의 사용 가능액이 두 화면에서 갈리면
// 안 되므로 검사가 둘을 견준다.
//
// **배정이 없는 행사는 예산이 없다.** 그때 배정과 사용 가능액은 0원이 아니라 '예산
// 미정'이다 — 0원은 '예산이 0원이다'라는 다른 사실이고, 검토 화면이 이미 그 말을 쓴다.
// 승인액과 실결제는 예산이 없어도 셀 수 있는 사실이라 그대로 센다.

/** 예산 항목이 하나도 없을 때의 말. 검토 화면(`finance/review.ts`)과 같은 말이다. */
const NO_BUDGET = '예산 미정'

/**
 * 요약의 금액 꼴. **'원'이 없다** — 그림이 단위를 값 옆에 따로 그린다(`items[].unit`).
 * 카드의 금액은 단위까지 한 덩이라 `won`을 쓴다. 자릿점을 붙이는 까닭은 같다: 화폐
 * 표기는 조직·지역의 것이라 표에 두지 않고 읽을 때 붙인다.
 */
function digits(amount: number): string {
  return amount.toLocaleString('ko-KR')
}

/** 이 행사의 배정. **항목이 하나도 없으면 null이다** — 0원과 다른 사실이다. */
async function budgetOf(db: Db, orgId: string, eventId: string): Promise<number | null> {
  const rows = await db
    .select({
      total: sql<number>`coalesce(sum(${budgetItems.amount}), 0)::int`,
      count: sql<number>`count(*)::int`,
    })
    .from(budgetItems)
    .where(and(eq(budgetItems.orgId, orgId), eq(budgetItems.eventId, eventId)))
  return Number(rows[0]?.count ?? 0) === 0 ? null : Number(rows[0]?.total ?? 0)
}

/** 이 행사의 요청에 딸린 결제로 실제로 나간 돈. */
async function spentOf(db: Db, orgId: string, eventId: string): Promise<number> {
  const rows = await db
    .select({ total: sql<number>`coalesce(sum(${payments.paidAmount}), 0)::int` })
    .from(payments)
    .innerJoin(
      purchaseRequests,
      and(
        eq(payments.requestId, purchaseRequests.id),
        eq(purchaseRequests.orgId, orgId),
        eq(purchaseRequests.eventId, eventId),
      ),
    )
    .where(eq(payments.orgId, orgId))
  return Number(rows[0]?.total ?? 0)
}

/**
 * 승인됐는데 아직 안 낸 돈. **결제에 딸린 승인액은 더하지 않는다** — 그것은 위에서
 * 실결제로 이미 셌고, 둘 다 더하면 같은 돈을 두 번 뺀다(`finance/requests.ts`와 같다).
 */
async function committedOf(db: Db, orgId: string, eventId: string): Promise<number> {
  const rows = await db
    .select({ total: sql<number>`coalesce(sum(${purchaseRequestItems.approvedAmount}), 0)::int` })
    .from(purchaseRequestItems)
    .innerJoin(
      purchaseRequests,
      and(
        eq(purchaseRequestItems.requestId, purchaseRequests.id),
        eq(purchaseRequests.orgId, orgId),
        eq(purchaseRequests.eventId, eventId),
      ),
    )
    .where(and(eq(purchaseRequestItems.orgId, orgId), isNull(purchaseRequestItems.paymentId)))
  return Number(rows[0]?.total ?? 0)
}

export interface EventFinanceSummary {
  budget: string
  committed: string
  spent: string
  available: string
}

/**
 * 금액 넉 줄(`event.financeSummary`). **없는 행사면 null이다** — 계약이 404를 두었다.
 *
 * 네 값이 다 따로 온다. 화면이 넷째를 앞의 셋에서 뺄 수 있을 것 같지만 그 뺄셈이 곧
 * 재정 규칙이고, 규칙이 바뀌면 화면이 아니라 여기가 바뀐다(명세가 그렇게 적었다).
 */
export async function eventFinanceSummary(
  db: Db,
  orgId: string,
  eventId: string,
): Promise<EventFinanceSummary | null> {
  if (!(await eventExists(db, orgId, eventId))) return null
  const [budget, spent, committed] = await Promise.all([
    budgetOf(db, orgId, eventId),
    spentOf(db, orgId, eventId),
    committedOf(db, orgId, eventId),
  ])
  return {
    budget: budget === null ? NO_BUDGET : digits(budget),
    committed: digits(committed),
    spent: digits(spent),
    available: budget === null ? NO_BUDGET : digits(budget - spent - committed),
  }
}

/**
 * 보드의 열 넷. **명세가 고정했다** — 그림이 네 열을 그리고 열마다 이 값을 인자로 박아
 * 조회한다. 값은 표의 단계 그대로다(`purchase_requests.stage`). 임시 저장(`draft`)은
 * 열이 아니다 — 재정부에 넘어간 적이 없는 요청은 보드에 오지 않는다.
 */
const STAGES: readonly PurchaseStage[] = ['review', 'purchase', 'proof', 'settled']

/**
 * 명세가 든 열이 아니면 **막는다.** 그대로 넘기면 저장소가 던져 500이 되고, 조용히 안
 * 거르고 전부 주면 한 열이 보드 전체가 된다. 안 넘긴 것도 막는다 — 열은 하나를
 * 가리키는 값이라 대신할 것이 없다(업무 보드의 `readStatus`와 같은 까닭).
 */
function readStage(asked: string | undefined): PurchaseStage {
  if (asked !== undefined && STAGES.includes(asked as PurchaseStage)) return asked as PurchaseStage
  throw new Blocked('명세에 없는 처리 단계입니다')
}

export interface FinanceCard {
  id: string
  departmentLabel: string
  requestedAt: string
  title: string
  itemsNote: string
  amountNote: string
  status: string
  statusTone: string
}

/**
 * 열 하나의 카드들(`event.financeBoard`).
 *
 * **낸 차례대로** — 오래 기다린 것이 위다(내 구매 요청 목록과 같은 차례). 명세도 그림도
 * 차례를 말하지 않는데, 안 정하면 저장소가 주는 대로 그려져 새로고침마다 카드가 자리를
 * 바꾼다.
 *
 * **품목은 전부 늘어놓는다.** 몇 개까지 보일지는 서버가 정하라고 명세가 적었고, 자르는
 * 수와 '외 N개' 같은 말을 지어내는 대신 있는 것을 다 준다 — 잘라야 하는 날이 오면
 * 여기 한 곳이다.
 *
 * 이 자리에는 404가 없다(계약). 남의 학생회 행사를 물으면 거르고 남은 것이 없다.
 */
export async function eventFinanceBoard(
  db: Db,
  orgId: string,
  eventId: string,
  asked: string | undefined,
): Promise<FinanceCard[]> {
  const stage = readStage(asked)
  const rows = await db
    .select({
      id: purchaseRequests.id,
      title: purchaseRequests.title,
      stage: purchaseRequests.stage,
      submittedAt: purchaseRequests.submittedAt,
      supplementRequestedAt: purchaseRequests.supplementRequestedAt,
      departmentName: departments.name,
    })
    .from(purchaseRequests)
    // **이어 붙인 표도 자기 조직을 확인한다.** id만 이으면 남의 조직의 부서 이름이
    // 우리 카드에 그려진다(행사 목록이 같은 구멍을 겪었다).
    .leftJoin(
      departments,
      and(eq(purchaseRequests.departmentId, departments.id), eq(departments.orgId, orgId)),
    )
    .where(
      and(
        eq(purchaseRequests.orgId, orgId),
        eq(purchaseRequests.eventId, eventId),
        eq(purchaseRequests.stage, stage),
      ),
    )
    .orderBy(asc(purchaseRequests.submittedAt), asc(purchaseRequests.id))

  const items = await itemsOf(
    db,
    orgId,
    rows.map((row) => row.id),
  )

  return rows.map((row) => {
    const mine = items.filter((item) => item.requestId === row.id)
    const status = statusOf(row.stage as PurchaseStage, row.supplementRequestedAt)
    return {
      id: row.id,
      departmentLabel: orNote(row.departmentName, '부서 미정'),
      requestedAt: orNote(dayOf(row.submittedAt), '미제출'),
      title: row.title,
      // 세는 말('개')은 명세가 이 조각의 예로 든 것이다. 이름이 하나도 없으면 수만 남는다.
      itemsNote: joinParts([`품목 ${mine.length}개`, mine.map((item) => item.name).join(', ')]),
      // **요청액이다** — 승인은 검토가 하고, 카드는 무엇을 얼마에 사려는지를 말한다.
      // 수량이나 단가가 없는 품목은 더할 것이 없다(내 구매 요청과 같은 셈).
      amountNote: won(
        mine.reduce(
          (sum, item) => sum + (requestedAmount(item.quantity, item.unitPrice) ?? 0),
          0,
        ),
      ),
      status: status.label,
      statusTone: status.tone,
    }
  })
}

/** 그 요청들의 품목. **한 번에 걷는다** — 카드마다 조회하면 열이 길어질수록 는다. */
async function itemsOf(db: Db, orgId: string, requestIds: readonly string[]) {
  if (requestIds.length === 0) return []
  return db
    .select({
      requestId: purchaseRequestItems.requestId,
      name: purchaseRequestItems.name,
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
    // 적은 차례가 곧 늘어놓는 차례다.
    .orderBy(asc(purchaseRequestItems.sortOrder), asc(purchaseRequestItems.id))
}

export interface EventFinanceAlerts {
  pendingReviewCount: number
}

/**
 * 지금 사람 손이 필요한 건수(`event.financeAlerts`). **없는 행사면 null이다.**
 *
 * 계약이 이 자리에 둔 조각은 '검토 대기' 하나다. **보완이 걸린 요청은 세지 않는다** —
 * 그것은 재정부가 아니라 요청자의 손을 기다리는 것이고, 화면의 딱지도 '검토 대기'가
 * 아니라 '보완 요청'이다. 어느 요청이 어느 칸인지는 내 구매 요청의 상태별 개수와 같은
 * 가름을 쓴다(`countKeyOf`) — 같은 말이 같은 것을 센다.
 */
export async function eventFinanceAlerts(
  db: Db,
  orgId: string,
  eventId: string,
): Promise<EventFinanceAlerts | null> {
  if (!(await eventExists(db, orgId, eventId))) return null
  const rows = await db
    .select({
      stage: purchaseRequests.stage,
      supplementRequestedAt: purchaseRequests.supplementRequestedAt,
    })
    .from(purchaseRequests)
    .where(and(eq(purchaseRequests.orgId, orgId), eq(purchaseRequests.eventId, eventId)))
  return {
    pendingReviewCount: rows.filter(
      (row) => countKeyOf(row.stage as PurchaseStage, row.supplementRequestedAt) === 'reviewCount',
    ).length,
  }
}
