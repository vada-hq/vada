// e4(남은 날 알약 + 신청 게이지)의 임의 값 모음. 나중에 앱 토큰으로 뽑을 후보라 이름을 붙여 한곳에 둔다.
// 색은 시맨틱 토큰(fg·fg-secondary·fg-tertiary·card·muted·primary-strong·primary-surface·danger)과
// 범주 색 category-1(teal, 신청 게이지에만)만 쓴다. 새 hex 없음.
// Tailwind가 이 파일의 글자를 읽어 클래스를 만들므로 클래스 이름은 통째로 적는다(조립 금지).

// ── 구역 바탕(①과 같은 회색 쟁반 + 흰 묶음) ──
export const TRAY = 'rounded-[28px] bg-muted p-2 @2xl:p-2.5'
// 쟁반 머리: 왼쪽 끝을 줄의 알약 왼쪽 끝에 맞춘다(쟁반 + 묶음 + 줄 안쪽 여백의 합)
export const TRAY_HEAD = 'px-4.5 pt-3 pb-2 @2xl:px-5.5 @2xl:pt-3.5 @2xl:pb-3'
export const GROUP = 'rounded-[22px] bg-card p-1.5 @2xl:p-2'

// ── 줄 ──
// 줄 상자. 977·716은 한 줄(알약 | 이름 · 다음 일정 | 신호)이라 신호 없는 줄이 56px이다(K7 64 안).
export const ROW =
  'gap-3 rounded-2xl px-3 py-3 @2xl:gap-4 @2xl:px-3.5 @2xl:py-3 hover:bg-muted/60 has-[[data-signal]:hover]:bg-transparent'
export const ROW_FOCUS =
  'has-[[data-title]:focus-visible]:ring-2 has-[[data-title]:focus-visible]:ring-inset has-[[data-title]:focus-visible]:ring-blue-700'
// 줄 몸: 358은 이름 → 다음 일정 → 신호를 쌓고, 716·977은 두 칸(무엇 | 신호)으로 펼친다.
// 두 칸 비율을 ①(f8 무엇 | 누구)과 같게 둬 홈에서 오른쪽 칸 시작선이 비슷한 자리에 선다.
export const ROW_BODY = 'min-w-0 flex-1 @2xl:grid @2xl:grid-cols-2 @2xl:items-center @2xl:gap-x-6'

// ── 남은 날 알약(짙은 중립 면 + 시계 + D-n) ──
// 최소 폭을 'D-12'에 맞춰 줄마다 알약이 같은 열로 선다(남은 날이 세로로 먼저 읽힘). 세 자리 날은 늘어난다.
export const DAY_PILL = 'h-7 min-w-16 gap-1 rounded-full px-2 @2xl:h-8 @2xl:min-w-18 @2xl:gap-1.5'
export const DAY_PILL_ICON = 'size-3.5 shrink-0 @2xl:size-4'
// 일정 미정 알약: 옅은 회색 면 + 빈 달력(남은 날이 없다는 사실만)
export const DAY_PILL_NONE = 'bg-muted text-fg-secondary'
export const DAY_PILL_SET = 'bg-fg text-card'

// ── 신청 게이지(신청 기간 + 정원 있는 행사에만) ──
// 글('신청 18/40')이 앞, 짧은 막대가 뒤. 업무 진행 막대(배포된 카드: 파란 막대 뒤에 '업무 n/m')와 순서·색·길이를 다르게 둔다.
export const GAUGE_TRACK = 'h-1.5 w-14 rounded-full bg-category-1-soft'
export const GAUGE_FILL = 'h-full rounded-full bg-category-1'

// ── 신호 글 단추 ──
// 390에서 누르는 자리만 44px로 키우고 바깥 여백으로 되돌린다(줄 높이는 그대로).
export const SIGNAL = 'relative z-10 h-auto min-h-6 max-sm:-my-2.5 max-sm:min-h-11'
export const SIGNAL_GAP = 'gap-x-4 gap-y-1 max-sm:gap-y-0'
export const SIGNAL_ICON = 'size-4'

// ── 빈 띠 ──
export const EMPTY = 'min-h-14 rounded-[28px] bg-muted py-1.5 pr-2 pl-3 gap-3'
export const EMPTY_DOT = 'size-9'

// ── 글자 단계(①과 같은 셋 + 알약) ──
export const TEXT_HEAD = 'text-[20px] leading-[28px] font-bold tracking-[-0.02em]' // 구역 이름·수
export const TEXT_TITLE = 'text-[17px] leading-[24px] font-semibold tracking-[-0.01em]' // 행사 이름
export const TEXT_SUB = 'text-[15px] leading-[22px]' // 다음 일정, 신호, 전체 보기
export const TEXT_PILL = 'text-[13px] leading-[18px] font-bold tabular-nums @2xl:text-[14px]' // 알약 안 D-n

// ── 전체 보기(묶음 아래 가운데) ──
export const SEE_ALL = 'min-h-11'
