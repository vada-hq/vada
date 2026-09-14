import type { DataRow } from '../../data-sources/definitions'

// 이 행사에서 내가 낸 구매 요청. 재정 보드의 카드와 같은 요청이므로 id를 맞춘다 —
// 두 벌이 같은 것에 다른 이름을 붙이면 눌러도 상세가 열리지 않는다.
export const MY_PURCHASE_REQUESTS: Record<string, DataRow[]> = {
  'E-01': [
    {
      id: 'PR-2026-0031',
      code: 'REQ-001',
      title: '체육대회 운영 물품 4종',
      amountNote: '135,000원',
      itemCountNote: '4종',
      requestedAt: '2026-03-01',
      neededOn: '2026-03-15',
      status: '검토 대기',
      statusTone: 'blue',
    },
  ],
}

// 상태별 개수는 목록에서 세지 않는다. 무엇을 어느 칸에 넣는지가 곧 조직의 절차라
// 서버가 안다 — 화면이 세면 절차가 화면에 적히게 된다.
export const MY_PURCHASE_REQUEST_SUMMARY: Record<string, DataRow> = {
  'E-01': {
    scopeNote: '이 행사에서 내가 제출한 구매 요청 · 박해랑 · 운영부 · 부원',
    reviewCount: '1',
    supplementCount: '0',
    approvedCount: '0',
    purchasingCount: '0',
    doneCount: '0',
  },
}


// 보완 요청. 재정부가 이름표 용지 하나에 보완을 걸었다(FIN-REQ-02의 표에서 그
// 품목만 '보완 필요'다 — 두 개발용 응답이 같은 것을 말한다).
export const SUPPLEMENT_REQUESTS: Record<string, DataRow> = {
  'PR-2026-0031': {
    reviewerNote: '요청 담당자 김바다',
    requestedAtNote: '보완 요청일 2026-03-03',
    dueNote: '재제출 권장 기한 2026-03-07',
  },
}

export const SUPPLEMENT_ITEMS: Record<string, DataRow[]> = {
  'PR-2026-0031': [
    {
      id: 'PRI-03',
      title: '보완 품목 — 이름표 용지',
      categoryNote: '제작·인쇄 · 홍보비',
      reason:
        '규격과 인쇄 사양이 누락되었습니다. 정확한 사이즈, 색상, 인쇄 위치를 명시하고 업체 견적서를 첨부해 주세요. 200장 기준 최소 2개 이상 업체 견적서 필요합니다.',
      name: '이름표 용지',
      quantityNote: '200장',
      unitPriceNote: '300원',
      amountNote: '60,000원',
      budgetItem: '행사 운영비',
    },
  ],
}

// 무엇을 다시 묻는지는 그 품목의 구매 유형이 정한다. 제작·인쇄라서 이 넷이고,
// 온라인 구매였다면 판매처와 상품 URL을 물었을 것이다 — 그래서 명세가 아니라
// 여기(서버 대역)에 있다.
export const SUPPLEMENT_INPUT_FIELDS: Record<string, DataRow[]> = {
  'PRI-03': [
    { key: 'size', label: '사이즈·규격', placeholder: '예: A4 (210×297mm)' },
    { key: 'color', label: '색상', placeholder: '예: 단색(검정)' },
    { key: 'printArea', label: '인쇄 위치', placeholder: '예: 전면 단면 인쇄' },
    { key: 'optionQuantity', label: '옵션별 수량', placeholder: '예: 기본형 200매' },
  ],
}

export const SUPPLEMENT_ATTACHMENTS: Record<string, DataRow[]> = {
  'PRI-03': [
    { key: 'designFile', label: '디자인 파일', placeholder: '클릭하여 파일 추가' },
    { key: 'printFile', label: '인쇄 파일', placeholder: '클릭하여 파일 추가' },
    { key: 'quote', label: '견적서', placeholder: '클릭하여 파일 추가' },
  ],
}


