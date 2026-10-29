// f8(f7 회색 쟁반 아이콘 줄 + f4 작은 얼굴·답 표시)의 임의 값 모음. 나중에 앱 토큰으로 뽑을 후보라 이름을 붙여 한곳에 둔다.
// 색은 시맨틱 토큰(fg·fg-secondary·fg-tertiary·fg-muted·card·muted·primary·primary-strong·primary-surface·danger)과
// 범주 색(category-*, 얼굴에만)만 쓴다. 새 hex 없음.
// Tailwind가 이 파일의 글자를 읽어 클래스를 만들므로 클래스 이름은 통째로 적는다(조립 금지).

// ── 구역 바탕(회색 쟁반) ──
export const TRAY = 'rounded-[28px] bg-muted p-2 @2xl:p-2.5'
// 쟁반 머리: 왼쪽 끝을 줄의 아이콘 원 왼쪽 끝에 맞춘다(쟁반 + 묶음 + 줄 안쪽 여백의 합).
export const TRAY_HEAD = 'px-4.5 pt-3 pb-2 @2xl:px-5.5 @2xl:pt-3.5 @2xl:pb-3'

// ── 흰 묶음 ──
export const GROUP = 'rounded-[22px] bg-card p-1.5 @2xl:p-2'

// ── 줄 ──
// 줄 상자. 마우스를 올리면 옅은 회색 면(일 보기). 사람 단추 위에 있을 때는 줄 면을 끄고 사람 단추만 면을 띄운다.
// 키보드 초점 링도 제목 단추에 초점이 있을 때만 줄 전체에 그린다(사람 단추 초점은 그 단추에만).
export const ROW =
  'gap-3 rounded-2xl px-3 py-2.5 @2xl:gap-4 @2xl:px-3.5 @2xl:py-3.5 hover:bg-muted/60 has-[[data-who]:hover]:bg-transparent'
export const ROW_FOCUS =
  'has-[[data-title]:focus-visible]:ring-2 has-[[data-title]:focus-visible]:ring-inset has-[[data-title]:focus-visible]:ring-blue-700'
// 줄 몸: 390은 무엇(제목·사실) 아래 누구(얼굴·묻기)를 쌓고, 716·977은 두 칸(무엇 | 누구)으로 펼쳐 줄 가운데를 채운다.
export const ROW_BODY = 'min-w-0 flex-1 @2xl:grid @2xl:grid-cols-2 @2xl:items-center @2xl:gap-x-6'
// 이유 아이콘 원(토스 혜택 줄의 회색 원). 중립: 이유는 그림과 사실 글이 말한다.
// 390에서는 뺀다: 정보가 아닌 원이 폭 56px를 먹어 물어봄·배정 글이 한 줄 더 꺾이고 K1(높이 700)을 넘긴다.
export const ICON_DOT = 'size-11 @2xl:size-12 bg-muted text-fg-secondary @max-2xl:hidden'
export const ICON_GLYPH = 'size-[22px] @2xl:size-6'

// ── 사람 ──
// 줄 안 작은 얼굴(머리글자 원) 28px, 글자 11px
export const FACE = 'size-7 text-[11px] leading-none'
// 사람 단추(묻기 / 물은 대화): 덮개 위(z-10). 390에서는 누르는 자리만 44px로 키우고 바깥 여백으로 되돌린다.
export const WHO = 'relative z-10 h-auto min-h-9 rounded-full max-sm:-my-2 max-sm:min-h-11'
// 물어봄 말풍선 알약
export const ASKED_PILL = 'h-7 rounded-full px-2.5 gap-1.5'
// 답 있음 점(새 소식)
export const ANSWER_DOT = 'size-2'

// ── 0건 띠 ──
export const QUIET = 'h-14 rounded-[28px] bg-muted px-3 gap-3'
export const QUIET_DOT = 'size-9'

// ── 글자 단계(3) ──
export const TEXT_HEAD = 'text-[20px] leading-[28px] font-bold tracking-[-0.02em]' // 구역 이름·건수(가장 큰 글자)
export const TEXT_TITLE = 'text-[17px] leading-[24px] font-semibold tracking-[-0.01em]' // 줄 제목
export const TEXT_SUB = 'text-[15px] leading-[22px]' // 사실·행사, 사람, 물어봄, 전체 보기, 0건 글
// 물어봄 알약 안 글(TEXT_SUB보다 한 단계 작게: 알약 높이 28 안에 둔다)
export const TEXT_PILL = 'text-[14px] leading-[20px]'

// ── 전체 보기(묶음 아래 가운데) ──
export const SEE_ALL = 'min-h-11'

// 얼굴 바탕·머리글자 색(범주 색 soft/strong 짝, f4와 같은 표). 사람이 처음 나온 차례대로 돌려 쓴다(같은 사람 = 같은 색).
// 분홍(4)·주황(6)은 위험 빨강과 헷갈려 뺐다. 머리글자 대비는 strong on soft로 4.5:1 이상.
export const FACE_TINTS = [
  'bg-category-5-soft text-category-5-strong', // sky
  'bg-category-2-soft text-category-2-strong', // violet
  'bg-category-3-soft text-category-3-strong', // emerald
  'bg-category-7-soft text-category-7-strong', // indigo
  'bg-category-1-soft text-category-1-strong', // teal
  'bg-category-8-soft text-category-8-strong', // lime
] as const
