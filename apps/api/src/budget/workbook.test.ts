import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readBook } from '../workbook/read-book.js'
import { INCOME_HEADER, LEDGER_HEADER, LEDGER_RECEIPT_HEADER, periodFileName, periodWorkbook, SPENDING_HEADER, type PeriodSheetData } from './workbook.js'

const valuesOf = (rows: string[][]) => (label: string) => rows.find(cells => cells[0] === label)?.slice(1)
// 날짜 칸은 엑셀 날짜 일련번호다(1970-01-01 = 25569).
const serial = (iso: string) => String(Date.parse(`${iso}T00:00:00Z`) / 86400000 + 25569)
const uploadedAt = new Date('2026-10-09T09:40:00Z')
const receiptUrl = 'https://vada.test/api/organizations/a/expenses/x1/receipts/r1/file'
const data: PeriodSheetData = {
  organizationName: '검증 학생회', period: { name: '2026년 2학기', startsOn: '2026-09-01', endsOn: '2027-02-28' },
  exportedAt: new Date('2026-10-10T01:05:00Z'),
  incomeLines: [{ name: '학생회비', amount: 800000, received: 750000 }, { name: '지원금', amount: 0, received: 0 }],
  unassignedIncome: { received: 30000, count: 1 },
  eventLines: [
    { name: '체육대회', budget: 300000, spent: 57000, planned: 23180, plannedUnknown: 1, remaining: 219820, settled: true },
    { name: '축제', budget: null, spent: 6000, planned: 0, plannedUnknown: 0, remaining: null, settled: false },
  ],
  operatingLines: [{ name: '회의비', amount: 10000, spent: 12000, remaining: -2000 }],
  unassigned: { spent: 3000, count: 1 },
  totals: { income: 800000, received: 780000, budget: 310000, undecided: 1, spent: 78000, planned: 23180, plannedUnknown: 1, remaining: 208820,
    balance: 702000 },
  incomes: [
    { receivedOn: '2026-09-05', line: '학생회비', description: '2학기 학생회비', amount: 750000, note: '학교 지급', recordedBy: '재정' },
    { receivedOn: '2026-10-01', line: null, description: '=후원금 & <감사>', amount: 30000, note: null, recordedBy: '회장' },
  ],
  // 행사 지출은 결제일이 기간 앞이어도 들어간다(8/28).
  expenses: [
    { paidOn: '2026-08-28', line: '체육대회', vendor: '쿠팡', description: '공', amount: 57000, method: 'council_card', payer: '재정', note: null,
      recordedBy: '재정', receipts: [{ kind: 'receipt', fileName: '영수증.jpg', uploadedBy: '재정', uploadedAt, url: receiptUrl }] },
    { paidOn: '2026-10-01', line: '상시 운영 · 회의비', vendor: '다이소', description: '다과', amount: 12000, method: 'personal', payer: '기획', note: '환급',
      recordedBy: '재정', receipts: [] },
    { paidOn: '2026-10-01', line: '축제', vendor: '인쇄소', description: '현수막', amount: 6000, method: 'transfer', payer: '재정', note: null, recordedBy: '회장',
      receipts: [{ kind: 'statement', fileName: '명세서.pdf', uploadedBy: '회장', uploadedAt, url: `https://vada.test/${'a'.repeat(300)}` }] },
    { paidOn: '2026-10-03', line: '상시 운영', vendor: '편의점', description: '물', amount: 3000, method: 'cash', payer: '재정', note: null, recordedBy: '재정',
      receipts: [] },
  ],
  voided: { incomes: 1, expenses: 2 },
  closed: null,
  carriedOver: null,
}