// 재정부가 보는 같은 요청. 요청자가 보는 것(finance.purchaseRequestDetail)과 겹치는
// 조각이 있지만 예산 사용 가능액은 이쪽에만 온다.
export const REVIEW_SUMMARIES: Record<string, DataRow> = {
  'PR-2026-0031': {
    code: 'REQ-001',
    status: '보완 요청',
    statusTone: 'yellow',
    amountNote: '135,000원',
    budgetAvailableNote: '950,000원',
    eventName: '2026 소프트웨어융합대학 체육대회',
    department: '운영부',
    requester: '박해랑',
    neededOn: '2026-03-15',
    requestedAt: '2026-03-01',
    purpose: '행사 당일 운영 및 물품 관리',
  },
}

export const REVIEW_ITEMS: Record<string, DataRow[]> = {
  'PR-2026-0031': [
    {
      id: 'PRI-01',
      result: 'approved',
      name: '박스테이프',
      categoryNote: '운영 물품 · 행사 운영비',
      purchaseType: '일반 구매',
      quantityNote: '5개',
      amountNote: '10,000원',
      approvedAmount: '10000',
    },
    {
      id: 'PRI-02',
      result: 'approved',
      name: '생수 500ml',
      categoryNote: '식음료 · 식비',
      purchaseType: '일반 구매',
      quantityNote: '10박스',
      amountNote: '50,000원',
      approvedAmount: '50000',
    },
    {
      id: 'PRI-03',
      result: 'supplement',
      name: '이름표 용지',
      categoryNote: '운영 물품 · 행사 운영비',
      purchaseType: '일반 구매',
      quantityNote: '200장',
      amountNote: '60,000원',
      approvedAmount: '60000',
      // 그림이 이 줄을 보완으로 골라 그렸고 사유도 함께 적혀 있다.
      reviewNote: '수량이 실제 필요량과 맞는지 확인해 주세요',
    },
    {
      id: 'PRI-04',
      result: 'approved',
      name: '유성 마커',
      categoryNote: '운영 물품 · 행사 운영비',
      purchaseType: '일반 구매',
      quantityNote: '10개',
      amountNote: '15,000원',
      approvedAmount: '15000',
    },
  ],
}


// 구매·발주. 묶음 하나가 업체 하나다 - 같은 요청의 품목 넷이 세 업체로 갈렸고,
// 인쇄업체는 아직 주문하지 못했다(품절). 없는 것과 아직 안 한 것은 다르다.
export const PURCHASE_ORDER_SUMMARIES: Record<string, DataRow> = {
  'PR-2026-0031': {
    eventName: '2026 소프트웨어융합대학 체육대회',
    code: 'REQ-001',
    status: '구매 진행 중',
    statusTone: 'blue',
    title: '체육대회 운영 물품 4종',
    requesterNote: '운영부 · 박해랑 · 필요한 날짜 2026-03-15',
    approvedAmountNote: '135,000원',
  },
}

export const PURCHASE_ORDERS: Record<string, DataRow[]> = {
  'PR-2026-0031': [
    {
      id: 'PO-01',
      vendor: '다이소 온라인몰',
      orderNote: '주문일 2026-03-08 · 담당 김바다',
      amountNote: '25,000원',
      items: [
        {
          id: 'POI-01',
          name: '박스테이프',
          quantityNote: '5개',
          amountNote: '10,000원',
          orderStatus: '주문 완료',
          orderStatusTone: 'green',
          deliveryOn: '2026-03-12',
          deliveryStatus: '배송 중',
          deliveryStatusTone: 'blue',
        },
        {
          id: 'POI-02',
          name: '유성 마커',
          quantityNote: '10개',
          amountNote: '15,000원',
          orderStatus: '주문 완료',
          orderStatusTone: 'green',
          deliveryOn: '2026-03-12',
          deliveryStatus: '배송 중',
          deliveryStatusTone: 'blue',
        },
      ],
    },
    {
      id: 'PO-02',
      vendor: '마켓컬리 B2B',
      orderNote: '주문일 2026-03-10 · 담당 김바다',
      amountNote: '50,000원',
      items: [
        {
          id: 'POI-03',
          name: '생수 500ml',
          quantityNote: '10박스',
          amountNote: '50,000원',
          orderStatus: '주문 완료',
          orderStatusTone: 'green',
          deliveryOn: '2026-03-15',
          deliveryStatus: '배송 예정',
          deliveryStatusTone: 'gray',
        },
      ],
    },
    {
      id: 'PO-03',
      vendor: '인쇄업체 A (제작 발주)',
      orderNote: '주문일 — · 담당 —',
      amountNote: '60,000원',
      items: [
        {
          id: 'POI-04',
          name: '이름표 용지 (제작)',
          quantityNote: '200장',
          amountNote: '60,000원',
          orderStatus: '품절·변경 필요',
          orderStatusTone: 'red',
          deliveryOn: '—',
          deliveryStatus: '—',
          deliveryStatusTone: 'red',
        },
      ],
    },
  ],
}


