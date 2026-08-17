# ORG-01 사이클

세 번째 화면 사이클이며, 목적은 제품 진도가 아니라 **표현력 시험**이다(방법론의 완성 판정 기준). 새 흐름(org-creation)의 첫 화면이라 요소 유형·스코프 계약이 처음으로 흐름 경계를 넘는다.

## 사이클 기록 (2026-08-18)

1. 사용자: Figma에서 화면 등록 → 원본 저장 → 정규화(63노드·자산 11) — 이전 세션에서 완료.
2. 요소 유형 `note` 도입 마무리(스키마 등록·교차검증·플러그인 왕복), 요소 유형 레지스트리 일치 테스트 추가.
3. 구현 전 reference·design 판독에서 마찰 2건이 **스펙 표현력 부족**으로 확인됨 → 스키마 확장 2건(아래 마찰 1·2).
4. 구현: ORG01Screen을 **elements 배열 순회 렌더**로 작성(화면별 하드코딩 대신). 컴포넌트 5개 추가, 테스트 29/29, e2e 3/3.
5. 검증: e2e 스크린샷 3장 자동 생성·AI 판독 — 구조·순서·정렬·선택 상태 모두 reference와 일치.

## 완료 기준

1. 레이아웃: 구조·순서·정렬·상대 비율이 `reference.png`와 일치(절대 픽셀 제외). — 통과
2. 동작: 유형 선택(펼친 버튼), 학교→단과대학 연쇄 활성화, 필수 누락 차단·첫 누락 포커스, `이전`은 판정 없이 ONB-02 복귀, `다음`은 ORG-02 미등록 오류. — 통과
3. note가 onboardingDraft 스코프의 표시 라벨을 이어 보여주고, 값이 없는 참조는 생략. — 통과
4. 검증: 빌드·린트·검증 CLI 오류 0 유지. — 통과

## 스펙 필드 소비 점검

방법론의 완료 점검 항목("모든 필드를 소비했거나 미사용 사유를 명시"):

| 필드 | 소비 |
| --- | --- |
| `meta.eyebrow`·`title`·`footerNote` | 렌더 |
| `select.presentation` | choiceGroup / dropdown 분기 |
| `select.helperText` | Field 아래 보조 설명 |
| `select.disabledPlaceholder` | 비활성 시 placeholder 대체 |
| `select.enabledWhen`·`resetOnChangeOf` | 연쇄 활성화·초기화 |
| `group.title`·`description`·`memberFieldKeys` | FieldGroup |
| `note.prefix`·`separator`·`fieldRefs` | NoteBox |
| `button.action.executeWhen`·`onExecutionBlocked` | 판정기 경유 |
| `meta.description` | ORG-01에 값이 없음(선택 필드) |
| `input.inputType`·`valueType` | **미소비** — TextInput이 항상 `type="text"`다. 기존 백로그 항목(스펙 필드 소비 커버리지)과 같은 계급 |
| `input.validation` | **소비 불가** — 스키마가 `readOnly`라 항상 `[]`이고 왕복에서 지워진다(백로그) |

## 마찰 로그

| # | 상황 | 번들에서 답을 찾았나 | 임시 결정 | 형식화 후보 |
| --- | --- | --- | --- | --- |
| 1 | `orgType`이 스펙상 `select`인데 디자인은 드롭다운이 아니라 **펼친 선택지 버튼 4개**(14:170~178). `searchable`은 필터링 축이라 구분 불가 | 아니오 | — | **해결 — `select.presentation`(dropdown\|choiceGroup) 추가.** 의미(하나 고르기)가 같아 새 유형을 만들지 않음 |
| 2 | "대표 범위" 필드 묶음(제목+설명+배경 상자)이 동작 명세에 없음. **ONB-01의 섹션 제목("기본 프로필"/"학적 정보")과 같은 계급의 재발** | 아니오 | — | **해결 — `group` 요소 유형 추가.** 재발이므로 방법론대로 앱 코드가 아니라 스키마에 반영. ONB-01의 하드코딩 섹션 마이그레이션은 백로그 |
| 3 | 주/보조 버튼 구분 근거가 명세에 없음. ONB-02는 흐름 순서로 판별했으나 ORG-01의 `이전`은 **다른 흐름으로 나가** 순서 비교가 불가능 — ONB-02의 처분이 일반 규칙이 아니었음이 드러남 | 아니오 | 화면 순서상 마지막 버튼 = 주 동작 | `button`에 강조도(주/보조) 필드. 버튼 2개 이상인 화면이 하나 더 나오면 결정 |
| 4 | 화면 헤더 좌측 구성이 화면마다 다름(ONB=로고, ORG=eyebrow+제목). 명세에 헤더 구성 정보 없음 | 예(design) | 진행 표시만 `FlowProgress`로 공통화, 헤더는 화면이 조립 | 해결로 간주(디자인 사실 우선 관례의 정상 적용) |
| 5 | 주 버튼 폭이 화면마다 다름(ONB-01=카드 폭, ORG-01=내용 폭) | 예(design) | `PrimaryButton`에 `fullWidth` prop | 해결로 간주 |
| 6 | `note`·`group`의 시각(배경·테두리 색)이 명세에 없음 | 예(design) | design 사실을 적용, interpretation 색표에 blue-50/100/500/700·gray-600 추가 | 해결로 간주 |

**신규 마찰 계급 2건(1·2).** 방법론의 수렴 조건(연속 2개 화면에서 신규 계급 0건)은 아직 충족되지 않았다.
