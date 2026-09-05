import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Db } from '../db/client.ts'
import { freshDb } from '../db/testing.ts'
import { harness, matchesContract, viewer } from '../events/testing.ts'
import type { Viewer } from '../permissions.ts'
import { NEIGHBOUR, seedOrgFinance } from './testing.ts'

// 사용 내역(FIN-LEDGER-01)의 여섯 자리 — 장부 · 범위 줄 · 머리 넷 · 고르는 목록 셋.
//
// **장부 줄은 결제와 아직 안 낸 승인에서 읽는다.** `ledger_entries`에 줄을 넣는 쓰기가
// 아직 없고(백로그), 계약은 이 장부를 결제 단계(`stage`)로 자르라 한다 — 전체 재정의
// '실제 지출'과 '지출 예정'이 각각 그 단계만 보여 달라고 여기 온다. 그 두 값이 결제와
// 승인에서 나오므로 장부도 같은 곳에서 읽어야 카드와 그 '내역'이 같은 돈을 말한다.
//
// 이 파일이 재는 것이 다섯이다.
//
// 1. **거르는 것도 자르는 것도 세는 것도 서버가 한다.** 달·행사·부서·예산 항목·검색어·단계.
// 2. **몇 건 중 몇 건인지는 범위 줄이 말한다.** 목록은 잘려서 온다.
// 3. **달의 이름도 서버가 준다.** 고르지 않았으면 이번 달이다.
// 4. **고르는 목록은 저장소에서 온다.** 달은 결제가 있는 달, 행사는 학생회의 행사 전부,
//    예산 항목은 상시와 행사별 전부.
// 5. **울타리가 선다.**

let db: Db
let close: () => Promise<void>

type Row = Record<string, unknown>

const ask = (path: string, who: Viewer = viewer('member')) => harness(db, { who }).request(path)

async function one(path: string, who?: Viewer): Promise<Row> {
  const res = await ask(path, who)
  expect(res.status, `${path}가 ${res.status}로 답했다`).toBe(200)
  return (await res.json()) as Row
}

async function many(path: string, who?: Viewer): Promise<Row[]> {
  const res = await ask(path, who)
  expect(res.status, `${path}가 ${res.status}로 답했다`).toBe(200)
  return (await res.json()) as Row[]
}

const ids = (rows: Row[]) => rows.map((row) => row.id)

beforeAll(async () => {
  const fresh = await freshDb()
  db = fresh.db as unknown as Db
  close = fresh.close
  await seedOrgFinance(db)
}, 60_000)

afterAll(async () => {
  await close()
})

