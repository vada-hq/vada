import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Db } from '../db/client.ts'
import { freshDb } from '../db/testing.ts'
import { harness, matchesContract, viewer } from '../events/testing.ts'
import type { Viewer } from '../permissions.ts'
import { budgetAvailable } from './requests.ts'
import { NEIGHBOUR, seedOrgFinance } from './testing.ts'

// 전체 재정 현황(FIN-00 · FIN-00B)의 네 자리 — 겉면 · 나눠 보기 · 증빙 현황 · 최근 지출.
//
// 이 파일이 재는 것이 여섯이다.
//
// 1. **총예산은 수입원의 합이고 사용 가능액은 총예산 − 실결제 − 아직 안 낸 승인액이다.**
//    사람이 정한 셈(2026-09-05)이고, 구매 요청 검토가 이미 같은 셈을 든다(`budgetAvailable`).
//    행사별 줄의 사용 가능액이 그 함수의 답과 **같아야 한다** — 두 벌이면 갈린다.
// 2. **편성 전인 학생회는 '편성 전'이라 말한다.** 0원이 아니다 — 0원은 '예산이 0원이다'라는
//    다른 사실이다. 쓴 돈은 예산과 무관하게 사실이므로 그대로 센다.
// 3. **나누는 축이 줄의 뜻을 바꾼다.** 행사별은 요청의 행사로, 부서별은 예산 항목의 담당
//    부서로 선다. 어디에도 못 드는 돈은 '운영 (상시)'·'부서 미지정' 한 줄에 모인다 —
//    숨기지 않는다.
// 4. **증빙 상태의 말은 사실에서 나온다.** 서류가 비었으면 누락, 다 붙었고 처리가 끝났으면
//    완료, 다 붙었는데 아직이면 확인 중.
// 5. **최근 지출은 장부와 같은 결제다.** 몇 줄을 얹을지는 서버가 정한다.
// 6. **울타리가 선다.** 옆 학생회의 결제는 이쪽 어디에도 안 보인다.

let db: Db
let close: () => Promise<void>

type Row = Record<string, unknown>

async function one(path: string, who: Viewer = viewer('member')): Promise<Row> {
  const res = await harness(db, { who }).request(path)
  expect(res.status, `${path}가 ${res.status}로 답했다`).toBe(200)
  return (await res.json()) as Row
}

async function many(path: string, who: Viewer = viewer('member')): Promise<Row[]> {
  const res = await harness(db, { who }).request(path)
  expect(res.status, `${path}가 ${res.status}로 답했다`).toBe(200)
  return (await res.json()) as Row[]
}

beforeAll(async () => {
  const fresh = await freshDb()
  db = fresh.db as unknown as Db
  close = fresh.close
  await seedOrgFinance(db)
}, 60_000)

afterAll(async () => {
  await close()
})

