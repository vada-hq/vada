// 행사 색: 행사 하나의 정체성 색. 행사 id로 정해 홈·캘린더·행사 목록 어디서나 같은 행사는 같은 색이다.
// 부서 색(lib/department-color.ts, contracts defaultDepartmentColor)과 같은 꼴: 저장색이 있으면 그것, 없으면 id 해시.
// 팔레트는 범주 색(category-1~8) 가운데 분홍(4)·주황(6)을 뺀 여섯. 둘은 위험 빨강(지남·초과)과 헷갈린다.
// 팔레트 순서는 저장 키처럼 바꾸지 않는다(바꾸면 모든 행사 색이 바뀐다).
// 사람(①의 얼굴)과 구별: 사람 = 둥근 얼굴, 옅은 면(soft) + 진한 글자. 행사 = 네모·막대, 가득 찬 색(500), 글자 없음.
// Tailwind가 이 파일의 글자를 읽어 클래스를 만들므로 클래스 이름은 통째로 적는다(조립 금지).

export const EVENT_COLORS = ['lime', 'sky', 'violet', 'emerald', 'indigo', 'teal'] as const
export type EventColorKey = (typeof EVENT_COLORS)[number]

// solid = 네모 표식(가득 찬 색), css = 막대 그라데이션·마름모에 쓰는 CSS 변수(투명도는 color-mix로 섞음)
export type EventColor = { key: EventColorKey; solid: string; css: string }

const COLOR: Record<EventColorKey, EventColor> = {
  lime: { key: 'lime', solid: 'bg-category-8', css: 'var(--color-category-8)' },
  sky: { key: 'sky', solid: 'bg-category-5', css: 'var(--color-category-5)' },
  violet: { key: 'violet', solid: 'bg-category-2', css: 'var(--color-category-2)' },
  emerald: { key: 'emerald', solid: 'bg-category-3', css: 'var(--color-category-3)' },
  indigo: { key: 'indigo', solid: 'bg-category-7', css: 'var(--color-category-7)' },
  teal: { key: 'teal', solid: 'bg-category-1', css: 'var(--color-category-1)' },
}

// contracts defaultDepartmentColor와 같은 해시(목록 차례·이름 변경과 무관)
const HASH_MULTIPLIER = 31
const HASH_MODULUS = 2_147_483_647
export function defaultEventColor(id: string): EventColorKey {
  let hash = 0
  for (const char of id.toLowerCase())
    hash = (hash * HASH_MULTIPLIER + char.charCodeAt(0)) % HASH_MODULUS
  return EVENT_COLORS[hash % EVENT_COLORS.length] ?? EVENT_COLORS[0]
}

// 앱에서는 행사에 저장색(color)을 두고, 만들 때 진행 중인 행사와 겹치지 않는 색을 고르는 쪽을 권한다.
// 견본(C2Event)에는 저장색이 없어 id 해시만 쓴다.
export function eventColorOf(event: { id: string; color?: EventColorKey | null }): EventColor {
  return COLOR[event.color ?? defaultEventColor(event.id)]
}

// 투명도를 섞은 CSS 색(0~1)
const PERCENT = 100
export const mix = (color: EventColor, alpha: number) =>
  `color-mix(in oklab, ${color.css} ${Math.round(Math.min(1, Math.max(0, alpha)) * PERCENT)}%, transparent)`
