# Figma Spec v2 작업 인계

이 문서는 **현재 상태 요약과 다음 한 단계**만 담는다. 이력은 git 로그, 결정은 `docs/decisions/`, 미착수 항목은 `docs/BACKLOG.md`, 화면별 구현 발견은 파일럿 문서의 마찰 로그가 원본이다.

## 목표 흐름

1. `node apps/spec-service/src/fetch-figma-screen.mjs <wireframe> <screenId>` 한 줄로 원본·자산·`reference.png`·`figma.design.json`을 받는다. **사람이 Figma에서 할 일은 없다.**
2. 추출기(`draft-screen-spec.mjs`)가 `figma.design.json`에서 요소 초안을 뽑고, 디자인만으로 알 수 없는 것은 질문으로 보고한다.
3. 사용자가 질문에 답한다(fieldKey 작명·선택지 출처·이동 대상 등 도메인 결정).
4. AI가 `screen.json`을 쓴다. 확인은 사람이 아니라 검사가 한다 — 근거 표시(`spec-provenance`)가 추정값만 골라 주고, design 대조가 그려지는 값을 견준다.
5. 개발 AI가 명세 번들로 화면을 구현하고, 마찰 로그가 파이프라인을 개선한다.

## 현재 상태 — 파이프라인

- **던진 예외가 더는 백지가 아니다(2026-08-25)**: 이 저장소는 명세의 구멍을 조용히 넘기지 않고 throw한다(없는 데이터 출처, 등록되지 않은 노드, 틀린 자산 지목). 그런데 React는 렌더 중 예외가 나면 트리를 통째로 버리므로 **드러내려고 던진 오류가 가장 안 드러나는 모양**이 됐다. `ErrorBoundary`가 받아 메시지를 원문 그대로 보여주고, 화면을 옮기면 다시 그려 본다(한 번 터진 앱이 새로고침 전까지 아무 화면도 못 여는 것을 막는다). EVT-TASK-01에서 실제로 백지를 겪고 붙였다.
- **플러그인과 브리지는 지웠다(2026-08-25)**: `apps/figma-plugin`과 `apps/spec-service/src/server.mjs`(`127.0.0.1:3846` HTTP 브리지)를 저장소에서 걷어냈다. 근거는 `docs/decisions/plugin-role.md` — 플러그인만 할 수 있다던 두 가지가 둘 다 사실이 아니게 됐다(원본은 REST가 바이트까지 같게 주고, 화면 신원은 프레임 이름이 말한다). 브리지의 손님은 플러그인뿐이었다. 검사 360 → 263개, 앱 셋 → 둘, 약 7,600줄이 줄었다. `apps/spec-service`는 이제 서버가 아니라 CLI 모음이다(REST 수신·초안 추출·명세 검증).
- **등록 노드 계약(2026-08-18)**: 요소의 `source.nodeId`는 그 요소의 모든 부분(라벨·컨트롤·보조 텍스트)을 포함하는 **가장 안쪽 노드**다(element-types.md). 검증기가 식별 텍스트(`label`, group은 `title`)를 등록 노드 하위 트리에서 **정확 일치**로 찾아 강제한다(부분 일치로 하면 placeholder가 라벨을 품기만 해도 통과한다). ONB-01은 안쪽 컨트롤을 등록하고 있어 6건을 래퍼로 마이그레이션했다. 이 계약 덕에 사람이 등록하든 AI가 design.json에서 뽑든 같은 답이 나온다.
- **화면 폴더 신원 계약(2026-08-18)**: 화면 폴더의 신원은 Figma 노드 id다(`figma.raw.json`의 `document.id` = `screen.json`의 `source.nodeId`). 폴더에 이미 다른 노드의 산출물이 있으면 받기를 **거부**한다. 원본은 번들에서 가장 먼저 저장되므로 여기서 막으면 자산과 reference.png까지 함께 보호된다. 같은 노드의 재저장(디자인 수정 후 재추출)은 정상 허용. 이 보호 이전에는 screenId를 잘못 지정하면 **reference.png가 조용히 다른 화면 것으로 바뀌었고**, reference는 존재 여부만 검사되므로 어떤 검증도 이를 잡지 못했다. 판정은 `packages/contracts/src/screen-folder-identity.mjs` 한 곳에 있다 — 브리지에서 미리 뽑아 둔 덕에 브리지를 지우면서 이 규칙이 함께 사라지지 않았다.
- **REST로 직접 받는다(2026-08-24)**: 화면 하나의 산출물을 **플러그인을 열지 않고** 받는다. `node apps/spec-service/src/fetch-figma-screen.mjs vada-wireframe <screenId>` 한 줄이면 `figma.raw.json`·자산·`reference.png`에 `figma.design.json`까지 만들어진다.
  - **왜 되는가**: 플러그인이 쓰던 `exportAsync({ format: "JSON_REST_V1" })`이 Figma 문서상 "REST API가 주는 것과 같은 JSON"이다. EVT-00A로 실측했다 — 노드 212개, 속성 차이 0건, 값 차이 0건, 직렬화 길이까지 187187로 같다.
  - **`geometry=paths`를 붙이면 안 된다** — 벡터 경로가 붙어 1.8배가 되고, 플러그인이 저장해 온 것과 다른 물건이 된다.
  - **자산의 단위를 이제 로컬에서 정한다**(`collectAssetNodes`를 받은 원본에 돌린다). 플러그인 안에서 정하던 때는 규칙을 고치려면 사람이 Figma를 열어 다시 저장해야 했다. **BACKLOG의 '자산 단위 규칙' 항목이 이제 재저장 없이 고칠 수 있는 것이 됐다.**
  - **다른 것 둘**: reference.png는 크기(2588×1492)·색 깊이·색 형식이 같고 압축만 다르다. 자산 SVG는 20개 중 13개가 다른데, 그림은 같고 **크기 기준이 다르다** — 플러그인은 와이어프레임의 0.875배를 경로 좌표에 굽고 REST는 viewBox에 맞춘다. design 대조·자산 대조 전부 통과한다(양쪽이 같은 파일을 본다).
  - **화면 신원은 이름이 말한다**: 프레임 이름에 screenId가 들어 있다(`운영 — 행사 · EVT-00A · …`). 새 화면은 이름으로 찾고, 이미 있는 폴더는 그 폴더의 노드를 다시 받는다. 이름이 여럿 맞으면 조용히 고르지 않고 목록을 보여주며 멈춘다.
  - **화면 목록을 볼 수 있다**: `node apps/spec-service/src/list-figma-screens.mjs vada-wireframe --todo`. 와이어프레임에 **화면 85개**가 있고 그중 14개가 명세됐다. 다음 화면을 제품 순서로 고르기로 했는데(implementation-methodology.md) 그 순서를 이제 Figma를 열지 않고 본다.
  - **토큰**: 저장소 루트 `.env`의 `FIGMA_TOKEN`(git 제외). 필요한 권한은 `file_content:read` 하나뿐이고 file content에는 쓰기 권한 자체가 없다. 파일 key는 비밀이 아니므로 `specs/figma/<wireframe>/figma-file.json`에 둔다.
  - **한도**: Tier 1, 분당 10~20회. **파일이 속한 플랜이 정한다 — 토큰 주인의 좌석이 아니다.** 화면 하나에 3~4회면 된다.
