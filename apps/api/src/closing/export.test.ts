import assert from 'node:assert/strict'
import { test } from 'node:test'
import { closingPath, errorOf, FINANCE, readClosing, spend } from '../test-support/closing.js'
import {
  ACCOUNT_NUMBER,
  exportPath,
  HOLDER,
  NAMES,
  seedExport,
} from '../test-support/closing-export.js'
import { withSettlement } from '../test-support/settlement.js'
import { readXlsx } from '../test-support/xlsx.js'

// 결산서 엑셀(기능 009 조각 5). 숫자는 결산서(조각 3)와 같은 계산 모듈에서 나온다.

const download = async (
  t: Parameters<Parameters<typeof withSettlement>[0]>[0],
  period: string,
  type: string,
  user = FINANCE,
) => {
  const response = await t.api.get(exportPath(t, period, type), user)
  assert.equal(response.status, 200, await response.clone().text())
  return { response, file: readXlsx(new Uint8Array(await response.arrayBuffer())) }
}
const rowOf = (rows: (string | number | null)[][], label: string) =>
  rows.find(row => row[0] === label)

test(
  '공개용·감사용 요약의 같은 이름 지출 항목은 행사 이름으로 구별하고 학생회 항목은 그대로다',
  withSettlement(async t => {
    const { period, budget } = await t.budgetOf()
    for (const name of ['봄 축제', '체육대회']) {
      const eventId = await t.event({ name })
      await t.budgetItem(budget, { purpose: '식비', eventId, amount: '10000' })
    }
    await t.budgetItem(budget, { purpose: '학생회 운영비', amount: '20000' })
    for (const kind of ['public', 'audit']) {
      const { file } = await download(t, period, kind)
      const summary = file.sheets['요약']!
      assert.deepEqual(rowOf(summary, '봄 축제 · 식비'), ['봄 축제 · 식비', 10000, 0, 10000, 0])
      assert.deepEqual(rowOf(summary, '체육대회 · 식비'), ['체육대회 · 식비', 10000, 0, 10000, 0])
      assert.deepEqual(rowOf(summary, '학생회 운영비'), ['학생회 운영비', 20000, 0, 20000, 0])
      assert.equal(rowOf(summary, '식비'), undefined)
    }
  }),
)

test(
  '엑셀 지출 내역도 예산 항목의 행사로 구별하며 서로 다른 행사의 같은 이름 항목을 합치지 않는다',
  withSettlement(async t => {
    const { period, budget } = await t.budgetOf()
    const items: string[] = []
    for (const name of ['봄 축제', '체육대회']) {
      const eventId = await t.event({ name })
      const item = await t.budgetItem(budget, { purpose: '식비', eventId })
      items.push(item)
      await spend(t, '2026-10-20T00:00:00Z', 1000, { budgetItemId: item, description: name })
    }
    const councilItem = await t.budgetItem(budget, { purpose: '식비' })
    await spend(t, '2026-10-20T00:00:00Z', 1000, {
      budgetItemId: councilItem,
      description: '학생회 식비',
    })
    const otherEvent = await t.event({ name: '다른 학생회 비공개 행사' }, t.other)
    const invalid = await t.budgetItem(budget, { purpose: '비품' })
    await t.pg.query('UPDATE budget_item SET event_id = $1 WHERE id = $2', [otherEvent, invalid])
    await spend(t, '2026-10-20T00:00:00Z', 1000, {
      budgetItemId: invalid,
      description: '잘못 연결된 항목',
    })
    const mixed = await spend(t, '2026-10-20T00:00:00Z', 2000, { description: '묶음 결제' })
    for (const item of items) {
      const { line } = await t.requestWithItem(null)
      await t.pg.query('UPDATE line_item SET budget_item_id = $1 WHERE id = $2', [item, line])
      await t.approve(line)
      await t.pay(mixed, line, '1000')
    }
    for (const kind of ['public', 'audit']) {
      const { file } = await download(t, period, kind)
      const expenses = file.sheets['지출']!.slice(1)
      for (const name of ['봄 축제', '체육대회'])
        assert.equal(expenses.find(row => row[3] === name)?.[6], `${name} · 식비`)
      assert.equal(expenses.find(row => row[3] === '학생회 식비')?.[6], '식비')
      assert.equal(expenses.find(row => row[3] === '잘못 연결된 항목')?.[6], '비품')
      assert.ok(!file.text.includes('다른 학생회 비공개 행사'))
      assert.deepEqual(
        String(expenses.find(row => row[3] === '묶음 결제')?.[6])
          .split(', ')
          .sort(),
        ['봄 축제 · 식비', '체육대회 · 식비'].sort(),
      )
    }
  }),
)

