# Figma Spec v2 작업 인계

이 문서는 **현재 상태 요약과 다음 한 단계**만 담는다. 이력은 git 로그, 결정은 `docs/decisions/`, 미착수 항목은 `docs/BACKLOG.md`, 화면별 구현 발견은 파일럿 문서의 마찰 로그가 원본이다.

## 목표 흐름

1. 사용자가 Figma에서 화면을 지정하고 `Figma 원본 JSON 저장`을 누른다. **사용자가 플러그인에서 하는 일은 여기까지다.**
2. 추출기(`draft-screen-spec.mjs`)가 `figma.design.json`에서 요소 초안을 뽑고, 디자인만으로 알 수 없는 것은 질문으로 보고한다.
3. 사용자가 질문에 답한다(fieldKey 작명·선택지 출처·이동 대상 등 도메인 결정).
4. AI가 `screen.json`을 쓴다. **플러그인은 그것을 읽어 보여주기만 한다**(읽기 전용, `plugin-role.md`).
5. 개발 AI가 명세 번들로 화면을 구현하고, 마찰 로그가 파이프라인을 개선한다.

## 현재 상태 — 파이프라인

- **플러그인**(apps/figma-plugin): **명세를 쓰지 않는다**(2026-08-19, `docs/decisions/plugin-role.md`). 하는 일은 Figma 안에서만 가능한 두 가지 — 화면 신원 등록(pluginData `screen-context`)과 `Figma 원본 JSON 저장`(raw JSON·벡터 SVG·2배율 reference.png를 브리지로 저장). 명세는 브리지에서 읽어 **읽기 전용으로** 표시하며, 값이 없는 속성도 이름을 보여주고 선택지 출처·버튼 실행 판정 후보를 풀어 준다. Figma 문서 안의 명세 사본은 없앴다.
- **브리지**(apps/spec-service): `127.0.0.1:3846` 고정, 저장 루트 `specs/figma`. 화면 GET/PUT(ETag/If-Match), figma-raw·자산(svg)·reference(png) PUT, 카탈로그 GET.
- **등록 노드 계약(2026-08-18)**: 요소의 `source.nodeId`는 그 요소의 모든 부분(라벨·컨트롤·보조 텍스트)을 포함하는 **가장 안쪽 노드**다(element-types.md). 검증기가 식별 텍스트(`label`, group은 `title`)를 등록 노드 하위 트리에서 **정확 일치**로 찾아 강제한다(부분 일치로 하면 placeholder가 라벨을 품기만 해도 통과한다). ONB-01은 안쪽 컨트롤을 등록하고 있어 6건을 래퍼로 마이그레이션했다. 이 계약 덕에 사람이 등록하든 AI가 design.json에서 뽑든 같은 답이 나온다.
- **화면 폴더 신원 계약(2026-08-18)**: 화면 폴더의 신원은 Figma 노드 id다(`figma.raw.json`의 `document.id` = `screen.json`의 `source.nodeId`). 폴더에 이미 다른 노드의 산출물이 있으면 screen.json·figma-raw PUT을 **409로 거부**한다. 원본은 번들에서 가장 먼저 저장되므로 여기서 막으면 자산 11개·reference.png까지 함께 보호된다. 같은 노드의 재저장(디자인 수정 후 재추출)은 정상 허용. 이 보호 이전에는 screenId를 잘못 지정하면 **reference.png가 조용히 다른 화면 것으로 바뀌었고**, reference는 존재 여부만 검사되므로 어떤 검증도 이를 잡지 못했다. Origin 검사: 헤더 없음(로컬 도구)·`null`(플러그인)·`*.figma.com`만 허용, 그 외 403(null-origin 위조 표적 공격은 잔존 위험 — 필요 시 공유 토큰으로 격상).
- **REST로 직접 받는다(2026-08-24)**: 화면 하나의 산출물을 **플러그인을 열지 않고** 받는다. `node apps/spec-service/src/fetch-figma-screen.mjs vada-wireframe <screenId>` 한 줄이면 `figma.raw.json`·자산·`reference.png`에 `figma.design.json`까지 만들어진다.
  - **왜 되는가**: 플러그인이 쓰던 `exportAsync({ format: "JSON_REST_V1" })`이 Figma 문서상 "REST API가 주는 것과 같은 JSON"이다. EVT-00A로 실측했다 — 노드 212개, 속성 차이 0건, 값 차이 0건, 직렬화 길이까지 187187로 같다.
  - **`geometry=paths`를 붙이면 안 된다** — 벡터 경로가 붙어 1.8배가 되고, 플러그인이 저장해 온 것과 다른 물건이 된다.
  - **자산의 단위를 이제 로컬에서 정한다**(`collectAssetNodes`를 받은 원본에 돌린다). 플러그인 안에서 정하던 때는 규칙을 고치려면 사람이 Figma를 열어 다시 저장해야 했다. **BACKLOG의 '자산 단위 규칙' 항목이 이제 재저장 없이 고칠 수 있는 것이 됐다.**
  - **다른 것 둘**: reference.png는 크기(2588×1492)·색 깊이·색 형식이 같고 압축만 다르다. 자산 SVG는 20개 중 13개가 다른데, 그림은 같고 **크기 기준이 다르다** — 플러그인은 와이어프레임의 0.875배를 경로 좌표에 굽고 REST는 viewBox에 맞춘다. design 대조·자산 대조 전부 통과한다(양쪽이 같은 파일을 본다).
  - **화면 신원은 이름이 말한다**: 플러그인은 pluginData(비공개, REST가 못 읽음)에 적지만 읽을 필요가 없다 — 프레임 이름에 screenId가 들어 있다(`운영 — 행사 · EVT-00A · …`). 새 화면은 이름으로 찾고, 이미 있는 폴더는 그 폴더의 노드를 다시 받는다. 폴더 신원 계약(다른 노드 덮어쓰기 금지)은 `packages/contracts/src/screen-folder-identity.mjs`가 한 곳에서 판정하고 브리지와 이 명령이 함께 쓴다.
  - **화면 목록을 볼 수 있다**: `node apps/spec-service/src/list-figma-screens.mjs vada-wireframe --todo`. 와이어프레임에 **화면 85개**가 있고 그중 11개가 명세됐다. 다음 화면을 제품 순서로 고르기로 했는데(implementation-methodology.md) 그 순서를 이제 Figma를 열지 않고 본다.
  - **토큰**: 저장소 루트 `.env`의 `FIGMA_TOKEN`(git 제외). 필요한 권한은 `file_content:read` 하나뿐이고 file content에는 쓰기 권한 자체가 없다. 파일 key는 비밀이 아니므로 `specs/figma/<wireframe>/figma-file.json`에 둔다.
  - **한도**: Tier 1, 분당 10~20회. **파일이 속한 플랜이 정한다 — 토큰 주인의 좌석이 아니다.** 화면 하나에 3~4회면 된다.
  - **플러그인은 아직 지우지 않는다.** 두 경로가 같은 결과를 낸다는 것은 확인했지만, 플러그인만 하는 일(화면 신원 등록 UI)이 남아 있고 지우는 것은 되돌리기 어렵다.
