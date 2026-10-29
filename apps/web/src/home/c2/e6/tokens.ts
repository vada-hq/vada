// e6(② 행사 구역, e3 가로 시간 축 다듬기)의 임의 값 모음. 나중에 앱 토큰으로 뽑을 후보라 이름을 붙여 한곳에 둔다.
// 색은 시맨틱 토큰(fg·fg-secondary·fg-tertiary·fg-muted·card·muted·surface-subtle·border·danger·danger-surface)과
// 행사 색(event-color.ts, 범주 색 1·2·3·5·7·8)만 쓴다. 새 hex 없음.
// Tailwind가 이 파일의 글자를 읽어 클래스를 만들므로 클래스 이름은 통째로 적는다(조립 금지).

// ── 구역 바탕(①f8과 같은 회색 쟁반 + 흰 묶음) ──
export const TRAY = 'rounded-[28px] bg-muted p-2 @2xl:p-2.5'
export const TRAY_HEAD = 'px-4 pt-3 pb-2 @2xl:px-5 @2xl:pt-3.5 @2xl:pb-3'
// 흰 묶음 안쪽 여백. 날짜 머리와 행사 줄이 같은 폭(= 시간 축 폭)을 쓴다.
export const GROUP = 'rounded-[22px] bg-card px-3 pt-2 pb-2 @2xl:px-5 @2xl:pt-3 @2xl:pb-3'

// ── 시간 축 기하(px, 묶음 안쪽 폭 W를 재서 계산) ──
// 축 길이: 넓은 폭(716·977) 14일, 좁은 폭(358) 7일
export const AXIS_WIDE_MIN = 560
export const AXIS_DAYS_WIDE = 14
export const AXIS_DAYS_NARROW = 7
// 왼쪽 행사 네모 칸 폭(= 오늘 선의 x). e3 머리글자 네모(28)를 작은 네모(10)로 바꿔 좁혔다.
export const GUTTER_WIDE = 32
export const GUTTER_NARROW = 28
// 오늘 선과 이름·일정 글 사이(이름과 일정 글이 같은 x에서 시작한다)
export const NAME_GAP = 10

// ── 날짜 머리 ──
export const AXIS_HEAD = 'h-[54px]' // 요일 16 + 2 + 날짜 원 28 + 3 + 일정 네모 5
export const AXIS_WEEKDAY = 'text-[12px] leading-[16px]'
export const AXIS_DAY = 'size-7 text-[15px] leading-none' // 날짜 숫자 칸(오늘은 짙은 원)
export const AXIS_MARKS = 'mt-[3px] h-[5px] gap-[3px]' // 그날 일정이 있는 행사 네모 줄
export const AXIS_MARK = 'size-[5px] rounded-[1.5px]'
// 오늘 선: 날짜 원 가운데(위에서 30px)부터 마지막 줄 막대까지
export const TODAY_LINE_TOP = 30
export const TODAY_LINE = 'w-[1.5px]'
export const TODAY_LINE_HALF = 0.75 // 선 폭의 반(가운데 맞춤)
// 오늘 선 끝: 마지막 줄 막대 가운데(줄 아래 여백 + 막대 칸 반)
export const TODAY_LINE_BOTTOM_NARROW = 11
export const TODAY_LINE_BOTTOM_WIDE = 8

// ── 행사 줄 ──
// 977·quiet 신호 없는 줄 = 위아래 5+5 + 이름 줄 28 + 일정 글 18 + 막대 칸 6 = 62(K7 ≤ 64)
export const ROW = 'py-2 @2xl:py-[5px]'
// 이름 줄 높이(977·716은 알약 높이 28에 맞춰 신호가 있든 없든 같은 줄 높이)
export const NAME_LINE = 'min-h-6 @2xl:min-h-7'
// 이름 줄 안 간격. 390은 알약의 누르는 자리(44)가 위아래로 8씩 넘치므로 줄 사이를 넓혀 겹치지 않게 한다.
export const NAME_LINE_GAP = 'gap-x-2.5 gap-y-2.5 @2xl:gap-y-1.5'
export const PILL_ROW_GAP = 'gap-x-1.5 gap-y-4 @2xl:gap-y-1.5'
export const LANE_GAP = 'mt-2 @2xl:mt-0'
// 행사 네모: 사람 얼굴(둥근 옅은 면 + 글자)과 구별되게 가득 찬 색 작은 네모, 글자 없음.
// 이름 첫 줄 가운데에 선다(위 여백 8·5 + 이름 줄 반 12·14 - 네모 반 5 = 15)
export const EVENT_MARK = 'size-2.5 rounded-[3px]'
export const EVENT_MARK_TOP = 'top-[15px] @2xl:top-[14px]'
export const EVENT_MARK_SIZE = 10
export const EVENT_MARK_GAP = 8 // 네모와 오늘 선 사이
// 줄 hover 면(줄 상자 밖으로 8px 넓힌 둥근 면)
export const ROW_HOVER =
  'before:pointer-events-none before:absolute before:inset-y-0 before:-inset-x-2 before:-z-10 before:rounded-2xl hover:before:bg-surface-subtle'

