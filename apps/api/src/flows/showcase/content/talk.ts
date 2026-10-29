import type { MessageEntry } from './types.js'

// 대화방 메시지. 행사 생김 같은 알림 글은 행사를 만들면 서버가 저절로 보낸다.
const FRESHMEN_PLANNING = { event: '새내기 배움터', department: '기획부' }

export const MESSAGES: MessageEntry[] = [
  {
    key: '즉석식품 제안',
    room: { event: '중간고사 간식행사' },
    by: '김바다',
    at: 'D-3 20:05',
    text: '간식은 이걸로 사면 어때요? 신청자 20명 나눠 줄 거예요 https://www.coupang.com/vp/products/7772240113?itemId=21483833503&vendorItemId=88537972751',
  },
  {
    key: '새터 상품 제안',
    room: { event: '새내기 배움터' },
    by: '김바다',
    at: 'D-3 21:45',
    text: '새터 때 쓸 거 이걸로 사면 어때요? https://www.coupang.com/vp/products/9662201908?vendorItemId=95683421752',
  },
  // 기획부방: 부장이 상품 후보를 모으고 부원 셋이 쿠팡 링크를 올린다.
  {
    room: FRESHMEN_PLANNING,
    by: '백승훈',
    at: 'D-1 13:14',
    text: '상품 예산은 1등 15만 원, 2등 7만 원, 3등 3만 원이에요. 1등 상품부터 정해 봐요. 각자 1등 후보 쿠팡 링크 하나씩 올려 주세요',
  },
  {
    room: FRESHMEN_PLANNING,
    by: '강도윤',
    at: 'D-1 13:34',
    text: 'https://link.coupang.com/a/ifDYqTOlIi',
  },
  { room: FRESHMEN_PLANNING, by: '강도윤', at: 'D-1 13:35', text: '요즘 이거 많이 쓰더라고요' },
  {
    room: FRESHMEN_PLANNING,
    by: '윤채원',
    at: 'D-1 13:54',
    text: 'https://link.coupang.com/a/ifD2QmbCeG',
  },
  {
    room: FRESHMEN_PLANNING,
    by: '이지우',
    at: 'D-1 14:09',
    text: 'https://link.coupang.com/a/ifD4uOPn8m',
  },
  { room: FRESHMEN_PLANNING, by: '이지우', at: 'D-1 14:10', text: '가성비 좋아 보여요' },
  {
    room: FRESHMEN_PLANNING,
    by: '윤채원',
    at: 'D-1 14:19',
    text: 'https://link.coupang.com/a/ifEbdZLcDk',
  },
  {
    room: FRESHMEN_PLANNING,
    by: '윤채원',
    at: 'D-1 14:20',
    text: '이것도 괜찮아 보여서 하나 더 올려요',
  },
  {
    room: FRESHMEN_PLANNING,
    by: '백승훈',
    at: 'D-1 14:34',
    text: '첫 번째 걸로 하죠. 예산 안이고 후기도 좋네요',
  },
]
