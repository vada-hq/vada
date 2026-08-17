# ONB-01 파일럿

목적: 화면 1개를 구현하는 동시에, 컨텍스트 번들이 구현 AI에게 충분한지 측정해 결함 지도를 만든다. 방법론은 `docs/decisions/implementation-methodology.md`를 따른다.

## 입력 번들

- 동작: `specs/figma/vada-wireframe/screens/ONB-01/screen.json`, `option-sources.json`, `state-scopes.json`
- 시각: `specs/figma/vada-wireframe/screens/ONB-01/figma.design.json`, `reference.png`
- 해석: `docs/decisions/vada-conventions.md`(제품), `specs/figma/vada-wireframe/interpretation.md`(wireframe)
- 판정 의미론: `packages/contracts/src/button-execution.mjs`

## 완료 기준

1. **레이아웃**: 구조·순서·정렬·상대 비율이 `reference.png`와 일치한다. 절대 픽셀은 환산(÷0.875) 때문에 일치를 요구하지 않는다.
2. **동작**: screen.json의 요소 7개가 명세대로 동작한다 — 이름·학번 입력, 학교(원격 검색: 2자 이상·300ms debounce 계약), 단과대학·학부·학과(enabledWhen 연쇄 활성화와 resetOnChangeOf 초기화), 현재 학년(정적 목록), 다음 버튼(공통 판정기 의미론: 필수값 누락 시 오류 표시와 첫 누락 필드 포커스, 충족 시 ONB-02로 이동 — ONB-02는 자리표시 화면으로 둔다).
3. **상태**: `onboardingDraft` 스코프 — 파일럿 범위에서는 메모리 수준으로 화면 이동 후 복귀 시 값이 유지된다. hover/focus/error/disabled 시각은 제품 관례 6번.
4. **원격 출처 mock**: `option-sources.json`의 계약대로 고정 fixture를 `{ options: [{ value, label }] }` 형태로 응답하는 mock을 둔다. base URL·인증은 명세에 없으므로 mock 계층 내부에서만 처리한다.
5. **검증**: `apps/vada-web`의 `npm run build` 통과, 스펙 검증 CLI 오류 0건 유지.

## 마찰 로그

구현 중 번들만으로 답할 수 없었던 순간을 즉시 기록한다. 이 표가 다음 형식화 결정의 유일한 근거다.

| # | 상황 | 번들에서 답을 찾았나 | 임시 결정 | 형식화 후보 |
| --- | --- | --- | --- | --- |
| 1 | 섹션 라벨·푸터 fontSize 11(lh 16.5)은 ÷0.875=12.57로 표준 스케일 밖 — 0.875 가설의 첫 반례. 카드 radius 9.25(→10.57)도 동일 | 아니오 | text-xs(12)·rounded-xl(12)로 스냅 | interpretation에 "표준 밖 값과 스냅 결과" 사례표 |
| 2 | 열린 드롭다운 목록 패널의 시각이 번들에 없음(와이어프레임에 열린 상태가 그려진 화면 없음) | 아니오 | white·border gray-200·rounded-md·shadow-md, 항목 hover gray-50, 선택 항목 blue-600 | vada-conventions 7번에 패널 스타일 추가(반영함) |
| 3 | mock 데이터의 내용과 value(id) 형식이 번들에 없음 — schools 응답의 value가 무엇인지(uuid? 코드?), 검색 의미론(부분일치·초성·대소문자)도 미정 | 아니오 | `sch-001` 형식의 임시 fixture + label 부분일치 검색 | option-sources에 값 형식·검색 의미론·예시 응답 계약 추가 |
| 4 | select은 value(id)만 저장하는데 재방문 시 라벨을 다시 그릴 방법이 스펙에 없음 | 아니오 | draft에 labels 보조 저장(값과 별도) | 해결 — vada-conventions 7번에 라벨 병행 저장 관례 반영 |
| 5 | 비활성 필드 시각이 관례 6번(bg gray-100)과 wireframe 사실(bg gray-50, 라벨·텍스트 gray-400, 아이콘 gray-300)이 충돌 | 예(design.json) | wireframe 값을 적용 | 해결 — vada-conventions 상단에 우선순위 원칙 명시 |
| 6 | 구현 결과를 reference.png와 자동 대조할 수단이 파이프라인에 없음 | 아니오 | 육안 대조 | 스크린샷 비교 도구 — 트리거: 구현 화면 수 증가 |
| 7 | 현재 학년 빈 Dropdown(7:75): "다른 입력과 같은 스타일"이되 셀렉트 어포던스(chevron)·빈 표시는 유추 | 부분(interpretation ONB-01 절) | 다른 select와 동일 스타일 + chevron, 값 없으면 빈 칸 | 없음(해결로 간주) |
| 8 | (사용자 검증에서 발견) 단과대학 placeholder "학교를 먼저 선택하세요"가 비활성 사유 안내를 겸하는데, 학교 선택 후 활성화되면 문구가 상황과 안 맞음 — 스펙에 placeholder가 상태별로 하나뿐 | 아니오 | 스펙 문구 그대로 표시 | 해결 — select 스키마에 disabledPlaceholder 추가, placeholder는 활성 문구로 이행 |
| 9 | (코드 리뷰 F2에서 발견) 검색형 select의 키보드 조작 계약이 스펙 어디에도 없음 — searchable: true만 있고 상호작용 정의 부재 | 아니오 | 표준 콤보박스 키보드(화살표·Enter·Escape·focusout 닫힘) 구현 | 해결 — vada-conventions 7번에 키보드 관례 반영 |
| 10 | (리뷰에서 발견) 화면 수준 텍스트(제목·부제·안내문)가 동작 명세에 없어 design.json에서 JSX로 수동 복사됨 — Figma에서 카피를 바꿔 재추출해도 구현이 자동으로 안 따라옴 | 아니오 | JSX에 하드코딩 | 해결 — screen.json에 선택적 meta(title·description·footerNote) 추가, 구현 하드코딩 제거 |
| 11 | (리뷰에서 발견) 온보딩 흐름의 단계 정보(전체 몇 단계 중 몇 번째, 단계 라벨)가 스펙 체계에 없음 — 진행 표시가 하드코딩 | 아니오 | AppHeader 컴포넌트에 step/totalSteps를 화면이 직접 전달 | 해결 — wireframe 단위 flows.json 카탈로그 신설(순서 배열 멤버십, 단계 자동 계산) |
