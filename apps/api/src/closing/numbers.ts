import type {
  ClosingAccountLine,
  ClosingExpense,
  ClosingIncome,
  ClosingLine,
  ClosingSourceTotal,
  IncomeSource,
} from '@vada/contracts'

// 결산서의 숫자는 이 모듈 하나가 만든다(화면, 엑셀, 공개 검사가 같은 값을 본다). 돈은 정수 원이다.
// 입력은 DB에서 취소하지 않은 줄만 묶어 가져온 합이다(totals.ts).

export type BudgetItemRow = { id: string; type: string; purpose: string; amount: number }
export type IncomeRow = {
  source: string
  itemId: string | null
  accountId: string | null
  amount: number
  count: number
}
export type ExpenseRow = { itemId: string | null; accountId: string | null; amount: number }
export type AccountRow = { id: string; name: string; closed: boolean }

const CARRYOVER = 'carryover'
const PERCENT = 100

const sum = (rows: readonly { amount: number }[]) => rows.reduce((all, row) => all + row.amount, 0)

function lineOf(item: BudgetItemRow, actual: number): ClosingLine {
  return {
    id: item.id,
    purpose: item.purpose,
    budget: item.amount,
    actual,
    difference: item.type === 'income' ? actual - item.amount : item.amount - actual,
    rate: item.amount > 0 ? Math.round((actual * PERCENT) / item.amount) : null,
  }
}

function linesOf(items: readonly BudgetItemRow[], type: string, rows: readonly ExpenseRow[]) {
  return items
    .filter(item => item.type === type)
    .map(item => lineOf(item, sum(rows.filter(row => row.itemId === item.id))))
}

function sourcesOf(rows: readonly IncomeRow[]): ClosingSourceTotal[] {
  const bySource = new Map<string, ClosingSourceTotal>()
  for (const row of rows) {
    const held = bySource.get(row.source) ?? {
      source: row.source as IncomeSource,
      count: 0,
      amount: 0,
    }
    bySource.set(row.source, {
      ...held,
      count: held.count + row.count,
      amount: held.amount + row.amount,
    })
  }
  return [...bySource.values()].sort((a, b) => a.source.localeCompare(b.source))
}

function incomeOf(items: readonly BudgetItemRow[], rows: readonly IncomeRow[]): ClosingIncome {
  const lines = linesOf(items, 'income', rows)
  const known = new Set(lines.map(line => line.id))
  const carryover = sum(rows.filter(row => row.source === CARRYOVER))
  const noItem = sum(
    rows.filter(row => row.source !== CARRYOVER && !(row.itemId && known.has(row.itemId))),
  )
  return { carryover, items: lines, noItem, bySource: sourcesOf(rows), total: sum(rows) }
}

function expenseOf(items: readonly BudgetItemRow[], rows: readonly ExpenseRow[]): ClosingExpense {
  const lines = linesOf(items, 'expense', rows)
  const known = new Set(lines.map(line => line.id))
  return {
    items: lines,
    noItem: sum(rows.filter(row => row.itemId === null)),
    otherPeriod: sum(rows.filter(row => row.itemId !== null && !known.has(row.itemId))),
    total: sum(rows),
  }
}

// 계좌마다(닫은 계좌 포함) 이 기간의 수입·지출. 이월금은 계좌가 없어 따로 보이므로 넣지 않는다.
function accountsOf(
  accounts: readonly AccountRow[],
  incomes: readonly IncomeRow[],
  expenses: readonly ExpenseRow[],
): ClosingAccountLine[] {
  const spendable = incomes.filter(row => row.source !== CARRYOVER)
  const lineFor = (account: AccountRow | null): ClosingAccountLine => {
    const id = account?.id ?? null
    const received = sum(spendable.filter(row => row.accountId === id))
    const spent = sum(expenses.filter(row => row.accountId === id))
    return { account, income: received, expense: spent, difference: received - spent }
  }
  return [...accounts.map(lineFor), lineFor(null)]
}

export function closingNumbersOf(input: {
  items: readonly BudgetItemRow[]
  incomes: readonly IncomeRow[]
  expenses: readonly ExpenseRow[]
  accounts: readonly AccountRow[]
}) {
  const income = incomeOf(input.items, input.incomes)
  const expense = expenseOf(input.items, input.expenses)
  return {
    income,
    expense,
    // 남은 돈 = 전기 이월금을 포함한 수입 합 − 지출 합
    remaining: income.total - expense.total,
    accounts: accountsOf(input.accounts, input.incomes, input.expenses),
  }
}
