// e1(줄 끝 큰 남은 날)의 임의 값 모음. 나중에 앱 토큰으로 뽑을 후보라 이름을 붙여 한곳에 둔다.
// 색은 시맨틱 토큰(fg·fg-secondary·fg-tertiary·fg-muted·card·muted·surface-subtle·border-subtle·primary-strong·
// primary-surface·danger)만 쓴다. 새 hex 없음.
// Tailwind가 이 파일의 글자를 읽어 클래스를 만들므로 클래스 이름은 통째로 적는다(조립 금지).

// ── 구역 바탕(회색 쟁반, ① f8과 같은 가족) ──
export const TRAY = 'rounded-[28px] bg-muted p-2 @2xl:p-2.5'
// 쟁반 머리: 왼쪽 끝을 줄의 행사 이름 왼쪽 끝에 맞춘다(쟁반 + 묶음 + 줄 안쪽 여백의 합).
export const TRAY_HEAD = 'px-4.5 pt-3 pb-2 @2xl:px-5.5 @2xl:pt-3.5 @2xl:pb-3'

// ── 흰 묶음 ──
export const GROUP = 'rounded-[22px] bg-card p-1.5 @2xl:p-2'

// ── 행사 줄 ──
// 줄 상자. 마우스를 올리면 아주 옅은 면(행사 보기). 남은 날 칸(muted)이 그 위에서도 보이게 surface-subtle을 쓴다.
// 신호 글 위에 있을 때는 줄 면을 끈다(신호가 따로 누르는 자리).
export const ROW =
  'gap-3 rounded-2xl px-3 py-2 @2xl:gap-6 @2xl:px-3.5 @2xl:py-2 hover:bg-surface-subtle has-[[data-signal]:hover]:bg-transparent'
// 키보드 초점: 이름 단추(줄 덮개)에 초점이 있을 때만 줄 전체에 링을 그린다.
export const ROW_FOCUS =
  'has-[[data-title]:focus-visible]:ring-2 has-[[data-title]:focus-visible]:ring-inset has-[[data-title]:focus-visible]:ring-blue-700'
// 줄 사이 가는 선: 977에서 이름과 오른쪽 끝 남은 날이 멀어 어느 줄의 숫자인지 선이 잇는다(e02 위젯).
// 선은 이름 쪽 여백에서 시작해 남은 날 칸 오른쪽 끝까지 긋는다.
export const ROW_RULE =
  'before:absolute before:top-0 before:right-3 before:left-3 before:h-px before:bg-border-subtle @2xl:before:right-3.5 @2xl:before:left-3.5 first:before:hidden'

// ── 남은 날 칸(새 부품) ──
// 고정 폭이라 'D-1'·'D-12'·'오늘'의 자릿수가 달라도 세로 한 열로 맞는다(e01). 면은 중립 muted(색으로 칠하지 않음).
export const DAYS_CELL = 'h-12 w-[76px] rounded-[14px] @2xl:w-[84px]'
// 큰 숫자: 줄 이름(17px)의 약 1.6배. 칸 높이 48 안에 숫자 28 + 라벨 16이 들어간다.
export const TEXT_DAYS = 'text-[26px] leading-[28px] font-bold tracking-[-0.03em] tabular-nums'
// 숫자 아래 다음 일정 이름('행사 종료')
export const TEXT_DAYS_LABEL = 'text-[12px] leading-[16px] font-medium'

// ── 신호 글 줄(새 부품) ──
// 390(터치)에서는 신호 하나가 누르는 자리 44px. 위아래 음수 여백 5px로 꺾인 줄 사이를 34px로 줄인다
// (누르는 자리는 이웃 줄과 10px만 겹치고 34px는 제 것이다. 음수 여백 없이 두면 꺾인 줄 사이가 22px씩 비어 신호가 흩어져 보인다).
export const SIGNAL = 'h-auto min-h-0 py-0.5 max-sm:min-h-11 max-sm:-my-[5px] max-sm:py-0'
// 신호 줄을 이름 밑에 붙인다(390은 누르는 자리 안의 위 여백 6px만큼 끌어올린다).
export const SIGNALS = 'mt-0.5 max-sm:-mt-1 max-sm:-mb-1'

// ── 0건 띠 ──
export const QUIET = 'min-h-14 rounded-[28px] bg-muted py-1.5 pr-2 pl-3 gap-3'
export const QUIET_DOT = 'size-9'

// ── 글자 단계 ──
export const TEXT_HEAD = 'text-[20px] leading-[28px] font-bold tracking-[-0.02em]' // 구역 이름·수
export const TEXT_TITLE = 'text-[17px] leading-[24px] font-semibold tracking-[-0.01em]' // 행사 이름
export const TEXT_SUB = 'text-[15px] leading-[22px]' // 신호, 전체 보기, 0건 글

// ── 전체 보기(묶음 아래 가운데) ──
export const SEE_ALL = 'min-h-11'