- **자산의 단위(2026-08-24 수정)**: "벡터만 품은 가장 바깥 노드"인데 그 판정이 두 곳에서 틀렸고, 둘 다 **화면에 그릴 수 없는 파일**을 만들었다.
  - **글이 든 줄이 한 덩이가 됐다**: Figma가 보이는 글에도 `absoluteRenderBounds`를 null로 주는 일이 있다(글 500개 중 23개, 채움도 있고 reference.png에도 그려져 있다). 그것을 '있으나 마나'로 읽어 아이콘과 글이 나란한 줄이 통째로 한 자산이 됐다(OPS-MEET-01A `18:720`, 582×19). **글이 그려지는지 Figma에게 묻지 않는다** — 글은 글이다.
  - **멀리 떨어진 둘이 한 덩이가 됐다**: OPS-00 카드의 머리 줄은 왼쪽 타일과 오른쪽 끝 화살표만 들어 글이 없다. 사이가 334px 비어 383×35짜리 파일이 나왔다. **한 자산은 붙어 있어야 한다** — 가장 큰 틈이 제 크기의 절반을 넘으면 가른다. 임계값은 재서 정했다(자식 둘 이상인 자산 111개 중 이 넷만 87%, 나머지는 전부 25% 이하).
  - 고친 뒤 두 화면을 REST로 다시 받았다. OPS-00 17 → 21개, OPS-MEET-01A 32 → 33개. `design/deviations.ts`의 예외 하나가 쓰이지 않게 돼 지웠다.
