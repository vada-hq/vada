// f5 '큰 숫자와 링'에서 쓴 임의 값. 나중에 앱 토큰으로 뽑을 후보라 이름을 붙여 한곳에 모은다.
// 색은 시맨틱 토큰 클래스만 쓴다(새 hex 없음).
import type { C1rKind } from '../c1r-data'

// ── 링 ──
// 큰 링(716·977, 왼쪽 면 가운데)과 작은 링(358, 머리 왼쪽)
export const RING_LG = { size: 132, stroke: 12 }
export const RING_SM = { size: 76, stroke: 8 }
// 조각 사이 틈(도). 조각 하나 = 한 건이라 틈이 있어야 건수가 세어진다.
export const RING_GAP_DEG = 7
// 정상인 날 체크 링(지름)
export const CHECK_RING = 28

// ── 글자 ──
// 링 가운데 큰 건수(716·977 / 358). 나머지 글자는 text-sm(14)·text-xs(12) 두 단계만 쓴다.
export const NUMBER_LG = 'text-[44px] leading-none'
export const NUMBER_SM = 'text-[28px] leading-none'

// ── 면·자리 ──
// 왼쪽 링 면의 폭(716·977)과 모서리
export const SIDE_W = '@2xl:grid-cols-[216px_minmax(0,1fr)]'
export const FACE_RADIUS = 'rounded-[14px]'
// 줄 모서리(hover 면)
export const ROW_RADIUS = 'rounded-[10px]'
// 사실 칸 폭: 716·977은 '결재 대기 D-3'이 한 줄로 드는 폭, 358은 좁혀 두 줄을 허용한다(자르지 않음)
export const FACT_COL = 'w-[76px] @2xl:w-[112px]'

// ── 이유 묶음: 링 조각·범례·줄 점이 같은 색을 쓴다 ──
// 지남·오늘만 위험 색, 나머지는 중립 회색 두 농도(명세 6절 색 역할).
export type Group = 'late' | 'soon' | 'assign'
export const GROUP_OF: Record<C1rKind, Group> = {
  late: 'late',
  today: 'late',
  tomorrow: 'soon',
  approval: 'soon',
  'no-department': 'assign',
  unassigned: 'assign',
}
export const GROUPS: { id: Group; label: string; stroke: string; fill: string }[] = [
  { id: 'late', label: '지남·오늘', stroke: 'stroke-danger', fill: 'bg-danger' },
  { id: 'soon', label: '임박', stroke: 'stroke-fg-muted', fill: 'bg-fg-muted' },
  { id: 'assign', label: '배정 필요', stroke: 'stroke-input', fill: 'bg-input' },
]
export const GROUP_STYLE = Object.fromEntries(GROUPS.map(g => [g.id, g])) as Record<
  Group,
  (typeof GROUPS)[number]
>
