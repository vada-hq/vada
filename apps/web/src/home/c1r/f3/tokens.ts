// f3(위쪽 상태 띠)의 임의 값 모음. 나중에 앱 토큰으로 뽑을 후보라 이름을 붙여 한곳에 둔다.
// 색은 모두 시맨틱 토큰(fg·fg-secondary·fg-tertiary·fg-muted·card·muted·border·primary-strong·primary-surface·danger)이다. 새 hex 없음.

// ── 띠(구역 머리) ──
// 흰 면, 둥근 띠. 977(@4xl)은 한 줄이라 높이 72의 절반 = 완전한 알약, 그 아래 폭은 두 단이라 28.
export const BAND_RADIUS = 'rounded-[28px] @4xl:rounded-[36px]'
export const BAND_RADIUS_QUIET = 'rounded-[28px]'
// 바닥(gray-50)에서 겨우 떠오를 만큼의 그림자(카카오뱅크 맨 위 알약)
export const BAND_SHADOW =
  'shadow-[0_1px_2px_rgb(16_24_40/0.05),0_8px_24px_-10px_rgb(16_24_40/0.14)]'
export const BAND_PAD = 'p-3'
// 띠 앞 둥근 표(메달): 구역 표시. 강조 1색(primary)의 옅은 면.
export const MEDAL = 'size-10'

// ── 이유 알약(애플 홈 상태 알약: 아이콘 원 + 두 줄 글) ──
export const PILL = 'h-12 rounded-full pl-1.5 pr-4 max-sm:pr-3'
export const PILL_ICON = 'size-9'
export const PILL_GAP = 'gap-1.5'

// ── 줄(상자 없음) ──
// 줄 앞 아이콘 원. 띠의 메달과 가운데 선이 맞도록(띠 p-3 + 메달 40 → 중심 32, 줄 pl-3.5 + 원 36 → 중심 32).
export const ROW_ICON = 'size-9'
export const ROW_PAD_X = 'pl-3.5 pr-3'

// ── 글자 단계(3) ──
export const TEXT_COUNT = 'text-[22px] leading-[28px] tracking-[-0.01em]' // 머리 건수(가장 큰 글자)
export const TEXT_MAIN = 'text-[15px] leading-[22px]' // 구역 이름, 줄 제목
export const TEXT_SUB = 'text-[13px] leading-[18px]' // 사실·사람·물어봄·행사, 알약 글
