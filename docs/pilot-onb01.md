# ONB-01 파일럿

목적: 화면 1개를 구현하는 동시에, 컨텍스트 번들이 구현 AI에게 충분한지 측정해 결함 지도를 만든다. 방법론은 `docs/decisions/app-implementation.md`를 따른다.

## 입력 번들

- 동작: `specs/figma/vada-wireframe/screens/ONB-01.json`, `option-sources.json`, `state-scopes.json`
- 시각: `specs/figma/vada-wireframe/screens/ONB-01/figma.design.json`, `reference.png`
- 해석: `docs/decisions/implementation-conventions.md`(전역), `specs/figma/vada-wireframe/interpretation.md`(wireframe)
- 판정 의미론: `packages/contracts/src/button-execution.mjs`

## 완료 기준

1. **레이아웃**: 구조·순서·정렬·상대 비율이 `reference.png`와 일치한다. 절대 픽셀은 환산(÷0.875) 때문에 일치를 요구하지 않는다.
2. **동작**: ONB-01.json의 요소 7개가 명세대로 동작한다 — 이름·학번 입력, 학교(원격 검색: 2자 이상·300ms debounce 계약), 단과대학·학부·학과(enabledWhen 연쇄 활성화와 resetOnChangeOf 초기화), 현재 학년(정적 목록), 다음 버튼(공통 판정기 의미론: 필수값 누락 시 오류 표시와 첫 누락 필드 포커스, 충족 시 ONB-02로 이동 — ONB-02는 자리표시 화면으로 둔다).
3. **상태**: `onboardingDraft` 스코프 — 파일럿 범위에서는 메모리 수준으로 화면 이동 후 복귀 시 값이 유지된다. hover/focus/error/disabled 시각은 전역 관례 6번.
4. **원격 출처 mock**: `option-sources.json`의 계약대로 고정 fixture를 `{ options: [{ value, label }] }` 형태로 응답하는 mock을 둔다. base URL·인증은 명세에 없으므로 mock 계층 내부에서만 처리한다.
5. **검증**: `apps/web`의 `npm run build` 통과, 스펙 검증 CLI 오류 0건 유지.

## 마찰 로그

구현 중 번들만으로 답할 수 없었던 순간을 즉시 기록한다. 이 표가 다음 형식화 결정의 유일한 근거다.

| # | 상황 | 번들에서 답을 찾았나 | 임시 결정 | 형식화 후보 |
| --- | --- | --- | --- | --- |