- **정규화**(packages/contracts + generate-figma-design.mjs): raw→design 결정적 변환(AI 불필요), `source.hash`(raw SHA-256)로 신선도 추적. 원본 저장→정규화 자동 연결은 보류 — 저장 후 CLI를 수동 실행한다.
- **대조가 양방향이 됐다(2026-08-24)**: 지금까지 검사는 전부 **명세 → 화면** 한 방향이었다. 명세가 가리키는 자리를 화면이 그렸는지는 봤지만, **design에 있는데 명세에 없는 것은 아무도 보지 않았다.** TASK-01의 헤더 버튼 `18:86`('업무 추가')이 그렇게 조용히 빠져 있었고, EVT-00A 사이클에서 헤더에 자리를 내다 우연히 드러났다. 검증기가 이제 반대 방향을 본다 — design의 **상호작용 노드**(`Btn`·`Button`·`Text Input`·`Dropdown`) 중 등록된 어느 요소의 하위 트리에도 없는 것을 오류로 알린다. 이름이 곧 신호라 판정이 흔들리지 않는 것들만 본다. 문구 없는 노드는 세지 않는다 — 명세에 적을 라벨이 없다(선택지가 비어 있는 드롭다운, 항목의 '…' 메뉴). 셸은 `shell.json`의 `excludeNodeNames`로 빠진다. 붙일 때 11개 화면에서 **0건**이었고, `18:86`을 도로 지워 실제로 그 한 줄을 짚는 것을 확인했다.
- **검증**(validate-specs.mjs): 스키마(ajv) + 교차 참조(중복 fieldKey·nodeId, 출처 key·인자 매핑, enabledWhen/resetOnChangeOf, 상태 스코프, 이동 대상, design nodeId·자산·reference, hash 신선도). 오류 시 종료 코드 1.
- **판정기**(button-execution.mjs): 필수값 존재 판정(공백·null은 누락, 0·false는 값), `executeWhen` 생략=항상 실행, `onExecutionBlocked`와 쌍 규칙. 앱이 재구현 없이 직접 import한다.
- **스펙 체계 확장(2026-08-17)**: 화면 JSON에 선택적 `meta`(title·description·footerNote), select에 선택적 `disabledPlaceholder`(placeholder는 활성 문구), button에 선택적 `description`·`badge`, wireframe 단위 `flows.json` 카탈로그(단계=배열 위치, **단계별 label**, 한 화면은 한 흐름 — 뒤로 이동 판별에도 사용), 내비게이션 정합성 계약(미등록 이동=명시적 오류, element-types.md).
- **스펙 체계 확장(2026-08-18, ORG-02 사이클)**: 요소 유형 `list`(추가·이름 수정·삭제하는 목록, `rootItem`이 있으면 트리), `action.submit` + wireframe 단위 `mutations.json` 카탈로그(경로·payloadScope·상태 문구), `onSuccess.navigate`·`scopeEvent`, 선택지 부연 설명 `options[].description`, 라벨 없는 select(`label` 선택 사항). 검증기는 목록의 참조·개수, 제출 계약 key, payloadScope와 scopeEvent의 스코프 정합을 교차 검사한다.
- **스펙 체계 확장(2026-08-18, ORG-01 사이클)**: 요소 유형 `note`(다른 상태 스코프의 값을 읽어 표시)와 `group`(필드 묶음 + 제목·설명), `meta.eyebrow`, input·select의 `helperText`, `select.presentation`(dropdown·choiceGroup). 검증기는 note의 스코프·fieldKey 참조와 group의 멤버 존재·단일 소속을 교차 검사한다.
- **테스트**: spec-service·변환기·검증 94, vada-web(vitest) 193 + Playwright e2e 59 — 전부 통과. e2e는 AI가 직접 실행·스크린샷 판독하는 시각 검증 1차 수단이다(`apps/vada-web`에서 `npm run e2e`).
- **요소 유형 레지스트리 단일화(2026-08-18)**: 검증기의 요소 스키마 목록은 이제 `screen.schema.json`의 `spec.type` enum에서 파생된다. enum에 있는데 스키마 파일이 없으면 기동 실패, 검증기가 모르는 유형은 **오류**다(과거에는 조용히 통과했다). 검증기 기동이 그 일치를 강제한다(플러그인이 사라지며 `element-type-registry.test.mjs`는 지웠다 — 검사하던 대상의 절반이 플러그인 쪽이었다).
- **추출기가 화면을 보는 눈(2026-08-24)**: 초안 재현율을 **36/67 → 41/67(61%)**, 헛것(등록되지 않은 것을 뽑음)을 **41 → 19개**로 고쳤다. 막혔던 네 곳이다.
  - **이름표 없는 것을 못 봤다**: 필드는 직계 자식에 `Label` 노드를, 목록은 묶음 제목을 요구했다. 목록 화면의 검색칸(EVT-00A `20:4153`)과 카드 목록(`20:4167`)이 통째로 안 보여 초안에 버튼 4개만 나왔다. 라벨 없이 홀로 선 컨트롤과 제목 없는 되풀이를 각각 길로 냈다. 라벨은 그려진 문구에서 짐작하고 **짐작임을 질문으로 알린다.**
  - **되풀이의 깊이를 안 봤다**: 카드 안의 '아이콘+날짜 / 아이콘+장소 / 아이콘+담당' 줄도 형제 이름이 같아 목록으로 읽혔다(OPS-MEET-01A에서 회의 카드 7개가 각각 itemList로). 판별은 **본문 항목이 저마다 글을 둘 이상 갖는가**다 — 한 줄짜리 되풀이는 항목이 아니라 카드의 부분이다. OPS-MEET-01A 헛것 14 → 0.
  - **헤더가 통째로 셸이었다**: `shell.json`의 `excludeNodeNames`에서 `Header`를 뺐다. 그 안의 버튼은 화면의 요소다 — TASK-01 `18:86`이 그래서 안 보였다.
  - **구조로 갈 수 없는 것을 만났다**: HOME-01K의 대시보드 열(`16:134`)과 OPS-MEET-01A의 행사별 묶음(`18:437`)은 **구조가 완전히 같다**(섹션 둘을 담은 Container). 안쪽 섹션을 잡는 쪽을 골랐다 — 묶음이 하나로 묶이는지는 사람이 답할 것이고, 섹션을 통째로 잃는 것이 더 나쁘다.
  - 눈금은 `tests/screen-draft.test.mjs`의 **래칫**(총합 맞춤 ≥41, 헛것 ≤19)이 지킨다. 화면별 표는 폼 화면 넷만 보므로 목록 화면이 나빠져도 조용했다.
