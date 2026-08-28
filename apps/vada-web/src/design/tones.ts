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

/**
 * 옅은 상자(EVT-02 20:4819·20:4911). 바탕 -50, 테두리 -200.
 *
 * 딱지(STATE_CHIP)와 같은 배합이지만 글자 색을 함께 갖지 않는다 — 상자 안에서
 * 제목·값·부연의 색이 저마다 다르기 때문이다.
 */
export const SOFT_BOX: Record<string, string> = {
  blue: 'border-blue-200 bg-blue-50',
  green: 'border-green-200 bg-green-50',
  yellow: 'border-yellow-200 bg-yellow-50',
  red: 'border-red-200 bg-red-50',
  // 후속 정리 현황의 '정리되지 않은 문서' 타일(EVT-02D 20:5859).
  orange: 'border-orange-200 bg-orange-50',
}

/**
 * 옅은 상자 안의 글(EVT-02 20:4911). **값은 -800으로 통일한다.**
 *
 * 라벨과 부연은 green·yellow만 한 단계 내린다. 흔들림이 아니라 이유가 있다 —
 * green-500·yellow-500은 같은 계열의 -50 바탕 위에서 읽히지 않는다. blue·red는
 * 그 자리에서도 충분히 진하다.
 *
 * 와이어프레임은 강조 카드의 값만 -700으로 그렸다(blue·red). 그것은 규칙이
 * 아니라 흔들림이므로 따르지 않고 design/deviations.ts에 적는다.
 */
export const SOFT_BOX_TEXT: Record<
  string,
  { label: string; value: string; note: string }
> = {
  blue: { label: 'text-blue-600', value: 'text-blue-800', note: 'text-blue-500' },
  green: { label: 'text-green-700', value: 'text-green-800', note: 'text-green-600' },
  yellow: { label: 'text-yellow-700', value: 'text-yellow-800', note: 'text-yellow-600' },
  red: { label: 'text-red-600', value: 'text-red-800', note: 'text-red-500' },
}

/**
 * 표 한 줄 왼쪽의 강조선(EVT-DOC-01 28:589). **톤의 -500으로 통일한다.**
 *
 * 무채색만 -400이다. 흔들림이 아니라 이유가 있다 — gray-500은 본문 글자의 색이라
 * 장식인 선이 글보다 진해진다.
 *
 * 톤 이름은 데이터가 준다. 문서가 행사의 어느 국면에 속하는지가 색을 정하는데,
 * 국면은 조직이 늘릴 수 있는 것이라 화면이 목록을 들고 있을 수 없다.
 */
export const ACCENT_BAR: Record<string, string> = {
  blue: 'bg-blue-500',
  amber: 'bg-amber-500',
  violet: 'bg-violet-500',
  gray: 'bg-gray-400',
}

/**
 * 목록을 좁혀 보는 버튼 묶음의 칩(EVT-00A 20:4155·EVT-DOC-01 28:562·EVT-SCHED-01 28:150).
 * **고른 것은 blue-600 바탕에 흰 글씨, 아닌 것은 흰 바탕에 gray-200 테두리·gray-600 글씨.**
 *
 * 색 이름을 데이터가 주지 않는 유일한 표다. 무엇을 고를 수 있는지는 명세에
 * 고정이고(option-sources.json), 고른 것이 하나라는 사실 말고 갈릴 것이 없다.
 *
 * 와이어프레임이 세 자리에서 흔들렸다. 고른 것의 바탕은 blue-600이 둘·gray-800이
 * 하나(EVT-DOC-01), 안 고른 글씨는 gray-600이 둘·gray-500이 하나(EVT-00A)다.
 * 많은 쪽을 규칙으로 삼고 나머지는 design/deviations.ts에 적는다 — 필터를 하나 더
 * 만들 때 무슨 색을 줄지 와이어프레임을 열어 보지 않아야 한다.
 */
export const CHOICE_CHIP = {
  on: 'border-blue-600 bg-blue-600 text-white',
  off: 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50',
} as const

/**
 * 줄 앞머리의 때(EVT-SCHED-01 28:353). **톤의 -700, 무채색만 gray-500.**
 *
 * ACCENT_BAR와 같은 톤 이름을 받는다 — 한 줄에서 점과 날짜가 같은 사실을 말하기
 * 때문이다. 무채색이 본문과 같은 색인 것은 흔들림이 아니라 이유가 있다: 도드라질
 * 것이 없는 줄은 도드라지지 않아야 한다.
 */
