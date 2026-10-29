// f2(이유별 타일)에서 쓴 임의 값과 새 색 조합. 나중에 앱 토큰·부품으로 뽑을 후보라 이름 붙여 모은다.
// Tailwind가 글을 읽어 클래스를 만들므로 값은 모두 그대로 쓴 클래스 글이다.

// ── 면 ──
// 컴포넌트 전체를 담는 옅은 회색 판(리마인더 홈의 회색 바탕). 그 위에 흰 타일과 흰 목록 면이 놓인다.
export const PANEL = 'rounded-[24px] bg-muted p-3 @2xl:p-4'
// 판 안의 흰 면(타일·목록) 모서리
export const FACE_RADIUS = 'rounded-[18px]'
// 판 안 면 사이 간격
export const FACE_GAP = 'gap-2.5 @2xl:gap-3'

// ── 타일 ──
// 타일 안 여백과 최소 높이(358 / 716·977)
export const TILE_BOX = 'min-h-[76px] p-3 @2xl:min-h-[92px] @2xl:p-3.5'
// 타일의 큰 수(가장 큰 글자). 첫 타일(초점)은 한 단계 더 크다.
export const TILE_NUMBER = 'text-[26px] leading-none font-bold tracking-tight @2xl:text-[30px]'
export const TILE_NUMBER_FOCUS = 'text-[32px] leading-none font-bold tracking-tight @2xl:text-[40px]'
// 타일 아이콘 원
export const TILE_ICON = 'size-7 @2xl:size-8 [&_svg]:size-3.5 @2xl:[&_svg]:size-4'

// ── 목록 줄 ──
// 줄 제목(본문 중 가장 큰 글자)과 보조 줄
export const ROW_TITLE = 'text-[15px] leading-[21px]'
export const ROW_META = 'text-[13px] leading-[18px]'
// 줄 사이 선: 아바타 오른쪽에서 시작(리마인더 목록의 들여 쓴 선). 16(여백) + 40(아바타) + 12(간격) = 68px
export const ROW_DIVIDER_INSET = 'before:left-[68px]'

// ── 아바타 ──
// 지름 40px(누르는 자리는 둘레 2px를 더해 44px)
export const AVATAR_SIZE = 'size-10'
export const AVATAR_TEXT = 'text-[13px] font-bold tracking-tight'
// 묻기 표시 배지(아바타 오른쪽 아래)
export const ASK_BADGE = 'size-4 [&_svg]:size-2.5'
// 사람 색: 기존 범주 색(category-*)의 옅은 면 + 진한 글자. 위험 색과 헷갈리지 않게 붉은 계열(4 pink, 6 orange)은 뺐다.
export const AVATAR_TONES = [
  'bg-category-1-soft text-category-1-strong',
  'bg-category-2-soft text-category-2-strong',
  'bg-category-5-soft text-category-5-strong',
  'bg-category-3-soft text-category-3-strong',
  'bg-category-7-soft text-category-7-strong',
  'bg-category-8-soft text-category-8-strong',
] as const