// 결제·증빙. 묶음 하나가 결제 하나이고, 연결된 품목과 증빙 서류가 그 결제와 함께
// 온다 - 따로 있는 것이 아니라 그 결제의 일부다.
//
// 실결제 합계가 승인 금액보다 2,500원 많다. 초과를 어떻게 처리할지는 조직의 재정
// 규칙이라 이 화면은 사실만 적고 막지 않는다(사람이 확인했다).
export const PAYMENT_EVIDENCE_SUMMARIES: Record<string, DataRow> = {
  'PR-2026-0031': {
    eventName: '2026 소프트웨어융합대학 체육대회',
    code: 'REQ-001',
    status: '증빙 정리 중',
    statusTone: 'blue',
    title: '체육대회 운영 물품 4종',
    requesterNote: '운영부 · 박해랑',
    approvedAmountNote: '135,000원',
    paidAmountNote: '137,500원',
    // 증빙 둘이 비어 있으므로 아직 끝낼 수 없다. 무엇이 '다 됐다'인지는 서버가 안다.
    completeBlockedNote: '증빙 서류 2건이 아직 등록되지 않았습니다.',
  },
}

export const PAYMENT_EVIDENCES: Record<string, DataRow[]> = {
  'PR-2026-0031': [
    {
      id: 'PAY-01',
      vendor: '다이소 온라인몰',
      paidNote: '결제일 2026-03-08 · 결제자 김바다 · 법인카드',
      amountNote: '승인 25,000원 → 실결제 24,500원',
      gapNote: '실결제액이 승인액보다 500원 적음',
      items: [
        { id: 'POI-01', name: '박스테이프' },
        { id: 'POI-02', name: '유성 마커' },
      ],
      documents: [
        { id: 'DOC-01', label: '영수증', status: '등록 완료', statusTone: 'green' },
        { id: 'DOC-02', label: '거래명세서', status: '등록 완료', statusTone: 'green' },
      ],
    },
    {
      id: 'PAY-02',
      vendor: '마켓컬리 B2B',
      paidNote: '결제일 2026-03-10 · 결제자 김바다 · 계좌이체',
      amountNote: '승인 50,000원 → 실결제 50,000원',
      items: [{ id: 'POI-03', name: '생수 500ml' }],
      documents: [
        { id: 'DOC-03', label: '영수증', status: '누락', statusTone: 'red' },
        { id: 'DOC-04', label: '거래명세서', status: '등록 완료', statusTone: 'green' },
      ],
    },
    {
      id: 'PAY-03',
      vendor: '인쇄업체 A',
      paidNote: '결제일 2026-03-13 · 결제자 김바다 · 계좌이체',
      amountNote: '승인 60,000원 → 실결제 63,000원',
      gapNote: '견적서 대비 최종 납품가 3,000원 초과',
      items: [{ id: 'POI-04', name: '이름표 용지 (제작)' }],
      documents: [
        { id: 'DOC-05', label: '견적서', status: '등록 완료', statusTone: 'green' },
        { id: 'DOC-06', label: '거래명세서', status: '등록 완료', statusTone: 'green' },
        { id: 'DOC-07', label: '세금계산서', status: '누락', statusTone: 'red' },
      ],
    },
  ],
}