- **추출기의 선례 재사용(2026-08-19)**: 초안을 뽑을 때 이미 등록된 다른 화면의 필드를 선례로 삼는다(`spec-precedent.mjs`). 확정 단위는 **스코프 + 라벨**이다 — 라벨이 같아도 스코프가 다르면 다른 필드일 수 있고 실제 반례가 있다(ONB-01 '학교'=`school`, ORG-01 '학교'=`repSchool`). 다른 스코프의 선례는 질문에 후보로 덧붙일 뿐 확정하지 않는다. 물려주는 것은 **데이터 계약**(`valueType`·`inputType`·`optionsSource`·`enabledWhen`·`resetOnChangeOf`·`validation`)뿐이고, 문구·필수·활성 여부는 화면마다 다르므로 디자인에서 유도한 값을 그대로 둔다. 같은 스코프에서 한 라벨이 두 키를 가리키거나 같은 키의 계약이 어긋나면 확정 대신 **모순으로 보고**한다. INV-01 기준 질문 **17건 → 6건**(남은 것은 버튼 이동 대상 2·버튼 묶음 읽기 1·활성 문구 2·note 1로, 전부 디자인에도 선례에도 없는 것이다).

- **화면 산출물 구조**: 화면의 모든 산출물(screen.json·figma.raw.json·figma.design.json·assets·reference.png)은 `screens/<screenId>/` 폴더 하나에 모인다.

