import { randomUUID } from 'node:crypto'
import type {
  ApplicantsResponse,
  ChatMessage,
  EventResponse,
  EventRoomsResponse,
  ExpenseResponse,
  PurchaseRequestResponse,
  PurchaseRequestsResponse,
  TaskResponse,
} from '@vada/contracts'
import { DAY_MS } from '@vada/contracts'
import {
  create,
  koreanDay,
  nowOf,
  org,
  read,
  sees,
  seesPermission,
  write,
  type Ctx,
} from './rehearsal-kit.js'

export const BANNER_WON = 30_000
const SNACK_WON = 20_000
export const DIRECT_WON = 12_000
const NEEDED_IN_DAYS = 3

// 6 구매 요청: 기획부원이 행사 기획부 방에 부탁 메시지를 올리고, 그 메시지에서 품목 둘의 요청을 낸다(업무에 잇는다).
export async function requestStep(ctx: Ctx) {
  const { planner } = ctx.cast
  const { w } = ctx
  await seesPermission(ctx, planner, 'purchase.request')
  const rooms = await read<EventRoomsResponse>(
    planner,
    `${org(ctx)}/events/${w.eventId}/rooms`,
    '행사 방 읽기',
  )
  const room = rooms.rooms.find(item => item.type === 'department')
  if (!room) throw new Error('구매 요청: 기획부원의 행사 방 목록에 부서방이 없다')
  const message = await create<ChatMessage>(
    planner,
    `${org(ctx)}/rooms/${room.id}/messages`,
    { body: '현수막이랑 간식을 사야 해요. 구매 요청 올릴게요.' },
    '부탁 메시지',
  )
  w.messageId = message.id
  const neededBy = koreanDay(new Date(nowOf(ctx).getTime() + NEEDED_IN_DAYS * DAY_MS))
  const created = await create<PurchaseRequestResponse>(
    planner,
    `${org(ctx)}/purchase-requests`,
    {
      commandId: randomUUID(),
      title: '행사 물품',
      eventId: w.eventId,
      neededBy,
      sourceMessageId: w.messageId,
      taskId: w.taskId,
      items: [
        { name: '현수막', quantity: 1 },
        { name: '간식', quantity: 2 },
      ],
    },
    '구매 요청',
  )
  w.requestId = created.request.id
  const items = created.request.items
  w.lineItemIds.banner = items.find(item => item.name === '현수막')!.id
  w.lineItemIds.snack = items.find(item => item.name === '간식')!.id
  await sees<TaskResponse>(
    planner,
    `${org(ctx)}/tasks/${w.taskId}`,
    body => [body.task.status],
    'in_progress',
  )
}

// 7 결재: 재정부장이 두 품목을 행사 예산 항목으로 승인하고, 하나는 사지 않기로 해 취소한다(DEC-73).
// 화면 차례와 같다: 결재 대기(필요한 때 순, 3일 안이라 '임박')에서 요청을 열고 두 품목에 [승인]을 골라 [승인 완료 처리] 한 번으로 보낸 뒤 간식을 취소한다.
export async function decideStep(ctx: Ctx) {
  const { financeHead } = ctx.cast
  const { w } = ctx
  const pending = await read<PurchaseRequestsResponse>(
    financeHead,
    `${org(ctx)}/purchase-requests?view=pending&event=${w.eventId}`,
    '결재할 요청 읽기',
  )
  if (!pending.requests.some(item => item.id === w.requestId))
    throw new Error('결재: 재정부장의 결재할 요청에 이 요청이 없다')
  const path = `${org(ctx)}/purchase-requests/${w.requestId}`
  await sees<PurchaseRequestResponse>(
    financeHead,
    path,
    body => body.request.actions,
    'purchase_request.decide',
  )
  const approve = (lineItemId: string, amount: number) => ({
    lineItemId,
    outcome: 'approved',
    amount,
    budgetItemId: w.budgetItemIds.event,
  })
  await write<PurchaseRequestResponse>(
    financeHead,
    `${path}/decisions`,
    {
      decisions: [
        approve(w.lineItemIds.banner, BANNER_WON),
        approve(w.lineItemIds.snack, SNACK_WON),
      ],
    },
    '결재',
  )
  await sees<PurchaseRequestResponse>(
    financeHead,
    path,
    body => body.request.items.find(item => item.id === w.lineItemIds.snack)!.actions,
    'line_item.cancel',
  )
  await write<PurchaseRequestResponse>(
    financeHead,
    `${path}/items/${w.lineItemIds.snack}/cancel`,
    { reason: '간식은 사지 않기로 했어요' },
    '품목 취소',
  )
}

function expenseBody(ctx: Ctx, kind: 'request' | 'direct', commandId: string) {
  const { w } = ctx
  const paidOn = koreanDay(nowOf(ctx))
  if (kind === 'request')
    return {
      commandId,
      vendor: '광고사',
      amount: BANNER_WON,
      paidOn,
      method: 'card',
      reason: '행사 홍보',
      accountId: w.accountIds.main,
      lines: [{ lineItemId: w.lineItemIds.banner, amount: BANNER_WON }],
    }
  return {
    commandId,
    vendor: '문구점',
    description: '테이프와 펜',
    amount: DIRECT_WON,
    paidOn,
    method: 'cash',
    paidBy: w.memberIds.planner,
    reason: '행사 준비물',
    budgetItemId: w.budgetItemIds.event,
    eventId: w.eventId,
  }
}

