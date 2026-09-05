import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import { freshDb } from '../db/testing.ts'
import {
  budgetItems,
  budgetPeriods,
  budgetSources,
  departments,
  events,
  members,
  organizations,
} from '../db/schema.ts'
import { harness, matchesContract, NOW, viewer } from '../events/testing.ts'

// 예산 편성(FIN-PLAN-01)의 세 자리 — 읽기 · 행사 고르기 · 저장.
//
// **재정 28자리가 전부 이 화면이 넣는 금액 위에 선다.** 그래서 여기서 재는 것은
// 화면 하나의 값이 아니라 **한 벌이 통째로 저장되고 통째로 다시 읽히는가**다.
//
// 이 파일이 재는 것이 일곱이다.
//
// 1. **아직 아무것도 없는 학생회는 기간도 줄도 없이 온다.** 조각을 비우지 않고 아예
//    내지 않는다 — 그것이 갓 만든 학생회의 첫 모습이다.
// 2. **저장은 덮어쓰기다.** id가 온 줄은 고치고, 없는 줄은 만들고, 안 온 줄은 지운다.
//    다시 읽으면 보낸 그 벌이 그대로 보인다.
// 3. **배정의 합이 수입의 합을 넘으면 422다.** 넘지 않는 한 남는 금액은 미배정이다.
// 4. **시작일이 끝일보다 늦으면 422다.**
// 5. **없는 부서·행사 id는 422다.** 남의 학생회의 것도 없는 것이다.
// 6. **울타리가 선다.** 남의 학생회 줄은 보이지도, 고쳐지지도 않는다.
// 7. **행사 목록은 완료된 것을 뺀다.** 끝난 행사에 예산을 새로 배정할 일이 없다.

let db: Db
let close: () => Promise<void>

const PLAN = '/api/finance/budget-plan'
const EVENTS = '/api/finance/budget-plan/events'

type Row = Record<string, unknown>

/**
 * 화면이 초안에 쓰는 그 모양이다 — 목록 칸에는 줄 이름을 줄바꿈으로 이어 담고, 줄의
 * 칸은 `목록.줄.칸`에 담는다(`spec/compute.ts`의 itemKey·joinRowIds). 수는 글로 온다.
 */
function flat(plan: {
  periodStart?: string
  periodEnd?: string
  sources?: Row[]
  items?: Row[]
  eventItems?: Row[]
}): Row {
  const values: Row = {}
  if (plan.periodStart !== undefined) values.periodStart = plan.periodStart
  if (plan.periodEnd !== undefined) values.periodEnd = plan.periodEnd
  for (const [list, rows] of [
    ['sources', plan.sources ?? []],
    ['items', plan.items ?? []],
    ['eventItems', plan.eventItems ?? []],
  ] as const) {
    values[list] = rows.map((_, index) => `r${index}`).join('\n')
    rows.forEach((row, index) => {
      for (const [key, value] of Object.entries(row)) {
        values[`${list}.r${index}.${key}`] = typeof value === 'number' ? String(value) : value
      }
    })
  }
  // 화면의 '행사' 고르기도 초안에 함께 실려 온다. 무엇을 보고 있었는지일 뿐 값이 아니다.
  values.event = 'E-01'
  return values
}

// **이름표는 검사 전체에서 하나씩 는다.** 앱을 부를 때마다 새로 세우는데(harness)
// 그때마다 번호가 처음부터면 앞서 만든 줄과 같은 이름이 나온다 — 진짜 서버는 UUID를
// 만들므로 이것은 검사만의 사정이다.
let made = 0
const newId = () => `BUD-${(made += 1)}`

const put = (body: unknown, who = viewer('chair')) =>
  harness(db, { who, newId }).request(PLAN, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })

async function readPlan(who = viewer('chair')): Promise<Row> {
  const res = await harness(db, { who }).request(PLAN)
  expect(res.status, `${PLAN}이 ${res.status}로 답했다`).toBe(200)
  const body = (await res.json()) as Row
  expect(matchesContract('finance.budgetPlanDraft', body)).toBe(true)
  return body
}

/** 채운 학생회 한 벌. 사람이 정한 예시 그대로다(docs/decisions/budget-screen.md). */
const FILLED = {
  periodStart: '2026-03-01',
  periodEnd: '2026-08-31',
  sources: [
    { sourceName: '학생회비', sourceAmount: 24_000_000 },
    { sourceName: '학교 지원금', sourceAmount: 6_000_000 },
  ],
  items: [
    { itemName: '운영비', itemAmount: 3_000_000, itemDepartment: 'D-01' },
    { itemName: '홍보비', itemAmount: 2_500_000, itemDepartment: 'D-02' },
    { itemName: '비품', itemAmount: 1_200_000 },
  ],
  eventItems: [
    { eventItemEvent: 'E-01', eventItemName: '물품비', eventItemAmount: 1_200_000 },
    { eventItemEvent: 'E-01', eventItemName: '홍보비', eventItemAmount: 800_000 },
    { eventItemEvent: 'E-02', eventItemName: '경품', eventItemAmount: 500_000 },
  ],
}