test(
  '감사용: 시트 다섯, 숫자는 결산서와 같고 취소한 줄은 없다. 증빙번호는 결제일 순이다',
  withSettlement(async t => {
    const { period } = await seedExport(t)
    const closing = await readClosing(t, period)
    const { file } = await download(t, period, 'audit')
    assert.deepEqual(Object.keys(file.sheets), ['요약', '수입', '지출', '계좌별', '점검'])
    const summary = file.sheets['요약']!
    assert.deepEqual(rowOf(summary, '수입 합'), ['수입 합', closing.income.total])
    assert.deepEqual(rowOf(summary, '지출 합'), ['지출 합', closing.expense.total])
    assert.deepEqual(rowOf(summary, '남은 돈'), ['남은 돈', closing.remaining])
    // 줄의 합도 같은 숫자다(따로 계산한 값이 어긋나면 여기서 드러난다)
    const sum = (rows: (string | number | null)[][], column: number) =>
      rows.slice(1).reduce((all, row) => all + Number(row[column] ?? 0), 0)
    assert.equal(sum(file.sheets['지출']!, 4), closing.expense.total)
    assert.equal(sum(file.sheets['수입']!, 2), closing.income.total)
    // 취소하지 않은 줄만: exportInfo 건수와 같다
    assert.equal(file.sheets['지출']!.length - 1, closing.exportInfo.expenseCount)
    assert.equal(file.sheets['수입']!.length - 1, closing.exportInfo.incomeCount)
    assert.deepEqual(
      file.sheets['지출']!.slice(1).map(row => [row[0], row[1], row[4]]),
      [
        [1, '2026-10-10', 5000],
        [2, '2026-10-20', 30000],
      ],
    )
    const accounts = file.sheets['계좌별']!
    assert.deepEqual(rowOf(accounts, '학생회 통장'), [
      '학생회 통장',
      300000,
      30000,
      270000,
      '국민은행',
      ACCOUNT_NUMBER,
      HOLDER,
    ])
    assert.ok(file.sheets['점검']!.some(row => row[0] === '증빙 없음' && row[1] === 2))
  }),
)

test(
  '사람이 쓴 글은 문자 칸이다: =, +, -, @로 시작해도 수식이 되지 않는다',
  withSettlement(async t => {
    const { period } = await seedExport(t)
    for (const type of ['audit', 'public']) {
      const { file } = await download(t, period, type)
      assert.equal(file.formulas, 0, type)
      assert.ok(file.sheets['수입']!.some(row => row[3] === '=HYPERLINK("http://example.test")'))
      const spent = file.sheets['지출']!
      assert.ok(spent.some(row => row[2] === '+문구점' && row[3] === '@마커'))
      assert.ok(spent.some(row => row[2] === '-식당' && row[9] === '=1+1'))
    }
  }),
)

test(
  '공개용: 사람 이름, 계좌번호, 예금주가 없고 시트는 넷이다. 감사용에는 있다',
  withSettlement(async t => {
    const { period } = await seedExport(t)
    const open = await download(t, period, 'public')
    assert.deepEqual(Object.keys(open.file.sheets), ['요약', '수입', '지출', '계좌별'])
    for (const secret of [...NAMES, ACCOUNT_NUMBER, HOLDER, '국민은행'])
      assert.ok(!open.file.text.includes(secret), secret)
    const audit = await download(t, period, 'audit')
    for (const secret of [...NAMES, ACCOUNT_NUMBER, HOLDER])
      assert.ok(audit.file.text.includes(secret), secret)
    // 숫자는 두 파일이 같다
    const withoutKind = (rows: (string | number | null)[][]) =>
      rows.filter(row => row[0] !== '파일')
    assert.deepEqual(
      withoutKind(open.file.sheets['요약']!),
      withoutKind(audit.file.sheets['요약']!),
    )
  }),
)

