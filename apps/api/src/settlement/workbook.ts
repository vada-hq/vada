import writeExcelFile, { type Cell, type Row } from 'write-excel-file/node'
import { EXPENSE_METHOD_LABELS, EXPENSE_METHODS, RECEIPT_KIND_LABELS, type ExpenseMethod, type ReceiptKind } from '@vada/contracts'

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
  // 취소하지 않은 지출, 결제일·기록 순. 이 순서로 1부터 번호(증빙 번호)를 매긴다.
  expenses: SheetExpense[]
}

export const EXPENSE_HEADER = ['번호', '결제일', '사용처', '내용', '금액', '결제 수단', '결제한 사람', '증빙 수', '메모', '기록한 사람']
export const RECEIPT_HEADER = ['지출 번호', '종류', '파일 이름', '올린 사람', '올린 날', '열기']
export const ITEM_HEADER = ['지출 번호', '품목', '수량', '예상 단가', '예상 금액', '요청한 사람']

// 사용자가 쓴 글은 모두 문자 칸이다. "="로 시작해도 수식으로 읽히지 않는다.
const text = (value: string): Cell => ({ value, type: String })
const bold = (value: string): Cell => ({ value, type: String, fontWeight: 'bold' })
const money = (value: number, strong = false): Cell => ({ value, type: Number, format: '#,##0', ...(strong ? { fontWeight: 'bold' as const } : {}) })
const count = (value: number): Cell => ({ value, type: Number })
// 결제일은 날짜 칸이다. 날짜를 UTC 자정으로 두어 일련번호가 정수가 되게 한다.
const day = (value: string): Cell => ({ value: new Date(`${value}T00:00:00.000Z`), type: Date, format: 'yyyy-mm-dd' })
// 수식 안 문자열은 255자까지다. 넘으면 링크를 빼고 표시만 남긴다. 주소는 서버가 만든 것만 넣는다.
const link = (url: string): Cell => url.length <= 255 && !url.includes('"') ? { value: `HYPERLINK("${url}","열기")`, type: 'Formula' } : text('—')
const header = (labels: string[]): Row => labels.map(bold)
// 2026-10-09 18:40 (한국 시간)
export const koreanTime = (value: Date) => value.toLocaleString('sv-SE', { timeZone: 'Asia/Seoul', hour12: false }).slice(0, 16)

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
    [],
    [bold('결제 수단별 합계')],
    ...EXPENSE_METHODS.map((method): Row => [text(EXPENSE_METHOD_LABELS[method]), money(byMethod(method))]),
    ...(data.voidedCount ? [[], [text(`취소한 지출 ${data.voidedCount}건은 넣지 않았어요.`)]] : []),
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

// 파일 이름. 윈도에서 쓸 수 없는 글자는 _로 바꾸고 한국 날짜를 붙인다.
export function settlementFileName(eventName: string, exportedAt: Date) {
  const name = eventName.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim() || '행사'
  return `${name} 정산 ${exportedAt.toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })}.xlsx`
}
// 내려받기 머리글. 한글 이름은 RFC 5987로 싣고, encodeURIComponent가 남기는 ' ( ) * 도 바꾼다.
export function contentDisposition(fileName: string) {
  const encoded = encodeURIComponent(fileName).replace(/['()*]/g, char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)
  return `attachment; filename="settlement.xlsx"; filename*=UTF-8''${encoded}`
}
