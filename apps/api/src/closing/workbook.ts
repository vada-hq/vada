import writeXlsxFile from 'write-excel-file/node'
import type { Closing, ClosingCheckKind, EvidenceType, IncomeSource } from '@vada/contracts'
import type { ExportAccount, ExportExpense, ExportIncome } from './export-rows.js'

// 결산서 엑셀. 숫자는 결산서와 같은 계산 모듈(numbers.ts)이 만든 값을 그대로 받고 여기서 다시 계산하지 않는다.
// 사람이 쓴 글은 모두 문자 칸이다. '=+-@'로 시작해도 수식이 되지 않는다(OWASP CSV Injection).
// 공개용은 사람 이름·계좌번호·예금주를 담지 않는다. 걸러 내는 곳은 이 파일의 kind 분기 한 곳이다.

export type ExportKind = 'public' | 'audit'

export type WorkbookInput = {
  kind: ExportKind
  closing: Closing
  incomes: ExportIncome[]
  expenses: ExportExpense[]
  accounts: ExportAccount[]
}

type Cell = {
  value: string | number
  type: StringConstructor | NumberConstructor
  format?: string
  fontWeight?: 'bold'
} | null
type Row = Cell[]

// XML에 쓸 수 없는 제어 문자는 뺀다(줄바꿈과 탭은 둔다).
// oxlint-disable-next-line no-control-regex -- 엑셀 XML에 들어갈 수 없는 문자를 걸러 내려고 일부러 제어 문자를 쓴다
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g

const text = (value: string | null | undefined): Cell =>
  value ? { value: value.replace(CONTROL, ''), type: String } : null
const won = (value: number): Cell => ({ value, type: Number, format: '#,##0' })
const count = (value: number): Cell => ({ value, type: Number })
const percent = (value: number | null): Cell =>
  value === null ? null : { value, type: Number, format: '0"%"' }
const head = (...labels: string[]): Row =>
  labels.map(value => ({ value, type: String, fontWeight: 'bold' }))
const titled = (label: string): Row => head(label)

const SOURCE_LABEL: Record<IncomeSource, string> = {
  fee: '학생회비',
  grant: '지원금',
  business: '사업 수익',
  donation: '후원금',
  other: '기타',
  participation_fee: '참가비',
  carryover: '이월금',
}
const METHOD_LABEL: Record<string, string> = {
  card: '카드',
  transfer: '계좌 이체',
  cash: '현금',
}
export const EVIDENCE_TYPE_LABEL: Record<EvidenceType, string> = {
  receipt: '영수증',
  statement: '거래명세서',
  tax_invoice: '세금계산서',
  card_statement: '카드 전표',
  transfer_confirmation: '이체 확인증',
  item_photo: '물품 사진',
  site_photo: '현장 사진',
  stock_photo: '입고 사진',
  other: '기타',
}
const CHECK_LABEL: Record<ClosingCheckKind, string> = {
  no_evidence: '증빙 없음',
  no_reason: '사유 없음',
  unreimbursed: '환급 전',
  no_account: '계좌 없음',
  no_item: '예산 항목 없음',
  other_period_item: '다른 기간 예산 항목',
}

const NO_ITEM = '(예산 항목 없음)'

function summarySheet({ closing, kind }: WorkbookInput): Row[] {
  const { income, expense } = closing
  const rows: Row[] = [
    titled('결산서'),
    [text('기간'), text(closing.period.name)],
    [text('기간 날짜'), text(`${closing.period.startsOn} ~ ${closing.period.endsOn}`)],
    [text('결산 상태'), text(closing.status === 'published' ? '공개됨' : '작성 중')],
    [text('파일'), text(kind === 'public' ? '공개용' : '감사용')],
    [],
    [text('전기 이월금'), won(income.carryover)],
    [text('수입 합'), won(income.total)],
    [text('지출 합'), won(expense.total)],
    [text('남은 돈'), won(closing.remaining)],
    [],
    head('수입 예산 항목', '예산', '결산', '차이'),
  ]
  for (const line of income.items)
    rows.push([text(line.purpose), won(line.budget), won(line.actual), won(line.difference)])
  rows.push([text(NO_ITEM), null, won(income.noItem)], [], head('출처별 수입', '건수', '금액'))
  for (const source of income.bySource)
    rows.push([text(SOURCE_LABEL[source.source]), count(source.count), won(source.amount)])
  rows.push([], head('지출 예산 항목', '예산', '결산', '차이', '집행률'))
  for (const line of expense.items)
    rows.push([
      text(line.purpose),
      won(line.budget),
      won(line.actual),
      won(line.difference),
      percent(line.rate),
    ])
  rows.push([text(NO_ITEM), null, won(expense.noItem)])
  rows.push([text('다른 기간 예산 항목'), null, won(expense.otherPeriod)])
  return rows
}

