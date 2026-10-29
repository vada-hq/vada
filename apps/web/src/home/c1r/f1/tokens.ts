// f1(큰 카드 하나에 초점)의 임의 값 모음. 나중에 앱 토큰으로 뽑을 후보라 이름을 붙여 한곳에 둔다.
// 색은 모두 시맨틱 토큰(fg·card·muted·danger·danger-surface·primary-strong)과 범주 색(category-*)이다. 새 hex 없음.

// 바깥 면: 테두리 없는 흰 면. 모서리 크게, 그림자는 바닥과 겨우 떨어질 만큼만(카카오뱅크 홈의 '회색 바탕 위 흰 면').
export const SHELL_RADIUS = 'rounded-[24px]'
export const SHELL_SHADOW =
  'shadow-[0_1px_2px_rgb(16_24_40/0.04),0_6px_20px_-6px_rgb(16_24_40/0.08)]'
export const SHELL_PAD = 'p-5 max-sm:p-4'

// 초점 카드: 면 색만으로 떠오르는 안쪽 카드(테두리·그림자 없음)
export const FOCUS_RADIUS = 'rounded-[20px]'
export const FOCUS_PAD = 'p-5'
// 초점 카드의 큰 사실 글자. 이 컴포넌트에서 가장 큰 글자. 358은 30/36, 넓은 폭(716·977)은 카드가 줄 4개 높이로
// 늘어나 40/48로 키운다(쿠팡이츠 큰 시간처럼 카드 안 초점을 숫자에).
export const FACT_XL =
  'text-[30px] leading-[36px] tracking-[-0.01em] @2xl:text-[40px] @2xl:leading-[48px]'

// 줄: 테두리 없이 면(hover)과 간격만으로 나눈다
export const ROW_RADIUS = 'rounded-[14px]'

// 사람 머리글자 원(아바타)
export const AVATAR_LG = 'size-[40px] text-[15px]' // 초점 카드
export const AVATAR_MD = 'size-[36px] text-[14px]' // 줄

// 묻기 알약: 흰 면, 완전히 둥글게
export const PILL = 'h-10 rounded-full px-4 max-sm:h-11'

// 아바타 색: 범주 색 중 위험 색(빨강 345~12도)과 헷갈릴 수 있는 분홍(4)·주황(6)은 빼고, 서로 가까운 초록 둘(1·3) 중 하나를 뺐다.
// 같은 사람은 같은 색(성으로 고른다). 견본: 이 = 청록, 정 = 연두, 최 = 보라, 김 = 하늘, 박 = 남색.
export const AVATAR_TONES = [
  'bg-category-1-soft text-category-1-strong',
  'bg-category-8-soft text-category-8-strong',
  'bg-category-2-soft text-category-2-strong',
  'bg-category-5-soft text-category-5-strong',
  'bg-category-7-soft text-category-7-strong',
] as const
