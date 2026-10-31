import {
  WON_MAX,
  type ExpenseMethod,
  type PurchaseLineItem,
  type PurchaseRequestDetail,
  type PurchaseRequestSummary,
} from '@vada/contracts'
import { requiredText, TOO_BIG } from '@/lib/use-form-check'
import { wonOf } from '@/lib/won-input'

// 지출 적기 폼의 값. 입력칸 값은 글자라 비운 칸은 빈 글이고, 요청으로 바꿀 때 null이나 NaN이 된다.
// 요청한 품목 결제(request)는 승인된 품목을 골라 결제 금액을 적고, 요청 없이(direct)는 금액과 예산 항목을 직접 적는다.
export type ExpenseMode = 'request' | 'direct'
type AutoField = 'vendor' | 'description' | 'reason'
export type PayLine = { lineItemId: string; amount: string; approvedAmount: number }
export type ExpenseValues = {
  mode: ExpenseMode
  vendor: string
  description: string
  amount: string
  paidOn: string
  method: ExpenseMethod | ''
  // 비면 학생회 돈이다.
  paidBy: string | null
  reason: string
  // 화면이 마지막으로 채운 값. 지금 값이 이것과 다르면 사람이 고친 것이라 자동으로 바꾸지 않는다. 서버에는 보내지 않는다.
  auto: Record<AutoField, string>
  budgetItemId: string | null
  requestedBy: string | null
  // 돈이 나간 계좌. undefined는 사람이 아직 고르지 않은 것이라 화면이 대표 계좌로 보고, null은 '없음'을 고른 것이다(account-form.ts의 pickAccount).
  accountId: string | null | undefined
  requestId: string | null
  lines: PayLine[]
  eventId: string | null
  // 결제한 요청에 행사가 있으면 지출의 행사는 그것과 같아 바꿀 수 없다(서버가 다르면 409).
  eventLocked: boolean
  // 메시지에서 열었으면 그 메시지. 사람이 고르지 않고 서버가 볼 수 있는지 본다.
  sourceMessageId: string | null
}

// 메시지에서 열 때 미리 채우는 값. linkedRequestIds는 그 메시지로 만든 구매 요청들로, 결제할 요청을 골라 두는 데만 쓴다.
export type ExpenseStart = Partial<
  Pick<ExpenseValues, 'description' | 'paidOn' | 'paidBy' | 'sourceMessageId'>
> & { linkedRequestIds?: readonly string[] }

export const emptyExpense = (
  today: string,
  eventId: string | null = null,
  start: ExpenseStart = {},
): ExpenseValues => ({
  mode: 'request',
  vendor: '',
  description: start.description ?? '',
  amount: '',
  paidOn: start.paidOn ?? today,
  method: '',
  paidBy: start.paidBy ?? null,
  reason: '',
  // 메시지에서 채운 내역도 화면이 채운 것이라, 요청을 골라 두면 요청 제목으로 바뀐다.
  auto: { vendor: '', description: start.description ?? '', reason: '' },
  budgetItemId: null,
  requestedBy: null,
  accountId: undefined,
  requestId: null,
  lines: [],
  eventId,
  eventLocked: false,
  sourceMessageId: start.sourceMessageId ?? null,
})

const orNull = (value: string) => (value.trim() === '' ? null : value)

export const linesTotal = (lines: PayLine[]) =>
  lines.reduce((sum, line) => {
    const won = wonOf(line.amount)
    return sum + (Number.isNaN(won) ? 0 : won)
  }, 0)

// 방식을 바꾸면 그 방식에만 있는 값은 비운다(보이지 않는 값이 몰래 나가지 않게).
export const withMode = (values: ExpenseValues, mode: ExpenseMode): ExpenseValues => ({
  ...withDefault(values, 'reason', ''),
  mode,
  requestId: null,
  lines: [],
  amount: '',
  budgetItemId: null,
  requestedBy: null,
  eventId: values.eventLocked ? null : values.eventId,
  eventLocked: false,
})

// 품목을 고르면 결제 금액이 승인 금액으로 채워진다. 다시 누르면 뺀다. 첫 품목의 판매처를 사용처로 채운다.
export function toggleLine(values: ExpenseValues, item: PurchaseLineItem): ExpenseValues {
  const has = values.lines.some(line => line.lineItemId === item.id)
  const first = !has && values.lines.length === 0
  return {
    ...(first ? withDefault(values, 'vendor', sellerDomain(item.link)) : values),
    lines: has
      ? values.lines.filter(line => line.lineItemId !== item.id)
      : [
          ...values.lines,
          {
            lineItemId: item.id,
            amount: String(item.amount ?? ''),
            approvedAmount: item.amount ?? 0,
          },
        ],
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
    amount: requested ? linesTotal(values.lines) : wonOf(values.amount),
    paidOn: values.paidOn,
    method: values.method,
    paidBy: values.paidBy,
    accountId: values.accountId ?? null,
    reason: orNull(values.reason),
    eventId: values.eventId,
    budgetItemId: requested ? null : values.budgetItemId,
    requestedBy: requested ? null : values.requestedBy,
    sourceMessageId: values.sourceMessageId,
    lines: requested
      ? values.lines.map(line => ({ lineItemId: line.lineItemId, amount: wonOf(line.amount) }))
      : [],
  }
}

