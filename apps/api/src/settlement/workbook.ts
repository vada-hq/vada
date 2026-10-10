import writeExcelFile, { type Row } from 'write-excel-file/node'
import { EXPENSE_METHOD_LABELS, EXPENSE_METHODS, RECEIPT_KIND_LABELS, type ExpenseMethod, type ReceiptKind } from '@vada/contracts'
import { bold, count, day, header, koreanTime, link, money, text, workbookFileName } from '../workbook/cells.js'

export { contentDisposition, koreanTime } from '../workbook/cells.js'

export interface SheetExpense {
  paidOn: string
  vendor: string
  description: string
  amount: number
  method: ExpenseMethod
  payer: string
  note: string | null
  recordedBy: string
  // 확인된 증빙만 담는다. url은 로그인한 구성원만 여는 앱 주소다.
  receipts: { kind: ReceiptKind; fileName: string; uploadedBy: string; uploadedAt: Date; url: string }[]
  items: { name: string; quantity: number | null; estimatedUnitPrice: number | null; requester: string }[]
}
// 정산서 한 장에 들어가는 자료. 서비스가 모으고 이 파일은 시트만 그린다.
export interface SettlementSheetData {
  organizationName: string
  eventName: string
  settled: { by: string; at: Date } | null
  exportedAt: Date
  budget: number | null
  planned: number
  plannedUnknown: number
  voidedCount: number
  // 받은 참가비와 입금 확인 수. 참가비를 받지 않는 행사는 null이다. 신청자별 입금은 넣지 않는다(금액으로 학생회비 납부 여부를 알 수 있다).
  fees: { received: number; count: number } | null
  // 정산이 넣은 참가비 수입의 기간·수입 항목 이름. 정산 전이거나 받은 참가비가 없으면 null이다.
  feeIncome: { period: string; line: string | null } | null
  // 취소하지 않은 지출, 결제일·기록 순. 이 순서로 1부터 번호(증빙 번호)를 매긴다.
  expenses: SheetExpense[]
}

export const EXPENSE_HEADER = ['번호', '결제일', '사용처', '내용', '금액', '결제 수단', '결제한 사람', '증빙 수', '메모', '기록한 사람']
export const RECEIPT_HEADER = ['지출 번호', '종류', '파일 이름', '올린 사람', '올린 날', '열기']
export const ITEM_HEADER = ['지출 번호', '품목', '수량', '예상 단가', '예상 금액', '요청한 사람']

