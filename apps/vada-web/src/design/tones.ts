// 색을 화면마다 적지 않는다. 여기가 한 곳이다.
//
// 원본은 figma.design.json이고 이 파일은 그 색에 이름을 붙인 것뿐이다. 둘이
// 어긋나면 design 대조(design-check)가 게이트에서 잡는다 — 그래서 이 표는 두 번째
// 진실이 아니라, 대조로 원본에 묶여 있는 한 곳이다.
//
// 왜 표가 필요한가. Tailwind는 클래스 이름을 실행 중에 만들 수 없다 —
// `bg-${tone}-100`은 빌드 때 훑어지지 않아 그 색이 아예 만들어지지 않는다.
// 그래서 톤마다 미리 적어 둔다.
//
// 톤 이름은 데이터가 준다(부서 색·주의 색은 조직이 정하는 값이라 이름으로 온다).
// 이름을 실제 색으로 옮기는 일만 구현이 한다.

/** 부서 딱지: 옅은 바탕에 진한 글씨(TASK-01 18:140). */
export const DEPARTMENT_CHIP: Record<string, string> = {
  teal: 'bg-teal-100 text-teal-700',
  pink: 'bg-pink-100 text-pink-700',
  emerald: 'bg-emerald-100 text-emerald-700',
  violet: 'bg-violet-100 text-violet-700',
  red: 'bg-red-100 text-red-700',
}

/** 업무 카드를 두르는 강조 테두리(TASK-01 18:136). */
export const ACCENT_BORDER: Record<string, string> = {
  teal: 'border-teal-500',
  pink: 'border-pink-500',
  emerald: 'border-emerald-500',
  violet: 'border-violet-500',
  red: 'border-red-500',
}

/** 주의 딱지: 테두리까지 있는 옅은 칩(TASK-01 18:216). */
export const ALERT_CHIP: Record<string, string> = {
  red: 'border-red-200 bg-red-50 text-red-700',
  yellow: 'border-yellow-200 bg-yellow-50 text-yellow-700',
}

/** 공간 카드의 옅은 테두리(OPS-00 16:614). */
export const SOFT_BORDER: Record<string, string> = {
  blue: 'border-blue-200',
  indigo: 'border-indigo-200',
  purple: 'border-purple-200',
  orange: 'border-orange-200',
}

/**
 * 큰 값 글씨(HOME-01K 16:102·16:295). **톤의 -600으로 통일한다.**
 *
 * 와이어프레임은 red만 500으로 그렸다. 규칙이 아니라 흔들림이므로 따르지 않는다 —
 * 그래야 값 타일을 하나 더 만들 때 와이어프레임을 다시 들여다보지 않아도 된다.
 * 그래서 생긴 차이는 design/deviations.ts에 적혀 있다.
 */
export const VALUE_TEXT: Record<string, string> = {
  blue: 'text-blue-600',
  indigo: 'text-indigo-600',
  orange: 'text-orange-600',
  red: 'text-red-600',
}

/**
 * 요약의 상태 칩(MY-01 16:402·TASK-01 18:96).
 * **바탕 -50, 테두리 -100, 글씨 -800으로 통일한다.**
 *
 * 어느 상태냐는 명세의 field가 말한다 — 이 이름들은 화면이 아니라 데이터 출처의
 * 것이므로, 같은 상태는 어느 화면에서든 같은 색이다.
 *
 * 와이어프레임은 지연만 -700으로 그렸다. 규칙이 아니라 흔들림이므로 따르지 않는다 —
 * 상태가 하나 늘 때 무슨 색을 줄지 규칙만 보고 정할 수 있어야 한다. 그래서 생긴
 * 차이는 design/deviations.ts에 적혀 있다.
 */
export const STATUS_CHIP: Record<string, string> = {
  delayedCount: 'border-red-100 bg-red-50 text-red-800',
  todoCount: 'border-orange-100 bg-orange-50 text-orange-800',
  reviewCount: 'border-yellow-100 bg-yellow-50 text-yellow-800',
  mineCount: 'border-blue-100 bg-blue-50 text-blue-800',
  unassignedCount: 'border-red-100 bg-red-50 text-red-800',
}

/** 표에 없는 톤은 조용히 색 없이 지나가지 않고 무채색으로 드러난다. */
export const NEUTRAL_CHIP = 'border-gray-200 bg-white text-gray-700'
export const NEUTRAL_BORDER = 'border-gray-200'
export const NEUTRAL_VALUE = 'text-gray-900'
