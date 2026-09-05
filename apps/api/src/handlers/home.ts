import type { Handlers } from '../deps.ts'

// 홈(HOME-01K). **아직 비어 있다** — 자리를 미리 열어 둔 것이다.
//
// **홈은 여러 표를 가로질러 센다.** 행사도 회의도 업무도 아닌, 그 전부의 요약이다.
// 그래서 어느 영역에도 넣지 않는다.
//
// **재정 요약은 여기 안 온다**(`home.financeSummary`). 예산을 정하는 화면이 명세에
// 없어 붙여도 0원 위에 선다 — 백로그의 '결정 대기'다. 그 자리만 화면에서 따로
// 가려진다(`Built`).

export const homeHandlers: Handlers = {}
