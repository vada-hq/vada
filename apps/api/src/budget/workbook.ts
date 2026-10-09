import writeExcelFile, { type Cell, type Row } from 'write-excel-file/node'
import { EXPENSE_METHOD_LABELS, RECEIPT_KIND_LABELS, type ExpenseMethod, type ReceiptKind } from '@vada/contracts'
import { bold, count, day, header, koreanTime, link, money, rate, text, workbookFileName } from '../workbook/cells.js'

export interface SheetIncome {
  receivedOn: string
  // 수입 항목 이름. 고르지 않았으면 null이다.
  line: string | null
  description: string
  amount: number
  note: string | null
  recordedBy: string
}
export interface SheetLedgerExpense {
  paidOn: string
  // 행사 이름, "상시 운영 · 운영 항목", "상시 운영"
  line: string
  vendor: string
  description: string
  amount: number
  method: ExpenseMethod
  payer: string
  note: string | null
  recordedBy: string
  // 확인된 증빙만 담는다. url은 로그인한 구성원만 여는 앱 주소다.
  receipts: { kind: ReceiptKind; fileName: string; uploadedBy: string; uploadedAt: Date; url: string }[]
}
// 결산서 한 장에 들어가는 자료. 서비스가 모으고 이 파일은 시트만 그린다. 숫자는 예산 화면과 같은 정의다.
export interface PeriodSheetData {
  organizationName: string
  period: { name: string; startsOn: string; endsOn: string }
  exportedAt: Date
  incomeLines: { name: string; amount: number; received: number }[]
  unassignedIncome: { received: number; count: number }
  eventLines: { name: string; budget: number | null; spent: number; planned: number; plannedUnknown: number; remaining: number | null; settled: boolean }[]
  operatingLines: { name: string; amount: number; spent: number; remaining: number }[]
  unassigned: { spent: number; count: number }
  totals: { income: number; received: number; budget: number; undecided: number; spent: number; planned: number; plannedUnknown: number; remaining: number;
    balance: number }
  // 취소하지 않은 수입·지출. 각각 기록한 순서로 주면 이 파일이 날짜 순으로 섞는다.
  incomes: SheetIncome[]
  expenses: SheetLedgerExpense[]
  voided: { incomes: number; expenses: number }
}

export const INCOME_HEADER = ['수입 항목', '예산', '실제 수입', '비율']
export const SPENDING_HEADER = ['구분', '항목', '예산', '실제 지출', '집행률', '지출 예정', '남은 예산', '비고']
export const LEDGER_HEADER = ['번호', '날짜', '구분', '항목', '내용', '사용처', '수입', '지출', '잔액', '결제 수단', '결제한 사람', '증빙 수', '메모', '기록한 사람']
export const LEDGER_RECEIPT_HEADER = ['내역 번호', '종류', '파일 이름', '올린 사람', '올린 날', '열기']

const dash = text('—')
// 남은 예산은 화면처럼 0보다 작으면 "초과"로 보인다. 값은 숫자 그대로라 더하고 뺄 수 있다.
const remaining = (value: number): Cell => ({ value, type: Number, format: '#,##0;#,##0" 초과"' })
// 나누는 값이 0이거나 미정이면 비율을 적지 않는다.
const ratio = (part: number, whole: number | null) => whole ? rate(part / whole) : dash

type Entry = { kind: 'income'; date: string; income: SheetIncome } | { kind: 'expense'; date: string; expense: SheetLedgerExpense }
// 날짜 순. 같은 날이면 수입을 먼저 두고, 같은 종류는 받은 순서(기록한 순)를 지킨다(정렬은 안정적이다).
function ledgerOf(data: PeriodSheetData): Entry[] {
  const rank = (entry: Entry) => entry.kind === 'income' ? 0 : 1
  return [...data.incomes.map((income): Entry => ({ kind: 'income', date: income.receivedOn, income })),
    ...data.expenses.map((expense): Entry => ({ kind: 'expense', date: expense.paidOn, expense }))]
    .sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : rank(a) - rank(b))
}

