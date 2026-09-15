import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Db } from '../db/client.ts'
import {
  departments,
  events,
  members,
  organizations,
  purchaseRequestItems,
  purchaseRequests,
  surveys,
} from '../db/schema.ts'
import { freshDb } from '../db/testing.ts'
import { eventBasics } from '../events/events.ts'
import { saveEventBasics } from '../events/basics.ts'
import { budgetPlanDraft, saveBudgetPlan } from '../finance/budget-plan.ts'
import { orgBreakdown } from '../finance/overview.ts'
import { applyForm } from '../public/survey.ts'

let db: Db
let close: () => Promise<void>
const now = new Date('2026-09-12T00:00:00Z')

beforeAll(async () => {
  const fresh = await freshDb()
  db = fresh.db as unknown as Db
  close = fresh.close
}, 60_000)

afterAll(async () => {
  await close()
})

describe('행사 데이터를 저장한 뒤 다른 화면에서 읽는다', () => {
  it('저장한 참가비와 정원을 행사 상세와 외부 신청 폼에 표시한다', async () => {
    await db.insert(organizations).values({ id: 'ORG-EVENT', name: '행사 학생회' })
    await db.insert(events).values({
      id: 'EVENT-FEE',
      orgId: 'ORG-EVENT',
      title: '참가비 행사',
    })
    await db.insert(surveys).values({
      id: 'SURVEY-FEE',
      orgId: 'ORG-EVENT',
      eventId: 'EVENT-FEE',
      linkToken: 'AAAAAAAAAAAAAAAAAAAAAA',
      active: true,
      capacity: 10,
    })

    await saveEventBasics(
      db,
      'ORG-EVENT',
      'EVENT-FEE',
      {
        feeType: 'duesConditional',
        paidAmount: 0,
        unpaidAmount: 5000,
        capacityType: 'limited',
        capacity: 1,
      },
      { now: () => now },
    )

    await expect(eventBasics(db, 'ORG-EVENT', 'EVENT-FEE')).resolves.toMatchObject({
      fee: '납부자 무료 / 미납자 5000원',
      capacity: '정원 1명',
    })
    await expect(
      applyForm(db, 'AAAAAAAAAAAAAAAAAAAAAA', { now: () => now }),
    ).resolves.toMatchObject({ fee: '납부자 무료 / 미납자 5000원' })
  })

  it('행사 예산의 담당 부서를 부서별 집계에 반영한다', async () => {
    await db.insert(organizations).values({ id: 'ORG-FINANCE', name: '재정 학생회' })
    await db.insert(departments).values({
      id: 'DEPT-FINANCE',
      orgId: 'ORG-FINANCE',
      name: '행사부',
    })
    await db.insert(members).values({
      id: 'MEMBER-FINANCE',
      orgId: 'ORG-FINANCE',
      name: '담당자',
    })
    await db.insert(events).values({
      id: 'EVENT-BUDGET',
      orgId: 'ORG-FINANCE',
      title: '예산 행사',
    })
    let serial = 0
    await saveBudgetPlan(
      db,
      'ORG-FINANCE',
      {
        periodStart: '2026-09-01',
        periodEnd: '2026-12-31',
        sources: [{ sourceName: '학생회비', sourceAmount: 100_000 }],
        items: [],
        eventItems: [
          {
            eventItemEvent: 'EVENT-BUDGET',
            eventItemName: '행사 운영비',
            eventItemAmount: 100_000,
            eventItemDepartment: 'DEPT-FINANCE',
          },
        ],
      },
      () => `FINANCE-${++serial}`,
      now,
    )
    const plan = await budgetPlanDraft(db, 'ORG-FINANCE')
    await db.insert(purchaseRequests).values({
      id: 'REQUEST-FINANCE',
      orgId: 'ORG-FINANCE',
      eventId: 'EVENT-BUDGET',
      title: '행사 물품',
      requesterMemberId: 'MEMBER-FINANCE',
      stage: 'purchase',
    })
    await db.insert(purchaseRequestItems).values({
      id: 'REQUEST-ITEM-FINANCE',
      orgId: 'ORG-FINANCE',
      requestId: 'REQUEST-FINANCE',
      name: '행사 물품',
      budgetItemId: plan.eventItems[0]!.id,
      reviewResult: 'approved',
      approvedAmount: 50_000,
    })

    const rows = await orgBreakdown(db, 'ORG-FINANCE', 'department')

    expect(rows.find((row) => row.id === 'DEPT-FINANCE')).toMatchObject({
      budget: '100,000원',
      planned: '50,000원',
      available: '50,000원',
    })
  })
})