- **자산의 단위(2026-08-24 수정)**: "벡터만 품은 가장 바깥 노드"인데 그 판정이 두 곳에서 틀렸고, 둘 다 **화면에 그릴 수 없는 파일**을 만들었다.
  - **글이 든 줄이 한 덩이가 됐다**: Figma가 보이는 글에도 `absoluteRenderBounds`를 null로 주는 일이 있다(글 500개 중 23개, 채움도 있고 reference.png에도 그려져 있다). 그것을 '있으나 마나'로 읽어 아이콘과 글이 나란한 줄이 통째로 한 자산이 됐다(OPS-MEET-01A `18:720`, 582×19). **글이 그려지는지 Figma에게 묻지 않는다** — 글은 글이다.
  - **멀리 떨어진 둘이 한 덩이가 됐다**: OPS-00 카드의 머리 줄은 왼쪽 타일과 오른쪽 끝 화살표만 들어 글이 없다. 사이가 334px 비어 383×35짜리 파일이 나왔다. **한 자산은 붙어 있어야 한다** — 가장 큰 틈이 제 크기의 절반을 넘으면 가른다. 임계값은 재서 정했다(자식 둘 이상인 자산 111개 중 이 넷만 87%, 나머지는 전부 25% 이하).
  - 고친 뒤 두 화면을 REST로 다시 받았다. OPS-00 17 → 21개, OPS-MEET-01A 32 → 33개. `design/deviations.ts`의 예외 하나가 쓰이지 않게 돼 지웠다.
