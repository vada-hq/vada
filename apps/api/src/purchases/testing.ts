import type { Db } from '../db/client.ts'
import {
  budgetItems,
  departments,
  events,
  members,
  organizations,
  paymentDocuments,
  payments,
  purchaseOrders,
  purchaseRequestItems,
  purchaseRequests,
  users,
} from '../db/schema.ts'
import { harness, NOW, type HarnessOptions } from '../events/testing.ts'
import type { Viewer } from '../permissions.ts'

// 구매 요청 흐름의 검사 다섯이 함께 쓰는 씨앗과 발판.
//
// **한 요청이 단계마다 하나씩 있다.** 검토 대기 · 보완 걸림 · 구매 진행 · 증빙 정리(서류가
// 모자란 것과 다 붙은 것) · 처리 완료 · 임시 저장 — 흐름의 쓰기 여섯이 저마다 다른 단계의
// 요청을 집어 옮기므로, 어느 검사가 어느 줄을 건드리는지 여기서 한눈에 보인다.
//
// **여기 있는 것은 검사만 쓴다.**

export const at = (text: string) => new Date(`${text}T00:00:00+09:00`)

/** 요청을 쓰는 사람 — 운영부 부원. 재정을 맡지 않는다. */
export const MEMBER: Viewer = {
  userId: 'U-01',
  membership: {
    orgId: 'ORG-01',
    memberId: 'M-01',
    role: 'member',
    departmentId: 'D-01',
    inFinanceDepartment: false,
  },
}

/** 판정을 보내고 증빙을 끝내는 사람 — 회장. `finance.manage`는 회장단이 늘 갖는다. */
export const CHAIR: Viewer = {
  userId: 'U-02',
  membership: {
    orgId: 'ORG-01',
    memberId: 'M-02',
    role: 'chair',
    departmentId: 'D-02',
    inFinanceDepartment: true,
  },
}

/** 같은 학생회의 다른 부원. 남의 초안을 건드리는 검사가 쓴다. */
export const OTHER: Viewer = {
  userId: 'U-03',
  membership: {
    orgId: 'ORG-01',
    memberId: 'M-03',
    role: 'member',
    departmentId: 'D-01',
    inFinanceDepartment: false,
  },
}

/** 옆 학생회 사람. 울타리를 재는 검사가 쓴다. */
export const STRANGER: Viewer = {
  userId: 'U-99',
  membership: {
    orgId: 'ORG-02',
    memberId: 'M-99',
    role: 'chair',
    departmentId: 'D-99',
    inFinanceDepartment: false,
  },
}