beforeAll(async () => {
  const fresh = await freshDb()
  db = fresh.db as unknown as Db
  close = fresh.close

  await db.insert(organizations).values([
    { id: 'ORG-01', name: '제12대 학생회' },
    { id: 'ORG-02', name: '옆 학생회' },
  ])
  await db.insert(departments).values([
    { id: 'D-01', orgId: 'ORG-01', name: '기획부', sortOrder: 0 },
    { id: 'D-02', orgId: 'ORG-01', name: '홍보부', sortOrder: 1 },
    { id: 'D-99', orgId: 'ORG-02', name: '남의 부서' },
  ])
  await db.insert(members).values([
    { id: 'M-01', orgId: 'ORG-01', name: '김바다', role: 'chair', departmentId: 'D-01' },
    { id: 'M-99', orgId: 'ORG-02', name: '남의 사람', departmentId: 'D-99' },
  ])
  await db.insert(events).values([
    {
      id: 'E-01',
      orgId: 'ORG-01',
      title: '2026 봄 축제',
      status: 'planning',
      startAt: new Date('2026-05-10T10:00:00+09:00'),
      updatedAt: NOW,
    },
    {
      id: 'E-02',
      orgId: 'ORG-01',
      title: '2026 체육대회',
      status: 'inProgress',
      startAt: new Date('2026-04-02T10:00:00+09:00'),
      updatedAt: NOW,
    },
    { id: 'E-03', orgId: 'ORG-01', title: '지난 신입생 환영회', status: 'done', updatedAt: NOW },
    { id: 'E-99', orgId: 'ORG-02', title: '남의 행사', status: 'planning', updatedAt: NOW },
  ])
  // 옆 학생회의 편성. **한 줄도 이쪽에 보이면 안 된다.**
  await db.insert(budgetPeriods).values({
    id: 'BP-99',
    orgId: 'ORG-02',
    startsOn: '2025-09-01',
    endsOn: '2026-02-28',
    updatedAt: NOW,
  })
  await db.insert(budgetSources).values({ id: 'BS-99', orgId: 'ORG-02', name: '남의 학생회비', amount: 1_000 })
  await db.insert(budgetItems).values({ id: 'B-99', orgId: 'ORG-02', name: '남의 항목', amount: 500 })
}, 60_000)

afterAll(async () => {
  await close()
})

describe('아직 아무것도 없는 학생회(finance.budgetPlanDraft)', () => {
  it('기간도 줄도 없이 온다 — 없는 조각은 내지 않는다', async () => {
    expect(await readPlan()).toEqual({ sources: [], items: [], eventItems: [] })
  })

  it('재정 권한이 없는 사람은 열지 못한다', async () => {
    expect((await harness(db, { who: viewer('member') }).request(PLAN)).status).toBe(403)
    expect((await put(flat(FILLED), viewer('member'))).status).toBe(403)
  })
})

describe('예산을 배정할 수 있는 행사(finance.budgetEvents.options)', () => {
  it('완료된 행사와 남의 행사는 오지 않고, 단계가 곁에 붙는다', async () => {
    const res = await harness(db).request(EVENTS)
    expect(res.status).toBe(200)
    const body = (await res.json()) as Row[]
    expect(matchesContract('finance.budgetEvents.options', body)).toBe(true)
    expect(body).toEqual([
      { value: 'E-02', label: '2026 체육대회', description: '진행 중' },
      { value: 'E-01', label: '2026 봄 축제', description: '기획 중' },
    ])
  })
})