describe('장부(finance.ledger)', () => {
  it('거르지 않으면 예정이 먼저, 그다음 결제가 최근 순으로 온다', async () => {
    const rows = await many('/api/finance/ledger')
    expect(matchesContract('finance.ledger', rows)).toBe(true)
    expect(rows).toEqual([
      // 아직 안 낸 승인. 쓴 날이 없으므로 그 자리를 비운 채로 온다.
      { id: 'planned:PR-06', date: '—', title: '의자', context: '운영 (상시)', department: '운영부', budgetItem: '비품', amountNote: '30,000원', proof: '결제 전', proofTone: 'gray' },
      { id: 'planned:PR-02', date: '—', title: '입구 현수막', context: '2026 봄 축제', department: '홍보부', budgetItem: '홍보비', amountNote: '200,000원', proof: '결제 전', proofTone: 'gray' },
      // 결제. 품목이 둘이고 예산 항목도 둘이라 둘 다 '외 1건'이 붙는다.
      { id: 'PAY-01', date: '07.17', title: '천막 대여 외 1건', context: '2026 봄 축제', department: '운영부', budgetItem: '물품비 외 1건', amountNote: '390,000원', proof: '확인 중', proofTone: 'yellow' },
      { id: 'PAY-02', date: '07.03', title: 'A4 용지', context: '운영 (상시)', department: '운영부', budgetItem: '운영비', amountNote: '48,000원', proof: '완료', proofTone: 'green' },
      { id: 'PAY-03', date: '06.20', title: '경품 상품권', context: '2026 체육대회', department: '운영부', budgetItem: '경품', amountNote: '120,000원', proof: '누락', proofTone: 'red' },
    ])
  })

  it('결제 단계로 자른다 — 전체 재정의 두 내역이 이 값을 싣고 온다', async () => {
    expect(ids(await many('/api/finance/ledger?stage=spent'))).toEqual(['PAY-01', 'PAY-02', 'PAY-03'])
    expect(ids(await many('/api/finance/ledger?stage=planned'))).toEqual(['planned:PR-06', 'planned:PR-02'])
  })

  it('달로 거른다 — 날이 없는 예정은 어느 달에도 들지 않는다', async () => {
    expect(ids(await many('/api/finance/ledger?month=2026-07'))).toEqual(['PAY-01', 'PAY-02'])
    expect(ids(await many('/api/finance/ledger?month=2026-06'))).toEqual(['PAY-03'])
    expect(ids(await many('/api/finance/ledger?month=2026-05'))).toEqual([])
  })

  it('행사·부서·예산 항목·검색어로 거른다', async () => {
    expect(ids(await many('/api/finance/ledger?eventId=E-01'))).toEqual(['planned:PR-02', 'PAY-01'])
    expect(ids(await many('/api/finance/ledger?departmentId=D-02'))).toEqual(['planned:PR-02'])
    // 홍보비(B-22)를 가리키는 품목이 든 줄. 결제는 품목 둘 중 하나만 가리켜도 든다.
    expect(ids(await many('/api/finance/ledger?budgetItemId=B-22'))).toEqual(['planned:PR-02', 'PAY-01'])
    // 내역으로도 행사로도 찾는다.
    expect(ids(await many('/api/finance/ledger?query=%EC%B2%9C%EB%A7%89'))).toEqual(['PAY-01'])
    expect(ids(await many('/api/finance/ledger?query=%EC%B2%B4%EC%9C%A1'))).toEqual(['PAY-03'])
    // 조건은 함께 건다.
    expect(ids(await many('/api/finance/ledger?eventId=E-01&stage=spent'))).toEqual(['PAY-01'])
  })

  it('명세에 없는 단계와 달 꼴은 막는다', async () => {
    expect((await ask('/api/finance/ledger?stage=paid')).status).toBe(422)
    expect((await ask('/api/finance/ledger?month=2026-13')).status).toBe(422)
    expect((await ask('/api/finance/ledger?month=202607')).status).toBe(422)
  })

  it('옆 학생회의 줄은 보이지 않고, 옆 학생회에는 제 것만 보인다', async () => {
    expect(ids(await many('/api/finance/ledger'))).not.toContain('PAY-99')
    expect(ids(await many('/api/finance/ledger', NEIGHBOUR))).toEqual(['PAY-99'])
  })
})

describe('범위 줄(finance.ledgerScope)', () => {
  it('무엇의 몇 줄인지와 누가 증빙을 처리하는지를 문장으로 준다', async () => {
    const body = await one('/api/finance/ledger/scope')
    expect(matchesContract('finance.ledgerScope', body)).toBe(true)
    expect(body.rangeNote).toBe('전체 기간 · 총 5건')
    // **역할 이름이 여기 들어간다.** 권한 행렬에서 만든 글이라 행렬을 고치면 따라온다.
    expect(String(body.handlingNote)).toContain('회장단')
    expect(String(body.handlingNote)).toContain('재정부만')
  })

  it('거르는 조건이 같으면 목록과 같은 것을 센다', async () => {
    expect((await one('/api/finance/ledger/scope?month=2026-07')).rangeNote).toBe('2026년 7월 · 총 2건')
    expect((await one('/api/finance/ledger/scope?stage=planned')).rangeNote).toBe('전체 기간 · 결제 예정 · 총 2건')
    expect((await one('/api/finance/ledger/scope?month=2026-06&stage=spent')).rangeNote).toBe('2026년 6월 · 결제 완료 · 총 1건')
    expect((await one('/api/finance/ledger/scope?month=2026-05')).rangeNote).toBe('2026년 5월 · 총 0건')
  })
})