describe('겉면(finance.orgOverview)', () => {
  it('회계 기간·기준일부터 집행률까지 한 벌로 온다', async () => {
    const body = await one('/api/finance/overview')
    expect(matchesContract('finance.orgOverview', body)).toBe(true)
    expect(body).toEqual({
      termNote: '2026. 03. 01 – 2026. 08. 31',
      // 기준일은 오늘이다 — 검사가 못 박은 지금(2026-08-15).
      asOfNote: '2026.08.15 기준',
      // 24,000,000 + 6,000,000. 배정은 9,200,000이라 나머지가 미배정이다.
      totalBudget: '30,000,000원',
      totalBudgetNote: '학생회비 외 1건 · 미배정 20,800,000원',
      // 결제 셋: 390,000 + 48,000 + 120,000.
      spent: '558,000원',
      spentNote: '결제가 완료된 3건',
      // 승인됐고 아직 안 낸 것: 200,000(PR-02) + 30,000(PR-06). 판정 전인 PR-05는 아니다.
      planned: '230,000원',
      plannedNote: '결제 예정 2건',
      // 30,000,000 − 558,000 − 230,000.
      available: '29,212,000원',
      availableNote: '새로 사용할 수 있는 금액',
      executionNote: '전체 예산 집행률 1.9%',
      plannedIncludedNote: '지출 예정 포함 2.6%',
      spentPercent: 1.9,
      // 두 마디를 더하면 '지출 예정 포함' 비율이 된다.
      plannedPercent: 0.7,
    })
  })

  // **0원이 아니라 편성 전이다.** 쓴 돈은 예산이 없어도 사실이라 그대로 센다.
  it('편성 전인 학생회는 그 사실을 말하고 쓴 돈만 센다', async () => {
    const body = await one('/api/finance/overview', NEIGHBOUR)
    expect(matchesContract('finance.orgOverview', body)).toBe(true)
    expect(body).toMatchObject({
      termNote: '편성 전',
      totalBudget: '편성 전',
      spent: '1,000원',
      spentNote: '결제가 완료된 1건',
      planned: '0원',
      plannedNote: '결제 예정 0건',
      available: '편성 전',
      spentPercent: 0,
      plannedPercent: 0,
    })
    expect(String(body.totalBudgetNote)).toContain('편성')
    expect(String(body.availableNote)).toContain('편성')
    expect(String(body.executionNote)).toContain('편성')
  })

  it('구성원이 아니면 막는다', async () => {
    const res = await harness(db, { who: { userId: 'U-00', membership: null } }).request('/api/finance/overview')
    expect(res.status).toBe(403)
  })
})

describe('나눠 보기(finance.orgBreakdown)', () => {
  it('행사별 — 요청의 행사로 서고, 행사에 안 딸린 돈은 한 줄에 모인다', async () => {
    const rows = await many('/api/finance/overview/breakdown?scope=event')
    expect(matchesContract('finance.orgBreakdown', rows)).toBe(true)
    expect(rows).toEqual([
      // 이른 행사가 먼저. 끝난 행사도 쓴 돈이 있으므로 온다.
      { id: 'E-02', name: '2026 체육대회', budget: '500,000원', spent: '120,000원', planned: '0원', available: '380,000원', executionPercent: 24 },
      // (390,000 + 200,000) / 2,000,000 = 29.5 → 30. 집행률은 지출 예정을 포함한다 — 그림이 그렇게 셌다.
      { id: 'E-01', name: '2026 봄 축제', budget: '2,000,000원', spent: '390,000원', planned: '200,000원', available: '1,410,000원', executionPercent: 30 },
      { id: 'ongoing', name: '운영 (상시)', budget: '6,700,000원', spent: '48,000원', planned: '30,000원', available: '6,622,000원', executionPercent: 1 },
    ])
  })

  // **두 벌로 세지 않는다.** 검토 화면이 드는 사용 가능액과 같은 수여야 한다.
  it('행사별 줄의 사용 가능액이 구매 요청 검토가 드는 셈과 같다', async () => {
    const rows = await many('/api/finance/overview/breakdown?scope=event')
    for (const [eventId, rowId] of [
      ['E-01', 'E-01'],
      ['E-02', 'E-02'],
      [null, 'ongoing'],
    ] as const) {
      const expected = await budgetAvailable(db, 'ORG-01', eventId)
      expect(rows.find((row) => row.id === rowId)?.available).toBe(`${expected!.toLocaleString('ko-KR')}원`)
    }
  })

  it('부서별 — 예산 항목의 담당 부서로 서고, 부서가 없는 것은 한 줄에 모인다', async () => {
    const rows = await many('/api/finance/overview/breakdown?scope=department')
    expect(matchesContract('finance.orgBreakdown', rows)).toBe(true)
    expect(rows).toEqual([
      // 운영비 3,000,000에서 A4 용지 48,000이 나갔다(결제의 품목이 운영비를 가리킨다).
      { id: 'D-01', name: '운영부', budget: '3,000,000원', spent: '48,000원', planned: '0원', available: '2,952,000원', executionPercent: 2 },
      // 홍보 포스터는 아직 판정 전이라 예정이 아니다.
      { id: 'D-02', name: '홍보부', budget: '2,500,000원', spent: '0원', planned: '0원', available: '2,500,000원', executionPercent: 0 },
      // 재정부(D-03)는 배정도 지출도 없어 오지 않는다.
      // 비품 1,200,000 + 행사 항목 2,500,000. 행사 항목은 담당 부서가 없다.
      { id: 'unassigned', name: '부서 미지정', budget: '3,700,000원', spent: '510,000원', planned: '230,000원', available: '2,960,000원', executionPercent: 20 },
    ])
  })

  // 어느 축이든 학생회 전체의 돈을 다 덮는다 — 한 축에서 사라지는 돈이 없다.
  it('어느 축으로 나눠도 지출과 예정의 합이 겉면과 같다', async () => {
    const won = (text: unknown) => Number(String(text).replace(/[^\d-]/g, ''))
    const overview = await one('/api/finance/overview')
    for (const scope of ['event', 'department']) {
      const rows = await many(`/api/finance/overview/breakdown?scope=${scope}`)
      expect(rows.reduce((sum, row) => sum + won(row.spent), 0)).toBe(won(overview.spent))
      expect(rows.reduce((sum, row) => sum + won(row.planned), 0)).toBe(won(overview.planned))
    }
  })

  it('편성 전이면 배정과 사용 가능이 편성 전이고 쓴 돈만 있다', async () => {
    const rows = await many('/api/finance/overview/breakdown?scope=event', NEIGHBOUR)
    expect(rows).toEqual([
      { id: 'E-99', name: '남의 행사', budget: '편성 전', spent: '1,000원', planned: '0원', available: '편성 전', executionPercent: 0 },
    ])
  })

  it('명세에 없는 축은 막는다', async () => {
    expect((await harness(db, { who: viewer('member') }).request('/api/finance/overview/breakdown?scope=all')).status).toBe(422)
    expect((await harness(db, { who: viewer('member') }).request('/api/finance/overview/breakdown')).status).toBe(422)
  })
})

