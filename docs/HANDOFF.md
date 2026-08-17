# Figma Spec v2 작업 인계

## 목표 흐름

1. 개발할 Figma 화면을 선택한다.
2. 플러그인에서 요소를 `입력`, `버튼`, `선택`으로 등록한다.
3. 확정적으로 읽을 수 있는 값은 자동으로 채우고, 나머지는 사용자가 검토·입력한다.
4. 화면 단위 저장 버튼을 한 번 눌러 개발 AI가 사용할 로컬 JSON 명세를 만든다.
5. 개발 AI가 로컬 JSON을 보완하면 플러그인에서 다시 불러와 검토한다.

## 현재 확인된 상태

- 선택한 노드의 `nodeId`, `name`, Figma `type`을 표시한다.
- 최초 한 번 `wireframeKey`와 작업 화면을 정하면 Figma `pluginData`에서 복원한다.
- 현재 작업 화면 내부 요소만 등록할 수 있고, 다른 화면은 명시적으로 변경한다.
- `입력` 선택 시 `input.schema.json`의 키에 맞는 편집 UI를 표시한다.
- `버튼` 선택 시 `button.schema.json`을 표시하며, 이동 대상과 실행 조건을 `action.type: navigate`, `targetScreenId`, `executeWhen: { type: allRequiredFieldsHaveValue, scope: screen }`으로 표현한다.
- 실행이 차단되면 `onExecutionBlocked: { type: showMissingRequiredFields, focus: firstMissingField }`에 따라 누락 오류를 표시하고 화면 순서상 첫 누락 필드로 이동하도록 명시한다.
- 플러그인은 버튼 아래에 현재 화면의 `required: true` 입력·선택 요소를 `판정 후보`로 풀어서 보여 준다. 실행 시점에는 `enabledWhen`을 만족한 후보만 판정한다.
- `선택` 선택 시 `select.schema.json`을 공통 편집 UI로 표시하며 `searchable`, `optionsSource`, `enabledWhen`, `resetOnChangeOf`를 지원한다.
- 선택지 출처의 실제 `type`, 설명, 필요 인자, 정적 선택지와 원격 요청 계약은 wireframe 단위 `specs/figma/<wireframeKey>/option-sources.json`에서 한 번만 관리한다.
- 화면 JSON의 `optionsSource`는 카탈로그 `key`와 필요할 때의 `params` 필드 매핑만 갖는다. `type`을 화면마다 중복하지 않는다.
- 플러그인은 카탈로그 key를 선택 목록으로 표시하고, 출처 type·설명·원격 호출 계약을 읽기 전용으로 보여 주며, 필요한 각 인자를 현재 화면의 등록된 `fieldKey`에 연결한다.
- 플러그인의 `구현 준비` 상태는 카탈로그 key와 무관하게 정적 선택지, 원격 계약, `searchable`, 인자 매핑의 호환성으로 계산한다.
- `enabledWhen`을 생략하면 항상 활성화로 해석하고, 명시하면 모든 조건을 만족할 때 활성화한다.
- `resetOnChangeOf`는 나열한 상위 필드가 변경되거나 지워질 때 현재 값을 초기화한다.
- 주변 텍스트에서 `label`을 찾고, 뒤의 `*`를 제거하면서 `required`를 정한다.
- 내부 텍스트는 임시 규칙으로 `placeholder` 또는 `initialValue`에 넣으며 사용자가 수정할 수 있다.
- 작성 중인 값은 `nodeId`별 메모리 초안으로 유지되고, 화면 저장 후에는 화면 Frame의 비공개 `pluginData`와 공개 `sharedPluginData`에 함께 저장된다.
- 복원할 때는 외부 AI가 갱신할 수 있는 `sharedPluginData`를 우선하고 비공개 사본도 같은 값으로 맞춘다.
- 기존 비공개 `pluginData`만 있는 화면은 처음 복원할 때 공유 사본으로 자동 이전하므로 기존 작업을 잃지 않는다.
- 공유 데이터 조회나 자동 이전이 실패해도 기존 비공개 화면 spec과 선택 UI 복원은 계속된다.
- 사용자가 요소 유형을 명시적으로 선택한 요소만 등록되며, `요소 등록 취소`로 제거할 수 있다.
- `이 화면 저장`은 등록 요소를 실제 JSON 타입과 중첩 구조로 변환해 화면 Frame에 먼저 저장한 뒤 로컬 브리지로 같은 JSON을 전송한다.
- 로컬 저장에 성공하면 `specs/figma/<wireframeKey>/screens/<screenId>.json`을 직접 생성하거나 교체하며 다운로드 창은 열지 않는다.
- `Figma 원본 JSON 저장`은 현재 작업 화면 Frame을 Figma의 `JSON_REST_V1` 형식으로 별도 추출한다.
- 원본은 `specs/figma/<wireframeKey>/screens/<screenId>/figma.raw.json`에 저장하며 기존 화면 동작 spec은 변경하지 않는다.
- `packages/contracts/src/figma-design.mjs`의 `normalizeFigmaDesign`은 화면에 종속되지 않은 결정적 규칙으로 `figma.raw.json`을 구현용 `figma.design.json`으로 정규화한다. 이 변환에는 AI가 필요하지 않다.
- 정규화 계약은 `packages/contracts/schemas/figma-design.schema.json`, 재사용 가능한 실행 진입점은 `apps/spec-service/src/generate-figma-design.mjs`에 있다.
- ONB-01의 결과는 `specs/figma/vada-wireframe/screens/ONB-01/figma.design.json`에 생성되어 있다. 루트 기준 viewport, 부모 기준 box, auto-layout·grid·sizing·constraints, fills·strokes·effects·corners, 텍스트와 혼합 스타일 run, component 참조, vector asset 참조를 담는다.
- ONB-01 원본의 83개 노드와 11개 vector asset 참조를 보존했다. 축약 직렬화 크기는 원본의 약 38.1%이며, 동일 원본을 다시 변환했을 때 SHA-256이 동일했다.
- 현재 `Figma 원본 JSON 저장`과 정규화 변환은 자동 연결하지 않았다. 원본 저장 뒤 CLI를 명시적으로 실행해야 하며 자동 연결은 편의 기능으로 보류한다.
- 정규화 CLI는 `figma.raw.json` 텍스트의 SHA-256을 `figma.design.json`의 `source.hash`로 기록한다. 검증 CLI가 이 값으로 신선도를 검사해 raw 재저장 후 정규화를 잊으면 오류로, hash가 없으면 경고로 알린다. 결정성은 유지된다(hash는 원본에만 의존).
- ONB-01 `figma.design.json` 단독 검토 결과, 계층·좌표·간격·auto-layout·grid·색상·타이포·혼합 run은 원본 없이 화면을 재구성하기에 충분하다. 상태(hover/focus/오류) 시각과 반응형 브레이크포인트는 wireframe 원본 자체에 없으므로 구현 관례로 보충한다. 이 화면에는 component instance가 없다.
- 11개 벡터는 stroke 1.167(=lucide 기본 2px의 14px 환산)로 Search ×3(각 2개 벡터), ChevronDown ×3, ArrowRight ×1(2개 벡터)로 식별된다. 따라서 SVG 파일 부재는 구현 차단이 아니며, reference.png 부재도 차단은 아니지만 검증 기준으로 필요하다.
- 원본 디자인에서 확인된 이슈와 처리: ① 검색 아이콘이 입력 상자 뒤에 가려지던 z-순서 문제는 wireframe에서 돋보기 `Icon`(7:43, 7:54, 7:65)을 앞으로 옮겨 해결했고, 재저장한 `reference.png`에서 돋보기 3개가 보이는 것과 정규화 재실행·테스트 통과를 확인했다. ② 현재 학년 `Dropdown`(7:75)은 자식 없는 448×20 빈 프레임이라 다른 입력(높이 33.5)과 다르며 구현은 동작 명세와 다른 입력 스타일을 따른다. ③ placeholder 텍스트가 값 색(#1E2939)으로 그려져 있어 구현 시 placeholder 색 관례를 적용한다. ④ 값 대부분이 통상 웹 값의 0.875배(448=512×0.875 등)라 소수점 px 처리 정책을 구현 시 정한다.
- 정규화는 pill 형태 `cornerRadius`를 노드 박스 절반으로 클램프하고(FLT_MAX 제거), `layoutGrow > 0`을 `grow: 1`로 정규화하며, 테두리가 레이아웃 공간을 차지하는 auto-layout 프레임에 `strokesIncludedInLayout: true`를 보존한다(padding이 테두리 안쪽 기준임을 뜻한다).
- 스키마에 자식 배열의 뒤→앞 z-순서, 비-auto-layout 프레임 자식의 절대 배치, box는 저장 시점 스냅샷이고 auto-layout 규칙이 우선한다는 렌더링 규약을 문서화했다. `schemaVersion`은 1을 유지했고 ONB-01 `figma.design.json`은 새 규칙으로 재생성해 결정성을 재확인했다.
- `Figma 원본 JSON 저장`은 이제 화면의 VECTOR·BOOLEAN_OPERATION 노드를 `SVG_STRING`으로, 화면 전체를 2배율 PNG로 함께 추출해 원본 JSON과 같은 흐름으로 브리지에 저장한다. 자산 파일명은 변환기 `assetRef`와 같은 규칙(`figmaAssetFileName`)이라 `assets/<nodeId>.svg` 참조와 1:1로 맞는다.
- 자산 추출이나 개별 자산 저장이 실패해도 `figma.raw.json` 저장은 유지되며 성공·실패 건수를 상태 메시지로 보여 준다.
- 새 플러그인 빌드로 ONB-01 원본 저장을 실제 Figma 앱에서 재실행해 `assets/*.svg` 11개와 `reference.png`(2배율, 2576×1480)가 생성되는 것을 확인했다. SVG는 실제 path geometry를 담고 있고 파일명이 `figma.design.json`의 `assetRef`와 1:1로 일치하며, 재저장된 원본으로 정규화 CLI를 다시 실행해도 SHA-256이 동일했다.
- Figma 원본 JSON에는 vector path geometry가 없으므로 SVG·reference.png는 플러그인의 원본 저장으로만 만들 수 있다.
- 로컬 브리지가 꺼져 있거나 저장이 실패하면 Figma 내부 사본은 유지하고 플러그인에 재시도 안내를 표시한다.
- 작업 화면을 복원하면 로컬 JSON도 한 번 확인하고 Figma 내부 사본과 다를 때 `로컬 초안 변경됨`을 표시한다.
- `로컬 초안 불러오기`는 로컬 JSON을 검토용 UI 초안으로만 교체하며, 사용자가 `이 화면 저장`을 눌러야 Figma 내부 사본과 로컬 파일에 다시 확정된다.
- 로컬 초안을 불러올 때 `schemaVersion`, 화면 `screenId`와 `nodeId`, 등록 요소의 현재 화면 소속 및 지원 유형만 안전 확인한다. 실제 앱 사용자 입력을 넣어 버튼 동작을 시뮬레이션하지는 않는다.
- 화면 JSON은 선택적으로 `stateScopeKey`를 참조하며, 같은 상태 스코프를 참조하는 화면은 앱 구현에서 입력값을 공유·복원하는 하나의 흐름으로 해석한다.
- 상태 스코프의 의미는 wireframe 단위 `specs/figma/<wireframeKey>/state-scopes.json`에서 한 번만 관리한다. 현재 `onboardingDraft`는 흐름 동안 유지되고 완료 또는 취소 시 제거된다.
- ONB-01과 ONB-02는 모두 `stateScopeKey: onboardingDraft`를 참조한다. 화면 이동 버튼마다 별도의 값 유지 설정은 넣지 않는다.
- 플러그인은 현재 화면의 스코프 key, 같은 스코프 화면 간 유지·복원, 제거 시점을 읽기 전용으로 표시하며 미지정·정의 누락·카탈로그 오류도 구분한다.
- 로컬 초안을 불러오거나 화면을 다시 저장해도 `stateScopeKey`를 보존한다. 이 계약은 개발 구현 명세이며 플러그인이 실제 앱 상태를 실행하지는 않는다.
- 공통 버튼 판정기는 현재 화면의 적용 가능한 필수 필드를 계산하고 값 존재 여부를 판정한다. 공백 문자열과 `null`은 누락이고 숫자 `0`과 boolean `false`는 값이며, 별도의 `validation` 규칙은 실행하지 않는다.
- `node apps/spec-service/src/validate-specs.mjs`가 모든 명세를 JSON Schema(ajv)와 교차 참조 규칙으로 검증한다: 화면 envelope(`screen.schema.json` 신설)·요소·카탈로그·figma.design.json 스키마, 중복 fieldKey·nodeId, 선택지 출처 key와 인자 매핑, enabledWhen·resetOnChangeOf 참조, 상태 스코프 key, 이동 대상 화면 존재(경고), design.json nodeId·자산 파일·reference.png 존재, screenId와 파일 이름 일치. 오류 시 종료 코드 1. 교차 참조 로직은 `packages/contracts/src/spec-validation.mjs`에 있다.
- 플러그인의 저장 시점 검증은 여전히 별도로 실행하지 않는다. 저장 후 위 검증 CLI로 확인한다.
- `apps/spec-service`에 로컬 JSON 브리지가 구현되어 있다.
- 브리지는 `127.0.0.1:3846`에서만 실행하며 저장 루트는 저장소의 `specs/figma`로 고정한다.
- `GET /health`, `GET/PUT /v1/screens/<wireframeKey>/<screenId>`, `PUT /v1/screens/<wireframeKey>/<screenId>/figma-raw`, `PUT /v1/screens/<wireframeKey>/<screenId>/assets/<파일명>.svg`, `PUT /v1/screens/<wireframeKey>/<screenId>/reference`, `GET /v1/option-sources/<wireframeKey>`, `GET /v1/state-scopes/<wireframeKey>`와 CORS preflight를 지원한다.
- 자산 PUT은 `image/svg+xml`에 `<svg` 본문, 참조 PUT은 `image/png`에 PNG 시그니처를 요구하고, 자산 파일명은 영숫자로 시작해 `.svg`로 끝나는 이름만 허용한 뒤 임시 파일 교체 방식으로 저장한다. 참조 이미지는 `screens/<screenId>/reference.png`에 저장된다.
- 화면 GET과 PUT은 파일 내용 기반 `ETag` 리비전을 반환한다. 플러그인은 `If-Match` 또는 `If-None-Match`로 AI가 새로 수정한 로컬 JSON의 무음 덮어쓰기를 막는다.
- 식별자 경로 이탈, 잘못된 JSON, URL과 본문의 `screenId` 불일치를 거부하고 임시 파일 교체 방식으로 저장한다.
- Figma 개발 플러그인의 공개 네트워크 접근은 계속 차단하고 `devAllowedDomains`에서 Figma가 허용하는 `http://localhost:3846`만 연다. 서버 자체는 `127.0.0.1`에만 바인딩한다.
- ONB-02의 `14:111` 버튼을 대상으로 AI의 로컬 JSON 수정, 플러그인 변경 감지, 명시적 불러오기, 사용자 검토, 최종 저장까지 왕복 동작을 실제 Figma 앱에서 확인했다.
- ONB-01의 네 선택 요소는 `education.schools`, `education.colleges`, `education.departments`, `education.currentGrades` 카탈로그 key로 전환했다.
- 단과대학은 `schoolId ← school`, 학부·학과는 `schoolId ← school`, `collegeId ← college`로 요청 인자를 연결했다.
- 현재 학년은 정적 문자열 값 `1`부터 `6`까지와 표시 문구 `1학년`부터 `6학년`까지로 확정했다.
- 선택지 카탈로그는 `schemaVersion: 2`이며, `static`은 `options`, `remote`는 `request`와 `messages`를 필수 계약으로 갖는다.
- 원격 응답은 앱 구현에서 `{ options: [{ value, label, disabled? }] }`로 정규화한다. 배포 환경의 base URL과 인증 정보는 화면·wireframe 명세에 넣지 않는다.
- 학교는 `GET /api/education/schools`를 검색어 2자 이상에서 300ms debounce로 호출한다. 단과대학과 학부·학과는 메뉴를 열 때 각각 `GET /api/education/colleges`, `GET /api/education/departments`를 호출하고 받은 목록을 클라이언트에서 검색한다.
- 원격 선택이 아닌 단순 목록도 표현할 수 있도록 `request.search`는 선택 사항이며, `loadOn: search`일 때만 원격 검색 계약이 필수다.
- ONB-01 다음 버튼은 현재 화면 범위의 필수값 존재 조건과 차단 동작을 명시하며, 일반화된 계약·공통 판정기·회귀 테스트가 추가되었다.
- 플러그인 전체 테스트 96개, spec-service·변환기 테스트 18개와 번들 빌드가 통과했다.
- 저장소를 git으로 관리한다(main 브랜치, node_modules·dist 제외, LF 정규화). 명세 변경 이력·롤백은 git이 담당하므로 SHA-256 수기 기록은 더 이상 하지 않는다.
- 프론트엔드 구현 해석 규칙을 `docs/decisions/implementation-conventions.md`로 확정했다: ÷0.875 환산 후 표준 스케일 스냅, lucide 아이콘 직접 사용(assets/*.svg는 검증 증거물), Pretendard, 유동 반응형(모바일 별도 설계 없음), 시맨틱 색 토큰, placeholder gray-400, 상태 시각 관례.

## 다음 한 단계

ONB-01 명세가 완결되었으므로 프론트엔드 화면 구현을 시작한다. 구현 위치(저장소·앱 구조)와 스택은 시작 전에 사용자와 정한다.

1. 동작은 `specs/figma/vada-wireframe/screens/ONB-01.json`, `option-sources.json`, `state-scopes.json`을 따른다.
2. 시각은 `screens/ONB-01/figma.design.json`을 기준으로 하되 `docs/decisions/implementation-conventions.md`의 확정 규칙(÷0.875 환산 후 표준 스케일 스냅, lucide 아이콘 직접 사용, Pretendard, 유동 반응형, 시맨틱 색 토큰)을 적용하고, 레이아웃 구조·비율 검증은 `reference.png`와 대조한다. `assets/*.svg`는 구현용 자산이 아니라 추출 검증 증거물이다.
3. 세부 상태 관례(placeholder 색, hover/focus/오류, 빈 Dropdown 처리)도 같은 규칙 문서를 따른다.

주기적 자동 감시, 원본 저장 직후 자동 정규화, 변경점 비교 화면, 자동 병합은 편의 기능으로 보류한다. 개인 Figma 계정이 연결되는 원격 Figma MCP 통합도 진행하지 않는다.

공유 화면 스펙의 namespace는 `figmaspecv2`, key는 `screen-spec`이다. `sharedPluginData`는 다른 플러그인에서도 읽을 수 있으므로 비밀값은 저장하지 않는다.

## 확인 명령

```powershell
Set-Location 'C:\Users\82108\figma-spec-v2\apps\figma-plugin'
npm test
npm run build

Set-Location 'C:\Users\82108\figma-spec-v2\apps\spec-service'
npm test

Set-Location 'C:\Users\82108\figma-spec-v2'
node apps/spec-service/src/generate-figma-design.mjs specs/figma/vada-wireframe/screens/ONB-01/figma.raw.json ONB-01
```

Figma 개발 플러그인은 `apps/figma-plugin/manifest.json`을 불러온다.