describe('머리 넷(finance.ledgerSummary)', () => {
  it('고른 달의 이름과 값을 준다', async () => {
    const body = await one('/api/finance/ledger/summary?month=2026-07')
    expect(matchesContract('finance.ledgerSummary', body)).toBe(true)
    expect(body).toEqual({
      // 결제 전부. 겉면의 '실제 지출'과 같은 수다.
      termTotal: '558,000원',
      monthLabel: '7월 지출',
      monthTotal: '438,000원',
      // 그 달의 결제 둘 중 처리가 끝난 것 하나.
      proofDone: '2건 중 1건',
      proofMissing: '0건',
    })
    expect(await one('/api/finance/ledger/summary?month=2026-06')).toMatchObject({
      monthLabel: '6월 지출',
      monthTotal: '120,000원',
      proofDone: '1건 중 0건',
      proofMissing: '1건',
    })
  })

  // 명세에 '이번 달'을 말할 어휘가 없어 화면이 넘길 값이 없다. 서버가 오늘로 정한다.
  it('고르지 않았으면 이번 달이다', async () => {
    expect(await one('/api/finance/ledger/summary')).toMatchObject({
      monthLabel: '8월 지출',
      monthTotal: '0원',
      proofDone: '0건 중 0건',
      proofMissing: '0건',
    })
  })

  it('달 꼴이 아니면 막는다', async () => {
    expect((await ask('/api/finance/ledger/summary?month=7%EC%9B%94')).status).toBe(422)
  })
})

describe('고르는 목록 셋', () => {
  it('달은 결제가 있는 달이 최근 순으로 온다(finance.ledgerMonths)', async () => {
    const body = await many('/api/finance/ledger/months')
    expect(matchesContract('finance.ledgerMonths.options', body)).toBe(true)
    expect(body).toEqual([
      { value: '2026-07', label: '2026년 7월' },
      { value: '2026-06', label: '2026년 6월' },
    ])
  })

  // 끝난 행사도 온다 — 쓴 돈은 행사가 끝나도 장부에 있다.
  it('행사는 학생회의 행사 전부가 이른 것부터 온다(finance.ledgerEvents)', async () => {
    const body = await many('/api/finance/ledger/events')
    expect(matchesContract('finance.ledgerEvents.options', body)).toBe(true)
    expect(body).toEqual([
      { value: 'E-02', label: '2026 체육대회' },
      { value: 'E-01', label: '2026 봄 축제' },
    ])
  })

  it('예산 항목은 상시와 행사별 전부가 편성한 차례로 온다(finance.orgBudgetItems)', async () => {
    const body = await many('/api/finance/budget-items')
    expect(matchesContract('finance.orgBudgetItems.options', body)).toBe(true)
    expect(body).toEqual([
      { value: 'B-11', label: '운영비' },
      { value: 'B-12', label: '홍보비' },
      { value: 'B-13', label: '비품' },
      // 행사별 항목은 어느 행사의 것인지가 곁에 붙는다 — 같은 이름이 상시에도 있다.
      { value: 'B-21', label: '물품비', description: '2026 봄 축제' },
      { value: 'B-22', label: '홍보비', description: '2026 봄 축제' },
      { value: 'B-31', label: '경품', description: '2026 체육대회' },
    ])
  })

  it('편성 전인 학생회의 예산 항목 목록은 비어 있다', async () => {
    expect(await many('/api/finance/budget-items', NEIGHBOUR)).toEqual([])
  })
})
