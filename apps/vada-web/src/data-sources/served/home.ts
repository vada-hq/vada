import type { Served } from './area'

/**
 * 홈(HOME-01K).
 *
 * **일곱 다 온다.** 한동안 재정 요약(`home.financeSummary`)만 안 왔다 — 예산을 정하는
 * 화면이 명세에 없어 붙여도 0원 위에 섰고, 그 자리만 화면에서 따로 가려졌다(`Built`).
 * 예산 편성 화면(FIN-PLAN-01)이 수입원과 배정을 넣게 되어 셀 바탕이 생겼다.
 */
export const home: Served = {
  reads: [
    // 보는 사람의 이름이 들어가는 인사라 서버가 완성해서 준다.
    'home.briefing',
    // 짚을 것이 없으면 빈 목록이다 — 개수가 데이터에 달렸다.
    'home.briefingNotices',
    // 행사 단계와 캘린더의 흐름을 가로질러 센다.
    'home.eventCounts',
    // 준비율과 지연은 그 행사의 업무에서 나온다.
    'home.events',
    // 캘린더와 같은 흐름을 오늘부터 자른 것이다.
    'home.schedules',
    // 셀 수 있는 사실만 온다 — 0건인 종류는 아예 오지 않는다.
    'home.orgAlerts',
    // 총예산은 수입원의 합이고 사용 가능은 정해진 셈이다 — 화면은 나누지 않는다.
    'home.financeSummary',
  ],
  writes: [],
}
