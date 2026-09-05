import type { Db } from '../db/client.ts'
import {
  budgetItems,
  budgetPeriods,
  budgetSources,
  departments,
  events,
  members,
  organizations,
  paymentDocuments,
  payments,
  purchaseRequestItems,
  purchaseRequests,
  users,
} from '../db/schema.ts'
import { NOW } from '../events/testing.ts'
import type { Viewer } from '../permissions.ts'

// 재정의 겉면(FIN-00 · FIN-LEDGER-01)을 재는 두 검사가 함께 심는 씨앗.
//
// **한 벌의 사실에서 두 화면의 값이 나와야 한다.** 겉면의 '실제 지출 558,000원'과
// 장부의 세 줄이 같은 결제에서 나오므로, 씨앗도 하나여야 두 검사가 같은 것을 잰다.
//
// | 학생회 | 무엇 |
// | --- | --- |
// | ORG-01 | **편성된 학생회.** 수입 둘 · 상시 항목 셋 · 행사 둘의 항목 셋 · 결제 셋 · 예정 둘 |
// | ORG-02 | **편성 전 학생회.** 결제는 하나 있다 — 예산이 없어도 쓴 돈은 사실이다 |

export const at = (text: string) => new Date(`${text}T00:00:00+09:00`)

/** 옆 학생회를 보는 사람. 울타리를 재는 데 쓴다. */
export const NEIGHBOUR: Viewer = {
  userId: 'U-99',
  membership: {
    orgId: 'ORG-02',
    memberId: 'M-99',
    role: 'member',
    departmentId: 'D-99',
    inFinanceDepartment: false,
  },
}