export async function seedPurchases(db: Db): Promise<void> {
  await db.insert(organizations).values([
    { id: 'ORG-01', name: '제12대 학생회' },
    { id: 'ORG-02', name: '옆 학생회' },
  ])
  await db.insert(departments).values([
    { id: 'D-01', orgId: 'ORG-01', name: '운영부', sortOrder: 0 },
    { id: 'D-02', orgId: 'ORG-01', name: '재정부', handlesFinance: true, sortOrder: 1 },
    { id: 'D-99', orgId: 'ORG-02', name: '남의 부서' },
  ])
  await db.insert(users).values([
    { id: 'U-01', email: 'haerang@example.ac.kr' },
    { id: 'U-02', email: 'bada@example.ac.kr' },
    { id: 'U-03', email: 'yunseul@example.ac.kr' },
  ])
  await db.insert(members).values([
    { id: 'M-01', orgId: 'ORG-01', name: '박해랑', departmentId: 'D-01', userId: 'U-01' },
    { id: 'M-02', orgId: 'ORG-01', name: '김바다', departmentId: 'D-02', role: 'chair', userId: 'U-02' },
    { id: 'M-03', orgId: 'ORG-01', name: '이윤슬', departmentId: 'D-01', userId: 'U-03' },
    { id: 'M-99', orgId: 'ORG-02', name: '남의 사람', departmentId: 'D-99' },
  ])
  await db.insert(events).values([
    { id: 'E-01', orgId: 'ORG-01', title: '2026 소프트웨어융합대학 체육대회', updatedAt: NOW },
    { id: 'E-02', orgId: 'ORG-01', title: '2026 봄 축제', updatedAt: NOW },
    { id: 'E-99', orgId: 'ORG-02', title: '남의 행사', updatedAt: NOW },
  ])
  await db.insert(budgetItems).values([
    { id: 'B-01', orgId: 'ORG-01', eventId: 'E-01', name: '행사 운영비', amount: 1_000_000, sortOrder: 0 },
    { id: 'B-02', orgId: 'ORG-01', eventId: 'E-01', name: '홍보비', amount: 500_000, sortOrder: 1 },
    { id: 'B-03', orgId: 'ORG-01', eventId: 'E-02', name: '봄 축제 물품비', amount: 300_000 },
    { id: 'B-04', orgId: 'ORG-01', eventId: null, name: '상시 운영비', amount: 200_000 },
    { id: 'B-99', orgId: 'ORG-02', eventId: 'E-99', name: '남의 항목', amount: 10 },
  ])

  await db.insert(purchaseRequests).values([
    // 검토를 기다리는 요청. 아직 아무 판정도 없다.
    {
      id: 'PR-01',
      orgId: 'ORG-01',
      eventId: 'E-01',
      code: 'REQ-001',
      title: '체육대회 운영 물품 2종',
      purpose: '체육대회 진행에 필요한 소모품을 삽니다.',
      departmentId: 'D-01',
      requesterMemberId: 'M-01',
      priority: 'normal',
      neededOn: at('2026-03-15'),
      stage: 'review',
      submittedAt: at('2026-03-01'),
    },
    // 보완이 걸린 요청. **단계는 여전히 검토다.** 김바다가 걸었다.
    {
      id: 'PR-02',
      orgId: 'ORG-01',
      eventId: 'E-01',
      code: 'REQ-002',
      title: '이름표 제작',
      departmentId: 'D-01',
      requesterMemberId: 'M-01',
      stage: 'review',
      submittedAt: at('2026-03-02'),
      reviewedByMemberId: 'M-02',
      supplementRequestedAt: at('2026-03-03'),
      supplementDueOn: at('2026-03-07'),
    },
    // 검토가 끝나 구매 중인 요청.
    {
      id: 'PR-03',
      orgId: 'ORG-01',
      eventId: 'E-01',
      code: 'REQ-003',
      title: '현수막 제작',
      departmentId: 'D-01',
      requesterMemberId: 'M-01',
      neededOn: at('2026-03-20'),
      stage: 'purchase',
      submittedAt: at('2026-03-04'),
      reviewedAt: at('2026-03-05'),
      reviewedByMemberId: 'M-02',
    },
    // 증빙 정리 중인데 서류가 하나 모자란 요청.
    {
      id: 'PR-04',
      orgId: 'ORG-01',
      eventId: 'E-01',
      code: 'REQ-004',
      title: '간식 구매',
      departmentId: 'D-01',
      requesterMemberId: 'M-01',
      stage: 'proof',
      submittedAt: at('2026-03-05'),
      reviewedAt: at('2026-03-06'),
      reviewedByMemberId: 'M-02',
    },
    // 증빙 정리 중이고 서류가 다 붙은 요청. 처리를 끝낼 수 있다.
    {
      id: 'PR-05',
      orgId: 'ORG-01',
      eventId: 'E-01',
      code: 'REQ-005',
      title: '상장 인쇄',
      departmentId: 'D-01',
      requesterMemberId: 'M-01',
      stage: 'proof',
      submittedAt: at('2026-03-06'),
      reviewedAt: at('2026-03-07'),
      reviewedByMemberId: 'M-02',
    },
    // 처리가 끝난 요청.
    {
      id: 'PR-06',
      orgId: 'ORG-01',
      eventId: 'E-01',
      code: 'REQ-006',
      title: '기념품 구매',
      departmentId: 'D-01',
      requesterMemberId: 'M-01',
      stage: 'settled',
      submittedAt: at('2026-03-06'),
      reviewedAt: at('2026-03-07'),
      reviewedByMemberId: 'M-02',
      evidenceCompletedAt: at('2026-03-09'),
    },
    // 내가 임시 저장해 둔 요청. 번호가 없고 아직 아무 데도 안 보인다.
    {
      id: 'PR-07',
      orgId: 'ORG-01',
      eventId: 'E-01',
      title: '임시 저장한 요청',
      purpose: '아직 쓰는 중',
      departmentId: 'D-01',
      requesterMemberId: 'M-01',
      priority: 'urgent',
      neededOn: at('2026-04-01'),
      stage: 'draft',
    },
    // 남이 쓰던 초안. 내가 고칠 수 없다.
    {
      id: 'PR-08',
      orgId: 'ORG-01',
      eventId: 'E-01',
      title: '남이 쓰던 초안',
      departmentId: 'D-01',
      requesterMemberId: 'M-03',
      stage: 'draft',
    },
    // 다른 행사의 요청. **번호가 이미 일곱까지 갔다** — 다음 제출은 여덟이어야 한다.
    {
      id: 'PR-09',
      orgId: 'ORG-01',
      eventId: 'E-02',
      code: 'PR-2026-0007',
      title: '봄 축제 현수막',
      departmentId: 'D-01',
      requesterMemberId: 'M-03',
      stage: 'review',
      submittedAt: at('2026-03-08'),
    },
    // 전부 반려되는 요청. **끝나는 자리를 재려면 끝낼 것이 있어야 한다.**
    {
      id: 'PR-11',
      orgId: 'ORG-01',
      eventId: 'E-01',
      code: 'REQ-011',
      title: '쓸모없는 물품',
      departmentId: 'D-01',
      requesterMemberId: 'M-03',
      stage: 'review',
      submittedAt: at('2026-03-08'),
    },
    // 검토를 기다리는 남의 요청 하나 더. 승인·반려가 섞이는 판정을 이것에 보낸다.
    {
      id: 'PR-10',
      orgId: 'ORG-01',
      eventId: 'E-01',
      code: 'REQ-010',
      title: '체육대회 장식',
      departmentId: 'D-01',
      requesterMemberId: 'M-03',
      stage: 'review',
      submittedAt: at('2026-03-08'),
    },
    // 남의 학생회 요청.
    {
      id: 'PR-99',
      orgId: 'ORG-02',
      eventId: 'E-99',
      code: 'REQ-999',
      title: '남의 학생회 요청',
      departmentId: 'D-99',
      requesterMemberId: 'M-99',
      stage: 'review',
      submittedAt: at('2026-03-01'),
    },
  ])

  await db.insert(purchaseOrders).values({
    id: 'PO-01',
    orgId: 'ORG-01',
    requestId: 'PR-03',
    vendor: '다이소 온라인몰',
    orderedOn: at('2026-03-08'),
    ordererMemberId: 'M-02',
  })

  await db.insert(payments).values([
    {
      id: 'PAY-01',
      orgId: 'ORG-01',
      requestId: 'PR-04',
      vendor: '다이소 온라인몰',
      paidOn: at('2026-03-08'),
      payerMemberId: 'M-02',
      method: '법인카드',
      paidAmount: 24_500,
    },
    {
      id: 'PAY-02',
      orgId: 'ORG-01',
      requestId: 'PR-05',
      vendor: '캠퍼스 인쇄소',
      paidOn: at('2026-03-09'),
      payerMemberId: 'M-02',
      method: '계좌이체',
      paidAmount: 30_000,
    },
  ])
  await db.insert(paymentDocuments).values([
    { id: 'PD-01', orgId: 'ORG-01', paymentId: 'PAY-01', label: '영수증', registeredAt: at('2026-03-08') },
    { id: 'PD-02', orgId: 'ORG-01', paymentId: 'PAY-01', label: '거래명세서' },
    { id: 'PD-03', orgId: 'ORG-01', paymentId: 'PAY-02', label: '영수증', registeredAt: at('2026-03-09') },
  ])

  await db.insert(purchaseRequestItems).values([
    // PR-01의 품목 둘. **카테고리·유형은 명세의 코드다.**
    {
      id: 'PRI-01',
      orgId: 'ORG-01',
      requestId: 'PR-01',
      sortOrder: 0,
      name: '박스테이프',
      category: 'supplies',
      purchaseType: 'online',
      budgetItemId: 'B-01',
      quantity: 5,
      unit: '개',
      unitPrice: 2_000,
      vendor: '쿠팡',
      productUrl: 'https://example.test/tape',
    },
    {
      id: 'PRI-02',
      orgId: 'ORG-01',
      requestId: 'PR-01',
      sortOrder: 1,
      name: '생수 500ml',
      category: 'food',
      purchaseType: 'offline',
      budgetItemId: 'B-01',
      quantity: 2,
      unit: '박스',
      unitPrice: 12_500,
      quoteStatus: 'received',
    },
    // PR-02의 품목 둘. 하나는 승인, 하나는 보완이 걸렸다.
    {
      id: 'PRI-03',
      orgId: 'ORG-01',
      requestId: 'PR-02',
      sortOrder: 0,
      name: '이름표 목걸이',
      category: 'supplies',
      purchaseType: 'online',
      budgetItemId: 'B-01',
      quantity: 100,
      unit: '개',
      unitPrice: 500,
      reviewResult: 'approved',
      approvedAmount: 50_000,
    },
    {
      id: 'PRI-04',
      orgId: 'ORG-01',
      requestId: 'PR-02',
      sortOrder: 1,
      name: '이름표 용지',
      category: 'print',
      purchaseType: 'contract',
      budgetItemId: 'B-02',
      quantity: 200,
      unit: '장',
      unitPrice: 300,
      reviewResult: 'supplement',
      reviewNote: '규격과 인쇄 사양을 적어 주세요',
    },
    // PR-03의 품목. 발주에 실렸다.
    {
      id: 'PRI-05',
      orgId: 'ORG-01',
      requestId: 'PR-03',
      sortOrder: 0,
      name: '현수막',
      quantity: 1,
      unit: '장',
      unitPrice: 30_000,
      reviewResult: 'approved',
      approvedAmount: 25_000,
      orderId: 'PO-01',
      expectedDeliveryOn: at('2026-03-12'),
    },
    // PR-04·PR-05·PR-06의 품목. 결제에 딸렸다.
    {
      id: 'PRI-06',
      orgId: 'ORG-01',
      requestId: 'PR-04',
      sortOrder: 0,
      name: '초콜릿',
      quantity: 10,
      unit: '개',
      unitPrice: 2_500,
      reviewResult: 'approved',
      approvedAmount: 25_000,
      paymentId: 'PAY-01',
    },
    {
      id: 'PRI-07',
      orgId: 'ORG-01',
      requestId: 'PR-05',
      sortOrder: 0,
      name: '상장',
      quantity: 30,
      unit: '장',
      unitPrice: 1_000,
      reviewResult: 'approved',
      approvedAmount: 30_000,
      paymentId: 'PAY-02',
    },
    {
      id: 'PRI-08',
      orgId: 'ORG-01',
      requestId: 'PR-06',
      sortOrder: 0,
      name: '기념품',
      quantity: 50,
      unit: '개',
      unitPrice: 2_000,
      reviewResult: 'approved',
      approvedAmount: 100_000,
    },
    // 임시 저장한 요청의 품목. **단가를 아직 안 적었다.**
    {
      id: 'PRI-09',
      orgId: 'ORG-01',
      requestId: 'PR-07',
      sortOrder: 0,
      name: '안내 팻말',
      category: 'supplies',
      budgetItemId: 'B-01',
      quantity: 3,
      unit: '개',
    },
    { id: 'PRI-10', orgId: 'ORG-01', requestId: 'PR-09', sortOrder: 0, name: '봄 축제 현수막', quantity: 1, unit: '장', unitPrice: 40_000 },
    { id: 'PRI-13', orgId: 'ORG-01', requestId: 'PR-11', sortOrder: 0, name: '안 쓰는 것', quantity: 1, unit: '개', unitPrice: 5_000 },
    { id: 'PRI-11', orgId: 'ORG-01', requestId: 'PR-10', sortOrder: 0, name: '풍선', quantity: 100, unit: '개', unitPrice: 100 },
    { id: 'PRI-12', orgId: 'ORG-01', requestId: 'PR-10', sortOrder: 1, name: '가랜드', quantity: 10, unit: '개', unitPrice: 3_000 },
  ])
}

