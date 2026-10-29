import type { DirectExpenseEntry, FinanceContent, PurchaseEntry } from './types.js'

// 계좌, 회계 기간, 예산, 수입, 구매 요청, 지출. 재정 기록은 재정부장이 적는다(재정 권한은 재정부에만 있다).
const MIDTERM = '중간고사 간식행사'
const FRESHMEN = '새내기 배움터'

export const FINANCE: FinanceContent = {
  by: '황성욱',
  periodAt: 'D-3 19:18',
  account: {
    at: 'D-3 19:19',
    name: '학생회 계좌',
    bank: '바다은행',
    holder: '김바다',
    number: '02-1234-1234',
    type: 'main',
  },
  budgetItems: [
    {
      at: 'D-3 19:20',
      event: MIDTERM,
      purpose: '행사 운영비',
      amount: 100_000,
      type: 'expense',
      department: '기획부',
    },
    {
      at: 'D-3 19:20',
      event: MIDTERM,
      purpose: '홍보비',
      amount: 50_000,
      type: 'expense',
      department: '홍보부',
    },
    {
      at: 'D-3 19:20',
      event: MIDTERM,
      purpose: '식비',
      amount: 300_000,
      type: 'expense',
      department: '기획부',
    },
    {
      at: 'D-3 21:12',
      event: FRESHMEN,
      purpose: '행사 운영비',
      amount: 1_500_000,
      type: 'expense',
      department: '기획부',
    },
    {
      at: 'D-3 21:12',
      event: FRESHMEN,
      purpose: '홍보비',
      amount: 200_000,
      type: 'expense',
      department: '홍보부',
    },
    {
      at: 'D-3 21:12',
      event: FRESHMEN,
      purpose: '식비',
      amount: 2_000_000,
      type: 'expense',
      department: '기획부',
    },
    {
      at: 'D-3 21:23',
      event: null,
      purpose: '학생회비',
      amount: 5_000_000,
      type: 'income',
      department: null,
    },
    {
      at: 'D-3 21:23',
      event: null,
      purpose: '학과 지원금',
      amount: 2_000_000,
      type: 'income',
      department: null,
    },
    {
      at: 'D-1 21:34',
      event: '기말고사 간식행사',
      purpose: '간식비',
      amount: 300_000,
      type: 'expense',
      department: '기획부',
    },
    {
      at: 'D-1 21:35',
      event: '학과 체육대회',
      purpose: '대관·상품',
      amount: 500_000,
      type: 'expense',
      department: '기획부',
    },
  ],
  incomes: [
    {
      at: 'D-2 09:40',
      source: 'fee',
      amount: 5_000_000,
      receivedOn: 'D-2',
      budget: { event: null, purpose: '학생회비' },
      toAccount: true,
    },
  ],
}

const MIDTERM_FOOD = { event: MIDTERM, purpose: '식비' }

export const PURCHASES: PurchaseEntry[] = [
  {
    title: '간식행사 과자 구입',
    event: MIDTERM,
    by: '김바다',
    at: 'D-3 19:23',
    body: '신청자 20명에게 나눠 줄 간식',
    items: [
      { name: '과자 선물세트', quantity: 20, estimatedUnitPrice: 5_000, estimatedShippingFee: 0 },
    ],
    decision: {
      by: '황성욱',
      at: 'D-3 19:24',
      approve: [{ item: '과자 선물세트', amount: 100_000, budget: MIDTERM_FOOD }],
    },
    shipment: {
      by: '김바다',
      at: 'D-3 19:25',
      carrier: 'kr.coupangls',
      trackingNumber: '123456789012',
    },
    expense: {
      by: '황성욱',
      at: 'D-3 19:26',
      vendor: '쿠팡',
      description: '간식행사 과자 구입',
      reason: '중간고사 기간 간식행사 신청자 20명에게 나눠 줄 과자',
      paidOn: 'D-3',
      method: 'card',
      fromAccount: true,
      evidenceAt: 'D-3 20:50',
    },
  },
  {
    title: '간식행사 즉석식품 구입',
    event: MIDTERM,
    by: '김바다',
    at: 'D-3 20:06',
    body: '간식은 이걸로 사면 어때요? 신청자 20명 나눠 줄 거예요 https://www.coupang.com/vp/products/7772240113?itemId=21483833503&vendorItemId=88537972751',
    fromMessage: '즉석식품 제안',
    items: [
      {
        name: '오즈키친 오뚜기 포크빈달루, 180g, 3개',
        quantity: 1,
        link: 'https://www.coupang.com/vp/products/7772240113?itemId=21483833503&vendorItemId=88537972751',
        estimatedUnitPrice: 6_270,
      },
    ],
    decision: {
      by: '황성욱',
      at: 'D-3 20:07',
      approve: [
        { item: '오즈키친 오뚜기 포크빈달루, 180g, 3개', amount: 6_270, budget: MIDTERM_FOOD },
      ],
    },
    expense: {
      by: '황성욱',
      at: 'D-3 20:08',
      vendor: '쿠팡',
      description: '간식행사 즉석식품 구입',
      reason: '간식행사 운영진 야식(대화에서 제안)',
      paidOn: 'D-3',
      method: 'card',
      fromAccount: true,
      fromMessage: '즉석식품 제안',
      evidenceAt: 'D-3 20:51',
    },
  },
  {
    title: '새터 조별 레크레이션 상품 구매',
    event: FRESHMEN,
    by: '백승훈',
    at: 'D-1 10:42',
    body: '새터 고기 ㄱㄱ',
    neededBy: 'D+1',
    fromMessage: '새터 상품 제안',
    items: [
      {
        name: '조별 레크레이션 상품',
        quantity: 12,
        options: '12조',
        link: 'https://www.coupang.com/vp/products/9662201908?vendorItemId=95683421752',
      },
    ],
    decision: {
      by: '황성욱',
      at: 'D-1 10:43',
      approve: [
        {
          item: '조별 레크레이션 상품',
          amount: 50_000,
          budget: { event: FRESHMEN, purpose: '식비' },
        },
      ],
    },
    shipment: {
      by: '황성욱',
      at: 'D-1 12:28',
      carrier: 'kr.lotte',
      trackingNumber: '412122020063',
    },
  },
  {
    title: '기말고사 간식 구매',
    event: '기말고사 간식행사',
    by: '백승훈',
    at: 'D-1 21:37',
    body: '신청자 60명에게 나눠 줄 간식 세트',
    neededBy: 'D+1',
    items: [
      {
        name: '간식 세트(컵라면·음료)',
        quantity: 60,
        estimatedUnitPrice: 5_000,
        estimatedShippingFee: 0,
      },
    ],
  },
]

// 요청 없이 적은 지출. 증빙이 없어 재정 화면에 '증빙 없음'으로 남는다.
export const DIRECT_EXPENSES: DirectExpenseEntry[] = [
  {
    by: '황성욱',
    at: 'D-1 21:46',
    vendor: '이마트24 미래관점',
    description: '{{D-1 주}} 운영진 회의 다과',
    amount: 43_730,
    reason: '운영진 회의 다과',
    paidOn: 'D-1',
    method: 'card',
    fromAccount: false,
    event: null,
    budget: null,
  },
]
