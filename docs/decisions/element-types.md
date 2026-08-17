# 요소 유형 분류

- 현재 지원 유형은 `input`, `button`, `select` 세 가지다.
- 실제 화면에 필요한 요소이면서 기존 유형과 다른 스키마가 필요할 때만 새 유형을 추가한다.
- `button`은 화면에 보이는 조작 요소이고, 클릭 후 수행할 `action`은 버튼 명세의 속성으로 다룬다.
- 현재 확인된 버튼 이동은 `action.type: navigate`와 `targetScreenId`로 표현하며, 새 동작 유형은 실제 화면에서 필요할 때 추가한다.
- `action.executeWhen`은 선택 사항이다. 생략하면 버튼은 조건 없이 항상 실행되고, 명시하면 `onExecutionBlocked`와 반드시 쌍으로 명시한다(스키마 `dependentRequired`로 강제).
- 필수 입력이 없는 화면의 버튼과 뒤로 가기 버튼에는 실행 조건을 붙이지 않는다. 뒤로 가기도 별도 유형 없이 `action.type: navigate`와 명시적 `targetScreenId`로 표현한다.
- **내비게이션 정합성 계약**: `targetScreenId`가 구현에 등록되지 않은 화면이면 구현은 조용한 대체(다른 화면 렌더) 없이 명시적 오류를 표시해야 한다. 스펙 단계에서는 검증 CLI가 미작성 대상 화면을 경고한다.
- 화면 수준 카피(제목·부제·안내문)는 화면 JSON의 선택적 `meta`(title·description·footerNote)에 두고, 구현은 이를 렌더하며 하드코딩하지 않는다. 흐름 단계 표시는 wireframe 단위 `flows.json` 카탈로그(순서 배열 멤버십, 한 화면은 한 흐름)에서 계산한다.
- `select`는 목록에서 하나를 고르는 요소이며, `searchable`로 목록 필터링 가능 여부를 구분한다.
- `select`의 값은 목록에서 선택하며 임의 문자열 입력은 허용하지 않는다.
- `select.placeholder`는 활성 상태 문구다. 비활성(enabledWhen 미충족) 사유 안내가 필요하면 선택적 `disabledPlaceholder`에 두고, 생략하면 placeholder를 그대로 쓴다.
- `select.optionsSource`는 wireframe 단위 카탈로그의 의미 `key`를 참조하며 출처 `type`을 화면 JSON에 중복하지 않는다.
- 출처에 인자가 필요하면 `optionsSource.params`에서 카탈로그 인자 이름을 현재 화면의 `fieldKey`에 연결한다.
- 카탈로그의 `static` 출처는 정적 `options`, `remote` 출처는 `request`와 상태별 `messages`를 중앙 계약으로 관리한다.
- 원격 응답은 `options[].value`, `options[].label`, 선택적 `options[].disabled` 구조로 정규화하며, base URL과 인증 정보는 카탈로그에 넣지 않는다.
- 원격 `request.search`는 선택 사항이고 `loadOn: search`일 때만 필수다. 플러그인은 key별 분기 없이 계약과 화면 요소의 호환성을 계산한다.
