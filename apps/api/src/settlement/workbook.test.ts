import assert from 'node:assert/strict'
import { test } from 'node:test'
import { strFromU8, unzipSync } from 'fflate'
import { contentDisposition, EXPENSE_HEADER, ITEM_HEADER, RECEIPT_HEADER, settlementFileName, settlementWorkbook,
  type SettlementSheetData } from './workbook.js'

// 테스트용 xlsx 읽기. 시트를 [행][열] 글자 표로 돌려준다.
// 문자 칸은 글, 숫자·날짜 칸은 저장된 값, 수식 칸은 "formula:수식", 빈 칸은 ''다.
function readBook(file: Buffer) {
  const files = unzipSync(new Uint8Array(file))
  const xml = (path: string) => strFromU8(files[path]!)
  const unescape = (value: string) => value.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')
  const attribute = (element: string, name: string) => element.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1]
  const strings = [...xml('xl/sharedStrings.xml').matchAll(/<si><t[^>]*>([\s\S]*?)<\/t><\/si>/g)].map(match => unescape(match[1]!))
  const targets = new Map([...xml('xl/_rels/workbook.xml.rels').matchAll(/<Relationship\b[^>]*>/g)]
    .map(([element]) => [attribute(element, 'Id')!, attribute(element, 'Target')!]))
  const sheets = [...xml('xl/workbook.xml').matchAll(/<sheet\b[^>]*>/g)].map(([element]) => {
    const target = targets.get(attribute(element, 'r:id')!)!
    return { name: unescape(attribute(element, 'name')!), path: target.startsWith('/') ? target.slice(1) : `xl/${target}` }
  })
  function rows(index: number) {
    const table: string[][] = []
    for (const [, column, row, attributes, inner = ''] of xml(sheets[index]!.path).matchAll(/<c r="([A-Z]+)(\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const formula = inner.match(/<f>([\s\S]*?)<\/f>/)?.[1]
      const value = inner.match(/<v>([\s\S]*?)<\/v>/)?.[1]
      const cell = formula !== undefined ? `formula:${unescape(formula)}` : value === undefined ? '' : /\st="s"/.test(attributes!) ? strings[Number(value)]! : value
      ;(table[Number(row) - 1] ??= [])[column!.charCodeAt(0) - 65] = cell
    }
    return Array.from(table, cells => Array.from(cells ?? [], cell => cell ?? ''))
  }
  return { names: sheets.map(sheet => sheet.name), rows }
}
const valuesOf = (rows: string[][]) => (label: string) => rows.find(cells => cells[0] === label)?.slice(1)

const uploadedAt = new Date('2026-10-09T09:40:00Z')
const receiptUrl = 'https://vada.test/api/organizations/a/expenses/x1/receipts/r1/file'
const data: SettlementSheetData = {
  organizationName: '검증 학생회', eventName: '체육대회', settled: { by: '재정', at: uploadedAt }, exportedAt: new Date('2026-10-10T01:05:00Z'),
  budget: 100000, planned: 0, plannedUnknown: 0, voidedCount: 1,
  expenses: [
    { paidOn: '2026-10-01', vendor: '=1+1', description: '물품', amount: 46000, method: 'council_card', payer: '재정', note: null, recordedBy: '재정',
      receipts: [{ kind: 'receipt', fileName: '영수증 (1).jpg', uploadedBy: '재정', uploadedAt, url: receiptUrl },
        { kind: 'statement', fileName: '명세서.pdf', uploadedBy: '회장', uploadedAt, url: `https://vada.test/${'a'.repeat(300)}` }],
      items: [{ name: '테이블', quantity: 2, estimatedUnitPrice: 11590, requester: '기획' },
        { name: '상품명 확인 필요', quantity: null, estimatedUnitPrice: null, requester: '기획' }] },
    { paidOn: '2026-10-03', vendor: '인쇄소', description: '현수막 & <배너>', amount: 60000, method: 'personal', payer: '기획', note: '환급 완료',
      recordedBy: '회장', receipts: [], items: [] },
  ],
}