// ── 조직 전체 재정(FIN-00 · FIN-00B · FIN-LEDGER-01) ────────────────────────
//
// **행사 하나의 재정과 다른 물건이다.** event.financeSummary는 eventId를 받아 그
// 행사만 세고, 이쪽은 학생회 전체를 센다.

export const ORG_FINANCE_OVERVIEW: DataRow = {
  termNote: '2026년 1학기',
  asOfNote: '2026.07.18 기준',
  totalBudget: '30,000,000원',
  totalBudgetNote: '학생회비 외 1건',
  spent: '12,400,000원',
  spentNote: '결제가 완료된 9건',
  planned: '3,100,000원',
  plannedNote: '결제 예정 3건',
  available: '14,500,000원',
  availableNote: '새로 사용할 수 있는 금액',
  executionNote: '전체 예산 집행률 41.3%',
  plannedIncludedNote: '지출 예정 포함 51.7%',
  // 막대의 두 마디. 이어 붙는 몫이라 41.3 + 10.4 = 51.7이다.
  spentPercent: 41.3,
  plannedPercent: 10.4,
}

// 나누는 축이 줄의 뜻을 통째로 바꾼다. 행사별은 디자인이 그린 그대로이고,
// 부서별은 그려지지 않았으므로 조직도의 부서로 서버 대역을 만든다.
export const ORG_BREAKDOWN: Record<string, DataRow[]> = {
  event: [
    { id: 'E-01', name: '체육대회', budget: '5,000,000원', spent: '2,100,000원', planned: '600,000원', available: '2,300,000원', executionPercent: 54 },
    { id: 'E-02', name: '신입생 환영 행사', budget: '3,000,000원', spent: '1,800,000원', planned: '200,000원', available: '1,000,000원', executionPercent: 67 },
    { id: 'E-03', name: '가을 축제', budget: '8,000,000원', spent: '0원', planned: '0원', available: '8,000,000원', executionPercent: 0 },
    // **행사에 안 딸린 돈이 모이는 줄.** 사람이 정했다(2026-09-07): 그림에 그렸다 —
    // 빼면 그 돈이 축에서 사라져 사람이 어디로 갔는지 물을 자리가 생긴다.
    { id: 'ongoing', name: '운영 (상시)', budget: '4,000,000원', spent: '1,200,000원', planned: '300,000원', available: '2,500,000원', executionPercent: 0 },
  ],
  department: [
    { id: 'D-01', name: '기획부', budget: '4,000,000원', spent: '1,500,000원', planned: '300,000원', available: '2,200,000원', executionPercent: 38 },
    { id: 'D-02', name: '홍보부', budget: '3,500,000원', spent: '2,100,000원', planned: '400,000원', available: '1,000,000원', executionPercent: 60 },
    { id: 'D-04', name: '운영부', budget: '2,000,000원', spent: '600,000원', planned: '0원', available: '1,400,000원', executionPercent: 30 },
  ],
}

export const ORG_PROOF_SUMMARY: DataRow = {
  completed: '6건',
  supplement: '1건',
  unregistered: '2건',
  totalNote: '26건',
}