export async function seedOrgFinance(db: Db): Promise<void> {
  await db.insert(organizations).values([
    { id: 'ORG-01', name: '제12대 학생회' },
    { id: 'ORG-02', name: '옆 학생회' },
  ])
  await db.insert(departments).values([
    { id: 'D-01', orgId: 'ORG-01', name: '운영부', sortOrder: 0 },
    { id: 'D-02', orgId: 'ORG-01', name: '홍보부', sortOrder: 1 },
    // 아무것도 배정받지 않았고 아무것도 안 썼다 — 부서별 축에 오지 않는다.
    { id: 'D-03', orgId: 'ORG-01', name: '재정부', handlesFinance: true, sortOrder: 2 },
    { id: 'D-99', orgId: 'ORG-02', name: '남의 부서', sortOrder: 0 },
  ])
  await db.insert(users).values([
    { id: 'U-01', email: 'bada@example.ac.kr' },
    { id: 'U-99', email: 'neighbour@example.ac.kr' },
  ])
  await db.insert(members).values([
    { id: 'M-01', orgId: 'ORG-01', name: '김바다', role: 'chair', departmentId: 'D-01', userId: 'U-01' },
    { id: 'M-99', orgId: 'ORG-02', name: '남의 사람', departmentId: 'D-99', userId: 'U-99' },
  ])
  await db.insert(events).values([
    { id: 'E-01', orgId: 'ORG-01', title: '2026 봄 축제', status: 'planning', startAt: at('2026-05-10'), updatedAt: NOW },
    // 끝난 행사. 예산을 새로 배정할 수는 없지만 쓴 돈은 그대로 장부에 있다.
    { id: 'E-02', orgId: 'ORG-01', title: '2026 체육대회', status: 'done', startAt: at('2026-04-02'), updatedAt: NOW },
    { id: 'E-99', orgId: 'ORG-02', title: '남의 행사', status: 'inProgress', updatedAt: NOW },
  ])

  // ── 편성 한 벌(ORG-01). 사람이 정한 예시 그대로다(docs/decisions/budget-screen.md). ──
  await db.insert(budgetPeriods).values({
    id: 'BP-01',
    orgId: 'ORG-01',
    startsOn: '2026-03-01',
    endsOn: '2026-08-31',
    updatedAt: NOW,
  })
  await db.insert(budgetSources).values([
    { id: 'BS-01', orgId: 'ORG-01', name: '학생회비', amount: 24_000_000, sortOrder: 0 },
    { id: 'BS-02', orgId: 'ORG-01', name: '학교 지원금', amount: 6_000_000, sortOrder: 1 },
  ])
  await db.insert(budgetItems).values([
    { id: 'B-11', orgId: 'ORG-01', name: '운영비', amount: 3_000_000, departmentId: 'D-01', sortOrder: 0 },
    { id: 'B-12', orgId: 'ORG-01', name: '홍보비', amount: 2_500_000, departmentId: 'D-02', sortOrder: 1 },
    // 담당 부서가 없는 상시 항목. 부서별 축에서 '부서 미지정'에 든다.
    { id: 'B-13', orgId: 'ORG-01', name: '비품', amount: 1_200_000, sortOrder: 2 },
    { id: 'B-21', orgId: 'ORG-01', eventId: 'E-01', name: '물품비', amount: 1_200_000, sortOrder: 3 },
    { id: 'B-22', orgId: 'ORG-01', eventId: 'E-01', name: '홍보비', amount: 800_000, sortOrder: 4 },
    { id: 'B-31', orgId: 'ORG-01', eventId: 'E-02', name: '경품', amount: 500_000, sortOrder: 5 },
  ])

  // ── 구매 요청과 그 돈. 단계는 `purchase_stage`가 정한다. ──
  await db.insert(purchaseRequests).values([
    // 결제까지 했고 증빙을 정리하는 중 — 서류는 다 붙었다('확인 중').
    { id: 'PR-01', orgId: 'ORG-01', eventId: 'E-01', code: 'REQ-001', title: '봄 축제 무대 물품', departmentId: 'D-01', requesterMemberId: 'M-01', stage: 'proof', submittedAt: at('2026-07-10') },
    // 승인됐고 아직 안 냈다 — 지출 예정이다.
    { id: 'PR-02', orgId: 'ORG-01', eventId: 'E-01', code: 'REQ-002', title: '봄 축제 현수막 추가', departmentId: 'D-02', requesterMemberId: 'M-01', stage: 'purchase', submittedAt: at('2026-07-12') },
    // 상시 지출. 처리가 끝났다('완료').
    { id: 'PR-03', orgId: 'ORG-01', code: 'REQ-003', title: '사무용품 구매', departmentId: 'D-01', requesterMemberId: 'M-01', stage: 'settled', submittedAt: at('2026-07-01'), evidenceCompletedAt: at('2026-07-05') },
    // 끝난 행사의 결제. 서류가 안 붙었다('누락').
    { id: 'PR-04', orgId: 'ORG-01', eventId: 'E-02', code: 'REQ-004', title: '체육대회 경품', departmentId: 'D-01', requesterMemberId: 'M-01', stage: 'proof', submittedAt: at('2026-06-15') },
    // 아직 판정하지 않았다 — 승인액이 없으므로 예정도 아니다.
    { id: 'PR-05', orgId: 'ORG-01', code: 'REQ-005', title: '홍보물 인쇄', departmentId: 'D-02', requesterMemberId: 'M-01', stage: 'review', submittedAt: at('2026-07-14') },
    // 담당 부서가 없는 상시 항목에서 나갈 예정.
    { id: 'PR-06', orgId: 'ORG-01', code: 'REQ-006', title: '비품 교체', departmentId: 'D-01', requesterMemberId: 'M-01', stage: 'purchase', submittedAt: at('2026-07-13') },
    { id: 'PR-99', orgId: 'ORG-02', eventId: 'E-99', code: 'REQ-999', title: '남의 요청', departmentId: 'D-99', requesterMemberId: 'M-99', stage: 'proof', submittedAt: at('2026-07-01') },
  ])
  await db.insert(payments).values([
    { id: 'PAY-01', orgId: 'ORG-01', requestId: 'PR-01', vendor: '무대장비 대여점', paidOn: at('2026-07-17'), payerMemberId: 'M-01', method: '법인카드', paidAmount: 390_000 },
    { id: 'PAY-02', orgId: 'ORG-01', requestId: 'PR-03', vendor: '문구점', paidOn: at('2026-07-03'), payerMemberId: 'M-01', paidAmount: 48_000 },
    { id: 'PAY-03', orgId: 'ORG-01', requestId: 'PR-04', vendor: '상품권 판매처', paidOn: at('2026-06-20'), payerMemberId: 'M-01', paidAmount: 120_000 },
    { id: 'PAY-99', orgId: 'ORG-02', requestId: 'PR-99', vendor: '남의 업체', paidOn: at('2026-07-05'), paidAmount: 1_000 },
  ])
  await db.insert(paymentDocuments).values([
    { id: 'PD-01', orgId: 'ORG-01', paymentId: 'PAY-01', label: '영수증', registeredAt: at('2026-07-17') },
    { id: 'PD-02', orgId: 'ORG-01', paymentId: 'PAY-01', label: '거래명세서', registeredAt: at('2026-07-18') },
    { id: 'PD-03', orgId: 'ORG-01', paymentId: 'PAY-02', label: '영수증', registeredAt: at('2026-07-03') },
    { id: 'PD-04', orgId: 'ORG-01', paymentId: 'PAY-03', label: '영수증' },
    { id: 'PD-99', orgId: 'ORG-02', paymentId: 'PAY-99', label: '영수증' },
  ])
  await db.insert(purchaseRequestItems).values([
    // PR-01의 품목 둘이 한 결제에 딸렸다. 예산 항목이 둘이라 장부 줄에 '외 1건'이 붙는다.
    { id: 'PRI-01', orgId: 'ORG-01', requestId: 'PR-01', sortOrder: 0, name: '천막 대여', budgetItemId: 'B-21', quantity: 2, unit: '동', unitPrice: 150_000, reviewResult: 'approved', approvedAmount: 300_000, paymentId: 'PAY-01' },
    { id: 'PRI-02', orgId: 'ORG-01', requestId: 'PR-01', sortOrder: 1, name: '무대 현수막', budgetItemId: 'B-22', quantity: 1, unit: '장', unitPrice: 100_000, reviewResult: 'approved', approvedAmount: 100_000, paymentId: 'PAY-01' },
    { id: 'PRI-03', orgId: 'ORG-01', requestId: 'PR-02', sortOrder: 0, name: '입구 현수막', budgetItemId: 'B-22', quantity: 2, unit: '장', unitPrice: 100_000, reviewResult: 'approved', approvedAmount: 200_000 },
    { id: 'PRI-04', orgId: 'ORG-01', requestId: 'PR-03', sortOrder: 0, name: 'A4 용지', budgetItemId: 'B-11', quantity: 10, unit: '박스', unitPrice: 5_000, reviewResult: 'approved', approvedAmount: 50_000, paymentId: 'PAY-02' },
    { id: 'PRI-05', orgId: 'ORG-01', requestId: 'PR-04', sortOrder: 0, name: '경품 상품권', budgetItemId: 'B-31', quantity: 12, unit: '장', unitPrice: 10_000, reviewResult: 'approved', approvedAmount: 120_000, paymentId: 'PAY-03' },
    { id: 'PRI-06', orgId: 'ORG-01', requestId: 'PR-05', sortOrder: 0, name: '홍보 포스터', budgetItemId: 'B-12', quantity: 50, unit: '장', unitPrice: 1_000 },
    { id: 'PRI-07', orgId: 'ORG-01', requestId: 'PR-06', sortOrder: 0, name: '의자', budgetItemId: 'B-13', quantity: 2, unit: '개', unitPrice: 15_000, reviewResult: 'approved', approvedAmount: 30_000 },
    { id: 'PRI-99', orgId: 'ORG-02', requestId: 'PR-99', sortOrder: 0, name: '남의 품목', quantity: 1, unitPrice: 1_000, reviewResult: 'approved', approvedAmount: 1_000, paymentId: 'PAY-99' },
  ])
}