test('정산서 요약: 숫자·정산 상태·결제 수단별 합계를 값으로 적는다', async () => {
  const book = readBook(await settlementWorkbook(data))
  assert.deepEqual(book.names, ['요약', '지출 내역', '증빙', '품목'])
  const summary = book.rows(0)
  const row = valuesOf(summary)
  assert.deepEqual(summary[0], ['행사 정산서'])
  assert.deepEqual([row('학생회'), row('행사')], [['검증 학생회'], ['체육대회']])
  assert.deepEqual(row('정산 상태'), ['정산 완료 · 2026-10-09 18:40 · 재정'])
  assert.deepEqual(row('내려받은 때'), ['2026-10-10 10:05'])
  assert.deepEqual([row('예산'), row('실제 지출'), row('지출 예정'), row('남은 예산'), row('집행률')], [['100000'], ['106000'], ['0'], ['-6000'], ['1.06']])
  assert.deepEqual([row('지출 건수'), row('증빙 누락')], [['2'], ['1']])
  assert.deepEqual([row('학생회 카드'), row('계좌이체'), row('현금'), row('개인 결제(환급 필요)')], [['46000'], ['0'], ['0'], ['60000']])
  assert.ok(summary.some(cells => cells[0] === '취소한 지출 1건은 넣지 않았어요.'))
})

test('정산서 시트: 지출은 번호·날짜 칸·문자 칸으로 쓰고 합계를 값으로 둔다. 증빙과 품목은 지출 번호로 잇는다', async () => {
  const book = readBook(await settlementWorkbook(data))
  // 결제일은 엑셀 날짜 일련번호다(1970-01-01 = 25569).
  const serial = (iso: string) => String(Date.parse(`${iso}T00:00:00Z`) / 86400000 + 25569)
  assert.deepEqual(book.rows(1), [
    EXPENSE_HEADER,
    ['1', serial('2026-10-01'), '=1+1', '물품', '46000', '학생회 카드', '재정', '2', '', '재정'],
    ['2', serial('2026-10-03'), '인쇄소', '현수막 & <배너>', '60000', '개인 결제(환급 필요)', '기획', '0', '환급 완료', '회장'],
    ['합계', '', '', '', '106000'],
  ])
  assert.deepEqual(book.rows(2), [
    RECEIPT_HEADER,
    ['1', '영수증', '영수증 (1).jpg', '재정', '2026-10-09', `formula:HYPERLINK("${receiptUrl}","열기")`],
    // 255자가 넘는 주소는 링크를 빼고 표시만 남긴다.
    ['1', '거래명세서', '명세서.pdf', '회장', '2026-10-09', '—'],
  ])
  assert.deepEqual(book.rows(3), [
    ITEM_HEADER,
    ['1', '테이블', '2', '11590', '23180', '기획'],
    ['1', '상품명 확인 필요', '확인 필요', '확인 필요', '—', '기획'],
  ])
})

test('지출이 없고 예산이 0원이면 머리글만 두고 집행률은 비운다. 예산이 미정이면 남은 예산도 비운다', async () => {
  const book = readBook(await settlementWorkbook({ ...data, settled: null, budget: 0, planned: 23180, plannedUnknown: 2, voidedCount: 0, expenses: [] }))
  const summary = book.rows(0)
  const row = valuesOf(summary)
  assert.deepEqual(row('정산 상태'), ['정산 전 (숫자가 바뀔 수 있어요)'])
  assert.deepEqual(row('지출 예정'), ['23180', '금액을 모르는 품목 2개 제외'])
  assert.deepEqual([row('남은 예산'), row('집행률')], [['-23180'], ['—']])
  assert.equal(summary.some(cells => cells[0]?.startsWith('취소한 지출')), false)
  assert.deepEqual(book.rows(1), [EXPENSE_HEADER, ['합계', '', '', '', '0']])
  assert.deepEqual(book.rows(2), [RECEIPT_HEADER])
  assert.deepEqual(book.rows(3), [ITEM_HEADER])
  const undecided = valuesOf(readBook(await settlementWorkbook({ ...data, budget: null })).rows(0))
  assert.deepEqual([undecided('예산'), undecided('남은 예산'), undecided('집행률')], [['미정'], ['—'], ['—']])
})

test('파일 이름은 윈도 금지 글자를 바꾸고 한국 날짜를 붙이며, 내려받기 머리글은 RFC 5987로 싣는다', () => {
  assert.equal(settlementFileName('체육대회 (1)/"최종"?', new Date('2026-10-09T15:30:00Z')), '체육대회 (1)__최종__ 정산 2026-10-10.xlsx')
  assert.equal(contentDisposition("a'(b)*.xlsx"), `attachment; filename="settlement.xlsx"; filename*=UTF-8''a%27%28b%29%2A.xlsx`)
})
