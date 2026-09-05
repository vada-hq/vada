import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Db } from '../db/client.ts'
import { freshDb } from '../db/testing.ts'
import {
  budgetItems,
  departments,
  events,
  members,
  organizations,
  payments,
  purchaseRequestItems,
  purchaseRequests,
} from '../db/schema.ts'
import { budgetAvailable } from '../finance/requests.ts'
import { harness, matchesContract } from './testing.ts'

// 행사 재정 — 개요(EVT-FIN-01)가 읽는 셋.
//
// **재정 화면들과 같은 표를 같은 셈으로 본다.** 구매 요청 한 줄이 검토 → 구매 → 증빙 →
// 정산을 지나고, 그 줄의 말과 색은 `finance/labels.ts`가 든다. 여기서 재는 것은
// 행사 하나로 좁혀 센 값이 그 규칙과 어긋나지 않는가다.
//
// 1. **금액 넷을 서버가 셈한다.** 사용 가능 = 배정 − 실결제 − 아직 안 낸 승인액
//    (docs/decisions/budget-screen.md). 검토 화면이 드는 사용 가능액과 같아야 한다.
// 2. **배정이 없는 행사는 예산이 없다** — 0원이 아니라 그 사실이 온다.
// 3. **열마다 그 단계의 요청만 온다.** 임시 저장한 요청은 어느 열에도 없다.
// 4. **검토 대기는 재정부의 손을 기다리는 것만 센다** — 보완이 걸린 요청은 요청자를
//    기다리고 있다.
// 5. **울타리가 선다.** 남의 학생회 행사는 없다고 답하거나(404가 있는 자리) 빈 목록이다.

let db: Db
let close: () => Promise<void>

const at = (text: string) => new Date(`${text}T00:00:00+09:00`)

