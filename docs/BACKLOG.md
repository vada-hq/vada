# 백로그

미착수 항목의 단일 추적처다. 스코프 태그([파이프라인]/[vada])를 붙이고, 착수 시점(트리거)이 있으면 명시한다. 완료하면 행을 삭제한다. 진행 상태는 `HANDOFF.md`, 화면별 발견은 각 파일럿 문서의 마찰 로그가 원본이다.

| 스코프 | 항목 | 트리거 |
| --- | --- | --- |
| 파이프라인 | 래스터 이미지 자산 미지원 — normalizePaint가 `imageRef`만 남기고 바이트를 export하는 경로가 없다 | 이미지가 있는 화면 등장 시 |
| 파이프라인 | 원본 저장 번들 세대 표식 — raw+SVG 11+PNG 13회 PUT의 부분 실패 시 혼합 세대를 파일만으로 식별 불가 | 부분 실패가 실제로 관측되면 |
| 파이프라인 | 루트 워크스페이스 — 저장소 루트에서 전체 테스트 일괄 실행 불가(앱별 npm test) | 앱이 더 늘어나면 |
| 파이프라인 | 스크린샷 자동 대조(마찰 6) — 구현 결과 vs reference.png 육안 의존 | 구현 화면 수 증가 시 |
| vada | option-sources 값 형식·예시 응답 계약(마찰 3) — mock의 `sch-001` id는 임시 | 백엔드 계약 확정 시 |
| vada | select 활성 상태 placeholder(마찰 8) — 비활성 사유 문구가 활성화 후 부적합, 스키마 확장 여부 | select 요소가 있는 다음 화면 착수 전 |
| vada | ErrorBoundary 부재 — 렌더 예외 시 백지 화면(런타임 가드의 throw 포함) | 다음 구현 작업 시(화면 수와 무관한 기본기) |
| vada | TextInput이 스펙 `inputType`을 소비하지 않음(type="text" 고정) — email/tel 등이 스펙에 등장하면 조용히 무시됨 | text 외 inputType 화면 등장 전 |
| vada | App 화면 전환의 암묵 fallback — 알 수 없는 screenId면 ONB-01을 렌더. 명시적 오류 표시 필요 | 화면 3개 이상 시 라우팅 정리와 함께 |
| vada | JSON Schema→TS 타입 코드젠 — `spec/types.ts` 수동 이중화의 drift 방지 | 스키마 변경 시(예: 마찰 8의 enabledPlaceholder) |
| vada | fetch 실패 재시도 어포던스 — error 상태에 재시도 버튼 없음. 카탈로그 `messages` 계약에도 재시도 개념이 없어 스펙 구멍이기도 함 | 백엔드 연동 시 또는 다음 select 화면 |
| vada | 린트 강화 — oxlint에 react-hooks 계열 규칙 부재 | 컴포넌트 수 증가 시 |
| vada | Pretendard 셀프호스팅 — 현재 CDN 로드 | 배포 준비 시 |
| vada | 콤보박스 키보드 세부(Home/End, 타이핑 시 자동 하이라이트 등) — 기본 조작(화살표·Enter·Escape)은 구현됨 | 접근성 다듬기 단계 |