/** 읽는 자리를 부른다. */
export function ask(db: Db, path: string, who: Viewer | null = MEMBER, options: HarnessOptions = {}) {
  return harness(db, { who, ...options }).request(path)
}

/** 쓰는 자리를 부른다. 몸통은 JSON으로 실린다 — 글을 주면 그대로 실린다(깨진 JSON을 보낼 때). */
export function post(
  db: Db,
  path: string,
  body: unknown,
  who: Viewer | null = MEMBER,
  headers: Record<string, string> = {},
  options: HarnessOptions = {},
) {
  return harness(db, { who, ...options }).request(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

/**
 * 화면이 초안에 쓰는 그 모양 — 목록 칸에는 줄 이름이 줄바꿈으로, 줄의 칸은 `목록.줄.칸`에
 * (`spec/compute.ts`의 itemKey·joinRowIds). 수는 글로 온다. 제출·임시 저장은 이 초안을 그대로
 * 보낸다(payloadScope: purchaseRequestDraft).
 */
export function flatDraft(draft: {
  eventId?: string
  requestId?: string
  title?: string
  neededOn?: string
  priority?: string
  purpose?: string
  items?: Array<Record<string, unknown>>
}): Record<string, unknown> {
  const values: Record<string, unknown> = {}
  for (const key of ['eventId', 'requestId', 'title', 'neededOn', 'priority', 'purpose'] as const) {
    if (draft[key] !== undefined) values[key] = draft[key]
  }
  const rows = draft.items ?? []
  values.items = rows.map((_, index) => `r${index}`).join('\n')
  rows.forEach((row, index) => {
    for (const [key, value] of Object.entries(row)) {
      values[`items.r${index}.${key}`] = typeof value === 'number' ? String(value) : value
    }
  })
  // 화면이 함께 실어 보내는 읽기 전용 칸. 서버는 지나친다 — 부서는 서버가 아는 사실이다.
  values.department = '운영부'
  return values
}

/** 다 채운 품목 하나. 제출이 요구하는 칸이 전부 있다. */
export const FULL_ITEM: Record<string, unknown> = {
  itemName: '박스테이프',
  itemCategory: 'supplies',
  budgetItem: 'B-01',
  purchaseType: 'online',
  quantity: 5,
  unit: '개',
  unitPrice: 2000,
  vendor: '쿠팡',
  productUrl: 'https://example.test/tape',
  option: '투명',
  deliveryNote: '학생회실 앞',
  quoteStatus: 'none',
}

/** 다 채운 요청 하나. */
export const FULL_DRAFT = {
  eventId: 'E-01',
  title: '체육대회 운영 물품',
  neededOn: '2026-08-12',
  priority: 'normal',
  purpose: '행사 당일 운영 및 물품 관리',
  items: [FULL_ITEM, { ...FULL_ITEM, itemName: '유성 마커', quantity: 10, unitPrice: 1500, budgetItem: 'B-02' }],
}