- **정규화**(packages/contracts + generate-figma-design.mjs): raw→design 결정적 변환(AI 불필요), `source.hash`(raw SHA-256)로 신선도 추적. 원본 저장→정규화 자동 연결은 보류 — 저장 후 CLI를 수동 실행한다.
- **대조가 양방향이 됐다(2026-08-24)**: 지금까지 검사는 전부 **명세 → 화면** 한 방향이었다. 명세가 가리키는 자리를 화면이 그렸는지는 봤지만, **design에 있는데 명세에 없는 것은 아무도 보지 않았다.** TASK-01의 헤더 버튼 `18:86`('업무 추가')이 그렇게 조용히 빠져 있었고, EVT-00A 사이클에서 헤더에 자리를 내다 우연히 드러났다. 검증기가 이제 반대 방향을 본다 — design의 **상호작용 노드**(`Btn`·`Button`·`Text Input`·`Dropdown`) 중 등록된 어느 요소의 하위 트리에도 없는 것을 오류로 알린다. 이름이 곧 신호라 판정이 흔들리지 않는 것들만 본다. 문구 없는 노드는 세지 않는다 — 명세에 적을 라벨이 없다(선택지가 비어 있는 드롭다운, 항목의 '…' 메뉴). 셸은 `shell.json`의 `excludeNodeNames`로 빠진다. 붙일 때 11개 화면에서 **0건**이었고, `18:86`을 도로 지워 실제로 그 한 줄을 짚는 것을 확인했다.
- **검증**(validate-specs.mjs): 스키마(ajv) + 교차 참조(중복 fieldKey·nodeId, 출처 key·인자 매핑, enabledWhen/resetOnChangeOf, 상태 스코프, 이동 대상, design nodeId·자산·reference, hash 신선도). 오류 시 종료 코드 1.
- **판정기**(button-execution.mjs): 필수값 존재 판정(공백·null은 누락, 0·false는 값), `executeWhen` 생략=항상 실행, `onExecutionBlocked`와 쌍 규칙. 앱이 재구현 없이 직접 import한다.
- **스펙 체계 확장(2026-08-17)**: 화면 JSON에 선택적 `meta`(title·description·footerNote), select에 선택적 `disabledPlaceholder`(placeholder는 활성 문구), button에 선택적 `description`·`badge`, wireframe 단위 `flows.json` 카탈로그(단계=배열 위치, **단계별 label**, 한 화면은 한 흐름 — 뒤로 이동 판별에도 사용), 내비게이션 정합성 계약(미등록 이동=명시적 오류, element-types.md). 플러그인은 meta를 저장 왕복에서 보존하고(실전 검증됨) 새 텍스트 필드 편집란은 스키마 주도로 자동 생성된다.
- **스펙 체계 확장(2026-08-18, ORG-02 사이클)**: 요소 유형 `list`(추가·이름 수정·삭제하는 목록, `rootItem`이 있으면 트리), `action.submit` + wireframe 단위 `mutations.json` 카탈로그(경로·payloadScope·상태 문구), `onSuccess.navigate`·`scopeEvent`, 선택지 부연 설명 `options[].description`, 라벨 없는 select(`label` 선택 사항). 검증기는 목록의 참조·개수, 제출 계약 key, payloadScope와 scopeEvent의 스코프 정합을 교차 검사한다.
- **스펙 체계 확장(2026-08-18, ORG-01 사이클)**: 요소 유형 `note`(다른 상태 스코프의 값을 읽어 표시)와 `group`(필드 묶음 + 제목·설명), `meta.eyebrow`, input·select의 `helperText`, `select.presentation`(dropdown·choiceGroup). 검증기는 note의 스코프·fieldKey 참조와 group의 멤버 존재·단일 소속을 교차 검사한다. 전부 스키마 주도라 플러그인 편집 UI는 자동 생성된다.
- **테스트**: 플러그인 89, spec-service·변환기·검증 96, vada-web(vitest) 159 + Playwright e2e 37 — 전부 통과. e2e는 AI가 직접 실행·스크린샷 판독하는 시각 검증 1차 수단이다(`apps/vada-web`에서 `npm run e2e`). 플러그인은 `manifest.json`을 Figma 데스크톱에서 불러온다.
- **요소 유형 레지스트리 단일화(2026-08-18)**: 검증기의 요소 스키마 목록은 이제 `screen.schema.json`의 `spec.type` enum에서 파생된다. enum에 있는데 스키마 파일이 없으면 기동 실패, 검증기가 모르는 유형은 **오류**다(과거에는 조용히 통과했다). `tests/element-type-registry.test.mjs`가 enum↔스키마 파일↔플러그인 옵션↔플러그인 `schemaByType`의 일치를 강제한다.
- **추출기가 화면을 보는 눈(2026-08-24)**: 초안 재현율을 **36/67 → 41/67(61%)**, 헛것(등록되지 않은 것을 뽑음)을 **41 → 19개**로 고쳤다. 막혔던 네 곳이다.
  - **이름표 없는 것을 못 봤다**: 필드는 직계 자식에 `Label` 노드를, 목록은 묶음 제목을 요구했다. 목록 화면의 검색칸(EVT-00A `20:4153`)과 카드 목록(`20:4167`)이 통째로 안 보여 초안에 버튼 4개만 나왔다. 라벨 없이 홀로 선 컨트롤과 제목 없는 되풀이를 각각 길로 냈다. 라벨은 그려진 문구에서 짐작하고 **짐작임을 질문으로 알린다.**
  - **되풀이의 깊이를 안 봤다**: 카드 안의 '아이콘+날짜 / 아이콘+장소 / 아이콘+담당' 줄도 형제 이름이 같아 목록으로 읽혔다(OPS-MEET-01A에서 회의 카드 7개가 각각 itemList로). 판별은 **본문 항목이 저마다 글을 둘 이상 갖는가**다 — 한 줄짜리 되풀이는 항목이 아니라 카드의 부분이다. OPS-MEET-01A 헛것 14 → 0.
  - **헤더가 통째로 셸이었다**: `shell.json`의 `excludeNodeNames`에서 `Header`를 뺐다. 그 안의 버튼은 화면의 요소다 — TASK-01 `18:86`이 그래서 안 보였다.
  - **구조로 갈 수 없는 것을 만났다**: HOME-01K의 대시보드 열(`16:134`)과 OPS-MEET-01A의 행사별 묶음(`18:437`)은 **구조가 완전히 같다**(섹션 둘을 담은 Container). 안쪽 섹션을 잡는 쪽을 골랐다 — 묶음이 하나로 묶이는지는 사람이 답할 것이고, 섹션을 통째로 잃는 것이 더 나쁘다.
  - 눈금은 `tests/screen-draft.test.mjs`의 **래칫**(총합 맞춤 ≥41, 헛것 ≤19)이 지킨다. 화면별 표는 폼 화면 넷만 보므로 목록 화면이 나빠져도 조용했다.