test(
  '권한: 공개 전 공개용은 재정부만, 공개 뒤에는 모든 운영진. 감사용은 늘 재정부만이다',
  withSettlement(async t => {
    const { period } = await seedExport(t)
    const status = async (type: string, user: string) =>
      (await t.api.get(exportPath(t, period, type), user)).status
    assert.equal(await status('public', 's-planningMember'), 403)
    assert.equal(await status('public', FINANCE), 200)
    await t.make(t.council, 'account_closing', {
      fiscalPeriodId: period,
      publishedAt: new Date('2026-10-24T00:00:00Z'),
    })
    assert.equal(await status('public', 's-planningMember'), 200)
    assert.equal(await status('public', 's-president'), 200)
    assert.equal(await status('audit', 's-planningMember'), 403)
    assert.equal(await status('audit', 's-president'), 403)
    assert.equal(await status('audit', FINANCE), 200)
    // 로그인하지 않았거나 다른 학생회 사람, 다른 학생회의 기간
    assert.equal((await t.api.get(exportPath(t, period, 'public'))).status, 401)
    assert.equal(await status('public', 'o-financeMember'), 403)
    const theirs = await t.budgetOf(t.other)
    assert.equal((await t.api.get(exportPath(t, theirs.period, 'audit'), FINANCE)).status, 404)
    assert.equal(
      (
        await t.api.get(
          exportPath(t, period, 'audit').replace(t.council.councilId, t.other.councilId),
          FINANCE,
        )
      ).status,
      403,
    )
  }),
)

test(
  '모르는 종류, 없는 종류, 같은 키 두 번, 모르는 키는 400이다',
  withSettlement(async t => {
    const { period } = await seedExport(t)
    const base = `${closingPath(t, period)}/export`
    for (const query of ['', '?type=zip', '?type=', '?type=audit&type=public', '?type=audit&x=1'])
      assert.equal((await t.api.get(base + query, FINANCE)).status, 400, query)
    assert.equal(
      (await t.api.get(`${closingPath(t, 'nope')}/export?type=audit`, FINANCE)).status,
      404,
    )
  }),
)

test(
  '파일 이름은 {기간 이름} 결산(공개용|감사용) {한국 날짜}.xlsx이고 윈도에서 못 쓰는 글자는 _다. 머리글은 filename*과 no-store',
  withSettlement(async t => {
    const { period } = await seedExport(t)
    await t.pg.query('UPDATE fiscal_period SET name = $1 WHERE id = $2', [
      '가:나/다?*"<>|\\.',
      period,
    ])
    const { response } = await download(t, period, 'audit')
    const disposition = response.headers.get('content-disposition') ?? ''
    const name = '가_나_다_______. 결산(감사용) 2026-10-25.xlsx'
    assert.match(disposition, /^attachment; filename="[\x20-\x7e]*"; filename\*=UTF-8''/)
    const encoded = /filename\*=UTF-8''(.*)$/.exec(disposition)?.[1] ?? ''
    assert.equal(decodeURIComponent(encoded), name)
    assert.equal(response.headers.get('cache-control'), 'no-store')
    assert.match(response.headers.get('content-type') ?? '', /spreadsheetml\.sheet/)
    const open = await download(t, period, 'public')
    assert.ok(
      decodeURIComponent(
        /filename\*=UTF-8''(.*)$/.exec(
          open.response.headers.get('content-disposition') ?? '',
        )?.[1] ?? '',
      ).includes('결산(공개용) 2026-10-25.xlsx'),
    )
  }),
)

test(
  '상한: 지출이 1,000건을 넘으면 409 EXPORT_TOO_LARGE다. 권한이 먼저다',
  withSettlement(async t => {
    const { period } = await seedExport(t)
    await t.pg.query(
      `WITH r AS (INSERT INTO record (kind, council_id) SELECT 'expense', $1 FROM generate_series(1, 1000) RETURNING id)
       INSERT INTO expense (id, amount, paid_at, description, vendor, method)
       SELECT id, 1, '2026-10-20T00:00:00Z', 'd', 'v', 'card' FROM r`,
      [t.council.councilId],
    )
    const big = await t.api.get(exportPath(t, period, 'audit'), FINANCE)
    assert.equal(big.status, 409)
    assert.equal(await errorOf(big), 'EXPORT_TOO_LARGE')
    assert.equal((await t.api.get(exportPath(t, period, 'public'), FINANCE)).status, 409)
    // 권한이 없으면 크기를 드러내지 않고 403이다
    assert.equal((await t.api.get(exportPath(t, period, 'audit'), 's-planningMember')).status, 403)
  }),
)
