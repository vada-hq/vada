import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Db } from '../db/client.ts'
import { freshDb } from '../db/testing.ts'
import { matchesContract } from '../events/testing.ts'
import { ask, seedPurchases, STRANGER } from './testing.ts'

// 구매 요청 상세·진행 상태(FIN-REQ-02)의 세 자리 — 겉면 · 품목별 처리 결과 · 처리 기록.
//
// 이 파일이 재는 것이 넷이다.
//
// 1. **완성된 글과 색을 서버가 만든다.** '35,000원'·'검토 대기'·'blue'는 저장된 값이 아니다.
// 2. **진행 단계 줄의 열쇠는 명세의 steps가 정한다.** 표의 단계(`proof`)와 줄의 열쇠(`evidence`)가
//    다른 말이고, 그 옮김을 서버가 한다 — 화면이 옮기면 절차가 화면에 적힌다.
// 3. **처리 기록은 표에 남은 때에서만 나온다.** 제출·검토·보완·발주·결제·정산의 때가 있는 줄만
//    있고, 없는 때는 줄이 없다. 임시 저장한 요청은 기록이 없다.
// 4. **없는 것은 없다고 말한다.** 남의 학생회 요청도 같은 답이다.

let db: Db
let close: () => Promise<void>

const DETAIL = '/api/ops/finance/purchase-requests/detail'
const ITEMS = '/api/ops/finance/purchase-requests/items'
const HISTORY = '/api/ops/finance/purchase-requests/history'

type Row = Record<string, unknown>

async function detail(requestId: string): Promise<Row> {
  const res = await ask(db, `${DETAIL}?requestId=${requestId}`)
  expect(res.status, `${requestId}의 상세가 ${res.status}로 답했다`).toBe(200)
  const body = (await res.json()) as Row
  expect(matchesContract('finance.purchaseRequestDetail', body)).toBe(true)
  return body
}

async function items(requestId: string): Promise<Row[]> {
  const res = await ask(db, `${ITEMS}?requestId=${requestId}`)
  expect(res.status).toBe(200)
  const body = (await res.json()) as Row[]
  expect(matchesContract('finance.purchaseRequestItems', body)).toBe(true)
  return body
}

async function history(requestId: string): Promise<Row[]> {
  const res = await ask(db, `${HISTORY}?requestId=${requestId}`)
  expect(res.status).toBe(200)
  const body = (await res.json()) as Row[]
  expect(matchesContract('finance.purchaseRequestHistory', body)).toBe(true)
  return body
}

beforeAll(async () => {
  const fresh = await freshDb()
  db = fresh.db as unknown as Db
  close = fresh.close
  await seedPurchases(db)
}, 60_000)

afterAll(async () => {
  await close()
})

describe('요청의 겉면(finance.purchaseRequestDetail)', () => {
  it('완성된 글과 색으로 온다', async () => {
    expect(await detail('PR-01')).toEqual({
      code: 'REQ-001',
      status: '검토 대기',
      statusTone: 'blue',
      title: '체육대회 운영 물품 2종',
      amountNote: '35,000원',
      eventName: '2026 소프트웨어융합대학 체육대회',
      department: '운영부',
      requester: '박해랑',
      neededOn: '2026-03-15',
      stage: 'review',
    })
  })

  // 단계 줄의 열쇠는 steps 요소의 items[].key와 같은 말이어야 한다(명세).
  it('표의 단계가 진행 단계 줄의 열쇠로 옮겨진다', async () => {
    expect(await detail('PR-02')).toMatchObject({ status: '보완 요청', statusTone: 'yellow', stage: 'review' })
    expect(await detail('PR-03')).toMatchObject({ status: '구매 진행 중', stage: 'purchase' })
    expect(await detail('PR-04')).toMatchObject({ status: '증빙 정리 중', stage: 'evidence' })
    expect(await detail('PR-06')).toMatchObject({ status: '처리 완료', statusTone: 'green', stage: 'done' })
  })

  // 임시 저장한 요청도 상세가 있다 — 아직 제출 단계에 서 있다.
  it('임시 저장한 요청은 번호가 없고 제출 단계에 서 있다', async () => {
    expect(await detail('PR-07')).toMatchObject({
      code: '번호 미정',
      status: '작성 중',
      statusTone: 'gray',
      stage: 'submitted',
      neededOn: '2026-04-01',
      // 단가를 안 적은 품목은 더할 것이 없다.
      amountNote: '0원',
    })
  })

  it('없는 것은 없다고 답한다 — 남의 학생회 요청도', async () => {
    expect((await ask(db, `${DETAIL}?requestId=PR-없음`)).status).toBe(404)
    expect((await ask(db, `${DETAIL}?requestId=PR-99`)).status).toBe(404)
    expect((await ask(db, DETAIL)).status).toBe(404)
    // 옆 학생회 사람에게는 제 것이 보인다.
    expect((await ask(db, `${DETAIL}?requestId=PR-99`, STRANGER)).status).toBe(200)
  })
})