test('결산서 요약: 수입·지출 숫자, 남은 돈, 건수와 알림 줄을 값으로 적는다', async () => {
  const book = readBook(await periodWorkbook(data))
  assert.deepEqual(book.names, ['요약', '수입 결산', '지출 결산', '수입·지출 내역', '증빙'])
  const summary = book.rows(0)
  const row = valuesOf(summary)
  assert.deepEqual(summary[0], ['결산서'])
  assert.deepEqual([row('학생회'), row('회계 기간'), row('기간'), row('내려받은 때'), row('마감')],
    [['검증 학생회'], ['2026년 2학기'], ['2026-09-01 ~ 2027-02-28'], ['2026-10-10 10:05'], ['마감 전']])
  assert.equal(row('다음 기간으로 넘긴 돈'), undefined)
  assert.deepEqual([row('수입 예산'), row('실제 수입')], [['800000'], ['780000']])
  assert.deepEqual(row('예산'), ['310000', '예산 미정 행사 1개는 0원으로 셈'])
  assert.deepEqual([row('실제 지출'), row('집행률')], [['78000'], [String(78000 / 310000)]])
  assert.deepEqual(row('지출 예정'), ['23180', '금액을 모르는 품목 1개 제외'])
  assert.deepEqual([row('남은 예산'), row('남은 돈')], [['208820'], ['702000', '실제 수입 − 실제 지출']])
  assert.deepEqual([row('수입 건수'), row('지출 건수'), row('증빙 누락')], [['2'], ['4'], ['2']])
  for (const line of ['취소한 수입 1건·지출 2건은 넣지 않았어요.', '행사 지출은 결제일과 상관없이 행사가 든 기간으로, 상시 운영 지출은 결제일로 셌어요.',
    '잔액은 0원에서 시작해 이 기간의 수입·지출만 더하고 뺀 값이에요.']) assert.ok(summary.some(cells => cells[0] === line), line)
})

test('수입 결산과 지출 결산: 편성 줄마다 예산·결산·비율을 적고, 미정·0원 예산은 비율을 비우며, 항목 없는 기록과 합계를 둔다', async () => {
  const book = readBook(await periodWorkbook(data))
  assert.deepEqual(book.rows(1), [
    INCOME_HEADER,
    ['학생회비', '800000', '750000', String(750000 / 800000)],
    ['지원금', '0', '0', '—'],
    ['수입 항목을 고르지 않은 수입', '', '30000', '—'],
    ['합계', '800000', '780000', String(780000 / 800000)],
  ])
  assert.deepEqual(book.rows(2), [
    SPENDING_HEADER,
    ['행사', '체육대회', '300000', '57000', String(57000 / 300000), '23180', '219820', '정산 완료 · 금액을 모르는 품목 1개 제외'],
    ['행사', '축제', '미정', '6000', '—', '0', '—'],
    ['운영', '회의비', '10000', '12000', String(12000 / 10000), '', '-2000'],
    ['운영', '운영 항목을 고르지 않은 지출', '', '3000', '', '', '', '1건'],
    ['합계', '', '310000', '78000', String(78000 / 310000), '23180', '208820'],
  ])
  // 남은 예산은 화면처럼 0보다 작으면 "초과"로 보인다. 값은 숫자 그대로다.
  assert.equal(book.formatOf(2, 'G4'), '#,##0;#,##0" 초과"')
})

