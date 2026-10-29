// f6(날짜 머리 축)의 임의 값 모음. 나중에 앱 토큰으로 뽑을 후보라 이름을 붙여 한곳에 둔다.
// 색은 모두 시맨틱 토큰(fg·fg-secondary·fg-tertiary·fg-muted·card·muted·border·border-subtle·surface-subtle·
// primary-strong·danger)과 범주 색(category-*)이다. 새 hex 없음.

// 바깥 면: 테두리 하나인 흰 면. 모서리만 앱 카드보다 조금 크게.
export const SHELL_RADIUS = 'rounded-[16px]'

// 글자 4단계(큰 날짜 숫자 / 구역 이름 / 일 제목 / 보조). 358은 날짜 숫자만 한 단계 작게.
export const DATE_NUMBER = 'text-[22px] leading-[28px] @2xl:text-[30px] @2xl:leading-[34px]'
export const SECTION_TITLE = 'text-[17px] leading-[24px]'
export const ROW_TITLE = 'text-[15px] leading-[22px]'
export const SMALL = 'text-[13px] leading-[18px]'

// 977·716: 왼쪽 머리 칸 폭과 축 선 자리(머리 칸 오른쪽 끝). 358: 축 선이 맨 왼쪽, 내용은 그만큼 들여 씀.
export const HEAD_COL = '@2xl:grid-cols-[112px_minmax(0,1fr)]'
export const AXIS_X = 'left-[5px] @2xl:left-[124px]'
export const DOT_X = 'left-[1px] @2xl:left-[120px]'
// 축 점의 세로 자리: 머리 첫 줄(날짜 숫자) 가운데
export const DOT_Y = 'top-[20px] @2xl:top-[29px]'
export const DOT = 'size-[9px]'
// 축 선이 첫 점(가운데)에서 시작하고 마지막 점에서 끝나는 자리(DOT_Y + 점 반지름)
export const AXIS_FROM_DOT = 'top-[24px] @2xl:top-[33px]'
export const AXIS_TO_DOT = 'h-[24px] @2xl:h-[33px]'
export const BODY_INSET = 'pl-6 @2xl:pl-0'
export const ROWS_INSET = '@2xl:pl-8'

// 줄: 테두리 없이 간격으로 나누고, 누르면(hover) 옅은 면이 깔린다
export const ROW_RADIUS = 'rounded-[12px]'

// 사람 머리글자 원(이름 두 글자)
export const AVATAR = 'size-[26px] text-[11px] leading-none'

// 아바타 색: 범주 색 가운데 위험 색(빨강 345~12도)과 헷갈릴 분홍(4)·주황(6)은 뺐다. 같은 사람은 같은 색(이름으로 고른다).
export const AVATAR_TONES = [
  'bg-category-1-soft text-category-1-strong',
  'bg-category-2-soft text-category-2-strong',
  'bg-category-7-soft text-category-7-strong',
  'bg-category-8-soft text-category-8-strong',
  'bg-category-5-soft text-category-5-strong',
] as const
