import { and, eq, isNull, sql } from 'drizzle-orm'
import type { ApiResponse } from '../../../../specs/figma/vada-wireframe/api-types.d.ts'
import type { Db } from '../db/client.ts'
import { budgetSources, payments, purchaseRequestItems } from '../db/schema.ts'
import { missingProofCount } from './home-finance-facts.ts'

export type FinanceSummary = ApiResponse<'home.financeSummary'>

/**
 * 전체 재정 요약(`home.financeSummary`).
 *
 * **총예산은 수입원의 합이다**(`budget_sources`) — 예산 편성 화면(FIN-PLAN-01)이 넣는다.
 * 사용 가능액의 셈은 정해진 것이다(docs/decisions/budget-screen.md): 배정 − 실결제 −
 * 아직 안 낸 승인액. 학생회 전체에서는 배정 자리에 총예산이 선다 — 전체 재정 현황
 * (FIN-00)의 예시가 같은 셈이다(30,000,000 − 12,400,000 − 3,100,000 = 14,500,000).
 *
 * **사용률은 실제로 나간 돈의 몫이다.** FIN-00이 '전체 예산 집행률'을 실제 지출로만 세고
 * '지출 예정 포함'을 따로 말한다 — 같은 학생회의 두 화면이 거의 같은 이름의 수를 다르게
 * 세면 사람이 어느 쪽을 믿을지 모른다. 사용률과 사용 가능 비율 사이의 빈 몫이 곧
 * 승인·집행 예정이고, 그 건수가 곁의 칸에 온다.
 *
 * **승인·집행 예정 건수는 돈이 걸린 요청의 수다** — 승인액이 있는데 아직 결제에 딸리지
 * 않은 품목을 하나라도 가진 요청. 금액을 더하는 그 품목들을 세므로 둘이 갈리지 않는다.
 *
 * **편성 전(수입 0)이면 비율이 없다.** 나눌 바탕이 없는데 0%를 주면 '하나도 안 썼다'로
 * 읽힌다 — 그 둘은 다른 사실이다. 그래서 비율 자리에 '편성 전'이라 적어 보낸다
 * (2026-09-06). 막대가 쓰는 수만 0으로 둔다 — 그리는 길이는 있어야 한다.
 *
 * **세는 말도 여기서 만든다.** 한동안 네 조각이 전부 수였고 화면이 조각 이름의 끝을
 * 보아 '%'와 '건'을 붙였다. 규칙이 화면에 있으면 화면마다 갈린다.
 */
export async function homeFinanceSummary(db: Db, orgId: string): Promise<FinanceSummary> {
  const [total, spent, committed, missingProof] = await Promise.all([
    totalBudget(db, orgId),
    spentTotal(db, orgId),
    committedTotal(db, orgId),
    missingProofCount(db, orgId),
  ])
  // 넘게 썼으면 쓸 수 있는 것이 없다 — 음수 비율은 뜻이 없다.
  const available = Math.max(0, total - spent - committed.amount)
  const planned = total > 0
  return {
    budgetUsedPercent: percentOf(spent, total),
    budgetUsedNote: planned ? `${percentOf(spent, total)}%` : BEFORE_PLAN,
    availableBudgetNote: planned ? `${percentOf(available, total)}%` : BEFORE_PLAN,
    plannedNote: `${committed.requests}건`,
    missingProofNote: `${missingProof}건`,
  }
}

/** 예산을 아직 안 짰다는 말. **0%와 다른 사실이다.** */
const BEFORE_PLAN = '편성 전'

/** 0-100의 정수. 계약이 그 범위라 적었고, 준비율(`home.events`)도 정수로 둥글린다. */
function percentOf(part: number, total: number): number {
  if (total <= 0) return 0
  return Math.min(100, Math.max(0, Math.round((part / total) * 100)))
}

/** 총예산 — 수입원의 합. 편성 전이면 0이다. */
async function totalBudget(db: Db, orgId: string): Promise<number> {
  const rows = await db
    .select({ total: sql<number>`coalesce(sum(${budgetSources.amount}), 0)::int` })
    .from(budgetSources)
    .where(eq(budgetSources.orgId, orgId))
  return Number(rows[0]?.total ?? 0)
}

/** 실제로 나간 돈 — 이 학생회의 결제 전부. 행사 지출과 상시 지출을 가르지 않는다. */
async function spentTotal(db: Db, orgId: string): Promise<number> {
  const rows = await db
    .select({ total: sql<number>`coalesce(sum(${payments.paidAmount}), 0)::int` })
    .from(payments)
    .where(eq(payments.orgId, orgId))
  return Number(rows[0]?.total ?? 0)
}

/**
 * 승인됐는데 아직 안 낸 돈과, 그 돈이 걸린 요청의 수.
 *
 * **결제에 딸린 승인액은 더하지 않는다** — 그것은 실결제로 이미 셌고, 둘 다 더하면 같은
 * 돈을 두 번 뺀다(`finance/requests.ts`와 같다). 승인액이 0인 품목은 돈이 걸린 것이
 * 아니므로 건수에도 들지 않는다.
 */
async function committedTotal(
  db: Db,
  orgId: string,
): Promise<{ amount: number; requests: number }> {
  const rows = await db
    .select({
      amount: sql<number>`coalesce(sum(${purchaseRequestItems.approvedAmount}), 0)::int`,
      requests: sql<number>`count(distinct case when coalesce(${purchaseRequestItems.approvedAmount}, 0) > 0 then ${purchaseRequestItems.requestId} end)::int`,
    })
    .from(purchaseRequestItems)
    .where(and(eq(purchaseRequestItems.orgId, orgId), isNull(purchaseRequestItems.paymentId)))
  return {
    amount: Number(rows[0]?.amount ?? 0),
    requests: Number(rows[0]?.requests ?? 0),
  }
}
