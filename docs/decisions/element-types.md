# 요소 유형 분류

## 등록 노드 계약 (2026-08-18 확정)

**요소의 `source.nodeId`는 그 요소의 모든 부분(라벨·컨트롤·보조 텍스트)을 포함하는 가장 안쪽 노드다.**

깊은 계층에서 어느 층을 등록할지 규칙이 없으면 사람도 화면마다 다르게 고른다 — 실제로 ONB-01은 안쪽 컨트롤(`Text Input`·`Dropdown`)을, ORG-01은 바깥 래퍼(`ProfileSearchSelect`·`Container`)를 등록해 같은 `select` 유형의 등록 층이 달랐다. 안쪽 컨트롤을 등록하면 그 요소의 라벨·아이콘이 등록 노드 **바깥**에 남아, "이 요소는 디자인의 이 부분이다"라는 연결이 깨진다.

검증기는 이 계약을 기계적으로 강제한다: 요소의 식별 텍스트(`label`, group은 `title`)가 등록 노드의 하위 트리 안에 없으면 오류다. 이 규칙이 있으면 사람이 등록하든 AI가 `figma.design.json`에서 뽑든 같은 답이 나온다.

## 스키마 작성 계약 (2026-08-18 확정, 2026-08-19 개정)

스키마는 사람이 읽는 계약이자 검증기의 원본이다. 표현이 흔들리면 같은 뜻을 두 가지로 쓸 수 있게 되고, 그러면 소비자마다 다르게 해석한다.

- **선택 속성은 nullable일 수 없다.** 겹치면 '부재'와 `null`이 같은 뜻이 되어 없음을 표현하는 방법이 둘이 된다. 값이 없을 수 있으면 `required` + nullable(`null`로 명시), 개념 자체가 없을 수 있으면 선택 + non-nullable(key 생략)로 간다. 원래는 플러그인 편집 왕복에서 한쪽이 소실되기 때문이었고(2026-08-19에 실제로 `select.label`의 `null`이 키째 사라졌다), 편집을 없앤 지금은 소비자 해석의 일관성이 이유다.
- **요소 유형 레지스트리는 한 벌만 둔다.** `schemaByType`은 `apps/figma-plugin/src/element-schemas.mjs` 한 곳에서만 선언한다. 예전에는 UI와 code 번들이 각자 들고 있었고, ORG-02 작업에서 code 쪽 갱신이 누락돼 `note`·`group`·`list`가 있는 화면은 불러오기가 통째로 실패했다 — 그런데 테스트가 ui.mjs만 검사해 통과했다. **가드가 대상의 일부만 보면 없는 것과 같다.**
- **화면 JSON의 요소 속성 순서는 스키마 선언 순서를 따른다.** 파일마다 순서가 제각각이면 같은 요소를 비교하기 어렵고 AI가 쓸 때마다 결과가 흔들린다. 값이 아니라 표현의 문제고 기계적으로 고칠 수 있어서 경고가 아니라 오류다(`checkPropertyOrder`). 도입 당시 이유는 플러그인 저장이 이 순서로 쓰기 때문이었는데(순서 노이즈가 값 손실을 가렸다), 플러그인이 더 이상 쓰지 않으므로 지금은 정규형 유지가 이유다.

앞의 두 규칙은 `tests/element-type-registry.test.mjs`가 요소 유형 전체를 훑어 강제하고, 마지막 규칙은 검증 CLI가 매번 검사한다. 플러그인이 명세를 쓰지 않게 된 경위는 `plugin-role.md`에 있다.

## 유형

