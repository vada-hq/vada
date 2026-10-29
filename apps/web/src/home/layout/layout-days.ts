// 회장단 홈 배치 시안(layout)의 '하루' 견본 셋과 배치 안 셋의 축 값.
// 명세: notes/integration/home/layout-spec.md 1절(하루)·3절(축). 구역 견본은 각 구역 폴더의 것을 그대로 묶는다(고치지 않음).

import { C1R_DATA, type C1rData } from '../c1r/c1r-data'
import { C2_DATA, type C2Data } from '../c2/c2-data'
import { C35_DATA } from '../c35/c35-data'

// 하루: 신호 많은 날(busy) / 평소(quiet, 설계 기준) / 첫날(first)
//   busy:  ① main, ② main, ③ main, ⑤ main, 사용 가능 음수
//   quiet: ① normal(0건), ② quiet, ③ normal, ⑤ normal, 사용 가능 양수
//   first: ① empty, ② empty, ③ empty, ⑤ empty, 사용 가능 없음
// shell: 옆 메뉴·머리를 띄우는 미리보기 견본(s5-data) 이름. 첫날은 옆 메뉴의 행사도 비운다.
type LayoutDay = {
  c1: C1rData
  c2: C2Data
  c35: (typeof C35_DATA)[keyof typeof C35_DATA]
  shell: 'main' | 'normal' | 'empty'
}

export const LAYOUT_DAYS = {
  busy: { c1: C1R_DATA.main, c2: C2_DATA.main, c35: C35_DATA.main, shell: 'main' },
  quiet: { c1: C1R_DATA.normal, c2: C2_DATA.quiet, c35: C35_DATA.normal, shell: 'normal' },
  first: { c1: C1R_DATA.empty, c2: C2_DATA.empty, c35: C35_DATA.empty, shell: 'empty' },
} satisfies Record<string, LayoutDay>
export type LayoutDayName = keyof typeof LAYOUT_DAYS
export const LAYOUT_DAY_NAMES = Object.keys(LAYOUT_DAYS) as LayoutDayName[]

// 오늘(견본 공통)
export const LAYOUT_TODAY = '2026-10-29'

// ── 축(명세 3절) ──
// greet   머리: line(날짜 + 인사 한 줄) / date(날짜만) / merge(평소엔 line, ①이 0건이면 ① 띠 대신 인사+정보 한 문장)
// columns 1280의 단: one(한 단) / two(왼쪽 ①② | 오른쪽 ③⑤·사용 가능) / mixed(위 ① 한 단, 아래 ② | ③⑤·사용 가능)
// focus   ①의 초점: tray(①만 쟁반 한 단계 진하게) / same(같은 무게) / yield(①이 0건이면 ①이 빠지고 ②가 첫 구역)
// between 구역 사이: space(간격만) / size(구역 머리 글자 크기 차이) / line(얇은 구분)
export type LayoutGreet = 'line' | 'date' | 'merge'
export const LAYOUT_GREETS: LayoutGreet[] = ['line', 'date', 'merge']

export const LAYOUT_PLANS = {
  L1: { greet: 'line', columns: 'one', focus: 'tray', between: 'space' },
  L2: { greet: 'date', columns: 'two', focus: 'same', between: 'size' },
  L3: { greet: 'merge', columns: 'mixed', focus: 'yield', between: 'line' },
} as const satisfies Record<
  string,
  {
    greet: LayoutGreet
    columns: 'one' | 'two' | 'mixed'
    focus: 'tray' | 'same' | 'yield'
    between: 'space' | 'size' | 'line'
  }
>
export type LayoutPlan = keyof typeof LAYOUT_PLANS
export const LAYOUT_PLAN_NAMES = Object.keys(LAYOUT_PLANS) as LayoutPlan[]
