import type { Context } from 'hono'
import { orgOf, type Handlers } from '../deps.ts'
import { paymentEvidences, paymentEvidenceSummary } from '../finance/evidence.ts'
import { eventExists, myPurchaseRequests, myPurchaseRequestSummary } from '../finance/mine.ts'
import { purchaseOrderList, purchaseOrderSummary } from '../finance/orders.ts'
import { reviewItems, reviewSummary } from '../finance/review.ts'
import { NotFound } from '../routes.ts'

// 재정(FIN-REV-01 · FIN-PROC-01 · FIN-EVID-01 · MY-REQ-01).
//
// **화면 넷이 한 표를 본다.** 요청하고 → 검토받고 → 사고 → 증빙을 붙이는 흐름이
// `purchase_requests`의 한 줄을 따라가고, 화면마다 다른 것은 그 줄의 어느 곁가지를
// 함께 읽느냐뿐이다(품목 · 발주 · 결제). 그래서 영역을 화면 이름이 아니라 표로 갈랐다.
//
// **`event.myPurchaseRequest*`도 여기 있다.** 이름이 `event.`로 시작하지만 같은
// 요청 표를 읽으므로 한 사람이 든다 — 자리가 겹치지만 않으면 이름의 머리와 파일
// 이름이 달라도 된다(`handlers/index.test.ts`가 겹침만 본다).
//
// **쓰기가 없다.** 요청을 내고 판정을 보내는 동작이 명세에 있지만 이 회차는 읽는
// 자리만 붙인다 — 그래서 지금 이 표들은 비어 있고, 화면은 빈 상태로 그려진다.
// 그것이 맞는 결과다. 없는 것을 지어내 채우지 않는다.

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
}
