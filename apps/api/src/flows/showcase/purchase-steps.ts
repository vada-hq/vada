import type { ExpenseResponse, PurchaseRequestResponse, ShipmentResponse } from '@vada/contracts'
import { create, sees, write } from '../rehearsal-kit.js'
import type { PurchaseEntry } from './content/types.js'
import { budgetId, eventId, found, org, seesPermission, who, type ShowcaseCtx } from './kit.js'
import { expenseFields } from './money-steps.js'

// 구매 요청의 한살이: 요청 → 재정부 결재 → 송장 → 결제한 지출. 지출의 증빙은 money-steps.ts의 evidenceStep이다.

const requestOf = (ctx: ShowcaseCtx, entry: PurchaseEntry) =>
  found(ctx.w.requests, entry.title, '구매 요청')
const requestPath = (ctx: ShowcaseCtx, entry: PurchaseEntry) =>
  `${org(ctx)}/purchase-requests/${requestOf(ctx, entry).id}`
const itemId = (ctx: ShowcaseCtx, entry: PurchaseEntry, name: string) =>
  found(requestOf(ctx, entry).items, name, `'${entry.title}'의 품목`)

export async function requestStep(ctx: ShowcaseCtx, entry: PurchaseEntry) {
  const person = who(ctx, entry.by)
  await seesPermission(ctx, person, 'purchase.request')
  const created = await create<PurchaseRequestResponse>(
    person,
    `${org(ctx)}/purchase-requests`,
    {
      title: entry.title,
      eventId: eventId(ctx, entry.event),
      body: entry.body,
      neededBy: entry.neededBy ? ctx.cal.dayOf(entry.neededBy) : null,
      sourceMessageId: entry.fromMessage
        ? found(ctx.w.messages, entry.fromMessage, '메시지')
        : null,
      items: entry.items.map(item => ({
        name: item.name,
        quantity: item.quantity,
        link: item.link ?? null,
        options: item.options ?? null,
        estimatedUnitPrice: item.estimatedUnitPrice ?? null,
        estimatedShippingFee: item.estimatedShippingFee ?? null,
      })),
    },
    '구매 요청',
  )
  const { request } = created
  ctx.w.requests.set(entry.title, {
    id: request.id,
    items: new Map(request.items.map(item => [item.name, item.id])),
  })
}

// 재정부가 품목마다 승인 금액과 예산 항목을 정해 한 번에 보낸다.
export async function decideStep(ctx: ShowcaseCtx, entry: PurchaseEntry) {
  const { decision } = entry
  const person = who(ctx, decision!.by)
  const path = requestPath(ctx, entry)
  await sees<PurchaseRequestResponse>(
    person,
    path,
    body => body.request.actions,
    'purchase_request.decide',
  )
  await write<PurchaseRequestResponse>(
    person,
    `${path}/decisions`,
    {
      decisions: decision!.approve.map(item => ({
        lineItemId: itemId(ctx, entry, item.item),
        outcome: 'approved',
        amount: item.amount,
        budgetItemId: budgetId(ctx, item.budget),
      })),
    },
    '결재',
  )
}

// 송장: 요청의 모든 품목을 한 상자로 넣는다.
export async function shipmentStep(ctx: ShowcaseCtx, entry: PurchaseEntry) {
  const { shipment } = entry
  const person = who(ctx, shipment!.by)
  // 송장 넣기는 기록 단위 권한(재정부와 요청한 사람)이라 요청 상세의 canAddShipment로 본다.
  await sees<PurchaseRequestResponse>(
    person,
    requestPath(ctx, entry),
    body => (body.request.canAddShipment ? ['송장 넣기'] : []),
    '송장 넣기',
  )
  await create<ShipmentResponse>(
    person,
    `${requestPath(ctx, entry)}/shipments`,
    {
      carrierId: shipment!.carrier,
      trackingNumber: shipment!.trackingNumber,
      lineItemIds: [...requestOf(ctx, entry).items.values()],
    },
    '송장 넣기',
  )
}

// 승인한 품목을 모두 결제한 지출. 결제 내역이 요청에 이어져 행사는 요청에서 채워진다. 적은 지출의 번호를 돌려준다.
export async function requestExpenseStep(ctx: ShowcaseCtx, entry: PurchaseEntry) {
  const expense = entry.expense!
  const person = who(ctx, expense.by)
  await seesPermission(ctx, person, 'finance.manage')
  const lines = entry.decision!.approve.map(item => ({
    lineItemId: itemId(ctx, entry, item.item),
    amount: item.amount,
  }))
  const created = await create<ExpenseResponse>(
    person,
    `${org(ctx)}/expenses`,
    {
      ...expenseFields(ctx, expense),
      amount: lines.reduce((sum, line) => sum + line.amount, 0),
      lines,
    },
    '결제한 지출 적기',
  )
  return created.expense.id
}