- 현재 지원 유형은 `input`, `button`, `select` 세 가지다.
- 실제 화면에 필요한 요소이면서 기존 유형과 다른 스키마가 필요할 때만 새 유형을 추가한다.
- `button`은 화면에 보이는 조작 요소이고, 클릭 후 수행할 `action`은 버튼 명세의 속성으로 다룬다.
- 현재 확인된 버튼 이동은 `action.type: navigate`와 `targetScreenId`로 표현하며, 새 동작 유형은 실제 화면에서 필요할 때 추가한다.
- `action.executeWhen`은 선택 사항이다. 생략하면 버튼은 조건 없이 항상 실행되고, 명시하면 `onExecutionBlocked`와 반드시 쌍으로 명시한다(스키마 `dependentRequired`로 강제).
- 필수 입력이 없는 화면의 버튼과 뒤로 가기 버튼에는 실행 조건을 붙이지 않는다. 뒤로 가기도 별도 유형 없이 `action.type: navigate`와 명시적 `targetScreenId`로 표현한다.
- **내비게이션 정합성 계약**: `targetScreenId`가 구현에 등록되지 않은 화면이면 구현은 조용한 대체(다른 화면 렌더) 없이 명시적 오류를 표시해야 한다. 스펙 단계에서는 검증 CLI가 미작성 대상 화면을 경고한다.
- **action 확장(2026-08-17 방향 확정 → 2026-08-18 ORG-02에서 스키마화)**: 데이터 전송은 `action.type: submit`으로 표현한다 — 제출 계약(경로·payload 스코프·상태 문구)은 option-sources와 같은 패턴의 wireframe 단위 `mutations.json` 카탈로그에 중앙화하고 버튼은 `mutationKey`만 참조하며, 성공 시 `onSuccess: { navigate?, scopeEvent? }`로 이동·스코프 이벤트를 함께 표현한다. **상태 스코프의 complete/cancel 이벤트는 action의 `scopeEvent`로만 발생한다** — 수명 관리(스코프 제거)와 데이터 전송(제출)은 분리된 관심사다. 예약해 둔 설계가 첫 실제 사례(ORG-02 `조직 만들기`)에서 그대로 맞았다.
- 실행 조건 판정(`executeWhen`·`onExecutionBlocked`)은 action 종류와 무관하다. navigate든 submit이든 같은 필수값 규칙을 쓴다.
- `list`는 사용자가 항목을 추가·이름 수정·삭제하는 목록이다. 지금까지의 요소가 모두 "값 하나"였던 것과 달리 값이 항목의 배열이다. `rootItem`이 있으면 고정 루트를 가진 트리로, 없으면 평면 목록으로 렌더한다. 개수는 `minItems`·`maxItems`로 정하며 `required`로 판정하지 않는다(필수값 판정 후보에 들어가지 않는다). 다른 필드 값에 따른 초기 항목은 `initialItems`로 표현하고, 그 값이 바뀔 때의 처리는 기존 `resetOnChangeOf`를 재사용한다.
- `select.label`은 선택 사항이다. 디자인에 라벨이 없는 선택(ORG-02의 조직 구성 방식 라디오 카드)은 **key 자체를 생략한다** — 없는 카피를 지어내지 않는다. `null`을 쓰지 않는 이유는 위 스키마 작성 계약이다(`group.description`·`list.label`도 같다).
- 선택지에 부연 설명이 필요하면 카탈로그의 `options[].description`에 둔다. 구현은 설명이 있는 선택지를 카드형으로, 없으면 압축형으로 그린다.
- 화면 수준 카피(제목·부제·안내문)는 화면 JSON의 선택적 `meta`(title·description·footerNote)에 두고, 구현은 이를 렌더하며 하드코딩하지 않는다. 흐름 단계 표시는 wireframe 단위 `flows.json` 카탈로그(순서 배열 멤버십, 한 화면은 한 흐름)에서 계산한다.
- `select`는 목록에서 하나를 고르는 요소이며, `searchable`로 목록 필터링 가능 여부를 구분한다.
- `select.presentation`은 선택 UI 형태다: `dropdown`(목록 패널을 열어 고른다, 생략 시 기본)과 `choiceGroup`(선택지를 모두 펼친 버튼 묶음). **`searchable`과는 다른 축이다** — 전자는 목록을 여는 방식, 후자는 목록을 거르는 방식이다. 같은 의미(하나 고르기)를 유지하므로 새 요소 유형을 만들지 않는다(ORG-01 `orgType`이 첫 사례).
- `group`은 여러 입력 필드를 하나의 의미 단위로 묶고 그 제목·설명을 담는 요소다. `memberFieldKeys`로 멤버를 나열하고, 구현은 멤버를 묶음 안에 순서대로 렌더하며 바깥 나열에서는 건너뛴다. 한 필드는 최대 한 묶음에만 속한다(검증기가 강제). 묶음의 시각(배경·테두리 유무)은 화면마다 다르므로 `figma.design.json`의 사실을 따르고 스키마에 넣지 않는다.
- `select`의 값은 목록에서 선택하며 임의 문자열 입력은 허용하지 않는다.
- `select.placeholder`는 활성 상태 문구다. 비활성(enabledWhen 미충족) 사유 안내가 필요하면 선택적 `disabledPlaceholder`에 두고, 생략하면 placeholder를 그대로 쓴다.
- `select.optionsSource`는 wireframe 단위 카탈로그의 의미 `key`를 참조하며 출처 `type`을 화면 JSON에 중복하지 않는다.
- 출처에 인자가 필요하면 `optionsSource.params`에서 카탈로그 인자 이름을 현재 화면의 `fieldKey`에 연결한다.
- 카탈로그의 `static` 출처는 정적 `options`, `remote` 출처는 `request`와 상태별 `messages`를 중앙 계약으로 관리한다.
- 원격 응답은 `options[].value`, `options[].label`, 선택적 `options[].disabled` 구조로 정규화하며, base URL과 인증 정보는 카탈로그에 넣지 않는다.
- 원격 `request.search`는 선택 사항이고 `loadOn: search`일 때만 필수다. 플러그인은 key별 분기 없이 계약과 화면 요소의 호환성을 계산한다.
