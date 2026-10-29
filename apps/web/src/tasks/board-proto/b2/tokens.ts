// b2 한 줄 카드: 임의 값과 이 안만의 크기·간격 모음. 색은 의미 토큰과 category-*만(부서 색은 data.ts).
// Tailwind가 이 파일의 글자를 읽어 클래스를 만들므로 클래스 이름은 통째로 적는다.

// ── 열: 화면을 셋으로 나눠 넓게. 열 상자 없이 머리 밑줄 하나로 열을 가른다 ──
export const COLS = 'grid grid-cols-3 gap-x-6'
// 열 머리: 상태 기호 + 이름 + 수, 아래 2px 선(상태마다 다른 진하기)
export const COL_HEAD = 'mb-2 flex h-10 items-center gap-2 border-b-2 px-1'
export const COL_LINE = {
  todo: 'border-border-strong',
  doing: 'border-primary-mark',
  done: 'border-border-default',
} as const
export const COL_GLYPH = 'size-4 shrink-0'
export const COL_NAME = 'text-sm font-bold text-fg'
export const COL_COUNT = 'text-sm tabular-nums text-fg-muted'

// ── 카드: 한 줄(넓을 때) ↔ 두 줄(카드 폭 448px 아래, 1280에서) ──
// 카드 자체가 container. 넓으면 한 줄 [제목 … 부서 칩 · 마감 · 얼굴 ⋯],
// 좁으면 [제목 … 얼굴 ⋯] / [부서 칩 · 마감]: 얼굴이 제목 줄 오른쪽에 붙어 b1(얼굴이 아래 줄 끝)과 읽는 차례가 다르다.
export const CARD =
  '@container rounded-lg border border-border-default bg-white hover:border-border-strong hover:bg-surface-subtle'
export const CARD_GAP = 'gap-1.5'
export const CARD_BODY =
  'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1 py-2 pr-1.5 pl-3 @md:flex @md:gap-3 @md:py-1.5'
export const AREA_TITLE = 'col-start-1 row-start-1'
export const AREA_WHO = 'col-start-2 row-start-1 @md:order-3'
export const AREA_META = 'col-span-2 row-start-2 @md:order-2'
export const TITLE = 'text-sm leading-5 font-medium text-fg'
export const TITLE_DONE = 'text-sm leading-5 font-normal text-fg-muted'
export const META = 'flex min-w-0 shrink-0 items-center gap-2 text-xs'
export const WHO = 'flex shrink-0 items-center gap-0.5 text-xs'
// 부서 칩: 부서 색 바탕(띠 없음)
export const DEPT_CHIP = 'h-5 rounded px-1.5 text-xs leading-5 font-medium'
// 마감 칸 폭을 맞춰 넓은 화면에서 줄끼리 세로로 줄 서게
export const DUE = 'shrink-0 whitespace-nowrap @md:min-w-[4.75rem] @md:text-right'
export const MENU = 'size-7 p-0'

// ── 얼굴 ──
export const FACE = 'size-6 text-[10px] leading-none'

// ── 빈 열·추가 ──
export const EMPTY =
  'flex h-11 items-center justify-center rounded-lg border border-dashed border-border-strong text-xs text-fg-tertiary'
export const ADD = 'mt-1 h-9 px-2 text-sm'
export const ADD_OPEN = 'mt-1.5 rounded-lg border border-primary-border-strong bg-white p-2'