- **추출기의 선례 재사용(2026-08-19)**: 초안을 뽑을 때 이미 등록된 다른 화면의 필드를 선례로 삼는다(`spec-precedent.mjs`). 확정 단위는 **스코프 + 라벨**이다 — 라벨이 같아도 스코프가 다르면 다른 필드일 수 있고 실제 반례가 있다(ONB-01 '학교'=`school`, ORG-01 '학교'=`repSchool`). 다른 스코프의 선례는 질문에 후보로 덧붙일 뿐 확정하지 않는다. 물려주는 것은 **데이터 계약**(`valueType`·`inputType`·`optionsSource`·`enabledWhen`·`resetOnChangeOf`·`validation`)뿐이고, 문구·필수·활성 여부는 화면마다 다르므로 디자인에서 유도한 값을 그대로 둔다. 같은 스코프에서 한 라벨이 두 키를 가리키거나 같은 키의 계약이 어긋나면 확정 대신 **모순으로 보고**한다. INV-01 기준 질문 **17건 → 6건**(남은 것은 버튼 이동 대상 2·버튼 묶음 읽기 1·활성 문구 2·note 1로, 전부 디자인에도 선례에도 없는 것이다).

- **화면 산출물 구조**: 화면의 모든 산출물(screen.json·figma.raw.json·figma.design.json·assets·reference.png)은 `screens/<screenId>/` 폴더 하나에 모인다. 브리지 API 경로는 그대로다.

## 현재 상태 — 제품 vada

