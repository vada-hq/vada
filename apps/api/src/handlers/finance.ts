import type { Context } from 'hono'
import { orgOf, type Handlers } from '../deps.ts'
import { budgetEventOptions, budgetPlanDraft, saveBudgetPlan } from '../finance/budget-plan.ts'
import { paymentEvidences, paymentEvidenceSummary } from '../finance/evidence.ts'
import {
  ledger,
  ledgerEventOptions,
  ledgerMonthOptions,
  ledgerScope,
  ledgerSummary,
  orgBudgetItemOptions,
  proofSummary,
  recentExpenses,
} from '../finance/ledger.ts'
import { eventExists, myPurchaseRequests, myPurchaseRequestSummary } from '../finance/mine.ts'
import { purchaseOrderList, purchaseOrderSummary } from '../finance/orders.ts'
import { orgBreakdown, orgOverview } from '../finance/overview.ts'
import { reviewItems, reviewSummary } from '../finance/review.ts'
import { NotFound } from '../routes.ts'

// 재정(FIN-00 · FIN-00B · FIN-LEDGER-01 · FIN-PLAN-01 · FIN-REV-01 · FIN-PROC-01 · FIN-EVID-01 · MY-REQ-01).
//
// **화면 넷이 한 표를 본다.** 요청하고 → 검토받고 → 사고 → 증빙을 붙이는 흐름이
// `purchase_requests`의 한 줄을 따라가고, 화면마다 다른 것은 그 줄의 어느 곁가지를
// 함께 읽느냐뿐이다(품목 · 발주 · 결제). 그래서 영역을 화면 이름이 아니라 표로 갈랐다.
//
// **`event.myPurchaseRequest*`도 여기 있다.** 이름이 `event.`로 시작하지만 같은
// 요청 표를 읽으므로 한 사람이 든다 — 자리가 겹치지만 않으면 이름의 머리와 파일
// 이름이 달라도 된다(`handlers/index.test.ts`가 겹침만 본다).
//
// **구매 요청 쪽에는 쓰기가 없다.** 요청을 내고 판정을 보내는 동작이 명세에 있지만
// 이 회차는 읽는 자리만 붙인다 — 그래서 지금 이 표들은 비어 있고, 화면은 빈 상태로
// 그려진다. 그것이 맞는 결과다. 없는 것을 지어내 채우지 않는다.
//
// **예산 편성(FIN-PLAN-01)은 쓴다.** 재정 28자리가 전부 이 화면이 넣는 금액 위에
// 선다 — 기간·수입원·항목 한 벌을 통째로 읽고 통째로 덮어쓴다(`finance/budget-plan.ts`).
//
// **재정의 겉면(FIN-00 · FIN-00B)과 장부(FIN-LEDGER-01)는 그 위에 선다.** 총예산은
// 수입원의 합이고, 실제 지출은 결제, 지출 예정은 아직 안 낸 승인액이다 — 검토 화면이
// 드는 셈과 같은 셈이다(`finance/money.ts` · `finance/overview.ts` · `finance/ledger.ts`).
// 편성 전인 학생회는 '편성 전'이라 답한다. 0원은 다른 사실이다.

/** 지금 보는 사람이 이 학생회에서 누구인가. **'내 구매 요청'을 이 값이 가른다.** */
function memberOf(c: Context): string {
  const memberId = c.get('sender')?.membership?.memberId
  if (memberId === undefined) throw new NotFound('이 학생회의 구성원이 아닙니다')
  return memberId
}

/**
 * 어느 요청인가.
 *
 * **없는 것은 없다고 말한다.** 남의 학생회 요청도 같은 답이다 — 밖에서 그 둘이
 * 갈려 보이면 남의 요청이 있는지를 주소로 물어볼 수 있게 된다.
 */
function askedRequest(c: Context): string {
  return c.req.query('requestId') ?? ''
}

function orMissing<T>(found: T | null): T {
  if (found === null) throw new NotFound('그 구매 요청을 찾지 못했습니다')
  return found
}