// 증빙 하나: 올리기 주소를 받고, 저장소에 올린 것으로 만든 뒤 붙인다.
async function attachEvidence(ctx: Ctx, expenseId: string) {
  const { financeStaff } = ctx.cast
  const path = `${org(ctx)}/expenses/${expenseId}`
  await sees<ExpenseResponse>(
    financeStaff,
    path,
    body => body.expense.actions,
    'expense.attach_evidence',
  )
  const upload = await write<{ key: string }>(financeStaff, `${path}/uploads`, {}, '증빙 올리기')
  await ctx.uploadEvidence!(upload.key)
  await create<ExpenseResponse>(
    financeStaff,
    `${path}/evidence`,
    { key: upload.key },
    '증빙 붙이기',
  )
}

// 8 지출: 재정부원이 남은 품목을 결제한 지출을 적고(같은 명령을 한 번 더 보내도 하나), 기획부원이 먼저 낸 직접 지출 하나를 적는다.
// 증빙은 올리는 쪽(uploadEvidence)이 있을 때만 붙인다. 증빙 없는 지출은 정산에 남는다.
export async function spendStep(ctx: Ctx) {
  const { financeStaff } = ctx.cast
  const { w } = ctx
  const payable = await read<PurchaseRequestsResponse>(
    financeStaff,
    `${org(ctx)}/purchase-requests?view=all&event=${w.eventId}`,
    '결제할 요청 읽기',
  )
  if (!payable.requests.some(item => item.id === w.requestId && item.payable))
    throw new Error('지출: 재정부원의 결제할 요청에 이 요청이 없다')
  const { request } = await sees<PurchaseRequestResponse>(
    financeStaff,
    `${org(ctx)}/purchase-requests/${w.requestId}`,
    body => body.request.items.filter(item => item.payable).map(item => item.id),
    w.lineItemIds.banner,
  )
  await seesPermission(ctx, financeStaff, 'finance.manage')
  const sent = { ...expenseBody(ctx, 'request', randomUUID()), description: request.title }
  const path = `${org(ctx)}/expenses`
  const first = await create<ExpenseResponse>(financeStaff, path, sent, '지출 적기')
  w.expenseIds.request = first.expense.id
  const again = await create<ExpenseResponse>(financeStaff, path, sent, '지출 다시 보내기')
  if (again.expense.id !== first.expense.id) throw new Error('지출 다시 보내기: 다른 지출이 생겼다')
  const direct = await create<ExpenseResponse>(
    financeStaff,
    path,
    expenseBody(ctx, 'direct', randomUUID()),
    '직접 지출 적기',
  )
  w.expenseIds.direct = direct.expense.id
  if (ctx.uploadEvidence)
    for (const id of [w.expenseIds.request, w.expenseIds.direct]) await attachEvidence(ctx, id)
}

// 9 정산 1: 시계가 행사 끝을 지난 뒤 재정부원이 먼저 낸 지출을 환급한다.
export async function reimburseStep(ctx: Ctx) {
  const { financeStaff } = ctx.cast
  const path = `${org(ctx)}/expenses/${ctx.w.expenseIds.direct}`
  await sees<ExpenseResponse>(financeStaff, path, body => body.expense.actions, 'expense.reimburse')
  await write<ExpenseResponse>(financeStaff, `${path}/reimburse`, {}, '환급')
}

// 9 정산 2: 재정부원이 환불함의 환불을 마친다.
export async function refundStep(ctx: Ctx) {
  const { financeStaff } = ctx.cast
  const path = `${org(ctx)}/registration-forms/${ctx.w.formId}/applicants?filter=refund_pending`
  const pending = await sees<ApplicantsResponse>(
    financeStaff,
    path,
    body => body.applicants.flatMap(item => item.actions),
    'deposit.refund',
  )
  for (const applicant of pending.applicants)
    await write(
      financeStaff,
      `${org(ctx)}/registrations/${applicant.id}/refund`,
      { amount: null },
      '환불',
    )
}

// 10 완료: 정산이 끝나 회장의 화면에 event.complete가 생기면 사유와 함께 완료한다(012).
export async function completeStep(ctx: Ctx) {
  const { chief } = ctx.cast
  const path = `${org(ctx)}/events/${ctx.w.eventId}`
  const before = await read<EventResponse>(chief, path, '완료 전 행사 읽기')
  if (!before.event.actions.includes('event.complete'))
    throw new Error(
      `완료: 회장의 화면에 event.complete가 없다. 막힌 까닭: ${JSON.stringify(before.event.blockers)}`,
    )
  await write<EventResponse>(
    chief,
    `${path}/complete`,
    { reason: '리허설 행사 정산을 마쳤어요' },
    '완료',
  )
}
