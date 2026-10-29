// b1 좁은 열 카드: 임의 값과 이 안만의 크기·간격 모음. 색은 의미 토큰과 category-*만(부서 색은 data.ts).
// Tailwind가 이 파일의 글자를 읽어 클래스를 만들므로 클래스 이름은 통째로 적는다.

// ── 열 ──
// 고정 폭 300px(Trello 272·GitHub 약 350 사이). 왼쪽부터 놓고 남는 오른쪽은 비운다(관례 그대로).
export const COL_W = 'w-75'
export const COLS_GAP = 'gap-3'
// 회색 열 상자: 카드가 흰 면으로 떠 보이게 하는 바탕
export const COL = 'rounded-2xl bg-surface-muted p-1.5'
export const COL_HEAD = 'flex h-9 items-center gap-2 px-2.5'
// 휴대폰 부서 묶음 머리(지금 '재정부 1'): 열 머리보다 낮게
export const LIST_HEAD = 'flex h-8 items-center gap-2 px-1'
export const COL_NAME = 'text-sm font-semibold text-fg-secondary'
export const COL_COUNT = 'text-sm tabular-nums text-fg-tertiary'

// ── 카드 ──
// 얇은 테두리 하나(그림자 없음). 올리면 테두리만 진해진다.
export const CARD =
  'rounded-xl border border-border-default bg-white px-3 pt-2.5 pb-2 hover:border-border-strong'
export const CARD_GAP = 'gap-1.5'
// 1단: 제목(두 줄까지). '⋯' 자리만큼 오른쪽을 비운다.
export const TITLE = 'pr-6 max-lg:pr-9 text-sm leading-5 font-semibold text-fg'
export const TITLE_DONE = 'pr-6 max-lg:pr-9 text-sm leading-5 font-medium text-fg-tertiary'
// 2단: 부서 점 + 부서 이름(부서 색 글자) · 마감 · 결과물 · 얼굴(오른쪽 끝)
export const META = 'mt-1.5 flex min-h-6 items-center gap-1.5 text-xs'
export const DEPT_DOT = 'size-2 rounded-full'
// 카드 '⋯': 오른쪽 위 구석
export const MENU_AT = 'absolute top-1 right-1 size-8 p-0'

// ── 얼굴 ──
export const FACE = 'size-6 text-[10px] leading-none'

// ── 빈 열·추가 ──
export const EMPTY = 'py-6 text-center text-xs text-fg-tertiary'
export const ADD = 'mt-1 h-9 rounded-xl px-2.5 text-sm hover:bg-white/70'
export const ADD_OPEN = 'mt-1.5 rounded-xl border border-primary-border-strong bg-white p-2'