// 장부 한 벌. FIN-00의 '최근 지출 내역'과 FIN-LEDGER-01의 '사용 내역'이 **같은
// 장부**를 다르게 자른 것이다 — 두 벌로 적으면 같은 지출에 다른 이름이 붙는다
// (재정 보드가 PR-01과 PR-2026-0031로 갈렸던 그 자리다).
//
// **와이어프레임이 두 화면에 서로 다른 줄을 그렸다.** 같은 07.17을 FIN-00은
// '현수막 제작 180,000원'으로, LEDGER-01은 '케이블 커버 6m 외 1건 84,000원'으로
// 그린다. 대조기는 그린 글을 그대로 요구하므로 둘 다 이 한 벌에 담고, 어느 줄이
// 어느 그림의 것인지만 drawnOn에 적는다.
export const ORG_LEDGER: Array<{
  month: string
  drawnOn: 'FIN-00' | 'FIN-LEDGER-01'
  eventId: string
  departmentId: string
  budgetItemId: string
  row: DataRow
}> = [
  { month: '2026-07', drawnOn: 'FIN-LEDGER-01', eventId: 'E-01', departmentId: 'D-04', budgetItemId: 'BI-01', row: { id: 'LG-01', date: '07.17', title: '케이블 커버 6m 외 1건', context: '2026 체육대회', department: '운영부', budgetItem: '안전·설비', amountNote: '84,000원', proof: '완료', proofTone: 'green' } },
  { month: '2026-07', drawnOn: 'FIN-LEDGER-01', eventId: 'E-01', departmentId: 'D-04', budgetItemId: 'BI-02', row: { id: 'LG-02', date: '07.16', title: '안전 안내 표지 제작', context: '2026 체육대회', department: '운영부', budgetItem: '인쇄·제작', amountNote: '45,000원', proof: '누락', proofTone: 'red' } },
  { month: '2026-07', drawnOn: 'FIN-LEDGER-01', eventId: 'E-01', departmentId: 'D-02', budgetItemId: 'BI-02', row: { id: 'LG-03', date: '07.15', title: '현수막 제작 (본부석)', context: '2026 체육대회', department: '홍보부', budgetItem: '인쇄·제작', amountNote: '120,000원', proof: '완료', proofTone: 'green' } },
  { month: '2026-07', drawnOn: 'FIN-LEDGER-01', eventId: 'E-01', departmentId: 'D-04', budgetItemId: 'BI-03', row: { id: 'LG-04', date: '07.14', title: '진행요원 교육 다과', context: '2026 체육대회', department: '운영부', budgetItem: '회의·운영비', amountNote: '32,000원', proof: '완료', proofTone: 'green' } },
  { month: '2026-07', drawnOn: 'FIN-LEDGER-01', eventId: 'E-02', departmentId: 'D-01', budgetItemId: 'BI-04', row: { id: 'LG-05', date: '07.11', title: '웰컴 키트 견본 구매', context: '신입생 환영 행사', department: '기획부', budgetItem: '물품 구매', amountNote: '58,000원', proof: '확인 중', proofTone: 'yellow' } },
  { month: '2026-07', drawnOn: 'FIN-LEDGER-01', eventId: 'E-01', departmentId: 'D-04', budgetItemId: 'BI-01', row: { id: 'LG-06', date: '07.10', title: '구급약품 세트', context: '2026 체육대회', department: '운영부', budgetItem: '안전·설비', amountNote: '67,000원', proof: '완료', proofTone: 'green' } },
  { month: '2026-07', drawnOn: 'FIN-LEDGER-01', eventId: '', departmentId: 'D-04', budgetItemId: 'BI-03', row: { id: 'LG-07', date: '07.08', title: '정기 운영회의 간식', context: '운영 (상시)', department: '운영부', budgetItem: '회의·운영비', amountNote: '21,000원', proof: '완료', proofTone: 'green' } },
  { month: '2026-07', drawnOn: 'FIN-LEDGER-01', eventId: 'E-02', departmentId: 'D-02', budgetItemId: 'BI-05', row: { id: 'LG-08', date: '07.05', title: 'SNS 광고 집행', context: '신입생 환영 행사', department: '홍보부', budgetItem: '홍보비', amountNote: '90,000원', proof: '누락', proofTone: 'red' } },
  { month: '2026-07', drawnOn: 'FIN-LEDGER-01', eventId: '', departmentId: 'D-04', budgetItemId: 'BI-06', row: { id: 'LG-09', date: '07.03', title: '사무용품 (A4·토너)', context: '운영 (상시)', department: '운영부', budgetItem: '사무·비품', amountNote: '43,000원', proof: '완료', proofTone: 'green' } },
  { month: '2026-07', drawnOn: 'FIN-LEDGER-01', eventId: '', departmentId: 'D-05', budgetItemId: 'BI-06', row: { id: 'LG-10', date: '07.01', title: '회계 장부 바인더', context: '운영 (상시)', department: '재정부', budgetItem: '사무·비품', amountNote: '15,000원', proof: '완료', proofTone: 'green' } },
  { month: '2026-07', drawnOn: 'FIN-00', eventId: 'E-01', departmentId: 'D-02', budgetItemId: 'BI-02', row: { id: 'LG-11', date: '07.17', title: '현수막 제작', context: '체육대회', department: '홍보부', budgetItem: '인쇄·제작', amountNote: '180,000원', proof: '완료', proofTone: 'green' } },
  { month: '2026-07', drawnOn: 'FIN-00', eventId: 'E-01', departmentId: 'D-04', budgetItemId: 'BI-04', row: { id: 'LG-12', date: '07.16', title: '생수 구매', context: '체육대회', department: '운영부', budgetItem: '물품 구매', amountNote: '120,000원', proof: '확인 중', proofTone: 'yellow' } },
  { month: '2026-07', drawnOn: 'FIN-00', eventId: 'E-02', departmentId: 'D-01', budgetItemId: 'BI-02', row: { id: 'LG-13', date: '07.15', title: '명찰 인쇄', context: '신입생 환영 행사', department: '기획부', budgetItem: '인쇄·제작', amountNote: '75,000원', proof: '누락', proofTone: 'red' } },
  // 달을 바꾸면 정말 다른 것이 오는지 보려고 둔 개발용 줄이다(그려지지 않았다).
  { month: '2026-06', drawnOn: 'FIN-LEDGER-01', eventId: '', departmentId: 'D-01', budgetItemId: 'BI-03', row: { id: 'LG-14', date: '06.28', title: '신입생 간담회 다과', context: '운영 (상시)', department: '기획부', budgetItem: '회의·운영비', amountNote: '38,000원', proof: '완료', proofTone: 'green' } },
  { month: '2026-06', drawnOn: 'FIN-LEDGER-01', eventId: 'E-02', departmentId: 'D-02', budgetItemId: 'BI-02', row: { id: 'LG-15', date: '06.20', title: '홍보 포스터 인쇄', context: '신입생 환영 행사', department: '홍보부', budgetItem: '인쇄·제작', amountNote: '52,000원', proof: '완료', proofTone: 'green' } },
]