- **명세**: ONB-01·ONB-02·ORG-01·ORG-02·INV-01·HOME-01K·MY-01·OPS-00·TASK-01·OPS-MEET-01A·EVT-00A·EVT-TASK-02 12개 완결. 검증 오류 0건 경고 0건.
- **구현**(apps/vada-web, Vite+React+TS+Tailwind v4+lucide-react+Pretendard): **12개 화면 전부 구현·검증 통과.** 스펙 JSON·판정기·flows 카탈로그를 직접 import하고, option-sources 계약대로 mock(450ms)이 응답한다. 상태는 스코프별 저장소(`state/scopes.ts`)로 일반화되어 ORG-01의 note가 **다른 스코프**(onboardingDraft)를 읽는다. 미등록 화면 오류 카드는 이제 명세에 없는 화면으로 갈 때만 뜬다.
- **화면이 인자를 받는다(2026-08-24, EVT-TASK-02)**: 열두 화면이 전부 인자가 없었는데 상세 화면은 "무엇의 상세인지"를 밖에서 받아야 한다. `screen.json`의 `params`에 선언하고 요소가 `screenParam`으로 가리킨다. 조회 인자의 출처가 셋이 되어(`fieldKey`·`value`·`screenParam`) 그 모양을 `element-params.schema.json`으로 뽑았다 — `itemList`와 `summary`가 같은 것을 쓴다. 값은 주소가 나른다(`#/EVT-TASK-02?taskId=T-03`) — 화면 하나만 따로 여는 성질을 지키려면 앞 화면을 반드시 거치게 할 수 없다. **없으면 드러낸다** — 조용히 아무 업무나 보여주지 않는다. 검사가 쓸 값은 명세가 갖는다(`params[].example`); 검사가 지어내면 그것은 명세에 없는 사실이 된다.
- **화면은 자리만 정한다(2026-08-24)**: 무엇을 그릴지는 화면이 정하지 않는다.
  - **부품 표**(`spec/elements.tsx`): 요소 유형 → 컴포넌트 매핑이 한 곳이다. 예전에는 ORG-01·INV-01이 각자 `renderField`를 들고 있었고 **이미 어긋나 있었다**(ORG-01만 `helperText`를 넘겨, INV-01에서는 스펙의 보조 설명이 그려지지 않을 수 있었다). `useFieldDraft`가 '동작'에 대해 한 일을 이 파일이 '형태'에 대해 한다. 폼 화면당 190줄 → 84줄.
  - **머리는 카드가 그린다**(`components/PageCard.tsx`): `screen` 하나를 받아 로고·눈썹·제목·설명·진행 표시를 그린다. 어느 형태인지도 화면이 고르지 않고 **`meta.eyebrow`가 정한다** — 눈썹(흐름 이름)이 있으면 머리 왼쪽을 그것이 차지해 로고가 빠진다. 카드형 5개가 모두 그렇고, design의 로고 유무와 대조하는 검사가 채점한다.
  - **발은 합치지 않았다**: 다섯 화면의 발이 design에서 실제로 다르다(주 버튼이 폭 전체인지, 보조가 왼쪽 끝인지, 안내문이 가운데인지 오른쪽인지). 불규칙이 아니라 사실이므로 따른다.
  - **셸 선택은 유도된다**: `stateScopeKey`가 있으면 흐름 화면(PageCard), 없으면 작업 화면(AppShell)이다. 9개 중 9개가 맞아 `layout` 필드를 따로 두지 않는다. 다만 **대조기가 셸은 보지 않으므로** 잘못 골라도 조용하다.
- **design 대조(2026-08-23~24)**: `figma.design.json`과 실제로 그려진 DOM을 게이트에서 견준다(`src/design-check/`). 화면이 `data-node-id`로 등록 노드를 지목하면 그 안의 **글·글자 색·굵기·칸의 배경/테두리색·그림**을 대조한다. 붙일 때 234곳이 어긋나 있었다.
  - 색은 Tailwind 팔레트에서 유도한다(`design-check/palette.ts`, oklch→sRGB 역변환). **이 와이어프레임의 색은 Tailwind 팔레트와 정확히 같아서** 대조 결과가 곧 고칠 클래스 이름이다.
  - `data-design-state`: 색이 화면 상태에 달린 자리(빈 칸의 안내 문구)는 견주지 않는다 — 정적 와이어프레임은 한 상태만 그린다.
  - `data-asset-node-id`: design이 그림으로 뽑아 둔 자리를 화면이 그렸는지 본다. 같은 그림이 여러 자리에 있으면 하나만 그려도 통과한다(Figma가 파일마다 새로 매기는 `clip0_NN_NN`을 지우고 내용으로 묶는다). 붙이자마자 TASK-01의 지연 카드 날짜 아이콘이 붉은 것을 잡았다 — **이전에는 스크린샷 판독만이 잡았다.**
  - **못 보는 것**: 한 방향이다(화면에만 있는 장식은 못 잡는다), 등록 노드 밖(셸)은 안 본다, 같은 글이 여럿이면 하나만 맞아도 통과, 여백·크기·위치·글자 크기는 안 본다(와이어프레임이 0.875배라 잡음이 섞인다).
