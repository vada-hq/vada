// e3(② 행사 구역, 가로 시간 축)의 임의 값 모음. 나중에 앱 토큰으로 뽑을 후보라 이름을 붙여 한곳에 둔다.
// 색은 시맨틱 토큰(fg·fg-secondary·fg-tertiary·fg-muted·card·muted·surface-subtle·border·danger·danger-surface)과
// 범주 색(category-1·2·3·5·7·8, 행사 머리글자·선로에만)만 쓴다. 새 hex 없음.
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
// 왼쪽 머리글자 칸 폭(= 오늘 선의 x). 행사 머리글자 네모가 여기 선다.
export const GUTTER_WIDE = 44
export const GUTTER_NARROW = 36
// 오늘 선과 이름 사이
export const NAME_GAP = 10
// 표식(마름모)과 일정 글 사이
export const LABEL_GAP = 10
// 일정 글 상자 안쪽 여백(px-1). 글자 자리를 LABEL_GAP에 맞추려고 상자를 이만큼 당긴다
export const LABEL_PAD = 4

// ── 날짜 머리 ──
export const AXIS_HEAD = 'h-12' // 48: 요일 16 + 날짜 원 28 + 아래 4
export const AXIS_WEEKDAY = 'text-[12px] leading-[16px]'
export const AXIS_DAY = 'size-7 text-[15px] leading-none' // 날짜 숫자 칸(오늘은 짙은 원)
// 오늘 선: 날짜 원 가운데(위에서 30px)부터 마지막 줄 끝까지
export const TODAY_LINE_TOP = 30
export const TODAY_LINE = 'w-[1.5px]'
export const TODAY_LINE_HALF = 0.75 // 선 폭의 반(가운데 맞춤)
// 오늘 선 끝: 마지막 줄 선로의 오늘 점(줄 아래 여백 + 선로 반)
export const TODAY_LINE_BOTTOM_NARROW = 18
export const TODAY_LINE_BOTTOM_WIDE = 17

// ── 행사 줄 ──
export const ROW = 'py-2 @2xl:py-[7px]'
// 이름 줄 높이(977·716은 알약 높이 28에 맞춰 신호가 있든 없든 같은 줄 높이)와 선로까지 간격
export const NAME_LINE = 'min-h-6 @2xl:min-h-7'
export const LANE_GAP = 'mt-1 @2xl:mt-0'
// 행사 머리글자 네모(①f8 얼굴의 행사판). 범주 색 soft 바탕 + strong 글자
// 머리글자 위치: 줄 위 여백에 맞춰 이름 첫 줄 가운데에 선다(줄 상자 기준, 이름 덮개가 줄 전체를 덮도록 이름 줄은 relative가 아니다)
export const GLYPH_TOP = 'top-2 @2xl:top-[7px]'
export const GLYPH =
  'size-6 rounded-[8px] text-[12px] @2xl:size-7 @2xl:rounded-[9px] @2xl:text-[13px]'
// 줄 hover 면(줄 상자 밖으로 8px 넓힌 둥근 면)
export const ROW_HOVER =
  'before:pointer-events-none before:absolute before:inset-y-0 before:-inset-x-2 before:-z-10 before:rounded-2xl hover:before:bg-surface-subtle'
// 선로(행사 이름 아래 한 줄): 높이 20
export const LANE = 'h-5'
export const TICK = 'h-1.5 w-px' // 하루 눈금
export const TICK_HALF = 0.5 // 눈금 폭의 반(가운데 맞춤)
export const TODAY_NODE = 'size-[7px]' // 선로 위 오늘 점
export const SEGMENT = 'h-[3px]' // 오늘 → 다음 일정 선분
export const DIAMOND = 'size-[11px]' // 다음 일정 표식(마름모)

// ── 신호 알약 ──
export const PILL = 'h-7 rounded-full px-2.5 gap-1'
export const PILL_ICON = 'size-3.5'
// 390: 알약 단추의 누르는 자리만 44px로 키우고 바깥 여백으로 되돌린다
export const PILL_TOUCH = 'max-sm:min-h-11 max-sm:min-w-11 max-sm:-my-2'

// ── 빈 띠 ──
export const EMPTY = 'min-h-14 rounded-[28px] bg-muted pl-3 pr-2 gap-3'
export const EMPTY_DOT = 'size-9'

// ── 글자 단계(4) ──
export const TEXT_HEAD = 'text-[20px] leading-[28px] font-bold tracking-[-0.02em]' // 구역 이름·수
export const TEXT_NAME = 'text-[17px] leading-[24px] font-semibold tracking-[-0.01em]' // 행사 이름
export const TEXT_SUB = 'text-[15px] leading-[20px]' // 다음 일정 글, 전체 보기, 빈 글
export const TEXT_PILL = 'text-[14px] leading-[20px]' // 신호 알약

export const SEE_ALL = 'min-h-11'

// 행사 색(범주 색 짝). 행사 id 번호로 정해 같은 행사는 어느 견본에서나 같은 색이다.
// 분홍(4)·주황(6)은 위험 빨강과 헷갈려 뺐다(①f8 얼굴 표와 같은 차례).
// glyph = 머리글자 네모, mark = 마름모, segment = 선분(옅게)
export const EVENT_TINTS = [
  {
    glyph: 'bg-category-5-soft text-category-5-strong',
    mark: 'bg-category-5',
    segment: 'bg-category-5/45',
    fade: 'from-category-5/0 to-category-5/45',
  },
  {
    glyph: 'bg-category-2-soft text-category-2-strong',
    mark: 'bg-category-2',
    segment: 'bg-category-2/45',
    fade: 'from-category-2/0 to-category-2/45',
  },
  {
    glyph: 'bg-category-3-soft text-category-3-strong',
    mark: 'bg-category-3',
    segment: 'bg-category-3/45',
    fade: 'from-category-3/0 to-category-3/45',
  },
  {
    glyph: 'bg-category-7-soft text-category-7-strong',
    mark: 'bg-category-7',
    segment: 'bg-category-7/45',
    fade: 'from-category-7/0 to-category-7/45',
  },
  {
    glyph: 'bg-category-1-soft text-category-1-strong',
    mark: 'bg-category-1',
    segment: 'bg-category-1/45',
    fade: 'from-category-1/0 to-category-1/45',
  },
  {
    glyph: 'bg-category-8-soft text-category-8-strong',
    mark: 'bg-category-8',
    segment: 'bg-category-8/45',
    fade: 'from-category-8/0 to-category-8/45',
  },
] as const
export type EventTint = (typeof EVENT_TINTS)[number]
