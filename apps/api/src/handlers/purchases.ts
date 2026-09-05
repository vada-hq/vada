import type { Context } from 'hono'
import { orgOf, type Handlers } from '../deps.ts'
import { purchaseRequestDetail, purchaseRequestHistory, purchaseRequestItemResults } from '../purchases/detail.ts'
import { purchaseRequestDraft, savePurchaseDraft, submitPurchaseRequest } from '../purchases/draft.ts'
import { completeEvidence } from '../purchases/evidence.ts'
import { budgetItemOptions } from '../purchases/options.ts'
import { sendReview } from '../purchases/review.ts'
import { eventExists } from '../purchases/rows.ts'
import {
  resubmitSupplement,
  saveSupplement,
  supplementAttachments,
  supplementInputFields,
  supplementItems,
  supplementRequest,
} from '../purchases/supplement.ts'
import { NotFound } from '../routes.ts'

// 구매 요청의 흐름(FIN-REQ-01 · REQ-02 · SUP-01의 읽기와 REQ-01 · SUP-01 · REV-01 · EVID-01의 쓰기).
//
// **재정 영역과 가른다.** `finance.ts`는 학생회 재정의 겉면(전체 현황·장부·예산 편성)과 검토·구매·
// 증빙 화면의 읽기를 답하고, 여기는 **요청 한 건이 작성 → 검토 → 구매 → 증빙 → 정산을 지나는 길**을
// 답한다. 보는 표는 같지만(`purchase_requests`와 그 딸림) 한 파일에 두면 나란히 붙일 때 같은 줄에서
// 부딪힌다. 상태의 말과 색은 저쪽과 같은 규칙에서 나온다(`finance/labels.ts`).
//
// **어느 요청인지는 몸통이 실어 온다.** 쓰기 여섯의 계약에는 인자가 하나도 없다 — FIN-EVID-01의
// '처리 완료'가 requestId를 몸통에 실어 보내던 길을 나머지도 따른다(명세에 그 배선이 없다 — 보고했다).

/** 지금 보는 사람이 이 학생회에서 누구인가. 요청자·검토자가 이 값이다. */
function memberOf(c: Context): { memberId: string } {
  const memberId = c.get('sender')?.membership?.memberId
  if (memberId === undefined) throw new NotFound('이 학생회의 구성원이 아닙니다')
  return { memberId }
}

/** 어느 요청인가. **없는 것은 없다고 말한다** — 남의 학생회 요청도 같은 답이다. */
function askedRequest(c: Context): string {
  const requestId = c.req.query('requestId') ?? ''
  c.set('auditSubject', { type: 'purchaseRequest', id: requestId })
  return requestId
}

function askedItem(c: Context): string {
  const itemId = c.req.query('itemId') ?? ''
  c.set('auditSubject', { type: 'purchaseRequestItem', id: itemId })
  return itemId
}

function orMissing<T>(found: T | null): T {
  if (found === null) throw new NotFound('그 구매 요청을 찾지 못했습니다')
  return found
}

/** 쓰기의 몸통. JSON이 아니면 null이고, 그것은 각 자리가 '모양이 아니다'(422)로 막는다. */
const bodyOf = (c: Context) => c.req.json().catch(() => null)

/** 쓰기가 다룬 요청. 몸통에서 읽되 기록에는 남긴다. */
async function bodyWithSubject(c: Context): Promise<unknown> {
  const body = await bodyOf(c)
  const requestId = body !== null && typeof body === 'object' ? (body as { requestId?: unknown }).requestId : undefined
  c.set('auditSubject', { type: 'purchaseRequest', id: typeof requestId === 'string' ? requestId : '' })
  return body
}