beforeAll(async () => {
  const fresh = await freshDb()
  db = fresh.db as unknown as Db
  close = fresh.close

  await db.insert(organizations).values([
    { id: 'ORG-01', name: '제12대 학생회' },
    { id: 'ORG-02', name: '옆 학생회' },
  ])
  await db.insert(departments).values([
    { id: 'D-01', orgId: 'ORG-01', name: '운영부' },
    { id: 'D-99', orgId: 'ORG-02', name: '남의 부서' },
  ])
  await db.insert(members).values([
    { id: 'M-01', orgId: 'ORG-01', name: '김바다', role: 'chair', departmentId: 'D-01' },
    { id: 'M-99', orgId: 'ORG-02', name: '남의 사람', departmentId: 'D-99' },
  ])
  await db.insert(events).values([
    { id: 'E-01', orgId: 'ORG-01', title: '2026 소프트웨어융합대학 체육대회' },
    // **배정이 없는 행사.** 구매 요청은 있어도 예산은 없다.
    { id: 'E-02', orgId: 'ORG-01', title: '2026 신입생 환영회' },
    { id: 'E-99', orgId: 'ORG-02', title: '남의 행사' },
  ])

  // 배정 3,000,000 — 명세가 예로 든 그 수다.
  await db.insert(budgetItems).values([
    { id: 'B-01', orgId: 'ORG-01', eventId: 'E-01', name: '물품비', amount: 1_200_000 },
    { id: 'B-02', orgId: 'ORG-01', eventId: 'E-01', name: '홍보비', amount: 1_800_000 },
    // 남의 학생회의 배정. 우리 행사에 더해지면 안 된다.
    { id: 'B-99', orgId: 'ORG-02', eventId: 'E-99', name: '남의 예산', amount: 5_000_000 },
  ])

  await db.insert(purchaseRequests).values([
    // 검토를 기다리는 요청 — 명세의 카드 예시 그대로 품목 넷에 135,000원.
    {
      id: 'PR-01',
      orgId: 'ORG-01',
      eventId: 'E-01',
      title: '체육대회 운영 물품 4종',
      departmentId: 'D-01',
      requesterMemberId: 'M-01',
      stage: 'review',
      submittedAt: at('2026-03-15'),
    },
    // 보완이 걸린 요청. **단계는 여전히 검토다** — 같은 열에 오되 딱지가 다르다.
    {
      id: 'PR-02',
      orgId: 'ORG-01',
      eventId: 'E-01',
      title: '이름표 용지 추가',
      departmentId: 'D-01',
      stage: 'review',
      submittedAt: at('2026-03-16'),
      supplementRequestedAt: at('2026-03-17'),
    },
    // 구매 진행 중 — 승인됐고 아직 아무것도 결제하지 않았다.
    {
      id: 'PR-03',
      orgId: 'ORG-01',
      eventId: 'E-01',
      title: '현수막 제작',
      departmentId: 'D-01',
      stage: 'purchase',
      submittedAt: at('2026-03-10'),
    },
    // 증빙 정리 중 — 결제가 났다.
    {
      id: 'PR-04',
      orgId: 'ORG-01',
      eventId: 'E-01',
      title: '간식 구매',
      departmentId: 'D-01',
      stage: 'proof',
      submittedAt: at('2026-03-08'),
    },
    // 처리 완료.
    {
      id: 'PR-05',
      orgId: 'ORG-01',
      eventId: 'E-01',
      title: '상장 인쇄',
      departmentId: 'D-01',
      stage: 'settled',
      submittedAt: at('2026-03-05'),
      evidenceCompletedAt: at('2026-03-12'),
    },
    // 임시 저장. **어느 열에도 없다** — 재정부에 넘어간 적이 없다.
    { id: 'PR-06', orgId: 'ORG-01', eventId: 'E-01', title: '아직 안 낸 요청', stage: 'draft' },
    // 다른 행사의 요청. 부서도 제출일도 없다 — 그 사실이 말로 와야 한다.
    { id: 'PR-07', orgId: 'ORG-01', eventId: 'E-02', title: '환영회 다과', stage: 'review' },
    {
      id: 'PR-99',
      orgId: 'ORG-02',
      eventId: 'E-99',
      title: '남의 요청',
      departmentId: 'D-99',
      stage: 'review',
      submittedAt: at('2026-03-01'),
    },
  ])

  await db.insert(payments).values([
    { id: 'PAY-01', orgId: 'ORG-01', requestId: 'PR-04', vendor: '편의점', paidAmount: 900_000 },
    { id: 'PAY-02', orgId: 'ORG-01', requestId: 'PR-05', vendor: '인쇄소', paidAmount: 50_000 },
    { id: 'PAY-99', orgId: 'ORG-02', requestId: 'PR-99', vendor: '남의 업체', paidAmount: 1_000 },
  ])

  await db.insert(purchaseRequestItems).values([
    { id: 'PRI-01', orgId: 'ORG-01', requestId: 'PR-01', sortOrder: 0, name: '박스테이프', quantity: 5, unitPrice: 2_000 },
    { id: 'PRI-02', orgId: 'ORG-01', requestId: 'PR-01', sortOrder: 1, name: '생수 500ml', quantity: 2, unitPrice: 12_500 },
    { id: 'PRI-03', orgId: 'ORG-01', requestId: 'PR-01', sortOrder: 2, name: '이름표 용지', quantity: 200, unitPrice: 300 },
    { id: 'PRI-04', orgId: 'ORG-01', requestId: 'PR-01', sortOrder: 3, name: '유성 마커', quantity: 20, unitPrice: 2_000 },
    // 단가가 없는 품목은 요청액에 더할 것이 없다.
    { id: 'PRI-05', orgId: 'ORG-01', requestId: 'PR-02', sortOrder: 0, name: '이름표 용지', quantity: 10, unitPrice: 5_000 },
    { id: 'PRI-06', orgId: 'ORG-01', requestId: 'PR-02', sortOrder: 1, name: '목걸이 줄', quantity: 10 },
    // 승인됐고 아직 안 낸 것 — 승인·집행 예정 1,100,000.
    { id: 'PRI-07', orgId: 'ORG-01', requestId: 'PR-03', sortOrder: 0, name: '현수막', quantity: 2, unitPrice: 350_000, approvedAmount: 600_000 },
    { id: 'PRI-08', orgId: 'ORG-01', requestId: 'PR-03', sortOrder: 1, name: '부스 배너', quantity: 5, unitPrice: 110_000, approvedAmount: 500_000 },
    // 결제에 딸린 승인액은 이미 실결제로 셌다 — 예정에 다시 더하지 않는다.
    { id: 'PRI-09', orgId: 'ORG-01', requestId: 'PR-04', sortOrder: 0, name: '간식', quantity: 300, unitPrice: 3_000, approvedAmount: 900_000, paymentId: 'PAY-01' },
    { id: 'PRI-10', orgId: 'ORG-01', requestId: 'PR-05', sortOrder: 0, name: '상장', quantity: 50, unitPrice: 1_000, approvedAmount: 50_000, paymentId: 'PAY-02' },
    { id: 'PRI-99', orgId: 'ORG-02', requestId: 'PR-99', sortOrder: 0, name: '남의 품목', quantity: 1, unitPrice: 1_000, approvedAmount: 1_000 },
  ])
})