// 고르지 않았으면 이번 달이다 — 그 판단은 서버가 한다(명세가 '이번 달'을 말할
// 어휘가 없다. 백로그에 적었다).
export const DEFAULT_LEDGER_MONTH = '2026-07'

export const LEDGER_MONTHS: Record<string, { label: string; total: number }> = {
  '2026-07': { label: '2026년 7월', total: 42 },
  '2026-06': { label: '2026년 6월', total: 31 },
}

export const LEDGER_SUMMARY: Record<string, DataRow> = {
  '2026-07': { termTotal: '3,842,000원', monthLabel: '7월 지출', monthTotal: '1,286,000원', proofDone: '42건 중 37건', proofMissing: '5건' },
  '2026-06': { termTotal: '3,842,000원', monthLabel: '6월 지출', monthTotal: '968,000원', proofDone: '31건 중 31건', proofMissing: '0건' },
}

// **역할 이름이 여기 있다.** 명세도 화면도 이 문장을 들지 않는다.
export const LEDGER_HANDLING_NOTE =
  '증빙 처리와 정산은 재정부·회장단이 각 행사 재정의 ‘증빙 필요’ 단계(결제·증빙 정리)에서 진행합니다.'

// 결제가 끝난 것과 아직 나갈 것. **증빙 상태로는 가를 수 없다** — 증빙은 돈이
// 나간 뒤의 절차이고 이것은 돈이 나갔는지의 물음이다.
export const LEDGER_STAGE: Record<string, string> = {
  'LG-05': 'planned',
  'LG-08': 'planned',
  'LG-14': 'planned',
}

