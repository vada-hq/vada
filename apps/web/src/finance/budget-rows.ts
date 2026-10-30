import type { BudgetItemType, CreateBudgetItems } from '@vada/contracts'
import type { FieldErrors, Parsed } from '@/lib/use-form-check'
import { wonOf } from '@/lib/won-input'

// 예산 편성 창(DEC-92, 와이어프레임 EVT-FIN-01B '행사 예산 편성')의 값과 칸 확인. 행마다 이름과 금액이고,
// 종류와 행사, 담당 부서는 창 하나에 하나다(와이어프레임도 행사 예산과 총예산을 따로 짠다). 칸 이름은 'rows.{행 번호}.purpose|amount'다.

// 행사 예산을 짤 때 채워 두는 행(와이어프레임 미편성 기본 행).
const EVENT_BUDGET_ROWS = ['행사 운영비', '홍보비', '식비'] as const

export type BudgetRow = { key: number; purpose: string; amount: string }
export type BudgetRowsValues = {
  type: BudgetItemType
  eventId: string | null
  departmentId: string | null
  rows: BudgetRow[]
}
// 같은 이름을 견줄 이미 있는 항목(지금 기간). 행사가 같은(둘 다 없음 포함) 항목끼리만 견준다(서버와 같은 범위).
export type ExistingItem = { purpose: string; event: { id: string } | null }

let nextKey = 0
export const blankRow = (purpose = ''): BudgetRow => ({ key: nextKey++, purpose, amount: '' })

// 행사 지출 예산이면 기본 행 셋, 아니면 빈 행 하나.
export const defaultRows = (type: BudgetItemType, eventId: string | null) =>
  eventId && type === 'expense' ? EVENT_BUDGET_ROWS.map(blankRow) : [blankRow()]

const isBlankRow = (row: BudgetRow) => row.purpose.trim() === '' && row.amount.trim() === ''

// 사람이 손대지 않은 행(빈 행이거나 기본 행 그대로)인가. 그렇다면 종류·행사를 바꿀 때 기본 행으로 다시 채운다.
export const untouchedRows = (rows: readonly BudgetRow[]) =>
  rows.every(
    row =>
      row.amount.trim() === '' &&
      (row.purpose.trim() === '' || (EVENT_BUDGET_ROWS as readonly string[]).includes(row.purpose)),
  )

// 보낼 행(완전히 빈 행은 버린다)과 그 행의 창 안 번호. 계약 오류의 'items.{n}'을 창의 행으로 되돌릴 때 쓴다.
const filledOf = (rows: readonly BudgetRow[]) =>
  rows.flatMap((row, index) => (isBlankRow(row) ? [] : [{ row, index }]))

export const budgetItemsOf = (values: BudgetRowsValues): CreateBudgetItems => ({
  items: filledOf(values.rows).map(({ row }) => ({
    purpose: row.purpose.trim(),
    amount: wonOf(row.amount),
    type: values.type,
    eventId: values.eventId,
    departmentId: values.departmentId,
  })),
})

// 금액 칸: 비었으면 필수, 숫자가 아니면 숫자만, 0이면 0원보다 크게(계약 하한 1원).
function amountError(amount: string) {
  if (amount.trim() === '') return '금액을 입력해 주세요'
  const won = wonOf(amount)
  if (Number.isNaN(won)) return '숫자만 입력해 주세요'
  return won < 1 ? '0원보다 큰 금액을 입력해 주세요' : undefined
}

// 행마다의 문제. 한쪽만 채운 행은 빈 칸을, 같은 이름은 뒤에 나온 행(이미 있는 항목과 같으면 그 행)을 짚는다.
// 모든 행이 비었으면 첫 행의 이름 칸을 짚는다.
export function budgetRowErrors(
  values: BudgetRowsValues,
  existing: readonly ExistingItem[],
): FieldErrors {
  const errors: FieldErrors = {}
  const filled = filledOf(values.rows)
  if (!filled.length) return { 'rows.0.purpose': '항목 이름을 입력해 주세요' }
  const taken = new Set(
    existing
      .filter(item => (item.event?.id ?? null) === values.eventId)
      .map(item => item.purpose.trim()),
  )
  for (const { row, index } of filled) {
    const purpose = row.purpose.trim()
    if (purpose === '') errors[`rows.${index}.purpose`] = '항목 이름을 입력해 주세요'
    else if (taken.has(purpose)) errors[`rows.${index}.purpose`] = '같은 이름의 항목이 있어요'
    taken.add(purpose)
    errors[`rows.${index}.amount`] = amountError(row.amount)
  }
  return errors
}

// 계약의 마지막 확인(너무 긴 이름, 금액 상한)을 그 행의 칸으로 옮겨 withContract가 읽게 한다. 경로는 ['items', 보낸 행 번호, 칸]이다.
export function rowsParsed(rows: readonly BudgetRow[], parsed: Parsed): Parsed {
  const filled = filledOf(rows)
  const issues = (parsed.error?.issues ?? []).flatMap(issue => {
    const [, sent, field] = issue.path
    const index = typeof sent === 'number' ? filled[sent]?.index : undefined
    if (index === undefined || typeof field !== 'string') return []
    return [{ ...issue, path: ['rows', index, field] }]
  })
  return { success: issues.length === 0, error: { issues } }
}

// 창 아래의 합계. 아직 숫자가 아닌 칸은 세지 않는다.
export const rowsTotal = (rows: readonly BudgetRow[]) =>
  rows.reduce((sum, row) => {
    const won = wonOf(row.amount)
    return Number.isNaN(won) ? sum : sum + won
  }, 0)