afterAll(async () => {
  await close()
})

type Row = Record<string, unknown>

const summary = (eventId: string) =>
  harness(db).request(`/api/ops/event/finance/summary?eventId=${eventId}`)
const alerts = (eventId: string) =>
  harness(db).request(`/api/ops/event/finance/alerts?eventId=${eventId}`)
const board = (eventId: string, stage: string | null) =>
  harness(db).request(
    stage === null
      ? `/api/ops/event/finance/board?eventId=${eventId}`
      : `/api/ops/event/finance/board?eventId=${eventId}&stage=${stage}`,
  )

async function one(res: Response | Promise<Response>): Promise<Row> {
  const got = await res
  expect(got.status, `${got.url}가 ${got.status}로 답했다`).toBe(200)
  return (await got.json()) as Row
}

async function many(res: Response | Promise<Response>): Promise<Row[]> {
  const got = await res
  expect(got.status, `${got.url}가 ${got.status}로 답했다`).toBe(200)
  return (await got.json()) as Row[]
}

describe('금액 넷(event.financeSummary)', () => {
  // 명세가 예로 든 넷과 같은 셈이다 — 3,000,000 · 1,100,000 · 950,000 · 950,000.
  it('배정·예정·지출·사용 가능을 자릿점 찍힌 글로 준다', async () => {
    expect(await one(summary('E-01'))).toEqual({
      budget: '3,000,000',
      committed: '1,100,000',
      spent: '950,000',
      available: '950,000',
    })
  })

  // **검토 화면(FIN-REV-01)과 같은 값이어야 한다.** 같은 행사의 사용 가능액이 화면마다
  // 갈리면 재정부가 어느 쪽을 믿을지 모른다.
  it('사용 가능액이 검토 화면의 셈과 같다', async () => {
    const row = await one(summary('E-01'))
    expect(row.available).toBe(
      (await budgetAvailable(db, 'ORG-01', 'E-01'))!.toLocaleString('ko-KR'),
    )
  })

  // **0원은 다른 사실이다.** 승인액과 실결제는 예산이 없어도 셀 수 있으므로 그대로 센다.
  it('배정이 없으면 배정과 사용 가능액은 수가 아니라 그 사실이 온다', async () => {
    expect(await one(summary('E-02'))).toEqual({
      budget: '예산 미정',
      committed: '0',
      spent: '0',
      available: '예산 미정',
    })
  })

  it('없는 행사도 남의 학생회 행사도 없다고 답한다', async () => {
    expect((await summary('E-99')).status).toBe(404)
    expect((await summary('없다')).status).toBe(404)
  })

  it('답이 계약의 모양을 지킨다', async () => {
    expect(matchesContract('event.financeSummary', await one(summary('E-01')))).toBe(true)
    expect(matchesContract('event.financeSummary', await one(summary('E-02')))).toBe(true)
  })
})

