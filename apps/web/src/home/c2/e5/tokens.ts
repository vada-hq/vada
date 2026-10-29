// e5(줄 끝 상태 신호 목록)의 임의 값 모음. 나중에 앱 토큰으로 뽑을 후보라 이름을 붙여 한곳에 둔다.
// 색은 시맨틱 토큰(fg·fg-secondary·fg-tertiary·fg-muted·card·muted·border·border-subtle·danger·danger-surface·primary-strong)만 쓴다. 새 hex 없음.
// 글자 단계·모서리 반경은 ①(c1r/f8)과 같은 값을 써 같은 부품 가족으로 보이게 하고,
// 면(흰 판 + 테두리, 회색 쟁반 없음)·나누는 법(줄 사이 선)·줄 앞 아이콘 원 없음으로 ①과 다른 구역으로 읽히게 한다.
// Tailwind가 이 파일의 글자를 읽어 클래스를 만들므로 클래스 이름은 통째로 적는다(조립 금지).

// ── 구역 판(흰 면 하나, 얇은 테두리) ──
// ①의 흰 묶음과 같은 반경 22. ①은 회색 쟁반 위에 흰 묶음이 떠 있고, ②는 쟁반 없이 흰 판 하나가 페이지 바닥 위에 선다.
export const CARD = 'rounded-[22px] border border-border bg-card'
// 판 머리: 이름·수(왼쪽) + 전체 보기(오른쪽). 왼쪽 끝을 줄 글자 왼쪽 끝에 맞춘다(목록 px + 줄 px).
export const HEAD = 'gap-3 pl-5 pr-3 pt-3 pb-1 @2xl:pl-6 @2xl:pr-4 @2xl:pt-4 @2xl:pb-1.5'
// 줄 목록: ① 묶음은 선 없이 여백으로만 나누고, ②는 줄 사이에 옅은 선을 긋는다.
export const LIST = 'px-2 pb-2'
// 줄 사이 선: 둘째 줄부터 위쪽에, 줄 글자 폭만큼 안쪽으로 들인 1px(줄의 둥근 hover 면과 부딪히지 않게 테두리 대신 그림)
export const ROW_RULE =
  'not-first:before:absolute not-first:before:inset-x-3 not-first:before:top-0 not-first:before:h-px not-first:before:bg-border-subtle @2xl:not-first:before:inset-x-4'

// ── 줄 ──
// 977·716: 한 줄 = 무엇·언제(왼쪽 두 층) | 신호 알약(오른쪽 끝에서 왼쪽으로) | 날짜 | 꺾쇠.
// 신호 없는 줄 높이 = 위아래 10 + 22 + 20 = 62(+ 선 1) ≤ 64(K7).
export const ROW = 'gap-3 px-3 py-2.5 @2xl:gap-4 @2xl:px-4 hover:bg-muted/60'
// 제목(줄 덮개) 초점일 때만 줄 전체 링. 알약 초점은 그 알약에만.
export const ROW_FOCUS =
  'has-[[data-name]:focus-visible]:ring-2 has-[[data-name]:focus-visible]:ring-inset has-[[data-name]:focus-visible]:ring-blue-700'
// 오른쪽 신호 칸이 줄을 다 먹지 않게 상한(긴 줄에서 이름이 너무 짧아지지 않게). 넘치면 오른쪽 정렬로 꺾는다.
export const SIGNALS_WIDE = '@2xl:max-w-[56%] @2xl:justify-end'

// ── 신호 알약(아이콘 + 단어) ──
// 977·716: 알약 자체가 단추(높이 28). 390: 단추를 44로 키우고 알약은 그 안 가운데(누르는 자리만 커짐).
// 키운 만큼 위아래 4px씩 되돌려, 알약이 여러 줄로 꺾일 때 줄 사이가 44 간격으로 벌어지지 않게 한다(보이는 틈 8).
export const PILL_HIT = 'max-sm:-my-1 max-sm:min-h-11'
export const PILL = 'h-7 gap-1 rounded-full pl-2 pr-2.5'
export const PILL_ICON = '[&_svg]:size-3.5'

// ── 날짜(다음 일정의 날, 977·716 줄 끝) ──
export const DATE = 'w-[7.5rem] text-right'

// ── 빈 상태 ──
export const EMPTY = 'gap-x-4 gap-y-2 px-5 py-3 @2xl:px-6'

// ── 글자 단계(①과 같은 단계) ──
export const TEXT_HEAD = 'text-[20px] leading-[28px] font-bold tracking-[-0.02em]' // 구역 이름·수
export const TEXT_NAME = 'text-[17px] leading-[22px] font-semibold tracking-[-0.01em]' // 행사 이름
export const TEXT_SUB = 'text-[15px] leading-[20px]' // 다음 일정, 날짜, 전체 보기, 빈 문구
export const TEXT_PILL = 'text-[14px] leading-[20px]' // 신호 알약 안 글
