import { createContext } from 'react'
import type { LayoutDayName, LayoutGreet, LayoutPlan } from './layout-days'

// 배치 시안 미리보기(home-s5.html?component=layout)에서만 값이 있다. HomeBody가 이것을 보고 회장단 홈 자리를 배치 시안으로 바꾼다.
export type LayoutPreviewValue = {
  plan: LayoutPlan
  day: LayoutDayName
  week: 'a' | 'b'
  greet: LayoutGreet
}
export const LayoutPreview = createContext<LayoutPreviewValue | null>(null)