// 무엇을 보고 있는지는 **서버가 완성한 문장**이 말한다. 그림에 갈피가 없으므로
// 이 줄이 유일한 단서다 — 화면이 지어내면 그 말이 화면의 것이 된다.
export const LEDGER_STAGE_NOTE: Record<string, string> = {
  spent: '결제 완료',
  planned: '결제 예정',
}

// 예산 편성 한 벌(FIN-PLAN-01). 값은 design(600:2)이 그린 그대로다 — 수입 둘, 상시
// 항목 넷, 행사 하나의 항목 둘. **금액은 수다** — 자릿점은 화면이 붙인다(합계를 화면이
// 다시 셈하는 자리라 글로 줄 수 없다). 부서는 org.departments의 값이고 행사는
// finance.budgetEvents의 값이다. 갓 만든 학생회는 기간도 줄도 없이 온다 — 그 모습은
// 서버 검사가 잰다(apps/api/src/finance/budget-plan.test.ts).
export const BUDGET_PLAN_DRAFT: DataRow = {
  periodStart: '2026-03-01',
  periodEnd: '2026-08-31',
  sources: [
    { id: 'BS-01', sourceName: '학생회비', sourceAmount: 24_000_000 },
    { id: 'BS-02', sourceName: '학교 지원금', sourceAmount: 6_000_000 },
  ],
  items: [
    { id: 'BI-11', itemName: '운영비', itemAmount: 3_000_000, itemDepartment: 'D-01', itemDepartmentName: '기획부' },
    { id: 'BI-12', itemName: '홍보비', itemAmount: 2_500_000, itemDepartment: 'D-02', itemDepartmentName: '홍보부' },
    { id: 'BI-13', itemName: '안전·설비', itemAmount: 1_800_000, itemDepartment: 'D-01', itemDepartmentName: '기획부' },
    { id: 'BI-14', itemName: '비품', itemAmount: 1_200_000 },
  ],
  eventItems: [
    { id: 'BI-21', eventItemEvent: 'E-01', eventItemEventName: '2026 봄 축제', eventItemName: '물품비', eventItemAmount: 1_200_000, eventItemDepartment: 'D-01', eventItemDepartmentName: '기획부' },
    { id: 'BI-22', eventItemEvent: 'E-01', eventItemEventName: '2026 봄 축제', eventItemName: '홍보비', eventItemAmount: 800_000, eventItemDepartment: 'D-01', eventItemDepartmentName: '기획부' },
  ],
}

// 고치려는 구매 요청 한 건. 품목 넷과 수량·단가는 디자인이 그린 그대로다 —
// 5×2000=10,000, 10×5000=50,000, 200×300=60,000, 10×1500=15,000이고 합이
// 135,000이다. 디자인의 셈이 맞는지 여기서 확인된다.
//
// 카테고리·예산 항목·구매 유형은 디자인이 넷 다 빈 드롭다운으로 그렸다. 채워
// 넣으면 그림에 없는 사실이 되므로 빈 채로 둔다.
export const PURCHASE_REQUEST_ITEMS: DataRow[] = [
  {
    itemName: '박스테이프',
    itemCategory: '',
    budgetItem: '',
    purchaseType: '',
    quantity: 5,
    unit: '개',
    unitPrice: 2000,
    quoteStatus: 'none',
  },
  {
    itemName: '생수 500ml',
    itemCategory: '',
    budgetItem: '',
    purchaseType: '',
    quantity: 10,
    unit: '박스',
    unitPrice: 5000,
    quoteStatus: 'none',
  },
  {
    itemName: '이름표 용지',
    itemCategory: '',
    budgetItem: '',
    purchaseType: '',
    quantity: 200,
    unit: '장',
    unitPrice: 300,
    quoteStatus: 'none',
  },
  {
    itemName: '유성 마커',
    itemCategory: '',
    budgetItem: '',
    purchaseType: '',
    quantity: 10,
    unit: '개',
    unitPrice: 1500,
    quoteStatus: 'none',
  },
]