export const financeHandlers: Handlers = {
  // ── 구매 요청 검토 (FIN-REV-01) ────────────────────────────────────────
  //
  // 재정부가 보는 쪽이다. 요청자가 보는 상세(FIN-REQ-02)와 출처가 다른 까닭은
  // 예산 사용 가능액처럼 요청자에게 보이지 않는 값이 여기에만 오기 때문이다.
  'finance.reviewSummary': async (c, d) => {
    const requestId = askedRequest(c)
    c.set('auditSubject', { type: 'purchaseRequest', id: requestId })
    return orMissing(await reviewSummary(d.db, orgOf(c), requestId))
  },
  'finance.reviewItems': async (c, d) => {
    const requestId = askedRequest(c)
    c.set('auditSubject', { type: 'purchaseRequest', id: requestId })
    return orMissing(await reviewItems(d.db, orgOf(c), requestId))
  },

  // ── 구매·발주 처리 (FIN-PROC-01) ───────────────────────────────────────
  'finance.purchaseOrderSummary': async (c, d) => {
    const requestId = askedRequest(c)
    c.set('auditSubject', { type: 'purchaseRequest', id: requestId })
    return orMissing(await purchaseOrderSummary(d.db, orgOf(c), requestId))
  },
  'finance.purchaseOrders': async (c, d) => {
    const requestId = askedRequest(c)
    c.set('auditSubject', { type: 'purchaseRequest', id: requestId })
    return orMissing(await purchaseOrderList(d.db, orgOf(c), requestId))
  },

  // ── 결제·증빙 정리 (FIN-EVID-01) ───────────────────────────────────────
  'finance.paymentEvidenceSummary': async (c, d) => {
    const requestId = askedRequest(c)
    c.set('auditSubject', { type: 'purchaseRequest', id: requestId })
    return orMissing(await paymentEvidenceSummary(d.db, orgOf(c), requestId))
  },
  'finance.paymentEvidences': async (c, d) => {
    const requestId = askedRequest(c)
    c.set('auditSubject', { type: 'purchaseRequest', id: requestId })
    return orMissing(await paymentEvidences(d.db, orgOf(c), requestId))
  },

  // ── 내 구매 요청 (MY-REQ-01) ───────────────────────────────────────────
  //
  // **누가 냈는지로 거르는 것을 서버가 한다.** 목록을 통째로 보내고 화면이 거르면
  // 머리의 건수와 그 아래 목록이 어긋난다.
  'event.myPurchaseRequests': async (c, d) => {
    const orgId = orgOf(c)
    const eventId = c.req.query('eventId') ?? ''
    c.set('auditSubject', { type: 'event', id: eventId })
    if (!(await eventExists(d.db, orgId, eventId))) {
      throw new NotFound('그 행사를 찾지 못했습니다')
    }
    return myPurchaseRequests(d.db, orgId, eventId, memberOf(c))
  },
  'event.myPurchaseRequestSummary': async (c, d) => {
    const orgId = orgOf(c)
    const eventId = c.req.query('eventId') ?? ''
    c.set('auditSubject', { type: 'event', id: eventId })
    if (!(await eventExists(d.db, orgId, eventId))) {
      throw new NotFound('그 행사를 찾지 못했습니다')
    }
    return myPurchaseRequestSummary(d.db, orgId, eventId, memberOf(c))
  },

  // ── 예산 편성 (FIN-PLAN-01) ────────────────────────────────────────────
  //
  // 학생회에 한 벌이라 인자가 없다. 누가 여는지는 미들웨어가 본다(`finance.manage`).
  'finance.budgetPlanDraft': async (c, d) => {
    const orgId = orgOf(c)
    c.set('auditSubject', { type: 'organization', id: orgId })
    return budgetPlanDraft(d.db, orgId)
  },
  'finance.budgetEvents.options': async (c, d) => budgetEventOptions(d.db, orgOf(c)),
  // **덮어쓰기다.** 화면이 초안 한 벌을 그대로 보내고 안 보낸 줄은 지운 것이다.
  'finance.budgetPlan.save': async (c, d) => {
    const orgId = orgOf(c)
    c.set('auditSubject', { type: 'organization', id: orgId })
    const body = await c.req.json().catch(() => null)
    return saveBudgetPlan(d.db, orgId, body, d.newId, d.invite.now())
  },

  // ── 전체 재정 현황 (FIN-00 · FIN-00B) ──────────────────────────────────
  //
  // 학생회 전체를 센다 — 행사 하나의 재정(`event.financeSummary`)과 다른 물건이다.
  // 기준일은 오늘이라 때를 함께 넘긴다.
  'finance.orgOverview': async (c, d) => {
    const orgId = orgOf(c)
    c.set('auditSubject', { type: 'organization', id: orgId })
    return orgOverview(d.db, orgId, d.invite.now())
  },
  // 나누는 축(scope)이 줄의 뜻을 통째로 바꾼다 — 서버가 걸러서 준다.
  'finance.orgBreakdown': async (c, d) => {
    const orgId = orgOf(c)
    c.set('auditSubject', { type: 'organization', id: orgId })
    return orgBreakdown(d.db, orgId, c.req.query('scope'))
  },
  'finance.proofSummary': async (c, d) => {
    const orgId = orgOf(c)
    c.set('auditSubject', { type: 'organization', id: orgId })
    return proofSummary(d.db, orgId)
  },
  // 장부와 같은 결제다 — 겉면에 몇 줄만 얹는다.
  'finance.recentExpenses': async (c, d) => {
    const orgId = orgOf(c)
    c.set('auditSubject', { type: 'organization', id: orgId })
    return recentExpenses(d.db, orgId)
  },

  // ── 사용 내역 (FIN-LEDGER-01) ──────────────────────────────────────────
  //
  // **거르는 것도 자르는 것도 세는 것도 서버가 한다.** 목록과 범위 줄이 같은 조건을
  // 받아야 같은 것을 센다.
  'finance.ledger': async (c, d) => {
    const orgId = orgOf(c)
    c.set('auditSubject', { type: 'organization', id: orgId })
    return ledger(d.db, orgId, ledgerFilters(c))
  },
  'finance.ledgerScope': async (c, d) => {
    const orgId = orgOf(c)
    c.set('auditSubject', { type: 'organization', id: orgId })
    return ledgerScope(d.db, orgId, ledgerFilters(c))
  },
  // 고르지 않은 달은 이번 달이다 — 그 판단을 서버가 오늘로 한다.
  'finance.ledgerSummary': async (c, d) => {
    const orgId = orgOf(c)
    c.set('auditSubject', { type: 'organization', id: orgId })
    return ledgerSummary(d.db, orgId, c.req.query('month'), d.invite.now())
  },
  'finance.ledgerMonths.options': async (c, d) => ledgerMonthOptions(d.db, orgOf(c)),
  'finance.ledgerEvents.options': async (c, d) => ledgerEventOptions(d.db, orgOf(c)),
  'finance.orgBudgetItems.options': async (c, d) => orgBudgetItemOptions(d.db, orgOf(c)),
}

/** 장부를 거르는 조건 여섯. 목록과 범위 줄이 **같은 것**을 읽어야 같은 것을 센다. */
function ledgerFilters(c: Context) {
  return {
    month: c.req.query('month'),
    eventId: c.req.query('eventId'),
    departmentId: c.req.query('departmentId'),
    budgetItemId: c.req.query('budgetItemId'),
    query: c.req.query('query'),
    stage: c.req.query('stage'),
  }
}
