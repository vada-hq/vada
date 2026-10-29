// c35(③ 내가 할 일, ⑤ 이번 주, 사용 가능 한 줄)의 새 임의 값 모음. ①f8에서 가져다 쓰는 값(쟁반·묶음·줄·얼굴·글자 단계)은
// c1r/f8/tokens.ts를 그대로 import하고, 여기에는 c35에서 새로 생긴 값만 둔다.
// 색은 시맨틱 토큰(fg·fg-secondary·fg-tertiary·fg-muted·card·muted·surface-subtle·primary-strong·primary-surface·danger·danger-surface)만. 새 hex 없음.
// Tailwind가 이 파일의 글자를 읽어 클래스를 만들므로 클래스 이름은 통째로 적는다(조립 금지).

// ── ③ 내가 할 일 ──
// 줄 오른쪽 행동 칸: 977·716은 폭을 고정해 '확인하기'·'보기'·꺾쇠가 같은 오른쪽 끝에 서고, 누구 칸이 같은 세로선에 선다.
export const ACTION_SLOT = 'flex shrink-0 justify-end @2xl:w-28'
// 확인 행동 알약(①의 파란 글 '…에게 묻기'와 다른 생김새: 파란 면을 채운 알약). 원래 화면으로 가는 링크다.
export const ACTION_PILL =
  'h-9 rounded-full bg-primary-surface px-3.5 gap-0.5 font-semibold text-primary-strong group-hover/act:bg-primary-surface/60'
// 390: 알약 단추의 누르는 자리만 44px로 키우고 바깥 여백으로 되돌린다
export const ACTION_TOUCH = 'max-sm:min-h-11 max-sm:-my-1'

// ── ⑤ 이번 주 ──
// 안 a(②e3 가족): 쟁반 + 흰 묶음 + 날짜 칸 줄. 쟁반 머리는 ①②③보다 한 단계 작게(조용한 띠).
export const WEEK_TRAY = 'rounded-[24px] bg-muted p-1.5 @2xl:p-2'
export const WEEK_HEAD = 'px-3.5 pt-2 pb-1.5 @2xl:px-4'
export const WEEK_GROUP = 'rounded-[18px] bg-card px-1.5 py-1 @2xl:px-2'
export const WEEK_ROW = 'min-h-12 gap-3 rounded-xl px-2 py-1.5'
// 날짜 칸: e3 날짜 머리(요일 12 위, 날짜 숫자 15 아래)를 줄 앞으로 옮긴 것
export const DATE_CELL = 'w-8'
export const DATE_WEEKDAY = 'text-[12px] leading-[14px]'
export const DATE_DAY = 'text-[15px] leading-[18px]'
// 라벨 알약('외부'·'제출 마감'): e3 신호 알약의 중립 회색 면
export const LABEL_PILL = 'h-6 rounded-full bg-muted px-2'
// 안 b(①f8 가족): 일정마다 f8 0건 띠와 같은 회색 띠 한 줄. 띠 사이 6px.
export const BAND = 'min-h-12 rounded-[24px] bg-muted pl-2 pr-1.5 gap-3'
export const BAND_STACK = 'gap-1.5'
export const BAND_DOT = 'size-8'
// 안 b 구역 머리(띠 위 작은 이름)
export const BAND_HEAD = 'px-3 pb-1.5'

// ⑤의 [안건 올리기]: 이 구역의 유일한 버튼(창으로 여는 시작 행동). 파란 글 + 더하기, 테두리 없음.
export const AGENDA_BUTTON =
  'relative z-10 h-9 shrink-0 gap-1 rounded-full border-0 px-3 py-0 text-primary-strong hover:bg-primary-surface hover:no-underline [&_svg]:size-4 max-sm:min-h-11 max-sm:-my-1'

// ── 사용 가능 ──
// 안 a(②e3 가족): 바탕 없는 한 줄, 금액은 e3 예산 신호 알약 꼴(지갑 아이콘 + 금액). 음수만 빨간 면.
export const AVAIL_LINE = 'min-h-12 gap-2.5 px-3.5'
export const AMOUNT_PILL = 'h-7 rounded-full px-2.5 gap-1'
export const AMOUNT_ICON = 'size-3.5'
// 안 b(①f8 가족): f8 0건 띠와 같은 회색 띠 한 줄(흰 원 + 글 + 오른쪽 글 단추)
export const AVAIL_BAND = 'h-14 rounded-[28px] bg-muted pl-3 pr-1.5 gap-3'

// 글자: 이번 주 줄 제목·사용 가능 금액(16), 보조 글(14)
export const TEXT_ITEM = 'text-[16px] leading-[22px] font-semibold tracking-[-0.01em]'
export const TEXT_SMALL = 'text-[14px] leading-[20px]'
// 안 a 쟁반 머리(15 굵게)
export const TEXT_QUIET_HEAD = 'text-[15px] leading-[22px] font-bold'
