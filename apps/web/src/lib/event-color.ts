import type { EventColorKey } from '@vada/contracts'

// 행사 색 → 범주 색(부서 색과 같은 대응: lime 8, sky 5, violet 2, emerald 3, indigo 7, teal 1).
// solid는 네모 표식(가득 찬 색), css는 막대 그라데이션·마름모에 쓰는 CSS 변수(투명도는 color-mix로 섞는다).
// Tailwind가 찾도록 클래스 이름은 조합하지 않는다.
export type EventColor = { solid: string; css: string }

const EVENT_COLOR: Record<EventColorKey, EventColor> = {
  lime: { solid: 'bg-category-8', css: 'var(--color-category-8)' },
  sky: { solid: 'bg-category-5', css: 'var(--color-category-5)' },
  violet: { solid: 'bg-category-2', css: 'var(--color-category-2)' },
  emerald: { solid: 'bg-category-3', css: 'var(--color-category-3)' },
  indigo: { solid: 'bg-category-7', css: 'var(--color-category-7)' },
  teal: { solid: 'bg-category-1', css: 'var(--color-category-1)' },
}

export const eventColorOf = (key: EventColorKey) => EVENT_COLOR[key]

// 투명도를 섞은 CSS 색(0~1)
const PERCENT = 100
export const mixColor = (color: EventColor, alpha: number) =>
  `color-mix(in oklab, ${color.css} ${Math.round(Math.min(1, Math.max(0, alpha)) * PERCENT)}%, transparent)`