describe('증빙 현황(finance.proofSummary)', () => {
  it('결제마다 하나의 갈래에 든다', async () => {
    const body = await one('/api/finance/overview/proof-summary')
    expect(matchesContract('finance.proofSummary', body)).toBe(true)
    expect(body).toEqual({
      // 서류가 다 붙었고 처리가 끝난 PAY-02.
      completed: '1건',
      // 서류는 다 붙었는데 아직 처리 중인 PAY-01.
      supplement: '1건',
      // 서류가 비어 있는 PAY-03.
      unregistered: '1건',
      totalNote: '3건',
    })
  })

  it('옆 학생회의 결제는 세지 않는다', async () => {
    expect(await one('/api/finance/overview/proof-summary', NEIGHBOUR)).toEqual({
      completed: '0건',
      supplement: '0건',
      unregistered: '1건',
      totalNote: '1건',
    })
  })
})

describe('최근 지출(finance.recentExpenses)', () => {
  it('결제한 차례의 역순으로 장부와 같은 줄이 온다', async () => {
    const rows = await many('/api/finance/overview/recent-expenses')
    expect(matchesContract('finance.recentExpenses', rows)).toBe(true)
    expect(rows).toEqual([
      // 품목이 둘이면 첫 품목에 '외 1건'이 붙는다.
      { id: 'PAY-01', date: '07.17', title: '천막 대여 외 1건', context: '2026 봄 축제', amountNote: '390,000원', proof: '확인 중', proofTone: 'yellow' },
      { id: 'PAY-02', date: '07.03', title: 'A4 용지', context: '운영 (상시)', amountNote: '48,000원', proof: '완료', proofTone: 'green' },
      { id: 'PAY-03', date: '06.20', title: '경품 상품권', context: '2026 체육대회', amountNote: '120,000원', proof: '누락', proofTone: 'red' },
    ])
  })
})