describe('보드의 열(event.financeBoard)', () => {
  it('검토 열에는 검토 중인 요청이 낸 차례로 오고 보완이 걸린 것은 딱지가 다르다', async () => {
    const rows = await many(board('E-01', 'review'))
    expect(rows.map((row) => row.id)).toEqual(['PR-01', 'PR-02'])
    expect(rows[0]).toEqual({
      id: 'PR-01',
      departmentLabel: '운영부',
      requestedAt: '2026-03-15',
      title: '체육대회 운영 물품 4종',
      itemsNote: '품목 4개 · 박스테이프, 생수 500ml, 이름표 용지, 유성 마커',
      amountNote: '135,000원',
      status: '검토 대기',
      statusTone: 'blue',
    })
    expect(rows[1]).toMatchObject({
      id: 'PR-02',
      // 단가가 없는 품목은 이름은 오되 금액에는 더할 것이 없다.
      itemsNote: '품목 2개 · 이름표 용지, 목걸이 줄',
      amountNote: '50,000원',
      status: '보완 요청',
      statusTone: 'yellow',
    })
  })

  // **말과 색은 재정 화면들과 같은 규칙에서 온다**(`finance/labels.ts`).
  it('나머지 세 열도 그 단계의 요청만 든다', async () => {
    expect(await many(board('E-01', 'purchase'))).toMatchObject([
      { id: 'PR-03', status: '구매 진행 중', statusTone: 'blue', amountNote: '1,250,000원' },
    ])
    expect(await many(board('E-01', 'proof'))).toMatchObject([
      { id: 'PR-04', status: '증빙 정리 중', statusTone: 'blue' },
    ])
    expect(await many(board('E-01', 'settled'))).toMatchObject([
      { id: 'PR-05', status: '처리 완료', statusTone: 'green' },
    ])
  })

  it('임시 저장한 요청은 어느 열에도 없다', async () => {
    for (const stage of ['review', 'purchase', 'proof', 'settled']) {
      expect((await many(board('E-01', stage))).map((row) => row.id)).not.toContain('PR-06')
    }
  })

  // 정해지지 않은 것은 **그 사실을 말로** 준다. 빈 글을 주면 화면이 빈 자리를 그린다.
  it('부서와 제출일이 없으면 그 사실이 말로 온다', async () => {
    expect(await many(board('E-02', 'review'))).toMatchObject([
      { id: 'PR-07', departmentLabel: '부서 미정', requestedAt: '미제출', itemsNote: '품목 0개', amountNote: '0원' },
    ])
  })

  // 열은 명세가 고정한 넷이다. 그대로 넘기면 저장소가 던져 500이 되고, 조용히 안 거르고
  // 전부 주면 한 열이 보드 전체가 된다.
  it('명세에 없는 단계나 빠진 단계는 막는다', async () => {
    expect((await board('E-01', 'draft')).status).toBe(422)
    expect((await board('E-01', '없는단계')).status).toBe(422)
    expect((await board('E-01', null)).status).toBe(422)
  })

  // 이 자리에는 404가 없다(계약). 거르고 남은 것이 없다고 답한다 — 행사 업무 보드와 같다.
  it('남의 학생회 행사를 물으면 빈 열이다', async () => {
    expect(await many(board('E-99', 'review'))).toEqual([])
    expect(await many(board('없다', 'review'))).toEqual([])
  })

  it('답이 계약의 모양을 지킨다', async () => {
    expect(matchesContract('event.financeBoard', await many(board('E-01', 'review')))).toBe(true)
  })
})

describe('사람 손이 필요한 건수(event.financeAlerts)', () => {
  // **보완이 걸린 요청은 세지 않는다.** 그것은 요청자의 손을 기다리는 것이고, 화면의
  // 딱지도 '검토 대기'가 아니라 '보완 요청'이다 — 같은 말이 같은 것을 센다.
  it('검토 대기는 재정부를 기다리는 요청만 센다', async () => {
    expect(await one(alerts('E-01'))).toEqual({ pendingReviewCount: 1 })
    expect(await one(alerts('E-02'))).toEqual({ pendingReviewCount: 1 })
  })

  it('없는 행사도 남의 학생회 행사도 없다고 답한다', async () => {
    expect((await alerts('E-99')).status).toBe(404)
    expect((await alerts('없다')).status).toBe(404)
  })

  it('답이 계약의 모양을 지킨다', async () => {
    expect(matchesContract('event.financeAlerts', await one(alerts('E-01')))).toBe(true)
  })
})
