// f7(회색 바탕 위 아이콘 줄, 토스 홈·혜택)의 임의 값 모음. 나중에 앱 토큰으로 뽑을 후보라 이름을 붙여 한곳에 둔다.
// 색은 시맨틱 토큰(fg·fg-secondary·fg-tertiary·fg-muted·card·muted·primary-strong·danger)과 범주 색(category-*)만 쓴다. 새 hex 없음.

// ── 구역 바탕(회색 쟁반) ──
// 구역 전체를 연회색(muted) 면으로 깐다. 테두리·그림자 없음. 흰 묶음이 이 안에 떠 있다.
export const TRAY = 'rounded-[28px] bg-muted p-2 @2xl:p-2.5'
// 쟁반 머리(구역 이름 + 건수): 왼쪽 끝을 줄의 아이콘 원 왼쪽 끝에 맞춘다(쟁반 + 묶음 + 줄 안쪽 여백의 합).
export const TRAY_HEAD = 'px-4.5 pt-3 pb-3 @2xl:px-5.5 @2xl:pt-3.5'

// ── 흰 묶음 ──
// 테두리·그림자 없는 흰 둥근 면 하나. 줄 사이 선 없음(넉넉한 줄 높이로만 나눈다).
export const GROUP = 'rounded-[22px] bg-card p-1.5 @2xl:p-2'

// ── 줄 ──
// 줄 높이는 두 줄 글 + 위아래 14px(토스 혜택 줄처럼 넉넉하게). 마우스를 올리면 묶음 안쪽으로 들인 둥근 옅은 면.
export const ROW = 'gap-3 rounded-2xl px-3 py-3.5 hover:bg-surface-subtle @2xl:gap-4 @2xl:px-3.5'
// 오른쪽 사실 칸의 폭 상한. 358은 가장 긴 사실('결재 대기 D-3')이 드는 만큼만 둬서 긴 행사가 제목 자리를 뺏지 않고 말줄임된다.
export const FACT_COL = 'max-w-[5.75rem] @2xl:max-w-60'
// 이유 아이콘 원(토스 혜택 줄의 회색 원)
export const ICON_DOT = 'size-11 @2xl:size-12'
export const ICON_GLYPH = 'size-[22px] @2xl:size-6'

// ── 0건 띠 ──
export const QUIET = 'h-14 rounded-[28px] bg-muted px-3 gap-3'
export const QUIET_DOT = 'size-9'

// ── 글자 단계(3) ──
export const TEXT_HEAD = 'text-[20px] leading-[28px] font-bold tracking-[-0.02em]' // 구역 이름·건수(가장 큰 글자)
export const TEXT_TITLE = 'text-[17px] leading-[24px] font-semibold tracking-[-0.01em]' // 줄 제목
export const TEXT_SUB = 'text-[15px] leading-[22px]' // 행동 줄, 사실, 물어봄, 행사, 전체 보기, 0건 글

// ── 전체 보기(묶음 아래 가운데) ──
export const SEE_ALL = 'h-12 @2xl:h-11'