## 현재 상태 — 제품 vada

- **명세**: ONB-01·ONB-02·ORG-01·ORG-02·INV-01·HOME-01K·MY-01·OPS-00·TASK-01·OPS-MEET-01A·EVT-00A·EVT-02·EVT-TASK-01·EVT-TASK-02·EVT-DOC-01 15개 완결. 검증 오류 0건 경고 0건.
- **구현**(apps/vada-web, Vite+React+TS+Tailwind v4+lucide-react+Pretendard): **12개 화면 전부 구현·검증 통과.** 스펙 JSON·판정기·flows 카탈로그를 직접 import하고, option-sources 계약대로 mock(450ms)이 응답한다. 상태는 스코프별 저장소(`state/scopes.ts`)로 일반화되어 ORG-01의 note가 **다른 스코프**(onboardingDraft)를 읽는다. 미등록 화면 오류 카드는 이제 명세에 없는 화면으로 갈 때만 뜬다.
- **작업 공간이 세 번째로 쓰였다(2026-08-25, EVT-DOC-01)**: 두 화면일 때는 자리가 맞은 것이 우연일 수 있었다. 세 번째 화면을 넣으며 `shell.json`의 작업 공간에서 고친 것은 **한 줄**이다(`문서` 갈피의 `note` → `targetScreenId`). 화면이 새로 적은 것도 `workspace.key`와 노드 둘뿐이다. **(A) 마찰 0건 · 신규 계급 1건**으로 사이클 중 가장 낮다.
- **표에는 열 머리가 있다(2026-08-25, EVT-DOC-01)**: 지금까지의 목록은 전부 카드였다. 열 머리는 **그려지는 글**이라 "어떻게 그리는지는 design.json이 갖는다"가 답을 주지 못한다 — 화면은 design.json을 실행 중에 읽지 않는다. `itemList.columns`가 라벨과 **그 열에 오는 조각**을 함께 갖고, 검증기가 조각의 존재와 한 조각이 두 열에 오지 않는지를 본다. 라벨만 적으면 표는 그려지고 칸만 비는 어긋남을 아무도 못 본다. 열 폭은 명세에 없다.
- **개수 출처도 인자를 받는다(2026-08-25, EVT-DOC-01)**: `select.optionCounts`는 MY-01에서 이미 있던 것이고 여기서 `params`만 늘었다 — 무엇을 고를 수 있는지는 고정이어도 몇 건인지는 어느 행사의 것인지에 달렸다. `itemList.params`와 같은 축이라 판정을 한 곳으로 합쳤다(`checkArgumentMap`).
- **작업 공간 — 셸과 화면 사이의 층(2026-08-25, EVT-02)**: 셸이 **모든** 화면의 것이라면 작업 공간은 **몇** 화면의 것이다. 한 행사를 여는 화면 일곱은 갈피 줄·상태 줄·제목을 똑같이 그린다. `shell.json`의 `workspaces`가 **무엇을** 그리는지(갈피 일곱, 상태 줄의 조각, 제목의 출처, 필요한 인자)를 갖고, 각 화면의 `workspace.source`는 **어디에** 그리는지(nodeId)만 갖는다 — 같은 갈피 줄이라도 화면마다 다른 노드이기 때문이다. 갈피는 고르는 것이 아니라 옮겨 가는 것이며(갈피마다 다른 화면) 이동에 공간의 인자가 함께 간다. 검증기는 가리킨 공간의 존재·그 공간이 요구하는 인자를 화면이 받는지·갈피가 이 화면을 정확히 하나 가리키는지를 본다. design 대조와 역방향 검사도 `workspace.source`를 등록 노드로 센다.
- **화면이 인자를 넘긴다(2026-08-25, EVT-TASK-01)**: 받는 자리를 만들었으니 **주는 자리**가 필요했다. `action.params`(button·itemAction·summary.action)로 이동하면서 대상 화면에 넘긴다. 값의 출처가 넷이 됐다 — 새로 생긴 `itemField`는 **명세도 화면도 모르는 값**이라 눌린 그 행에서 읽는다(칸반 카드의 업무 번호). 조회에는 쓸 수 없다(조회 시점에는 항목이 없다). 인자를 안 넘겨도 이동은 성공하고 **대상 화면만 조용히 비므로** 검증기가 셋을 본다: 대상이 받지 않는 인자, 대상이 받는데 아무도 주지 않는 인자, 그 목록의 출처에 없는 조각. 함께 `meta.titleFrom`(제목이 데이터에서 온다 — `meta.title`은 화면의 **이름**으로 남는다)과 `summary.items[].label` 선택화(값이 라벨까지 품고 오는 자리)가 생겼다.
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
- **마찰 로그**: 화면마다 `docs/pilot-<screenId>.md`에 있다(11개). 잔여 발견은 전부 `docs/BACKLOG.md`에 있고, 미룬 것에는 **트리거**가 달려 있다.
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