- **색은 한 곳에 있다**(`design/tones.ts`): 부서 칩·강조 테두리·상태 칩·값 타일 색. Tailwind가 실행 중에 클래스 이름을 만들 수 없어 표가 필요하다. 톤 이름은 **데이터가 준다** — 부서 색은 조직이 정하는 값이라 `data-sources.json`의 `departmentTone`으로 온다.
- **와이어프레임의 불규칙은 따르지 않는다**(`design/deviations.ts`): 규칙을 따르고 그래서 생긴 차이를 적어 둔다(상태 칩 글씨 -800, 값 타일 숫자 -600, 팔레트 밖 색 금지, 같은 상태는 같은 색). **예외는 자리가 아니라 규칙·색에 건다** — 화면이 늘어도 목록이 늘지 않아야 하기 때문이다(`data-design-rule`). 쓰이지 않는 예외는 실패로 다뤄 목록이 썩지 않게 한다.
- **준수 검사가 화면 전부를 본다**(`spec/conformance.test.tsx`): 예전에는 세 화면만 손으로 적혀 있었고 그래서 INV-01의 어긋남을 아무도 못 봤다. 넓히면서 검사 자체의 눈이 좁았던 곳도 드러났다(`<input type="search">`는 `textbox`가 아니라 `searchbox`, 안 검색되는 select는 placeholder가 속성이 아니라 글).
- **제출 왕복이 실제로 돈다**(ORG-02): `조직 만들기` → mutations 카탈로그의 mock 전송 → `onSuccess.navigate`로 HOME-01K 이동 + `scopeEvent: complete`로 orgCreationDraft 제거.
- **마찰 로그**: 화면마다 `docs/pilot-<screenId>.md`에 있다(9개). 잔여 발견은 전부 `docs/BACKLOG.md`에 있고, 미룬 것에는 **트리거**가 달려 있다.
- **동기화 개념이 사라졌다(2026-08-19)**: 플러그인이 명세를 쓰지 않으므로 Figma 사본과 로컬 JSON이 어긋날 일이 없다. 전환 직전 4개 화면 모두 왕복 diff 0으로 보존을 실증한 뒤 편집 경로를 걷어냈다. 플러그인 소스는 4643 → 2761줄(-41%)이고 `screen-spec.mjs`(560줄)와 그 테스트(805줄)는 통째로 사라졌다.

## 규약 포인터

- 스코프 모델·네임스페이스(3층: 파이프라인/제품/wireframe): `docs/decisions/repo-scopes.md`
- 구현 방법론(구현=검증 실험, 증거 기반 형식화): `docs/decisions/implementation-methodology.md`
- 요소 유형: `docs/decisions/element-types.md`
- vada 구현 관례: `docs/decisions/vada-conventions.md` · wireframe 해석: `specs/figma/vada-wireframe/interpretation.md`
- 보류(의도적 결정): 주기적 자동 감시, 원본 저장 직후 자동 정규화, 변경점 비교 화면, 자동 병합, 개인 계정이 연결되는 원격 Figma MCP 통합.

## 변경 전파 시험 결과 (2026-08-18)

스펙을 바꿨을 때 어떤 검사가 잡아내는지 실측했다(ONB-01의 필드 하나를 4가지로 변형).

| 변경 | validate | vitest | e2e |
| --- | --- | --- | --- |
| 라벨 변경 | 잡음 | 통과 | 잡음 |
| 필수 해제 | 통과 | 통과 | 잡음 |
| `inputType` 변경 | 통과 | 통과 | 통과 ← **아무도 못 잡음** |
| `placeholder` 변경 | 통과 | 통과 | 통과 ← **아무도 못 잡음** |