const methodError = (method: ExpenseValues['method']) =>
  method === '' ? '결제 수단을 골라 주세요' : undefined

// 요청 결제의 금액은 고른 품목의 합이라 칸이 없다. 합이 계약의 상한을 넘으면 품목 쪽에 알린다.
function linesError({ requestId, lines }: ExpenseValues) {
  if (requestId !== null && lines.length === 0) return '결제한 품목을 골라 주세요'
  return linesTotal(lines) > WON_MAX ? TOO_BIG : undefined
}

// 누를 때 확인하는 칸. 사용처·내역·결제일은 늘, 금액은 요청 없이 적을 때, 요청과 품목은 요청한 품목을 결제할 때 필수다.
// 결제일은 오늘 뒤일 수 없다(서버도 막는다).
export function expenseErrors(values: ExpenseValues, today: string) {
  const amount = values.amount.trim()
  return {
    method: methodError(values.method),
    vendor: requiredText(values.vendor, '사용처를'),
    description: requiredText(values.description, '내역을'),
    paidOn:
      requiredText(values.paidOn, '결제일을') ??
      (values.paidOn > today ? '오늘이나 그 전 날짜를 입력해 주세요' : undefined),
    ...(values.mode === 'direct'
      ? {
          amount:
            requiredText(amount, '금액을') ??
            (wonOf(amount) > 0 ? undefined : '1 이상의 숫자를 입력해 주세요'),
        }
      : {
          requestId: values.requestId === null ? '결제할 요청을 골라 주세요' : undefined,
          lines: linesError(values),
        }),
  }
}

// 판매처가 따로 저장되지 않은 품목은 링크의 도메인으로 채운다(024-10, DEC-92).
function sellerDomain(link: string | null) {
  if (!link) return ''
  try {
    const url = new URL(link)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.hostname : ''
  } catch {
    return ''
  }
}

export function withRequest(
  values: ExpenseValues,
  request: PurchaseRequestSummary | null,
): ExpenseValues {
  const event = request?.event ?? null
  const defaults = withDefault(
    withDefault(withDefault(values, 'reason', ''), 'vendor', ''),
    'description',
    request?.title ?? '',
  )
  return {
    ...defaults,
    requestId: request?.id ?? null,
    lines: [],
    eventId: event ? event.id : values.eventLocked ? null : values.eventId,
    eventLocked: event !== null,
  }
}

// 메시지에 연결된 요청 중 결제할 수 있는 것이 꼭 하나면 그 요청이다. 없거나 여럿이면 시스템이 대신 고르지 않는다.
// 연결이 둘 이상이어도 결제할 수 있는 것만 센다: 같은 메시지로는 앞 요청을 취소·반려한 뒤에만 다시 낼 수 있어서,
// 연결이 여럿인 것은 대개 결제할 수 없는 옛 요청과 다시 낸 요청 하나이고, 고를 것은 그 하나뿐이다.
export function linkedRequestOf<T extends { id: string }>(
  payable: T[],
  linkedIds: readonly string[],
): T | null {
  const [only, ...rest] = payable.filter(request => linkedIds.includes(request.id))
  return only !== undefined && rest.length === 0 ? only : null
}

// 화면이 채우는 값은 사람이 손대지 않은 칸(지금 값이 마지막 자동값과 같음)에만 넣는다. 사람이 쓴 값을 몰래 지우지 않는다.
function withDefault(values: ExpenseValues, field: AutoField, value: string): ExpenseValues {
  if (values[field] !== values.auto[field] || values.auto[field] === value) return values
  return { ...values, [field]: value, auto: { ...values.auto, [field]: value } }
}

export function withRequestReason(
  values: ExpenseValues,
  request: Pick<PurchaseRequestDetail, 'id' | 'body'>,
): ExpenseValues {
  if (values.mode !== 'request' || values.requestId !== request.id) return values
  return withDefault(values, 'reason', request.body ?? '')
}

// 승인액 대비 20% 초과는 자릿수 실수를 한 번 더 확인한다(DEC-92). 합계로 비교하면 다른 품목의 적은 결제가 초과를 숨긴다.
const AMOUNT_CONFIRM_RATIO = 1.2
export const needsAmountConfirm = (values: ExpenseValues) =>
  values.mode === 'request' &&
  values.lines.some(line => wonOf(line.amount) > line.approvedAmount * AMOUNT_CONFIRM_RATIO)