// ── 선로: 일정 글 줄(이름과 같은 x에서 시작) + 그 아래 막대 칸 ──
export const LANE_TEXT = 'h-[18px] text-[15px] leading-[18px]'
export const LANE_BAR = 'h-1.5' // 막대 칸 6
export const SEGMENT = 'h-[3px]' // 오늘 → 다음 일정 막대
// 하루 눈금: 막대 칸에만(글 줄을 가로지르지 않는다). 평소 줄의 빈 오른쪽을 '날짜 자'로 채운다.
export const TICK = 'h-[5px] w-px'
export const TICK_HALF = 0.5
export const TODAY_NODE = 'size-[7px]' // 막대 위 오늘 점
export const DIAMOND = 'size-[9px]' // 다음 일정 표식(마름모)
// 막대 진하기: 오늘 쪽 진하고 축 끝으로 갈수록 옅다(행사마다가 아니라 날짜 자리마다 같은 진하기).
// 먼 일정의 긴 막대가 가장 큰 색 덩어리가 되지 않게 한다.
// [축 위 자리(오늘 0 → 축 끝 1), 진하기]. 처음 4분의 1(977 약 3일, 358 약 2일)까지 진하고 그 뒤 빨리 옅어진다.
const BAR_AT_TODAY = 0.85
const BAR_KNEE_1 = 0.25
const BAR_AT_KNEE_1 = 0.6
const BAR_KNEE_2 = 0.55
const BAR_AT_KNEE_2 = 0.22
const BAR_AT_END = 0.06
export const BAR_STOPS: readonly (readonly [number, number])[] = [
  [0, BAR_AT_TODAY],
  [BAR_KNEE_1, BAR_AT_KNEE_1],
  [BAR_KNEE_2, BAR_AT_KNEE_2],
  [1, BAR_AT_END],
]
export const DIAMOND_LIFT = 0.3 // 마름모는 막대보다 이만큼 진하게(작아서)
export const DIAMOND_MIN = 0.55
export const ONGOING_FROM = 0.3 // 진행 중: 오늘 선 앞(네모 칸)의 이 비율 자리부터 옅게 번져 들어온다

// ── 신호 알약 ──
export const PILL = 'h-7 rounded-full px-2.5 gap-1'
export const PILL_ICON = 'size-3.5'
// 390: 알약 단추의 누르는 자리만 44px로 키우고 바깥 여백으로 되돌린다(이웃 알약과는 PILL_ROW_GAP으로 띄운다)
export const PILL_TOUCH = 'max-sm:min-h-11 max-sm:min-w-11 max-sm:-my-2'

// ── 빈 띠 ──
export const EMPTY = 'min-h-14 rounded-[28px] bg-muted pl-3 pr-2 gap-3'
export const EMPTY_DOT = 'size-9'

// ── 글자 단계 ──
export const TEXT_HEAD = 'text-[20px] leading-[28px] font-bold tracking-[-0.02em]' // 구역 이름·수
export const TEXT_NAME = 'text-[17px] leading-[24px] font-semibold tracking-[-0.01em]' // 행사 이름
export const TEXT_SUB = 'text-[15px] leading-[20px]' // 전체 보기, 빈 글
export const TEXT_PILL = 'text-[14px] leading-[20px]' // 신호 알약

export const SEE_ALL = 'min-h-11'
