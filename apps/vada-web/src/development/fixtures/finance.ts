import type { DataRow } from '../../data-sources/definitions'
import {
  BUDGET_PLAN_DRAFT,
  DEFAULT_LEDGER_MONTH,
  LEDGER_HANDLING_NOTE,
  LEDGER_MONTHS,
  LEDGER_STAGE,
  LEDGER_STAGE_NOTE,
  LEDGER_SUMMARY,
  MY_PURCHASE_REQUESTS,
  MY_PURCHASE_REQUEST_SUMMARY,
  NEW_PURCHASE_REQUEST,
  ORG_BREAKDOWN,
  ORG_FINANCE_OVERVIEW,
  ORG_LEDGER,
  ORG_PROOF_SUMMARY,
  PAYMENT_EVIDENCES,
  PAYMENT_EVIDENCE_SUMMARIES,
  PURCHASE_ORDERS,
  PURCHASE_ORDER_SUMMARIES,
  PURCHASE_REQUEST_DETAILS,
  PURCHASE_REQUEST_DRAFTS,
  PURCHASE_REQUEST_HISTORY,
  PURCHASE_REQUEST_RESULTS,
  REVIEW_ITEMS,
  REVIEW_SUMMARIES,
  SUPPLEMENT_ATTACHMENTS,
  SUPPLEMENT_INPUT_FIELDS,
  SUPPLEMENT_ITEMS,
  SUPPLEMENT_REQUESTS,
} from './finance-data'
import { matchesQuery } from './search'

export const FINANCE_DASHBOARD_FIXTURES: Record<string, DataRow | DataRow[]> = {
  // 예산 편성(FIN-PLAN-01). 화면 하나가 이 한 벌을 초안으로 삼는다.
  'finance.budgetPlanDraft': BUDGET_PLAN_DRAFT,
  // 전체 재정 현황을 보는 사람. 지금 보는 사람은 예산을 편성할 수 없다 - 편성할
  // 수 있는 사람이 보는 그림이 FIN-00B(변형)이고, 사람이 그 사이를 오갈 수 없다.
  'finance.overviewViewer': { canPlanBudget: false },
  'finance.orgOverview': ORG_FINANCE_OVERVIEW,
  'finance.proofSummary': ORG_PROOF_SUMMARY,
  'finance.recentExpenses': ORG_LEDGER.filter((entry) => entry.drawnOn === 'FIN-00').map(
    (entry) => entry.row,
  ),
}

const stageOf = (id: unknown) => LEDGER_STAGE[String(id)] ?? 'spent'

function ledgerEntriesOf({
  month = '',
  eventId = '',
  departmentId = '',
  budgetItemId = '',
  query = '',
  stage = '',
}: Record<string, string>) {
  return ORG_LEDGER.filter(
    (entry) =>
      entry.drawnOn === 'FIN-LEDGER-01' &&
      entry.month === (month || DEFAULT_LEDGER_MONTH) &&
      (eventId === '' || entry.eventId === eventId) &&
      (departmentId === '' || entry.departmentId === departmentId) &&
      (budgetItemId === '' || entry.budgetItemId === budgetItemId) &&
      (stage === '' || stageOf(entry.row.id) === stage) &&
      matchesQuery(entry.row, query),
  )
}

export const FINANCE_FILTERED_FIXTURES: Record<
  string,
  (params: Record<string, string>) => DataRow[]
> = {
  // 요청 id가 비면 새 요청이다 — 없는 것이 아니라 아직 안 적힌 것이다.
  'finance.purchaseRequestDraft': ({ requestId = '' }) =>
    requestId === ''
      ? [NEW_PURCHASE_REQUEST]
      : PURCHASE_REQUEST_DRAFTS[requestId]
        ? [PURCHASE_REQUEST_DRAFTS[requestId]]
        : [],
  'finance.purchaseRequestDetail': ({ requestId = '' }) =>
    PURCHASE_REQUEST_DETAILS[requestId] ? [PURCHASE_REQUEST_DETAILS[requestId]] : [],
  'finance.purchaseRequestItems': ({ requestId = '' }) =>
    PURCHASE_REQUEST_RESULTS[requestId] ?? [],
  'finance.paymentEvidenceSummary': ({ requestId = '' }) => {
    const row = PAYMENT_EVIDENCE_SUMMARIES[requestId]
    return row === undefined ? [] : [row]
  },
  'finance.paymentEvidences': ({ requestId = '' }) => PAYMENT_EVIDENCES[requestId] ?? [],
  'finance.purchaseOrderSummary': ({ requestId = '' }) => {
    const row = PURCHASE_ORDER_SUMMARIES[requestId]
    return row === undefined ? [] : [row]
  },
  'finance.purchaseOrders': ({ requestId = '' }) => PURCHASE_ORDERS[requestId] ?? [],
  'finance.reviewSummary': ({ requestId = '' }) => {
    const row = REVIEW_SUMMARIES[requestId]
    return row === undefined ? [] : [row]
  },
  'finance.reviewItems': ({ requestId = '' }) => REVIEW_ITEMS[requestId] ?? [],
  'finance.supplementRequest': ({ requestId = '' }) => {
    const row = SUPPLEMENT_REQUESTS[requestId]
    return row === undefined ? [] : [row]
  },
  'finance.supplementItems': ({ requestId = '' }) => SUPPLEMENT_ITEMS[requestId] ?? [],
  'finance.supplementInputFields': ({ itemId = '' }) => SUPPLEMENT_INPUT_FIELDS[itemId] ?? [],
  'finance.supplementAttachments': ({ itemId = '' }) => SUPPLEMENT_ATTACHMENTS[itemId] ?? [],
  'event.myPurchaseRequests': ({ eventId = '' }) => MY_PURCHASE_REQUESTS[eventId] ?? [],
  'event.myPurchaseRequestSummary': ({ eventId = '' }) => {
    const row = MY_PURCHASE_REQUEST_SUMMARY[eventId]
    return row === undefined ? [] : [row]
  },
  'finance.orgBreakdown': ({ scope = 'event' }) => ORG_BREAKDOWN[scope] ?? [],
  'finance.ledger': (params) => ledgerEntriesOf(params).map((entry) => entry.row),
  'finance.ledgerSummary': ({ month = '' }) => [
    LEDGER_SUMMARY[month || DEFAULT_LEDGER_MONTH] ?? LEDGER_SUMMARY[DEFAULT_LEDGER_MONTH],
  ],
  // '총 42건 중 최근 10건'을 손으로 적지 않는다 — 보여 준 줄에서 센다. 총 건수만
  // 서버가 아는 값이라 달마다 적어 둔다(목록은 잘려서 오므로 자기가 못 센다).
  'finance.ledgerScope': (params) => {
    const known = LEDGER_MONTHS[params.month || DEFAULT_LEDGER_MONTH]
    const shown = ledgerEntriesOf(params).length
    const stageNote = LEDGER_STAGE_NOTE[params.stage ?? '']
    return [
      {
        rangeNote:
          stageNote === undefined
            ? `${known.label} · 총 ${known.total}건 중 최근 ${shown}건 표시`
            : `${known.label} · ${stageNote} ${shown}건`,
        handlingNote: LEDGER_HANDLING_NOTE,
      },
    ]
  },
  'finance.purchaseRequestHistory': ({ requestId = '' }) =>
    PURCHASE_REQUEST_HISTORY[requestId] ?? [],
}