describe('저장(finance.budgetPlan.save)', () => {
  it('한 벌을 저장하면 다시 읽었을 때 그 벌이 그대로 보인다', async () => {
    const res = await put(flat(FILLED))
    const answer = await res.text()
    expect(res.status, answer).toBe(200)
    // 이 자리는 돌려주는 값이 없다(계약).
    expect(JSON.parse(answer)).toEqual({})

    const plan = await readPlan()
    expect(plan.periodStart).toBe('2026-03-01')
    expect(plan.periodEnd).toBe('2026-08-31')
    // **금액은 수로 온다** — 자릿점은 화면이 붙인다.
    expect(plan.sources).toEqual([
      { id: expect.any(String), sourceName: '학생회비', sourceAmount: 24_000_000 },
      { id: expect.any(String), sourceName: '학교 지원금', sourceAmount: 6_000_000 },
    ])
    // 담당 부서가 없는 줄은 그 조각을 내지 않는다.
    expect(plan.items).toEqual([
      { id: expect.any(String), itemName: '운영비', itemAmount: 3_000_000, itemDepartment: 'D-01' },
      { id: expect.any(String), itemName: '홍보비', itemAmount: 2_500_000, itemDepartment: 'D-02' },
      { id: expect.any(String), itemName: '비품', itemAmount: 1_200_000 },
    ])
    expect(plan.eventItems).toEqual([
      { id: expect.any(String), eventItemEvent: 'E-01', eventItemName: '물품비', eventItemAmount: 1_200_000 },
      { id: expect.any(String), eventItemEvent: 'E-01', eventItemName: '홍보비', eventItemAmount: 800_000 },
      { id: expect.any(String), eventItemEvent: 'E-02', eventItemName: '경품', eventItemAmount: 500_000 },
    ])
  })

  it('덮어쓰기다 — id가 온 줄은 고치고, 없는 줄은 만들고, 안 온 줄은 지운다', async () => {
    const before = await readPlan()
    const sources = before.sources as Row[]
    const items = before.items as Row[]
    const eventItems = before.eventItems as Row[]

    const res = await put(
      flat({
        periodStart: '2026-03-02',
        periodEnd: '2026-08-31',
        // 학교 지원금은 안 보낸다 — 지운 것이다. 학생회비는 금액을 고친다.
        sources: [{ id: sources[0]!.id, sourceName: '학생회비', sourceAmount: 25_000_000 }],
        // 운영비의 부서를 뗀다. 홍보비는 그대로, 비품은 지우고, 새 줄 하나.
        items: [
          { id: items[0]!.id, itemName: '운영비', itemAmount: 3_000_000 },
          { id: items[1]!.id, itemName: '홍보비', itemAmount: 2_500_000, itemDepartment: 'D-02' },
          { itemName: '안전·설비', itemAmount: 1_800_000, itemDepartment: 'D-01' },
        ],
        // 체육대회의 줄만 남기고 봄 축제의 두 줄은 지운다.
        eventItems: [{ id: eventItems[2]!.id, eventItemEvent: 'E-02', eventItemName: '경품', eventItemAmount: 700_000 }],
      }),
    )
    expect(res.status, await res.text()).toBe(200)

    const after = await readPlan()
    expect(after.periodStart).toBe('2026-03-02')
    expect(after.sources).toEqual([{ id: sources[0]!.id, sourceName: '학생회비', sourceAmount: 25_000_000 }])
    expect(after.items).toEqual([
      { id: items[0]!.id, itemName: '운영비', itemAmount: 3_000_000 },
      { id: items[1]!.id, itemName: '홍보비', itemAmount: 2_500_000, itemDepartment: 'D-02' },
      { id: expect.any(String), itemName: '안전·설비', itemAmount: 1_800_000, itemDepartment: 'D-01' },
    ])
    expect((after.items as Row[])[2]!.id).not.toBe(items[2]!.id)
    expect(after.eventItems).toEqual([
      { id: eventItems[2]!.id, eventItemEvent: 'E-02', eventItemName: '경품', eventItemAmount: 700_000 },
    ])
    // 기간은 학생회에 하나다 — 다시 저장해도 줄이 늘지 않는다.
    expect(await db.select().from(budgetPeriods).where(eq(budgetPeriods.orgId, 'ORG-01'))).toHaveLength(1)
  })

  it('계약이 적은 모양(줄 배열)으로 보내도 같은 저장이다', async () => {
    const before = await readPlan()
    const res = await put({
      periodStart: '2026-03-02',
      periodEnd: '2026-08-31',
      sources: before.sources,
      items: before.items,
      eventItems: before.eventItems,
    })
    expect(res.status, await res.text()).toBe(200)
    expect(await readPlan()).toEqual(before)
  })

  it('배정의 합이 수입의 합을 넘으면 422이고 아무것도 바뀌지 않는다', async () => {
    const before = await readPlan()
    const res = await put(
      flat({
        periodStart: '2026-03-01',
        periodEnd: '2026-08-31',
        sources: [{ sourceName: '학생회비', sourceAmount: 1_000_000 }],
        items: [{ itemName: '운영비', itemAmount: 600_000 }],
        eventItems: [{ eventItemEvent: 'E-01', eventItemName: '물품비', eventItemAmount: 400_001 }],
      }),
    )
    expect(res.status).toBe(422)
    expect(((await res.json()) as { message: string }).message).toContain('수입')
    expect(await readPlan()).toEqual(before)
  })

  it('딱 맞게 배정하는 것은 된다 — 넘는 것만 막는다', async () => {
    const res = await put(
      flat({
        periodStart: '2026-03-01',
        periodEnd: '2026-08-31',
        sources: [{ sourceName: '학생회비', sourceAmount: 1_000_000 }],
        items: [{ itemName: '운영비', itemAmount: 600_000 }],
        eventItems: [{ eventItemEvent: 'E-01', eventItemName: '물품비', eventItemAmount: 400_000 }],
      }),
    )
    expect(res.status, await res.text()).toBe(200)
  })

  it('시작일이 끝일보다 늦으면 422다', async () => {
    const res = await put(flat({ ...FILLED, periodStart: '2026-09-01', periodEnd: '2026-08-31' }))
    expect(res.status).toBe(422)
    // 같은 날은 늦은 것이 아니다.
    expect((await put(flat({ ...FILLED, periodStart: '2026-08-31', periodEnd: '2026-08-31' }))).status).toBe(200)
  })

  it('기간이 없거나 날짜 꼴이 아니면 422다', async () => {
    expect((await put(flat({ ...FILLED, periodStart: undefined }))).status).toBe(422)
    expect((await put(flat({ ...FILLED, periodEnd: '' }))).status).toBe(422)
    expect((await put(flat({ ...FILLED, periodStart: '2026. 03. 01' }))).status).toBe(422)
    expect((await put(flat({ ...FILLED, periodEnd: '2026-02-30' }))).status).toBe(422)
  })

  it('없는 부서·행사 id는 422다 — 남의 학생회의 것도 없는 것이다', async () => {
    const withDepartment = (itemDepartment: string) =>
      flat({ ...FILLED, items: [{ itemName: '운영비', itemAmount: 1_000, itemDepartment }] })
    expect((await put(withDepartment('D-99'))).status).toBe(422)
    expect((await put(withDepartment('D-없음'))).status).toBe(422)

    const withEvent = (eventItemEvent: string) =>
      flat({ ...FILLED, eventItems: [{ eventItemEvent, eventItemName: '물품비', eventItemAmount: 1_000 }] })
    expect((await put(withEvent('E-99'))).status).toBe(422)
    expect((await put(withEvent('E-없음'))).status).toBe(422)
    expect((await put(withEvent(''))).status).toBe(422)
  })

  it('금액이 수가 아니거나 음수이거나 이름이 비면 422다', async () => {
    expect(
      (await put(flat({ ...FILLED, sources: [{ sourceName: '학생회비', sourceAmount: '이천만' }] }))).status,
    ).toBe(422)
    expect(
      (await put(flat({ ...FILLED, sources: [{ sourceName: '학생회비', sourceAmount: -1 }] }))).status,
    ).toBe(422)
    expect(
      (await put(flat({ ...FILLED, sources: [{ sourceName: '학생회비', sourceAmount: 1.5 }] }))).status,
    ).toBe(422)
    expect((await put(flat({ ...FILLED, items: [{ itemName: '  ', itemAmount: 1 }] }))).status).toBe(422)
    expect((await put(flat({ ...FILLED, items: [{ itemName: '운영비' }] }))).status).toBe(422)
  })

  it('몸통이 한 벌의 모양이 아니면 422다', async () => {
    expect((await put([])).status).toBe(422)
    expect((await put('{이건 json이 아니다')).status).toBe(422)
    expect((await put({ ...flat(FILLED), sources: 42 })).status).toBe(422)
  })

  it('남의 학생회의 줄은 보이지도 고쳐지지도 않는다', async () => {
    const mine = await readPlan()
    for (const row of [...(mine.sources as Row[]), ...(mine.items as Row[]), ...(mine.eventItems as Row[])]) {
      expect(row.id).not.toBe('BS-99')
      expect(row.id).not.toBe('B-99')
    }
    // 남의 줄 id를 들고 고치려 하면 받을 수 없는 값이다 — 조용히 새로 만들지 않는다.
    const res = await put(
      flat({ ...FILLED, sources: [{ id: 'BS-99', sourceName: '가로챈 수입', sourceAmount: 1 }] }),
    )
    expect(res.status).toBe(422)
    const theirs = await db.select().from(budgetSources).where(eq(budgetSources.orgId, 'ORG-02'))
    expect(theirs.map((row) => [row.id, row.name, row.amount])).toEqual([['BS-99', '남의 학생회비', 1_000]])
    // 옆 학생회가 읽으면 제 것만 보인다.
    const theirPlan = await readPlan({
      userId: 'U-99',
      membership: { orgId: 'ORG-02', memberId: 'M-99', role: 'chair', departmentId: 'D-99', inFinanceDepartment: false },
    })
    expect(theirPlan).toEqual({
      periodStart: '2025-09-01',
      periodEnd: '2026-02-28',
      sources: [{ id: 'BS-99', sourceName: '남의 학생회비', sourceAmount: 1_000 }],
      items: [{ id: 'B-99', itemName: '남의 항목', itemAmount: 500 }],
      eventItems: [],
    })
  })
})
