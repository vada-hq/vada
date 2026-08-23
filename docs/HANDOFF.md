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
- **정규화**(packages/contracts + generate-figma-design.mjs): raw→design 결정적 변환(AI 불필요), `source.hash`(raw SHA-256)로 신선도 추적. 원본 저장→정규화 자동 연결은 보류 — 저장 후 CLI를 수동 실행한다.
- **검증**(validate-specs.mjs): 스키마(ajv) + 교차 참조(중복 fieldKey·nodeId, 출처 key·인자 매핑, enabledWhen/resetOnChangeOf, 상태 스코프, 이동 대상, design nodeId·자산·reference, hash 신선도). 오류 시 종료 코드 1.
- **판정기**(button-execution.mjs): 필수값 존재 판정(공백·null은 누락, 0·false는 값), `executeWhen` 생략=항상 실행, `onExecutionBlocked`와 쌍 규칙. 앱이 재구현 없이 직접 import한다.
- **스펙 체계 확장(2026-08-17)**: 화면 JSON에 선택적 `meta`(title·description·footerNote), select에 선택적 `disabledPlaceholder`(placeholder는 활성 문구), button에 선택적 `description`·`badge`, wireframe 단위 `flows.json` 카탈로그(단계=배열 위치, **단계별 label**, 한 화면은 한 흐름 — 뒤로 이동 판별에도 사용), 내비게이션 정합성 계약(미등록 이동=명시적 오류, element-types.md). 플러그인은 meta를 저장 왕복에서 보존하고(실전 검증됨) 새 텍스트 필드 편집란은 스키마 주도로 자동 생성된다.
- **스펙 체계 확장(2026-08-18, ORG-02 사이클)**: 요소 유형 `list`(추가·이름 수정·삭제하는 목록, `rootItem`이 있으면 트리), `action.submit` + wireframe 단위 `mutations.json` 카탈로그(경로·payloadScope·상태 문구), `onSuccess.navigate`·`scopeEvent`, 선택지 부연 설명 `options[].description`, 라벨 없는 select(`label` 선택 사항). 검증기는 목록의 참조·개수, 제출 계약 key, payloadScope와 scopeEvent의 스코프 정합을 교차 검사한다.
- **스펙 체계 확장(2026-08-18, ORG-01 사이클)**: 요소 유형 `note`(다른 상태 스코프의 값을 읽어 표시)와 `group`(필드 묶음 + 제목·설명), `meta.eyebrow`, input·select의 `helperText`, `select.presentation`(dropdown·choiceGroup). 검증기는 note의 스코프·fieldKey 참조와 group의 멤버 존재·단일 소속을 교차 검사한다. 전부 스키마 주도라 플러그인 편집 UI는 자동 생성된다.
- **테스트**: 플러그인 89, spec-service·변환기·검증 82, vada-web(vitest) 132 + Playwright e2e 21 — 전부 통과. e2e는 AI가 직접 실행·스크린샷 판독하는 시각 검증 1차 수단이다(`apps/vada-web`에서 `npm run e2e`). 플러그인은 `manifest.json`을 Figma 데스크톱에서 불러온다.
- **요소 유형 레지스트리 단일화(2026-08-18)**: 검증기의 요소 스키마 목록은 이제 `screen.schema.json`의 `spec.type` enum에서 파생된다. enum에 있는데 스키마 파일이 없으면 기동 실패, 검증기가 모르는 유형은 **오류**다(과거에는 조용히 통과했다). `tests/element-type-registry.test.mjs`가 enum↔스키마 파일↔플러그인 옵션↔플러그인 `schemaByType`의 일치를 강제한다.
- **추출기의 선례 재사용(2026-08-19)**: 초안을 뽑을 때 이미 등록된 다른 화면의 필드를 선례로 삼는다(`spec-precedent.mjs`). 확정 단위는 **스코프 + 라벨**이다 — 라벨이 같아도 스코프가 다르면 다른 필드일 수 있고 실제 반례가 있다(ONB-01 '학교'=`school`, ORG-01 '학교'=`repSchool`). 다른 스코프의 선례는 질문에 후보로 덧붙일 뿐 확정하지 않는다. 물려주는 것은 **데이터 계약**(`valueType`·`inputType`·`optionsSource`·`enabledWhen`·`resetOnChangeOf`·`validation`)뿐이고, 문구·필수·활성 여부는 화면마다 다르므로 디자인에서 유도한 값을 그대로 둔다. 같은 스코프에서 한 라벨이 두 키를 가리키거나 같은 키의 계약이 어긋나면 확정 대신 **모순으로 보고**한다. INV-01 기준 질문 **17건 → 6건**(남은 것은 버튼 이동 대상 2·버튼 묶음 읽기 1·활성 문구 2·note 1로, 전부 디자인에도 선례에도 없는 것이다).