export const purchaseHandlers: Handlers = {
  // ── 구매 요청 작성·수정 (FIN-REQ-01) ───────────────────────────────────
  //
  // 초안은 행사에 딸린다. 요청 id가 없으면 새로 쓰는 것이고 그때도 서버가 아는 것(부서)은 채워 온다.
  'finance.purchaseRequestDraft': async (c, d) => {
    const eventId = c.req.query('eventId') ?? ''
    const requestId = c.req.query('requestId') ?? ''
    c.set('auditSubject', requestId === '' ? { type: 'event', id: eventId } : { type: 'purchaseRequest', id: requestId })
    return purchaseRequestDraft(d.db, orgOf(c), memberOf(c), eventId, requestId)
  },
  'finance.budgetItems.options': async (c, d) => {
    const orgId = orgOf(c)
    const eventId = c.req.query('eventId') ?? ''
    if (!(await eventExists(d.db, orgId, eventId))) throw new NotFound('그 행사를 찾지 못했습니다')
    return budgetItemOptions(d.db, orgId, eventId)
  },
  // 임시 저장은 덮어쓰기이고 새 줄의 이름표를 돌려준다. 제출은 같은 것을 보내되 검토로 넘긴다.
  'finance.purchaseRequest.saveDraft': async (c, d) => {
    const made = await savePurchaseDraft(d.db, orgOf(c), memberOf(c), await bodyWithSubject(c), d.newId, d.invite.now())
    c.set('auditSubject', { type: 'purchaseRequest', id: made.id })
    return made
  },
  'finance.purchaseRequest.submit': async (c, d) => {
    const made = await submitPurchaseRequest(d.db, orgOf(c), memberOf(c), await bodyWithSubject(c), d.newId, d.invite.now())
    c.set('auditSubject', { type: 'purchaseRequest', id: made.id })
    return made
  },

  // ── 구매 요청 상세·진행 상태 (FIN-REQ-02) ──────────────────────────────
  'finance.purchaseRequestDetail': async (c, d) => orMissing(await purchaseRequestDetail(d.db, orgOf(c), askedRequest(c))),
  'finance.purchaseRequestItems': async (c, d) =>
    orMissing(await purchaseRequestItemResults(d.db, orgOf(c), askedRequest(c))),
  'finance.purchaseRequestHistory': async (c, d) => orMissing(await purchaseRequestHistory(d.db, orgOf(c), askedRequest(c))),

  // ── 보완 요청 확인·재제출 (FIN-SUP-01) ─────────────────────────────────
  //
  // 걸려 있지 않으면 머리가 없다(404). 다시 받을 칸과 파일 자리는 아직 정해진 것이 없어 빈 목록이다.
  'finance.supplementRequest': async (c, d) => supplementRequest(d.db, orgOf(c), askedRequest(c)),
  'finance.supplementItems': async (c, d) => orMissing(await supplementItems(d.db, orgOf(c), askedRequest(c))),
  'finance.supplementInputFields': async (c, d) => {
    const found = await supplementInputFields(d.db, orgOf(c), askedItem(c))
    if (found === null) throw new NotFound('그 품목을 찾지 못했습니다')
    return found
  },
  'finance.supplementAttachments': async (c, d) => {
    const found = await supplementAttachments(d.db, orgOf(c), askedItem(c))
    if (found === null) throw new NotFound('그 품목을 찾지 못했습니다')
    return found
  },
  'finance.purchaseRequest.saveSupplement': async (c, d) =>
    saveSupplement(d.db, orgOf(c), memberOf(c), await bodyWithSubject(c)),
  'finance.purchaseRequest.resubmitSupplement': async (c, d) =>
    resubmitSupplement(d.db, orgOf(c), memberOf(c), await bodyWithSubject(c), d.invite.now()),

  // ── 구매 요청 검토 (FIN-REV-01) ────────────────────────────────────────
  //
  // 누가 여는지는 미들웨어가 본다(`finance.manage`). 보내는 사람이 곧 검토자다.
  'finance.purchaseRequest.sendReview': async (c, d) =>
    sendReview(d.db, orgOf(c), memberOf(c), await bodyWithSubject(c), d.invite.now()),

  // ── 결제·증빙 정리 (FIN-EVID-01) ───────────────────────────────────────
  'finance.purchaseRequest.completeEvidence': async (c, d) =>
    completeEvidence(d.db, orgOf(c), await bodyWithSubject(c), d.invite.now()),
}
