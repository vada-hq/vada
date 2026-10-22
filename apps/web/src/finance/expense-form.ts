import type { ExpenseMethod, PurchaseLineItem } from '@vada/contracts'

// 지출 적기 폼의 값. 입력칸 값은 글자라 비운 칸은 빈 글이고, 요청으로 바꿀 때 null이나 NaN이 된다.
// 요청한 품목 결제(request)는 승인된 품목을 골라 결제 금액을 적고, 요청 없이(direct)는 금액과 예산 항목을 직접 적는다.
export type ExpenseMode = 'request' | 'direct'
export type PayLine = { lineItemId: string; amount: string }
export type ExpenseValues = {
  mode: ExpenseMode
  vendor: string
  description: string
  amount: string
  paidOn: string
  method: ExpenseMethod
  // 비면 학생회 돈이다.
  paidBy: string | null
  reason: string
  budgetItemId: string | null
  requestedBy: string | null
  // 돈이 나간 계좌. undefined는 사람이 아직 고르지 않은 것이라 화면이 대표 계좌로 보고, null은 '없음'을 고른 것이다(account-form.ts의 pickAccount).
  accountId: string | null | undefined
  requestId: string | null
  lines: PayLine[]
  eventId: string | null
  // 결제한 요청에 행사가 있으면 지출의 행사는 그것과 같아 바꿀 수 없다(서버가 다르면 409).
  eventLocked: boolean
}

export const emptyExpense = (today: string, eventId: string | null = null): ExpenseValues => ({
  mode: 'request',
  vendor: '',
  description: '',
  amount: '',
  paidOn: today,
  method: 'card',
  paidBy: null,
  reason: '',
  budgetItemId: null,
  requestedBy: null,
  accountId: undefined,
  requestId: null,
  lines: [],
  eventId,
  eventLocked: false,
})

const orNull = (value: string) => (value.trim() === '' ? null : value)
const numberOf = (value: string) => (value.trim() === '' ? Number.NaN : Number(value))

export const linesTotal = (lines: PayLine[]) =>
  lines.reduce(
    (sum, line) => sum + (Number.isNaN(numberOf(line.amount)) ? 0 : numberOf(line.amount)),
    0,
  )

// 방식을 바꾸면 그 방식에만 있는 값은 비운다(보이지 않는 값이 몰래 나가지 않게).
export const withMode = (values: ExpenseValues, mode: ExpenseMode): ExpenseValues => ({
  ...values,
  mode,
  requestId: null,
  lines: [],
  amount: '',
  budgetItemId: null,
  requestedBy: null,
  eventId: values.eventLocked ? null : values.eventId,
  eventLocked: false,
})

// 품목을 고르면 결제 금액이 승인 금액으로 채워진다. 다시 누르면 뺀다.
export function toggleLine(values: ExpenseValues, item: PurchaseLineItem): ExpenseValues {
  const has = values.lines.some(line => line.lineItemId === item.id)
  return {
    ...values,
    lines: has
      ? values.lines.filter(line => line.lineItemId !== item.id)
      : [...values.lines, { lineItemId: item.id, amount: String(item.amount ?? '') }],
  }
}

export const setLineAmount = (values: ExpenseValues, lineItemId: string, amount: string) => ({
  ...values,
  lines: values.lines.map(line => (line.lineItemId === lineItemId ? { ...line, amount } : line)),
})

// 서버로 보낼 본문. 요청한 품목 결제의 금액은 결제 내역의 합이다.
export function expenseOf(values: ExpenseValues) {
  const requested = values.mode === 'request'
  return {
    vendor: values.vendor,
    description: values.description,
    amount: requested ? linesTotal(values.lines) : numberOf(values.amount),
    paidOn: values.paidOn,
    method: values.method,
    paidBy: values.paidBy,
    accountId: values.accountId ?? null,
    reason: orNull(values.reason),
    eventId: values.eventId,
    budgetItemId: requested ? null : values.budgetItemId,
    requestedBy: requested ? null : values.requestedBy,
    lines: requested
      ? values.lines.map(line => ({ lineItemId: line.lineItemId, amount: numberOf(line.amount) }))
      : [],
  }
}