describe('품목별 처리 결과(finance.purchaseRequestItems)', () => {
  it('판정과 재정부의 말이 품목마다 온다 — 말이 없으면 줄표다', async () => {
    expect(await items('PR-02')).toEqual([
      {
        id: 'PRI-03',
        name: '이름표 목걸이',
        quantityNote: '100개',
        amountNote: '50,000원',
        result: '승인',
        resultTone: 'green',
        note: '—',
      },
      {
        id: 'PRI-04',
        name: '이름표 용지',
        quantityNote: '200장',
        amountNote: '60,000원',
        result: '보완',
        resultTone: 'yellow',
        note: '규격과 인쇄 사양을 적어 주세요',
      },
    ])
  })

  it('아직 판정하지 않은 품목은 검토 대기다', async () => {
    const rows = await items('PR-01')
    expect(rows.map((row) => [row.result, row.resultTone])).toEqual([
      ['검토 대기', 'gray'],
      ['검토 대기', 'gray'],
    ])
    expect(rows[0]).toMatchObject({ id: 'PRI-01', quantityNote: '5개', amountNote: '10,000원' })
  })

  it('단가를 안 적은 품목은 금액 미정이다', async () => {
    expect((await items('PR-07'))[0]).toMatchObject({ name: '안내 팻말', quantityNote: '3개', amountNote: '금액 미정' })
  })

  it('없는 요청·남의 학생회 요청은 없다고 답한다', async () => {
    expect((await ask(db, `${ITEMS}?requestId=PR-없음`)).status).toBe(404)
    expect((await ask(db, `${ITEMS}?requestId=PR-99`)).status).toBe(404)
  })
})

describe('처리 기록(finance.purchaseRequestHistory)', () => {
  it('제출만 한 요청은 제출 한 줄이다', async () => {
    expect(await history('PR-01')).toEqual([
      { id: 'submitted', action: '요청 제출', actorNote: '박해랑 · 2026-03-01 00:00' },
    ])
  })

  it('보완이 걸리면 누가 언제 걸었는지가 한 줄 더 온다', async () => {
    expect(await history('PR-02')).toEqual([
      { id: 'submitted', action: '요청 제출', actorNote: '박해랑 · 2026-03-02 00:00' },
      { id: 'supplement', action: '보완 요청', actorNote: '김바다 · 2026-03-03 00:00' },
    ])
  })

  it('검토·발주·결제·정산의 때가 있으면 시간순으로 줄이 선다', async () => {
    expect(await history('PR-03')).toEqual([
      { id: 'submitted', action: '요청 제출', actorNote: '박해랑 · 2026-03-04 00:00' },
      { id: 'reviewed', action: '재정부 검토 완료', actorNote: '김바다 · 2026-03-05 00:00' },
      { id: 'order:PO-01', action: '발주 · 다이소 온라인몰', actorNote: '김바다 · 2026-03-08 00:00' },
    ])
    expect(await history('PR-04')).toEqual([
      { id: 'submitted', action: '요청 제출', actorNote: '박해랑 · 2026-03-05 00:00' },
      { id: 'reviewed', action: '재정부 검토 완료', actorNote: '김바다 · 2026-03-06 00:00' },
      { id: 'payment:PAY-01', action: '결제 · 다이소 온라인몰', actorNote: '김바다 · 2026-03-08 00:00' },
    ])
    // 정산을 누가 했는지는 표에 없다. 때만 온다 — 없는 사람을 지어내지 않는다.
    expect((await history('PR-06')).at(-1)).toEqual({ id: 'settled', action: '처리 완료', actorNote: '2026-03-09 00:00' })
  })

  it('임시 저장한 요청은 아직 아무 일도 없었다', async () => {
    expect(await history('PR-07')).toEqual([])
  })

  it('없는 요청·남의 학생회 요청은 없다고 답한다', async () => {
    expect((await ask(db, `${HISTORY}?requestId=PR-없음`)).status).toBe(404)
    expect((await ask(db, `${HISTORY}?requestId=PR-99`)).status).toBe(404)
  })
})