- **화면 산출물 구조**: 화면의 모든 산출물(screen.json·figma.raw.json·figma.design.json·assets·reference.png)은 `screens/<screenId>/` 폴더 하나에 모인다. 브리지 API 경로는 그대로다.

## 현재 상태 — 제품 vada

- **명세**: ONB-01·ONB-02·ORG-01·ORG-02·INV-01·HOME-01K·MY-01·OPS-00·TASK-01 9개 완결. 검증 오류 0건 경고 0건.
- **구현**(apps/vada-web, Vite+React+TS+Tailwind v4+lucide-react+Pretendard): **9개 화면 전부 구현·검증 통과.** 스펙 JSON·판정기·flows 카탈로그를 직접 import하고, option-sources 계약대로 mock(450ms)이 응답한다. 상태는 스코프별 저장소(`state/scopes.ts`)로 일반화되어 ORG-01의 note가 **다른 스코프**(onboardingDraft)를 읽는다. 미등록 화면 오류 카드는 이제 명세에 없는 화면으로 갈 때만 뜬다.
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
- **준수 검사가 9개 화면 전부를 본다**(`spec/conformance.test.tsx`): 예전에는 세 화면만 손으로 적혀 있었고 그래서 INV-01의 어긋남을 아무도 못 봤다. 넓히면서 검사 자체의 눈이 좁았던 곳도 드러났다(`<input type="search">`는 `textbox`가 아니라 `searchbox`, 안 검색되는 select는 placeholder가 속성이 아니라 글).
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

TASK-01(상시 업무 칸반 보드) 사이클을 마쳤다(`docs/pilot-task01.md`).
**MY-01과 같은 계열의 화면이고, 신규 계급 1건이다.**

| 사이클 | 신규 계급 | 새 개념 | (A) 마찰 |
| --- | --- | --- | --- |
| INV-01 | 2 | 2 | 0 |
| HOME-01K | 3 | 3 | 1 |
| MY-01 | 4 | 1 | 1 |
| OPS-00 | 3 | 0 | 1 |
| **TASK-01** | **1** | **0** | **0** |

MY-01이 연 자리(`itemList.params`·`itemAction`·`select` choiceGroup·`summary.unit`)가
**전부 고치지 않고 쓰였다**. 유일한 추가는 `params`의 값이 화면 필드 대신 고정값도
될 수 있게 한 것인데, 이는 `summary.items`의 `field`/`value` 구분을 한 자리 더
적용한 것이라 새 개념이 아니다.

**(A) 마찰 0건** — 구현하다 명세에 자리가 없어 막힌 것이 하나도 없었다.

### 수렴 판정

기준은 "연속 2개 화면 사이클에서 새로운 마찰 계급 0건"이다. 아직 도달하지
않았다(TASK-01은 1건). 다만 **추세는 분명하다** — 새 개념은 두 사이클 연속 0이고,
신규 계급도 3 → 1로 줄었다.

`docs/pilot-ops00.md`에서 배운 것을 지켰다: 연속을 데스크톱 화면 수로 세지 않고
**같은 계열**로 셌다. OPS-00(허브)은 MY-01의 자리를 하나도 쓰지 않아 판정에
쓸 수 없었고, TASK-01(목록)이 판정했다.

**다음 후보**

1. **목록 계열 화면 하나 더** — 신규 계급 0이면 첫 수렴이다. 회의 목록
   (OPS-MEET-01A)이 Figma에 있고 필터·목록 구조가 같아 보인다.
2. ~~자산 소비 검사~~ — 2026-08-24 완료. `data-asset-node-id`로 design의 그림과
   화면을 대조한다. 붙이자마자 TASK-01의 지연 카드 아이콘 색을 잡았다.

**막혀 있는 것**: 다음 화면의 `figma.raw.json`이 없다. 사용자가 Figma에서 화면을
지정하고 `Figma 원본 JSON 저장`을 눌러야 한다.

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
- **게이트 간헐 실패가 아직 있다** — `Tests  no tests` + 종료 코드 1로 나타난다.
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