EVT-02(행사 개요) 사이클을 마쳤다(`docs/pilot-evt-02.md`).
**행사 작업 공간의 두 번째 화면**이라, 목적은 화면 하나가 아니라 **같은 머리를 두
화면이 나눠 쓸 자리를 만드는 것**이었다.

| 사이클 | 신규 계급 | 새 개념 | (A) 마찰 |
| --- | --- | --- | --- |
| OPS-MEET-01A | 3 | 2 | 3 |
| EVT-00A | 1 | 0 | 1 |
| EVT-TASK-02 | 3 | 1 | 1 |
| EVT-TASK-01 | 3 | 2 | 2 |
| **EVT-02** | **2** | **1** | **2** |

1. **작업 공간**(새 개념) — 셸이 모든 화면의 것이라면 작업 공간은 몇 화면의
   것이다. **무엇을** 그리는지는 `shell.json`의 `workspaces`가, **어디에** 그리는지는
   각 화면의 `workspace.source`가 갖는다. 같은 갈피 줄이라도 화면마다 다른 노드에
   그려지므로 nodeId만 나누고 나머지는 한 곳이다. EVT-TASK-01은 요소 16개→8개.
2. **값 아래 보조 문구** — `summary.items[].description`·`descriptionField`.
   `신청자 / 142명 / 정원 200명`은 크기도 색도 달라 한 문자열로 합칠 수 없다.

### 검사가 사각을 스스로 알렸다

작업 공간으로 옮기자마자 **상태 줄이 design 대조에서 통째로 빠졌다** — 대조기가
등록 노드를 `elements`에서만 모았기 때문이다. 알려 준 것은 대조가 아니라
**'쓰이지 않는 예외' 검사**였다. 그 줄을 아무도 안 보게 되자 예외가 놀기 시작했고,
예외 목록이 썩지 않는지 보는 검사가 대조의 사각을 잡았다.

### 손으로 적은 목록이 규칙이 됐다

`meta.title`이 그려지지 않는 화면이 둘째로 나왔다. 목록에 한 줄 더 적는 대신
규칙으로 바꿨다 — **제목이 데이터에서 오면 `meta.title`은 화면을 부르는 말일
뿐이다.** 준수 검사가 따로 갖고 있던 같은 목록도 걷어내 구현과 한 함수를 본다.

**다음 후보**

1. **행사 계열을 마저 잇는다**(`EVT-DOC-01`·`EVT-MEET-01`·`EVT-SCHED-01`) — 작업
   공간이 **세 번째로** 쓰인다. 지금 두 화면은 같은 모양이라 자리가 맞았을 뿐일 수
   있다. 세 번째가 그대로 들어가면 그때 자리가 맞다고 말할 수 있고, **여기서 계급
   0건이 나오면 첫 수렴 신호다.**
2. **행사 목록에서 개요로 잇는다**(`EVT-00A`의 '행사 상세 보기' pending) — 이제
   갈 곳이 생겼다. 목록의 항목이 eventId를 넘기면 되므로 작은 일이다.
3. **회의 계열**(19개) — 가장 큰 덩어리인데 아직 한 화면만 봤다.

화면 목록은 `node apps/spec-service/src/list-figma-screens.mjs vada-wireframe --todo`로 본다
(85개 중 14개 명세됨).


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
npm test          # spec-service → vada-web
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
