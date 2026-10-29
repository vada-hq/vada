// b3 흰 묶음 줄: 임의 값과 이 안만의 크기·간격 모음. 홈 ①(c1-final f8) 부품 가족(회색 쟁반·흰 묶음·두 칸 줄)의 값을 따른다.
// 색은 의미 토큰과 category-*만(부서 색은 data.ts). Tailwind가 이 파일의 글자를 읽으므로 클래스 이름은 통째로 적는다.

// ── 쟁반: 열 셋을 한 회색 면에 담아 가운데 둔다. 열마다 폭 상한 448px ──
export const WIDTH = 'mx-auto w-full max-w-[1376px]'
export const TRAY = 'rounded-[28px] bg-muted p-1.5'
export const COLS = 'grid grid-cols-3 gap-2'
// 쟁반 위 열 머리(흰 묶음 밖): 이름이 가장 큰 글자
export const COL_HEAD = 'flex items-baseline gap-2 px-4 pt-2 pb-1.5'
export const COL_NAME = 'text-[17px] leading-6 font-bold tracking-[-0.01em] text-fg'
export const COL_COUNT = 'text-[17px] leading-6 font-semibold tabular-nums text-fg-tertiary'

// ── 흰 묶음: 열마다 하나. 줄은 구분선으로 나눈다 ──
export const GROUP = 'rounded-[22px] bg-card p-1'
export const DIVIDE = 'divide-y divide-border-subtle'

// ── 줄: 무엇(띠 + 제목 / 부서 · 마감) | 누구(얼굴 + 이름) ──
export const ROW = 'flex items-center gap-3 rounded-2xl px-3 py-2.5 hover:bg-surface-subtle'
// 부서 띠: 제목 두 줄 높이의 세로 막대(색은 이것 하나, 부서 이름은 회색 글)
export const BAND = 'w-1 self-stretch rounded-full'
export const TITLE = 'text-[15px] leading-[22px] font-semibold tracking-[-0.01em] text-fg'
export const TITLE_DONE =
  'text-[15px] leading-[22px] font-medium tracking-[-0.01em] text-fg-tertiary'
export const SUB = 'mt-0.5 flex min-w-0 items-center gap-1.5 text-[13px] leading-5'
// 누구 칸: 넓으면 얼굴 + 이름, 묶음 폭 384px 아래면 얼굴만(이름은 title)
export const WHO = 'flex shrink-0 items-center gap-2 text-[13px] leading-5'
export const WHO_NAME = 'hidden text-fg-secondary @sm:inline'
export const MENU = '-mr-1.5 size-8 p-0'

// ── 얼굴 ──
export const FACE = 'size-7 text-[11px] leading-none'

// ── 빈 열·추가 ──
export const EMPTY = 'px-3 py-5 text-center text-[13px] text-fg-muted'
export const ADD = 'h-11 rounded-2xl px-3 text-[15px] hover:bg-surface-subtle'
export const ADD_OPEN = 'p-2'