function incomeSheet({ incomes, kind }: WorkbookInput): Row[] {
  const audit = kind === 'audit'
  const rows: Row[] = [
    head('받은 날', '출처', '금액', '내용', '예산 항목', '계좌', ...(audit ? ['적은 사람'] : [])),
  ]
  for (const row of incomes)
    rows.push([
      text(row.receivedOn),
      text(SOURCE_LABEL[row.source as IncomeSource] ?? row.source),
      won(row.amount),
      text(row.description),
      text(row.item),
      text(row.account),
      ...(audit ? [text(row.recorder)] : []),
    ])
  return rows
}

function expenseSheet({ expenses, kind }: WorkbookInput): Row[] {
  const audit = kind === 'audit'
  const rows: Row[] = [
    head(
      '증빙번호',
      '결제일',
      '사용처',
      '내용',
      '금액',
      '결제 수단',
      '예산 항목',
      '계좌',
      '행사',
      '사유',
      '환급일',
      '증빙 수',
      ...(audit ? ['먼저 낸 사람', '부탁한 사람', '적은 사람'] : []),
    ),
  ]
  for (const row of expenses)
    rows.push([
      count(row.number),
      text(row.paidOn),
      text(row.vendor),
      text(row.description),
      won(row.amount),
      text(METHOD_LABEL[row.method] ?? row.method),
      text(row.items.join(', ')),
      text(row.account),
      text(row.event),
      text(row.reason),
      text(row.reimbursedOn),
      count(row.evidenceCount),
      ...(audit ? [text(row.payer), text(row.requester), text(row.recorder)] : []),
    ])
  return rows
}

// 계좌별 줄은 결산서의 계좌 줄(numbers.ts)이다. 은행·번호·예금주는 감사용에만 붙인다. 이월금은 계좌 줄에 넣지 않고 따로 적는다.
function accountSheet({ closing, accounts, kind }: WorkbookInput): Row[] {
  const audit = kind === 'audit'
  const rows: Row[] = [
    head('계좌', '수입', '지출', '차이', ...(audit ? ['은행', '계좌번호', '예금주'] : [])),
  ]
  for (const line of closing.accounts) {
    const detail = accounts.find(row => row.id === line.account?.id)
    rows.push([
      text(
        line.account ? line.account.name + (line.account.closed ? ' (닫음)' : '') : '계좌 미지정',
      ),
      won(line.income),
      won(line.expense),
      won(line.difference),
      ...(audit ? [text(detail?.bank), text(detail?.accountNumber), text(detail?.holder)] : []),
    ])
  }
  rows.push([], [text('전기 이월금(계좌 줄에 넣지 않음)'), won(closing.income.carryover)])
  return rows
}

// 점검은 감사용에만 든다. 수는 전체이고 목록은 결산서가 주는 상한까지다.
function checkSheet({ closing, expenses }: WorkbookInput): Row[] {
  const numbers = new Map(expenses.map(row => [row.id, row.number]))
  const rows: Row[] = [head('점검', '건수', '해당 증빙번호')]
  for (const check of closing.checks) {
    const listed = check.targets.flatMap(target =>
      target.type === 'expense' && numbers.has(target.id) ? [String(numbers.get(target.id))] : [],
    )
    rows.push([text(CHECK_LABEL[check.kind]), count(check.count), text(listed.join(', '))])
  }
  rows.push([], head('완료하지 않은 행사의 입금', '입금 수', '금액'))
  for (const row of closing.feePending.blocking)
    rows.push([text(row.event.name), count(row.depositCount), won(row.amount)])
  const next = closing.feePending.nextPeriod
  rows.push([
    text(`다음 기간 행사에 받은 입금(행사 ${next.eventCount}곳)`),
    count(next.depositCount),
    won(next.amount),
  ])
  return rows
}

const WIDE = 18
const sheetOf = (sheet: string, data: Row[]) => ({
  sheet,
  data,
  columns: (data[0] ?? []).map(() => ({ width: WIDE })),
})

export function workbookOf(input: WorkbookInput): Promise<Buffer> {
  const sheets = [
    sheetOf('요약', summarySheet(input)),
    sheetOf('수입', incomeSheet(input)),
    sheetOf('지출', expenseSheet(input)),
    sheetOf('계좌별', accountSheet(input)),
    ...(input.kind === 'audit' ? [sheetOf('점검', checkSheet(input))] : []),
  ]
  return writeXlsxFile(sheets).toBuffer()
}