function summarySheet(data: SettlementSheetData): Row[] {
  const spent = data.expenses.reduce((sum, expense) => sum + expense.amount, 0)
  const missing = data.expenses.filter(expense => expense.receipts.length === 0).length
  const byMethod = (method: ExpenseMethod) => data.expenses.filter(expense => expense.method === method).reduce((sum, expense) => sum + expense.amount, 0)
  return [
    [bold('행사 정산서')],
    [],
    [text('학생회'), text(data.organizationName)],
    [text('행사'), text(data.eventName)],
    [text('정산 상태'), text(data.settled ? `정산 완료 · ${koreanTime(data.settled.at)} · ${data.settled.by}` : '정산 전 (숫자가 바뀔 수 있어요)')],
    [text('내려받은 때'), text(koreanTime(data.exportedAt))],
    [],
    [text('예산'), data.budget === null ? text('미정') : money(data.budget)],
    [text('실제 지출'), money(spent)],
    [text('지출 예정'), money(data.planned), ...(data.plannedUnknown ? [text(`금액을 모르는 품목 ${data.plannedUnknown}개 제외`)] : [])],
    [text('남은 예산'), data.budget === null ? text('—') : money(data.budget - spent - data.planned)],
    // 예산이 미정이거나 0원이면 나누지 않는다.
    [text('집행률'), data.budget ? { value: spent / data.budget, type: Number, format: '0.0%' } : text('—')],
    [text('지출 건수'), count(data.expenses.length)],
    [text('증빙 누락'), count(missing)],
    ...feeRows(data),
    [],
    [bold('결제 수단별 합계')],
    ...EXPENSE_METHODS.map((method): Row => [text(EXPENSE_METHOD_LABELS[method]), money(byMethod(method))]),
    ...(data.voidedCount ? [[], [text(`취소한 지출 ${data.voidedCount}건은 넣지 않았어요.`)]] : []),
  ]
}
// 참가비 묶음. 참가비를 받는 행사만 둔다.
function feeRows({ fees, feeIncome }: SettlementSheetData): Row[] {
  if (!fees) return []
  return [
    [],
    [bold('참가비')],
    [text('받은 참가비'), money(fees.received), text(`입금 확인 ${fees.count}명`)],
    ...(feeIncome ? [[text('참가비 수입'), text(`${feeIncome.period} 수입${feeIncome.line ? ` · ${feeIncome.line}` : ''}`)]] : []),
  ]
}
function expenseSheet(data: SettlementSheetData): Row[] {
  const total = data.expenses.reduce((sum, expense) => sum + expense.amount, 0)
  return [
    header(EXPENSE_HEADER),
    ...data.expenses.map((expense, index): Row => [count(index + 1), day(expense.paidOn), text(expense.vendor), text(expense.description),
      money(expense.amount), text(EXPENSE_METHOD_LABELS[expense.method]), text(expense.payer), count(expense.receipts.length),
      expense.note === null ? null : text(expense.note), text(expense.recordedBy)]),
    [bold('합계'), null, null, null, money(total, true)],
  ]
}
function receiptSheet(data: SettlementSheetData): Row[] {
  return [header(RECEIPT_HEADER), ...data.expenses.flatMap((expense, index) => expense.receipts.map((receipt): Row => [count(index + 1),
    text(RECEIPT_KIND_LABELS[receipt.kind]), text(receipt.fileName), text(receipt.uploadedBy), text(koreanTime(receipt.uploadedAt).slice(0, 10)),
    link(receipt.url)]))]
}
function itemSheet(data: SettlementSheetData): Row[] {
  return [header(ITEM_HEADER), ...data.expenses.flatMap((expense, index) => expense.items.map((item): Row => [count(index + 1), text(item.name),
    item.quantity === null ? text('확인 필요') : count(item.quantity),
    item.estimatedUnitPrice === null ? text('확인 필요') : money(item.estimatedUnitPrice),
    item.quantity === null || item.estimatedUnitPrice === null ? text('—') : money(item.quantity * item.estimatedUnitPrice),
    text(item.requester)]))]
}

// 행사 정산서(.xlsx). 합계는 계산한 값을 적어 수식을 계산하지 않는 미리 보기에서도 보이게 한다.
export async function settlementWorkbook(data: SettlementSheetData): Promise<Buffer> {
  return writeExcelFile([
    { data: summarySheet(data), sheet: '요약', columns: [{ width: 18 }, { width: 36 }, { width: 28 }] },
    { data: expenseSheet(data), sheet: '지출 내역', stickyRowsCount: 1, columns: [{ width: 6 }, { width: 12 }, { width: 20 }, { width: 32 },
      { width: 12 }, { width: 18 }, { width: 12 }, { width: 8 }, { width: 28 }, { width: 12 }] },
    { data: receiptSheet(data), sheet: '증빙', stickyRowsCount: 1, columns: [{ width: 8 }, { width: 12 }, { width: 36 }, { width: 12 },
      { width: 12 }, { width: 8 }] },
    { data: itemSheet(data), sheet: '품목', stickyRowsCount: 1, columns: [{ width: 8 }, { width: 36 }, { width: 8 }, { width: 12 },
      { width: 12 }, { width: 12 }] },
  ]).toBuffer()
}

// 파일 이름. 예: "체육대회 정산 2026-10-10.xlsx"
export const settlementFileName = (eventName: string, exportedAt: Date) => workbookFileName(eventName, '행사', '정산', exportedAt)
