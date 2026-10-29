import type { PurchaseItemBrief, PurchaseRequestSummary, SettlementResponse } from '@vada/contracts'

// 구매 칸반 견본: 와이어프레임 PUR-00의 예시 요청을 목록 응답 모양으로 옮겼다.
const E1 = '0199d1a0-0000-7000-8000-0000000000e1'
let seq = 0
const id = () => `0199d1a0-0000-7000-8000-${String(++seq).padStart(12, '0')}`
type ItemSeed = [string, number, number | null, PurchaseItemBrief['status'], boolean?, boolean?]
type Head = [title: string, dept: string, who: string, status: PurchaseRequestSummary['status']]
function req(
  [title, dept, who, status]: Head,
  items: ItemSeed[],
  extra: Partial<PurchaseRequestSummary> = {},
): PurchaseRequestSummary {
  const briefs: PurchaseItemBrief[] = items.map(([name, quantity, estimate, s, paid, shipped]) => ({
    id: id(),
    name,
    quantity,
    estimate,
    amount: s === 'pending' ? null : estimate,
    status: s,
    paid: paid ?? false,
    shipped: shipped ?? false,
  }))
  const approved = briefs.filter(b => b.status === 'approved')
  const total = briefs.reduce((sum, b) => sum + (b.estimate ?? 0), 0)
  return {
    id: id(),
    title,
    status,
    requestedBy: { id: who === '박해랑' ? 'm1' : 'm9', name: who },
    neededBy: '2026-11-14',
    itemCount: briefs.length,
    createdAt: '2026-10-28T03:00:00.000Z',
    event: { id: E1, name: '2026 소프트웨어융합대학 체육대회' },
    payable: false,
    estimate: { subtotal: total, total },
    bodyPreview: null,
    progress: {
      decided: briefs.every(b => b.status !== 'pending'),
      paid: approved.length > 0 && approved.every(b => b.paid),
      partlyPaid: approved.some(b => b.paid) && !approved.every(b => b.paid),
      hasShipment: briefs.some(b => b.shipped),
    },
    itemBriefs: briefs,
    requesterDepartments: [dept],
    ...extra,
  }
}

export const REQUESTS: PurchaseRequestSummary[] = [
  req(
    ['체육대회 운영 물품 4종', '운영부', '박해랑', 'pending'],
    [
      ['생수 500ml', 10, 50000, 'pending'],
      ['이름표 용지', 200, 60000, 'pending'],
      ['박스테이프', 5, 10000, 'pending'],
      ['종이컵', 4, 15000, 'pending'],
    ],
    { bodyPreview: '행사 당일 운영 및 물품 관리', neededBy: '2026-11-15' },
  ),
  req(
    ['현수막 A형 제작', '홍보부', '이홍보', 'rejected'],
    [['메인 현수막', 1, 180000, 'rejected']],
    {
      neededBy: '2026-11-14',
    },
  ),
  req(
    ['운영진 단체 티셔츠', '홍보부', '이홍보', 'partial'],
    [
      ['운영 티셔츠', 30, 120000, 'cancelled'],
      ['운영 티셔츠(재주문)', 30, 120000, 'approved'],
    ],
    { neededBy: '2026-11-13' },
  ),
  req(
    ['배너 거치대', '운영부', '박해랑', 'approved'],
    [['배너 거치대', 4, 80000, 'approved', false, true]],
    { bodyPreview: '행사장 배너 설치용 거치대', neededBy: '2026-11-12' },
  ),
  req(
    ['행사 진행요원 조끼', '운영부', '박해랑', 'approved'],
    [['진행요원 조끼', 15, 90000, 'approved', false, true]],
    { bodyPreview: '진행요원 식별용 조끼' },
  ),
  req(
    ['행사 장비 대여·용역', '운영부', '박해랑', 'approved'],
    [
      ['앰프·스피커 세트 대여', 1, 150000, 'approved'],
      ['무전기 세트 대여', 6, 48000, 'approved'],
      ['무대 설치·철거 용역', 1, 300000, 'approved'],
      ['그늘막 천막(3x3m) 대여', 2, 80000, 'approved'],
    ],
    { bodyPreview: '행사 당일 음향·그늘막·무전 장비 대여와 무대 설치 용역' },
  ),
  req(
    ['무선 마이크 세트 구매', '운영부', '박해랑', 'rejected'],
    [['무선 마이크 세트', 2, 160000, 'rejected']],
    { bodyPreview: '행사 진행 안내와 시상식 사회용 무선 마이크' },
  ),
  req(
    ['체육대회 사전 준비 물품', '운영부', '박해랑', 'approved'],
    [
      ['안내 표지판', 5, 75000, 'approved', true],
      ['구급함 보충 용품', 1, 40000, 'approved', true],
      ['운영본부 접이식 테이블', 2, 90000, 'approved', true],
    ],
    { bodyPreview: '행사 2주 전 미리 준비한 운영 물품', neededBy: '2026-11-05' },
  ),
  req(
    ['운영본부 사무용품', '운영부', '박해랑', 'approved'],
    [
      ['네임펜 세트', 4, 12000, 'approved'],
      ['A4 용지', 3, 15000, 'approved'],
    ],
    { bodyPreview: '운영본부 접수대에서 쓸 사무용품' },
  ),
  req(
    ['디자인 도구 구독료 (3~6월)', '홍보부', '이홍보', 'approved'],
    [['디자인 도구 구독료', 4, 105600, 'approved', true]],
    { event: null },
  ),
]

export const boardSettlement: SettlementResponse = {
  settlement: {
    budget: {
      expense: 3000000,
      income: 0,
      items: [
        {
          id: 'b1',
          type: 'expense',
          purpose: '행사 운영비',
          amount: 1500000,
          actual: 520000,
          committed: 775000,
          available: 205000,
        },
        {
          id: 'b2',
          type: 'expense',
          purpose: '홍보비',
          amount: 800000,
          actual: 260000,
          committed: 120000,
          available: 420000,
        },
        {
          id: 'b3',
          type: 'expense',
          purpose: '식비',
          amount: 700000,
          actual: 170000,
          committed: 0,
          available: 530000,
        },
      ],
    },
    actual: { expense: 950000, fee: 0, income: 0, depositCount: 0, refundPendingCount: 0 },
    difference: 2050000,
    remaining: [],
    settled: false,
    completed: false,
    approvals: [],
  },
}
