// e2(왼쪽 날짜 칸 + 세로 레일)의 임의 값 모음. 나중에 앱 토큰으로 뽑을 후보라 이름을 붙여 한곳에 둔다.
// 색은 시맨틱 토큰(fg·fg-secondary·fg-tertiary·fg-muted·card·muted·border·primary-strong·primary-surface·danger)만 쓴다. 새 hex 없음.
// Tailwind가 이 파일의 글자를 읽어 클래스를 만들므로 클래스 이름은 통째로 적는다(조립 금지).

// ── 구역 바탕(①의 f8과 같은 회색 쟁반 + 흰 묶음, 같은 부품 가족) ──
export const TRAY = 'rounded-[28px] bg-muted p-2 @2xl:p-2.5'
// 쟁반 머리: 왼쪽 끝을 날짜 칸 왼쪽 끝에 맞춘다(쟁반 + 묶음 + 줄 안쪽 여백의 합)
export const TRAY_HEAD = 'px-4.5 pt-3 pb-2 @2xl:px-5.5 @2xl:pt-3.5 @2xl:pb-3'
// 흰 묶음. 줄 사이 4px(716·977은 12px): 레일이 줄과 줄 사이를 잇는 자리. 977은 줄이 낮아 틈을 넓혀야 레일이 선으로 보인다.
export const GROUP = 'flex flex-col gap-1 rounded-[22px] bg-card p-1.5 @2xl:gap-3 @2xl:p-2'

// ── 줄 ──
// 마우스를 올리면 옅은 회색 면(행사 보기). 신호 위에 있으면 줄 면을 끈다(신호는 따로 누르는 자리).
export const ROW =
  'gap-3 rounded-2xl px-3 py-2.5 @2xl:gap-4 @2xl:px-3.5 @2xl:py-1.5 hover:bg-muted/60 has-[[data-sig]:hover]:bg-transparent'
export const ROW_FOCUS =
  'has-[[data-title]:focus-visible]:ring-2 has-[[data-title]:focus-visible]:ring-inset has-[[data-title]:focus-visible]:ring-blue-700'
// 줄 몸: 358은 이름 / 다음 일정 / 신호를 쌓고, 716·977은 두 칸(이름·다음 일정 | 신호, 같은 폭)으로 펼친다.
// 신호를 줄 오른쪽 끝에 붙이면 이름과 신호 사이 가운데가 한 덩어리로 빈다(①의 f8 고칠 것 3과 같은 문제).
export const ROW_BODY = 'min-w-0 flex-1 @2xl:grid @2xl:grid-cols-2 @2xl:items-center @2xl:gap-x-6'
// 716·977 신호 칸: 둘째 칸 왼쪽부터, 길면 줄을 바꿔 쌓는다(long 넷). 글줄 간격 = 신호 높이 32
export const SIGNALS_WIDE = '@2xl:gap-y-0'

// ── 날짜 칸(새 부품) ──
// 면·테두리 없이 글자로만 세운다: 월(작게) / 날짜 숫자(크게) / 요일(작게). 높이 50 = 줄 높이를 정한다(K7 ≤ 64).
export const DATE_CELL = 'w-12 @2xl:w-14 h-[50px]'
export const DATE_SMALL = 'text-[12px] leading-[13px] font-medium'
export const DATE_NUM = 'text-[22px] leading-[24px] font-semibold tracking-[-0.02em] tabular-nums'
export const DATE_UNDECIDED = 'text-[14px] leading-[24px] font-semibold'

// ── 세로 레일(새 부품): 날짜 칸 아래에서 다음 줄 날짜 칸 위까지 가는 선 ──
// 위치 = 줄 안쪽 여백 + 날짜 칸 폭의 절반. 위 = 줄 위 여백 + 칸 높이 50 + 틈 4. 아래 = 줄 사이(4 / 12) + 다음 줄 위 여백 - 틈 4.
export const RAIL =
  'w-px bg-border left-[36px] top-[64px] -bottom-[10px] @2xl:left-[42px] @2xl:top-[60px] @2xl:-bottom-[14px]'

// ── 신호(새 부품: 아이콘 + 글 단추, 테두리·면 없음) ──
// 390에서는 누르는 자리만 44px로 키우고 바깥 여백으로 되돌려 글줄 간격은 28px로 둔다.
export const SIGNAL =
  'relative z-10 h-auto min-h-8 gap-1.5 rounded-lg px-1.5 py-1 -mx-1.5 max-sm:min-h-11 max-sm:-my-2'
export const SIGNAL_ICON = 'size-4'

// ── 0건 띠(①의 f8과 같은 높이) ──
export const QUIET = 'min-h-14 rounded-[28px] bg-muted pl-3 pr-2 gap-3'
export const QUIET_DOT = 'size-9'

// ── 글자 단계 ──
export const TEXT_HEAD = 'text-[20px] leading-[28px] font-bold tracking-[-0.02em]' // 구역 이름·수(가장 큰 글자)
export const TEXT_TITLE = 'text-[17px] leading-[24px] font-semibold tracking-[-0.01em]' // 행사 이름
export const TEXT_SUB = 'text-[15px] leading-[22px]' // 다음 일정, 신호, 전체 보기, 0건 글

// ── 전체 보기(묶음 아래 가운데) ──
export const SEE_ALL = 'min-h-11'
