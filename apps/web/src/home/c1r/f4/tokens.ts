// f4 '얼굴로 묶기'의 생김새 값. 나중에 앱 토큰으로 뽑을 후보라 이름을 붙여 한곳에 모은다(c1f 지시서 '풀린 규칙').
// 색은 시맨틱 토큰과 기존 범주 색(category-N)만 쓴다. hex는 없다.
// Tailwind가 이 파일의 글자를 읽어 클래스를 만들므로 클래스 이름은 통째로 적는다(조립 금지).

export const F4 = {
  // 카드: 테두리 없이 둥근 흰 면 + 옅게 퍼진 그림자(20px, 그림자 y 8 / 흐림 24 / 퍼짐 -6, 투명도 0.08)
  cardRadius: 'rounded-[20px]',
  cardShadow: 'shadow-[0_1px_2px_rgb(16_24_40/0.04),0_8px_24px_-6px_rgb(16_24_40/0.08)]',
  // 얼굴 무대: 카드 안 회색 면(16px)
  stageRadius: 'rounded-[16px]',
  // 줄: 선 없이 둥근 면(14px), hover에서만 면이 보임
  rowRadius: 'rounded-[14px]',
  // 얼굴 크기: 첫째(가장 급한 일의 사람) 64 / 나머지 52, 358에서는 52 / 44(누르는 자리 최소)
  faceLead: 'size-[52px] @2xl:size-[64px]',
  // 얼굴 자리 높이 = 첫째 얼굴 높이. 얼굴 아래 끝을 맞춰 이름 줄이 한 높이에 오게 한다
  faceSlot: 'h-[52px] @2xl:h-[64px]',
  face: 'size-11 @2xl:size-[52px]',
  // 줄 앞 작은 얼굴 36
  faceRow: 'size-9',
  // 첫째 얼굴의 흰 테 4px + 그림자(무대 위로 떠 보이게)
  faceLeadLift: 'ring-4 ring-card shadow-[0_4px_12px_-2px_rgb(16_24_40/0.18)]',
  // 얼굴 칸 너비(977·716). 358은 칸을 똑같이 나눈다
  faceCol: '@2xl:w-[128px]',
  // 수 배지 20px, 글자 11px(text-xs보다 작은 단계: 원 안에 두 자리까지)
  countBadge: 'size-5 text-[11px] leading-none',
  // 말풍선(물어봄 상태) 10px 모서리
  bubbleRadius: 'rounded-[10px]',
  bubbleShadow: 'shadow-[0_2px_8px_-1px_rgb(16_24_40/0.16)]',
} as const

// 얼굴 바탕·머리글자 색(범주 색 soft/strong 짝). 무대에 나온 차례대로 돌려 쓴다(옆 얼굴끼리 다르게).
// 분홍(4)·주황(6)은 위험 색(빨강)과 헷갈려 뺐다. 머리글자 대비는 모두 4.5:1 이상(strong on soft).
export const FACE_TINTS = [
  'bg-category-5-soft text-category-5-strong', // sky
  'bg-category-2-soft text-category-2-strong', // violet
  'bg-category-3-soft text-category-3-strong', // emerald
  'bg-category-7-soft text-category-7-strong', // indigo
  'bg-category-1-soft text-category-1-strong', // teal
  'bg-category-8-soft text-category-8-strong', // lime
] as const