test('수입·지출 내역: 날짜 순이고 같은 날은 수입이 먼저이며, 잔액은 0원부터 더하고 뺀다. 증빙은 내역 번호로 잇는다', async () => {
  const book = readBook(await periodWorkbook(data))
  assert.deepEqual(book.rows(3), [
    LEDGER_HEADER,
    ['1', serial('2026-08-28'), '지출', '체육대회', '공', '쿠팡', '', '57000', '-57000', '학생회 카드', '재정', '1', '', '재정'],
    ['2', serial('2026-09-05'), '수입', '학생회비', '2학기 학생회비', '', '750000', '', '693000', '', '', '', '학교 지급', '재정'],
    // "="로 시작하는 글도 수식이 아니라 글이다.
    ['3', serial('2026-10-01'), '수입', '—', '=후원금 & <감사>', '', '30000', '', '723000', '', '', '', '', '회장'],
    ['4', serial('2026-10-01'), '지출', '상시 운영 · 회의비', '다과', '다이소', '', '12000', '711000', '개인 결제(환급 필요)', '기획', '0', '환급', '재정'],
    ['5', serial('2026-10-01'), '지출', '축제', '현수막', '인쇄소', '', '6000', '705000', '계좌이체', '재정', '1', '', '회장'],
    ['6', serial('2026-10-03'), '지출', '상시 운영', '물', '편의점', '', '3000', '702000', '현금', '재정', '0', '', '재정'],
    ['합계', '', '', '', '', '', '780000', '78000', '702000'],
  ])
  assert.deepEqual(book.rows(4), [
    LEDGER_RECEIPT_HEADER,
    ['1', '영수증', '영수증.jpg', '재정', '2026-10-09', `formula:HYPERLINK("${receiptUrl}","열기")`],
    // 255자가 넘는 주소는 링크를 빼고 표시만 남긴다.
    ['5', '거래명세서', '명세서.pdf', '회장', '2026-10-09', '—'],
  ])
})

test('빈 기간은 머리글과 합계만 두고, 미정·취소 알림 줄을 넣지 않는다', async () => {
  const book = readBook(await periodWorkbook({ ...data, incomeLines: [], unassignedIncome: { received: 0, count: 0 }, eventLines: [], operatingLines: [],
    unassigned: { spent: 0, count: 0 }, totals: { income: 0, received: 0, budget: 0, undecided: 0, spent: 0, planned: 0, plannedUnknown: 0, remaining: 0,
      balance: 0 }, incomes: [], expenses: [], voided: { incomes: 0, expenses: 0 } }))
  const summary = book.rows(0)
  const row = valuesOf(summary)
  assert.deepEqual([row('예산'), row('지출 예정'), row('집행률'), row('남은 돈')], [['0'], ['0'], ['—'], ['0', '실제 수입 − 실제 지출']])
  assert.equal(summary.some(cells => cells[0]?.startsWith('취소한')), false)
  assert.deepEqual(book.rows(1), [INCOME_HEADER, ['합계', '0', '0', '—']])
  assert.deepEqual(book.rows(2), [SPENDING_HEADER, ['합계', '', '0', '0', '—', '0', '0']])
  assert.deepEqual(book.rows(3), [LEDGER_HEADER, ['합계', '', '', '', '', '', '0', '0', '0']])
  assert.deepEqual(book.rows(4), [LEDGER_RECEIPT_HEADER])
})

test('파일 이름은 윈도 금지 글자를 바꾸고 한국 날짜를 붙이며, 빈 이름은 회계 기간으로 쓴다', () => {
  assert.equal(periodFileName('2026/2학기 "최종"', new Date('2026-10-09T15:30:00Z')), '2026_2학기 _최종_ 결산 2026-10-10.xlsx')
  assert.equal(periodFileName('  ', new Date('2026-10-09T15:30:00Z')), '회계 기간 결산 2026-10-10.xlsx')
})

test('결산서 요약: 마감한 기간이면 마감한 때와 사람, 다음 기간으로 넘긴 돈을 적는다', async () => {
  const closedAt = new Date('2026-10-10T01:05:00Z')
  const summary = readBook(await periodWorkbook({ ...data, closed: { by: '재정', at: closedAt }, carriedOver: { periodName: '2027년 1학기', amount: 88000 } }))
    .rows(0)
  const row = valuesOf(summary)
  assert.deepEqual([row('마감'), row('다음 기간으로 넘긴 돈')], [['2026-10-10 10:05 재정'], ['88000', '2027년 1학기']])
  // 넘긴 돈은 남은 돈 바로 아래에 둔다.
  const balanceAt = summary.findIndex(cells => cells[0] === '남은 돈')
  assert.equal(summary[balanceAt + 1]![0], '다음 기간으로 넘긴 돈')
})