// 아직 아무것도 적히지 않은 요청. 비어 있지 않은 것이 둘 있다 — 작성자의 소속
// 부서와 품목 한 줄이다. 부서는 서버가 이미 알고, 품목 한 줄은 minItems가 정한다.
// **아직 안 적은 수는 오지 않는다.** 빈 글('')로 주면 같은 조각이 때로 수, 때로
// 글이 되고 — 값의 종류를 도출해 보니 저장소에서 그런 조각이 이 둘뿐이었다.
// 0은 값이므로(0개·0원) 빈 것과 0을 글로 섞으면 둘을 가를 수 없다.
export const EMPTY_PURCHASE_REQUEST_ITEM: DataRow = {
  itemName: '',
  itemCategory: '',
  budgetItem: '',
  purchaseType: '',
  unit: '',
  quoteStatus: 'none',
}

export const PURCHASE_REQUEST_DRAFTS: Record<string, DataRow> = {
  'PR-2026-0031': {
    title: '체육대회 운영 물품',
    department: '운영부',
    neededOn: '2026-08-12',
    priority: 'normal',
    purpose: '',
    items: PURCHASE_REQUEST_ITEMS,
  },
}

export const NEW_PURCHASE_REQUEST: DataRow = {
  title: '',
  department: '운영부',
  neededOn: '',
  priority: '',
  purpose: '',
  items: [EMPTY_PURCHASE_REQUEST_ITEM],
}


// 구매 요청 한 건의 상세. 값은 전부 design(30:822)이 그린 그대로다.
//
// 자릿점과 단위가 찍힌 글로 오는 것에 주의한다 — 이 화면은 아무것도 셈하지 않는다.
// 이미 일어난 일의 금액이라 서버의 것이다(FIN-REQ-01과 반대다).
export const PURCHASE_REQUEST_DETAILS: Record<string, DataRow> = {
  'PR-2026-0031': {
    code: 'REQ-001',
    status: '보완 요청',
    statusTone: 'yellow',
    title: '체육대회 운영 물품 4종',
    amountNote: '135,000원',
    eventName: '2026 소프트웨어융합대학 체육대회',
    department: '운영부',
    requester: '박해랑',
    neededOn: '2026-03-15',
    stage: 'review',
  },
}

export const PURCHASE_REQUEST_RESULTS: Record<string, DataRow[]> = {
  'PR-2026-0031': [
    {
      id: 'it-1',
      name: '박스테이프',
      quantityNote: '5개',
      amountNote: '10,000원',
      result: '승인',
      resultTone: 'green',
      note: '—',
    },
    {
      id: 'it-2',
      name: '생수 500ml',
      quantityNote: '10박스',
      amountNote: '50,000원',
      result: '승인',
      resultTone: 'green',
      note: '—',
    },
    {
      id: 'it-3',
      name: '이름표 용지',
      quantityNote: '200장',
      amountNote: '60,000원',
      result: '보완 필요',
      resultTone: 'yellow',
      note: '규격·수량 확인 후 견적서 재첨부 요망',
    },
    {
      id: 'it-4',
      name: '유성 마커',
      quantityNote: '10개',
      amountNote: '15,000원',
      result: '승인',
      resultTone: 'green',
      note: '—',
    },
  ],
}

// 시간순으로 온다. 화면이 다시 정렬하지 않는다.
export const PURCHASE_REQUEST_HISTORY: Record<string, DataRow[]> = {
  'PR-2026-0031': [
    { id: 'h-1', action: '제출', actorNote: '박해랑 · 2026-03-01 10:05' },
    { id: 'h-2', action: '재정부 검토 시작', actorNote: '김바다 · 2026-03-02 09:30' },
    { id: 'h-3', action: '보완 요청 발송', actorNote: '김바다 · 2026-03-03 14:00' },
  ],
}