export const LEAD_TEXT: Record<string, string> = {
  blue: 'text-blue-700',
  amber: 'text-amber-700',
  violet: 'text-violet-700',
  gray: 'text-gray-500',
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
  // 상태별 개수 타일(MY-REQ-01 30:164). 앞의 넷보다 한 단계 짙다 — 옆에 라벨이
  // 회색으로 작게 붙어 수가 홀로 서기 때문이다.
  yellow: 'text-yellow-700',
  green: 'text-green-700',
  purple: 'text-purple-700',
  gray: 'text-gray-600',
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

/**
 * 상태 딱지(OPS-MEET-01A 18:458). **바탕 -50, 글씨 -700으로 통일한다.**
 *
 * 회의 상태(예정·진행 중·정리 중·취소)는 조직 운영에 따라 늘 수 있으므로 색 이름은
 * 데이터가 준다(data-sources.json의 statusTone). 이름을 색으로 옮기는 일만 여기서 한다.
 *
 * 무채색만 다르다 — 끝난 것(완료)과 덧붙는 표시(비공개)는 테두리 없이
 * gray-100/gray-500이다. 흔들림이 아니라 이유가 있다: gray-50은 흰 카드 위에서
 * 바탕이 보이지 않고, 끝난 것을 테두리로 앞세울 이유도 없다.
 */
export const STATE_CHIP: Record<string, string> = {
  gray: 'bg-gray-100 text-gray-500',
  blue: 'border border-blue-200 bg-blue-50 text-blue-700',
  green: 'border border-green-200 bg-green-50 text-green-700',
  yellow: 'border border-yellow-200 bg-yellow-50 text-yellow-700',
  red: 'border border-red-200 bg-red-50 text-red-700',
  orange: 'border border-orange-200 bg-orange-50 text-orange-700',
}

/** 표 안의 작은 상태 딱지. FIN-PROC-01은 바탕만 있고 테두리는 그리지 않는다. */
export const TABLE_STATE_CHIP: Record<string, string> = {
  gray: 'bg-gray-100 text-gray-500',
  blue: 'bg-blue-50 text-blue-700',
  green: 'bg-green-50 text-green-700',
  yellow: 'bg-yellow-50 text-yellow-700',
  red: 'bg-red-50 text-red-700',
  orange: 'bg-orange-50 text-orange-700',
}

/** 딱지 없이 글자색만 상태를 드러내는 표 값(FIN-PROC-01 배송 상태). */
export const STATE_TEXT: Record<string, string> = {
  gray: 'text-gray-500',
  blue: 'text-blue-700',
  green: 'text-green-700',
  yellow: 'text-yellow-700',
  red: 'text-red-500',
  orange: 'text-orange-700',
}

/** 보완처럼 주의를 요구하지만 위험 동작은 아닌 작은 화면 행동. */
export const CAUTION_BUTTON = 'bg-yellow-100 text-yellow-700'

/**
 * 정보 딱지(EVT-00A 20:4195). 색이 하나뿐이라 이름을 받지 않는다.
 *
 * 상태 딱지와 다른 것이다 — 상태는 무엇이냐를 말하므로 색이 갈리지만, 이것은
 * 행사마다 개수만 다른 요약 문구라 전부 같은 무채색이다.
 */
export const INFO_CHIP = 'border border-gray-100 bg-gray-50 text-gray-600'

/** 더 옅은 정보 딱지(EVT-TASK-02 25:1738). 바탕까지 gray-100이다. */
export const MUTED_CHIP = 'border border-gray-100 bg-gray-100 text-gray-600'

/** 표에 없는 톤은 조용히 색 없이 지나가지 않고 무채색으로 드러난다. */
export const NEUTRAL_CHIP = 'border-gray-200 bg-white text-gray-700'
export const NEUTRAL_BORDER = 'border-gray-200'
export const NEUTRAL_VALUE = 'text-gray-900'

/**
 * 고른 선택지가 판정마다 다른 색으로 칠해지는 묶음(FIN-REV-01 30:1486).
 *
 * 보통의 choiceGroup은 고른 것이 파랑 하나다. 여기서는 무엇을 골랐느냐가 곧 결과라
 * 색이 갈린다 - 승인은 초록, 보완은 노랑, 반려는 빨강. 어느 판정이 어느 색인지는
 * design의 사실이고, 값과 색을 잇는 일은 여기 한 곳에서 한다.
 *
 * 안 고른 것은 판정과 무관하게 회색이다: 아직 그것이 아니기 때문이다.
 */
export const VERDICT_CHOICE: Record<string, string> = {
  승인: 'bg-green-600 border-green-600 text-white',
  보완: 'bg-yellow-500 border-yellow-500 text-white',
  반려: 'bg-red-600 border-red-600 text-white',
}

/** 값이 분류일 뿐 상태가 아닌 딱지(FIN-REV-01의 '일반 구매'). */
export const TYPE_CHIP = 'bg-gray-100 text-gray-500'

/**
 * 조직도에서 그 사람의 자리를 말하는 딱지(ORG-03A 30:4536·30:4550).
 *
 * STATE_CHIP과 배합이 다르다 - 테두리 없이 -200 바탕만 쓴다. 상태 딱지는 흰
 * 카드 위에 놓이지만 이것은 이미 색이 깔린 카드 안에 겹쳐 놓이기 때문이다.
 */
export const ROLE_CHIP: Record<string, string> = {
  yellow: 'bg-yellow-200 text-yellow-800',
  blue: 'bg-blue-200 text-blue-800',
}

/**
 * 기본 역할 딱지(ORG-04B). 회장단만 보라이고 부서장은 파랑, 부원은 무채색이다.
 *
 * ROLE_CHIP과 다르다 - 저기는 조직도의 자리 딱지라 -200 바탕에 -800 글씨이고,
 * 여기는 목록 줄 끝의 둥근 딱지라 한 단계 옅다. 같은 '역할'이라도 그려지는
 * 자리가 다르면 배합이 다르다.
 */
export const BASE_ROLE_CHIP: Record<string, string> = {
  violet: 'border-violet-200 bg-violet-50 text-violet-700',
  blue: 'border-blue-200 bg-blue-50 text-blue-700',
  gray: 'border-gray-200 bg-gray-50 text-gray-600',
}

/** 자리 딱지를 단 사람의 카드 자체도 그 색을 옅게 깐다(30:4525·30:4539). */
export const ROLE_CARD: Record<string, string> = {
  yellow: 'border-yellow-300 bg-yellow-50',
  blue: 'border-blue-200 bg-blue-50',
}

/**
 * 이미 색이 깔린 상자 안에 겹쳐 놓이는 상태 딱지(ORG-03C 30:5325).
 *
 * STATE_CHIP과 달리 테두리가 없고 바탕이 -100이다 - 흰 카드 위가 아니라 -50이
 * 깔린 상자 위에 놓이므로 한 단계 더 진해야 보인다(ROLE_CHIP과 같은 이유).
 */
export const CHIP_ON_TINT: Record<string, string> = {
  green: 'bg-green-100 text-green-700',
}

/**
 * 줄 전체를 옅게 칠하는 색(itemList.rowToneField).
 *
 * 손봐야 하는 줄만 다르다 — 학생 명단에서 명단과 납부 기록이 어긋난 학생이
 * 그 자리다. 딱지보다 옅어야 한다: 줄 전체가 칠해지므로 같은 -100이면 표가
 * 얼룩덜룩해진다.
 */
export const ROW_TONE: Record<string, string> = {
  yellow: 'bg-yellow-50',
  red: 'bg-red-50',
}

/**
 * 상태 띠(OPS-MEET-03A 18:2955, OPS-MEET-09 20:2719). **테두리는 톤의 -200으로 통일한다.**
 *
 * 와이어프레임이 흔들린다 - 03A의 파란 띠는 -100이고 09의 붉은 띠는 -200이다.
 * 같은 종류의 띠이므로 규칙을 따르고 그 차이는 design/deviations.ts에 적는다.
 *
 * 톤 이름은 데이터가 준다(meeting.detail.stateBannerTone). 회의 상태가 색을
 * 정하는데 상태는 조직이 늘릴 수 있는 것이라 화면이 목록을 들고 있을 수 없다.
 */
export const BANNER_TONE: Record<string, string> = {
  blue: 'border-blue-200 bg-blue-50',
  orange: 'border-orange-200 bg-orange-50',
  green: 'border-green-200 bg-green-50',
  yellow: 'border-yellow-200 bg-yellow-50',
  red: 'border-red-200 bg-red-50',
}

/** 그 띠 안의 글. 제목은 -800, 본문은 -700이다. */
export const BANNER_TEXT: Record<string, { title: string; note: string }> = {
  blue: { title: 'text-blue-800', note: 'text-blue-700' },
  orange: { title: 'text-orange-800', note: 'text-orange-700' },
  green: { title: 'text-green-800', note: 'text-green-700' },
  yellow: { title: 'text-yellow-800', note: 'text-yellow-700' },
  red: { title: 'text-red-800', note: 'text-red-700' },
}

/**
 * 되돌릴 수 없는 동작의 으뜸 단추(OPS-MEET-D02 회의 종료 · D04 회의 취소).
 *
 * **색이 아니라 뜻이다.** button.emphasis는 primary·secondary·quiet 셋뿐이라
 * '되돌릴 수 없다'를 명세가 말하지 못한다 - 그 사실은 design이 빨갛게 그린
 * 것으로만 남아 있다. 다음 위험 단추를 만들 때 와이어프레임을 다시 열지
 * 않으려면 여기 한 곳에 있어야 한다.
 *
 * CAUTION_BUTTON과 짝이다 - 저것은 스스로 "주의를 요구하지만 위험 동작은
 * 아닌" 자리라고 못 박아 두었다.
 */
export const DANGER_BUTTON =
  'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600/50'

/**
 * 확인 모달 안의 안내 상자(OPS-MEET-D01~D04). **네 자리에서 둘씩 갈린다.**
 *
 * 가르는 규칙은 흔들림이 아니다 - **상자 색이 으뜸 단추 색을 따라간다.**
 * 파란 단추(D01 시작 · D03 권한 부여)면 무채색, 붉은 단추(D02 종료 ·
 * D04 취소)면 붉다.
 *
 * SOFT_BOX를 넓히지 않고 새 표로 둔 까닭: 붉은 상자의 테두리가 -100이라
 * SOFT_BOX의 규칙(-200)을 따르지 않는다. 넓히면 다음 사람이 SOFT_BOX.red를
 * 집어 쓰고 조용히 어긋난다.
 *
 * 톤 이름을 데이터가 주지 않는다 - 무엇을 확인시키는지가 명세에 고정이다
 * (CHOICE_CHIP·VERDICT_CHOICE와 같은 자리).
 */
export const CONFIRM_NOTE: Record<string, string> = {
  gray: 'border-gray-200 bg-gray-50 text-gray-600',
  red: 'border-red-100 bg-red-50 text-red-700',
}

/**
 * 몇 건인지를 알리는 딱지(OPS-MEET-07의 '없음' · 08의 '0건').
 *
 * INFO_CHIP·MUTED_CHIP과 배합이 다르다 - 이것은 테두리 없이 gray-100 바탕에
 * gray-500 글씨다. 무엇을 말하느냐가 다르기 때문이다: 저것들은 덧붙이는 설명이고
 * 이것은 **세어 본 결과**다. 셋이 비슷해 보여도 이름이 갈려야 다음 사람이
 * 아무거나 집지 않는다.
 */
export const COUNT_CHIP = 'bg-gray-100 text-gray-500'

/**
 * 캘린더 일정 딱지(OPS-CAL-01 30:2233 격자 · 30:2381 이번 주).
 * **바탕 -50, 테두리는 톤의 -500, 글씨 -800.**
 *
 * STATE_CHIP과 배합이 다르다 — 저기는 테두리가 -200이라 딱지가 조용한데, 이것은
 * 격자 칸 안에서 색만으로 유형을 가르는 자리라 테두리가 진하다.
 *
 * 톤 이름이 곧 **유형의 이름**이다(event·meeting·deadline). 유형은 조직 운영에
 * 따라 늘 수 있으므로 색 이름을 데이터가 준다.
 */
export const CALENDAR_CHIP: Record<string, string> = {
  event: 'border-green-500 bg-green-50 text-green-800',
  meeting: 'border-violet-500 bg-violet-50 text-violet-800',
  deadline: 'border-orange-500 bg-orange-50 text-orange-800',
}

/**
 * 유형 필터 칩(30:2120~30:2125)과 범례의 점(30:2130·30:2133·30:2136).
 * 딱지보다 한 단계 옅다 — 테두리 -200, 글씨 -700.
 *
 * CHOICE_CHIP과 다르다: 저기는 **고른 것이 무엇이냐**만 말하므로 색이 하나인데,
 * 여기는 안 고른 칩도 제 유형의 색을 지니고 있다(범례와 같은 색이라야 읽힌다).
 */
export const CALENDAR_TYPE_FILTER: Record<string, string> = {
  event: 'border-green-200 bg-green-50 text-green-700',
  meeting: 'border-violet-200 bg-violet-50 text-violet-700',
  deadline: 'border-orange-200 bg-orange-50 text-orange-700',
}
export const CALENDAR_TYPE_DOT: Record<string, string> = {
  event: 'bg-green-500',
  meeting: 'bg-violet-400',
  deadline: 'bg-orange-500',
}

/** 고른 필터는 유형과 무관하게 무채색으로 채운다(30:2118). */
export const CALENDAR_FILTER_ON = 'border-gray-700 bg-gray-700 text-white'

/**
 * 월 격자의 날짜 수(30:2164 등). 토는 blue-400, 일은 red-400, 나머지는 gray-500.
 * **오늘만 채워진 동그라미다**(30:2246) — 그것이 언제인지는 서버만 안다.
 */
export const CALENDAR_DAY: Record<string, string> = {
  gray: 'text-gray-500',
  blue: 'text-blue-400',
  red: 'text-red-400',
  today: 'bg-blue-600 text-white',
}