- 라벨 변경은 **등록 노드 계약**이 잡았다(스펙 라벨이 디자인 텍스트와 어긋나면 오류). 예상 못 한 부수효과다.
- 필수 해제는 e2e가 잡았지만 의미론이 아니라 접근성 이름(`학번*`→`학번`) 변화로 우연히 걸린 것이다.
- 구멍 2건은 성격이 달랐다: `inputType`은 **소비 자체가 없었고**(TextInput이 항상 `type="text"`), `placeholder`는 **소비는 되나 아무도 확인하지 않았다**.
- 처분: TextInput이 `inputType`을 소비하도록 고치고, **스펙 준수 테스트**(`src/spec/conformance.test.tsx`)를 도입했다. 기대값을 스펙 JSON에서 읽으므로 스펙을 고치면 검사가 따라간다. 구현을 일부러 깨뜨려(`type={type}`→`type="text"`) 실제로 실패하는 것을 확인했다.
- **그 뒤(2026-08-23~24)**: 준수 검사가 9개 화면 전부를 보게 됐고, design 대조가 붙어 **글자 색·굵기·칸 색·그림**까지 게이트가 본다. 이 표에서 '아무도 못 잡음'이던 축은 남아 있지 않지만, 새로 생긴 구멍이 있다 — **여백·크기·위치·글자 크기**와 **셸(등록 노드 밖)**은 여전히 아무도 안 본다.

## 다음 한 단계

EVT-TASK-02(업무 상세) 사이클을 마쳤다(`docs/pilot-evt-task-02.md`).
**새 계열이고 신규 계급 3건이다.** 그리고 **플러그인을 한 번도 열지 않고 받은 첫 화면**이다.

| 사이클 | 신규 계급 | 새 개념 | (A) 마찰 |
| --- | --- | --- | --- |
| OPS-MEET-01A | 3 | 2 | 3 |
| EVT-00A | 1 | 0 | 1 |
| **EVT-TASK-02** | **3** | **1** | **1** |

셋의 성격이 다르다.

1. **화면이 인자를 받는다** — 스키마를 넓혔다(위 참조).
2. **명세되지 않은 갈피를 적을 자리가 없다** — 선택지의 부연 설명을 빌렸다. 뜻이
   가깝지만 정확히 그것은 아니다. 한 번 더 나오면 자리를 만든다.
3. **눈썹에 데이터가 들어간다** — 빵부스러기의 행사 이름이 데이터인데 `meta.eyebrow`는
   고정 문자열이다. 줄여서 그렸다. 대조기가 셸을 안 보므로 검사에 안 걸린다.

### design 대조가 데이터의 오류를 둘 잡았다

79곳에서 시작했고(새 계열이라 손으로 고를 것이 많다), 그중 둘은 화면이 아니라
**데이터가 틀린 것**이었다 — 제출 상태 딱지의 색(초록 아니라 파랑), 마감일을
지연이면 붉게 그린 것(design은 안 그런다). 눈으로 맞췄다면 못 봤을 것들이다.

**다음 후보**

1. **행사 업무 보드**(`EVT-TASK-01`, `25:1186`) — EVT-TASK-02의 pending을 풀고
   화면 인자를 **실제로 넘겨 보는** 첫 사례가 된다. 지금은 주소로만 들어간다.
2. **옛 벡터 단위 자산 5화면**(ONB-01·ONB-02·ORG-01·ORG-02·INV-01) — 다시 받으면
   아이콘이 제대로 묶인다. 다만 그러면 그림 대조가 그 화면들에서 처음 켜진다.
3. **남은 재현율 39%** — `interpretation.md`의 기계 판독 승격이 필요하다.

화면 목록은 `node apps/spec-service/src/list-figma-screens.mjs vada-wireframe --todo`로 본다
(85개 중 12개 명세됨).


## 2026-08-24 정리: 화면당 손 작업 줄이기

수렴 기준 (2)는 "화면당 사람의 개입이 고정 목록을 벗어나지 않는다"이다. 그 목록에
남아 있던 것들을 이번에 걷어냈다. 새 화면을 만들 때 **더는 하지 않아도 되는 일**:

| 예전에 화면마다 했던 것 | 지금 |
| --- | --- |
| 요소 유형 → 컴포넌트 매핑을 손으로 씀 | `spec/elements.tsx`가 한다 |
| 머리(로고·눈썹·제목·진행)를 손으로 조립 | `PageCard`가 한다 |
| 색을 화면 안에 적음 | `design/tones.ts` 한 곳 |
| 아이콘 빠짐을 **스크린샷으로 눈으로 확인** | 게이트가 잡는다 |
| 준수 검사 목록에 화면을 손으로 추가 | `ALL_SCREENS`에서 저절로 |
| design과 어긋난 색을 아무도 모름 | 게이트가 잡는다(붙일 때 234곳) |

남아 있는 손 작업: **자리 배치**(발의 형태는 화면마다 design이 다르다)와 **도메인
답변**(fieldKey 작명·선택지 출처·이동 대상).

### 알아 둘 것

- **`meta.title`이 두 가지를 겸한다** — 화면의 이름이자 그려지는 제목이다. INV-01의
  design에는 화면 제목이 아예 없어 둘이 갈린다. `spec/screens.ts`의 `drawsTitle`이
  그 사실 하나를 들고 있고 구현과 준수 검사가 같은 곳을 본다.
- **옛 벡터 단위 자산 5화면**(ONB-01·ONB-02·ORG-01·ORG-02·INV-01) — 아이콘이 벡터
  조각으로 저장돼 있어 그림 대조를 할 수 없다. 대조기가 `usesVectorUnitAssets`로
  **유도해서** 건너뛴다(조각은 Figma가 붙이는 이름이 `Vector`다). 손으로 든 목록이
  아니므로 Figma에서 다시 저장하면 판정이 저절로 넘어간다.
- **게이트 간헐 실패 — 원인이 처음으로 좁혀졌다(2026-08-24)**: `.test-flakes.log`에 쌓인
  세 번이 **전부 같은 모양**이었다. dom은 `Vitest failed to find the current suite`가
  `src/test/setup.ts`의 `afterEach`에서, node는 `Cannot read properties of undefined
  (reading 'config')`가 `describe`에서 난다. 파일 열넷이 하나도 못 돌고 2~3초 만에 죽는다.
  dom의 격리를 풀어 두었으므로(`isolate: false`) setup은 **워커마다 한 번** 도는데, 그
  워커가 수집 문맥이 닫힌 뒤 재활용되면 이 모양이 된다. `groupOrder`는 순서만 가르지
  프로세스를 가르지 않아 dom의 fork를 node가 물려받을 수 있었다. **node 프로젝트를
  다른 풀(`threads`)로 옮겼다.** 덤으로 vada-web 검사가 60초 → 33초가 됐다.
  **아직 고쳤다고 말하지 않는다** — 세 번뿐인 일이라 통과 한 번으로는 증명되지 않는다.
- (옛 기록) **게이트 간헐 실패** — `Tests  no tests` + 종료 코드 1로 나타난다.
  `scripts/run-tests.mjs`가 한 번 다시 돌리고 증거를 `.test-flakes.log`에 쌓는다.
  2026-08-24에 **재시도까지 연속 실패한 사례가 처음 나왔다**(바로 다시 돌리면 통과).
  원인 미상. 반증한 것: CI 환경변수, 연속 6회 반복, 동시 실행 2개, CPU 부하,
  차가운 Vite 캐시, vitest 중복 설치, 훅 타임아웃.

## 확인 명령

저장소 루트에 스크립트 모음이 있다(워크스페이스로 묶지는 않았다 — 각 앱이 자기 node_modules를 유지한다).

```powershell
Set-Location 'C:\Users\82108\figma-spec-v2'
npm run check     # test(3개 앱) + validate + e2e + build 일괄

# 개별 실행
npm test          # 플러그인 → spec-service → vada-web
                  # 실패하면 전체 출력이 .test-last.log에 남는다(추적용, git 제외)
npm run validate  # 명세 검증 CLI
npm run e2e       # Playwright(스크린샷은 apps/vada-web/e2e/shots)
npm run build

# 특정 화면만 바로 열기 — 화면의 주소는 screenId다
#   http://localhost:5173/#/TASK-01
# 개발 빌드에는 오른쪽 아래에 화면 목록 버튼이 있다(배포 빌드에는 없다).

# 원본 정규화(화면 저장 후 수동 실행)
node apps/spec-service/src/generate-figma-design.mjs specs/figma/vada-wireframe/screens/ONB-01/figma.raw.json ONB-01
```