function summarySheet(data: PeriodSheetData): Row[] {
  const { totals } = data
  const missing = data.expenses.filter(expense => expense.receipts.length === 0).length
  return [
    [bold('결산서')],
    [],
    [text('학생회'), text(data.organizationName)],
    [text('회계 기간'), text(data.period.name)],
    [text('기간'), text(`${data.period.startsOn} ~ ${data.period.endsOn}`)],
    [text('내려받은 때'), text(koreanTime(data.exportedAt))],
    [],
    [bold('수입')],
    [text('수입 예산'), money(totals.income)],
    [text('실제 수입'), money(totals.received)],
    [],
    [bold('지출')],
    [text('예산'), money(totals.budget), ...(totals.undecided ? [text(`예산 미정 행사 ${totals.undecided}개는 0원으로 셈`)] : [])],
    [text('실제 지출'), money(totals.spent)],
    [text('집행률'), ratio(totals.spent, totals.budget)],
    [text('지출 예정'), money(totals.planned), ...(totals.plannedUnknown ? [text(`금액을 모르는 품목 ${totals.plannedUnknown}개 제외`)] : [])],
    [text('남은 예산'), remaining(totals.remaining)],
    [],
    [bold('남은 돈'), money(totals.balance, true), text('실제 수입 − 실제 지출')],
    [],
    [text('수입 건수'), count(data.incomes.length)],
    [text('지출 건수'), count(data.expenses.length)],
    [text('증빙 누락'), count(missing)],
    [],
    ...(data.voided.incomes || data.voided.expenses ? [[text(`취소한 수입 ${data.voided.incomes}건·지출 ${data.voided.expenses}건은 넣지 않았어요.`)]] : []),
    [text('행사 지출은 결제일과 상관없이 행사가 든 기간으로, 상시 운영 지출은 결제일로 셌어요.')],
    [text('잔액은 0원에서 시작해 이 기간의 수입·지출만 더하고 뺀 값이에요.')],
  ]
}
function incomeSheet(data: PeriodSheetData): Row[] {
  const { totals } = data
  return [
    header(INCOME_HEADER),
    ...data.incomeLines.map((line): Row => [text(line.name), money(line.amount), money(line.received), ratio(line.received, line.amount)]),
    ...(data.unassignedIncome.count ? [[text('수입 항목을 고르지 않은 수입'), null, money(data.unassignedIncome.received), dash]] : []),
    [bold('합계'), money(totals.income, true), money(totals.received, true), ratio(totals.received, totals.income)],
  ]
}
function spendingSheet(data: PeriodSheetData): Row[] {
  const { totals } = data
  const notes = (line: PeriodSheetData['eventLines'][number]) =>
    [line.settled ? '정산 완료' : '', line.plannedUnknown ? `금액을 모르는 품목 ${line.plannedUnknown}개 제외` : ''].filter(Boolean).join(' · ')
  return [
    header(SPENDING_HEADER),
    ...data.eventLines.map((line): Row => [text('행사'), text(line.name), line.budget === null ? text('미정') : money(line.budget), money(line.spent),
      ratio(line.spent, line.budget), money(line.planned), line.remaining === null ? dash : remaining(line.remaining), notes(line) ? text(notes(line)) : null]),
    // 운영 줄에는 지출 예정이 없다.
    ...data.operatingLines.map((line): Row => [text('운영'), text(line.name), money(line.amount), money(line.spent), ratio(line.spent, line.amount), null,
      remaining(line.remaining), null]),
    ...(data.unassigned.count ? [[text('운영'), text('운영 항목을 고르지 않은 지출'), null, money(data.unassigned.spent), null, null, null,
      text(`${data.unassigned.count}건`)]] : []),
    [bold('합계'), null, money(totals.budget, true), money(totals.spent, true), ratio(totals.spent, totals.budget), money(totals.planned, true),
      remaining(totals.remaining), null],
  ]
}
function ledgerSheet(entries: Entry[]): Row[] {
  let balance = 0
  let received = 0
  let spent = 0
  const rows = entries.map((entry, index): Row => {
    if (entry.kind === 'income') {
      const { income } = entry
      balance += income.amount
      received += income.amount
      return [count(index + 1), day(income.receivedOn), text('수입'), text(income.line ?? '—'), text(income.description), null, money(income.amount), null,
        money(balance), null, null, null, income.note === null ? null : text(income.note), text(income.recordedBy)]
    }
    const { expense } = entry
    balance -= expense.amount
    spent += expense.amount
    return [count(index + 1), day(expense.paidOn), text('지출'), text(expense.line), text(expense.description), text(expense.vendor), null,
      money(expense.amount), money(balance), text(EXPENSE_METHOD_LABELS[expense.method]), text(expense.payer), count(expense.receipts.length),
      expense.note === null ? null : text(expense.note), text(expense.recordedBy)]
  })
  return [header(LEDGER_HEADER), ...rows, [bold('합계'), null, null, null, null, null, money(received, true), money(spent, true), money(balance, true)]]
}
function receiptSheet(entries: Entry[]): Row[] {
  return [header(LEDGER_RECEIPT_HEADER), ...entries.flatMap((entry, index) => entry.kind === 'income' ? [] : entry.expense.receipts.map((receipt): Row => [
    count(index + 1), text(RECEIPT_KIND_LABELS[receipt.kind]), text(receipt.fileName), text(receipt.uploadedBy),
    text(koreanTime(receipt.uploadedAt).slice(0, 10)), link(receipt.url)]))]
}

// 결산서(.xlsx). 부산대 재정운용세칙 결산안 서식(별지 제2호)의 세입 요약·세출 요약·세부 내역을 시트로 옮긴다.
// 합계는 계산한 값을 적어 수식을 계산하지 않는 미리 보기에서도 보이게 한다.
export async function periodWorkbook(data: PeriodSheetData): Promise<Buffer> {
  const entries = ledgerOf(data)
  return writeExcelFile([
    { data: summarySheet(data), sheet: '요약', columns: [{ width: 18 }, { width: 36 }, { width: 36 }] },
    { data: incomeSheet(data), sheet: '수입 결산', stickyRowsCount: 1, columns: [{ width: 28 }, { width: 14 }, { width: 14 }, { width: 8 }] },
    { data: spendingSheet(data), sheet: '지출 결산', stickyRowsCount: 1, columns: [{ width: 6 }, { width: 28 }, { width: 14 }, { width: 14 }, { width: 8 },
      { width: 14 }, { width: 14 }, { width: 32 }] },
    { data: ledgerSheet(entries), sheet: '수입·지출 내역', stickyRowsCount: 1, columns: [{ width: 6 }, { width: 12 }, { width: 6 }, { width: 20 }, { width: 28 },
      { width: 16 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 18 }, { width: 12 }, { width: 8 }, { width: 24 }, { width: 12 }] },
    { data: receiptSheet(entries), sheet: '증빙', stickyRowsCount: 1, columns: [{ width: 8 }, { width: 12 }, { width: 36 }, { width: 12 }, { width: 12 },
      { width: 8 }] },
  ]).toBuffer()
}

// 파일 이름. 예: "2026년 2학기 결산 2026-10-10.xlsx"
export const periodFileName = (periodName: string, exportedAt: Date) => workbookFileName(periodName, '회계 기간', '결산', exportedAt)
