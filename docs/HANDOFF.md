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
- **테스트**: 플러그인 83, spec-service·변환기·검증 58, vada-web(vitest) 49 + Playwright e2e 7 — 전부 통과. e2e는 AI가 직접 실행·스크린샷 판독하는 시각 검증 1차 수단이다(`apps/vada-web`에서 `npm run e2e`). 플러그인은 `manifest.json`을 Figma 데스크톱에서 불러온다.
- **요소 유형 레지스트리 단일화(2026-08-18)**: 검증기의 요소 스키마 목록은 이제 `screen.schema.json`의 `spec.type` enum에서 파생된다. enum에 있는데 스키마 파일이 없으면 기동 실패, 검증기가 모르는 유형은 **오류**다(과거에는 조용히 통과했다). `tests/element-type-registry.test.mjs`가 enum↔스키마 파일↔플러그인 옵션↔플러그인 `schemaByType`의 일치를 강제한다.
- **추출기의 선례 재사용(2026-08-19)**: 초안을 뽑을 때 이미 등록된 다른 화면의 필드를 선례로 삼는다(`spec-precedent.mjs`). 확정 단위는 **스코프 + 라벨**이다 — 라벨이 같아도 스코프가 다르면 다른 필드일 수 있고 실제 반례가 있다(ONB-01 '학교'=`school`, ORG-01 '학교'=`repSchool`). 다른 스코프의 선례는 질문에 후보로 덧붙일 뿐 확정하지 않는다. 물려주는 것은 **데이터 계약**(`valueType`·`inputType`·`optionsSource`·`enabledWhen`·`resetOnChangeOf`·`validation`)뿐이고, 문구·필수·활성 여부는 화면마다 다르므로 디자인에서 유도한 값을 그대로 둔다. 같은 스코프에서 한 라벨이 두 키를 가리키거나 같은 키의 계약이 어긋나면 확정 대신 **모순으로 보고**한다. INV-01 기준 질문 **17건 → 6건**(남은 것은 버튼 이동 대상 2·버튼 묶음 읽기 1·활성 문구 2·note 1로, 전부 디자인에도 선례에도 없는 것이다).

- **화면 산출물 구조**: 화면의 모든 산출물(screen.json·figma.raw.json·figma.design.json·assets·reference.png)은 `screens/<screenId>/` 폴더 하나에 모인다. 브리지 API 경로는 그대로다.

## 현재 상태 — 제품 vada

- **명세**: ONB-01·ONB-02·ORG-01·ORG-02 완결. INV-01·HOME-01K는 이동 대상으로만 등장(검증 경고 2건, 의도된 미완성).
- **구현**(apps/vada-web, Vite+React+TS+Tailwind v4+lucide-react+Pretendard): ONB-01·ONB-02·ORG-01·ORG-02 모두 구현·검증 통과. 스펙 JSON·판정기·flows 카탈로그를 직접 import하고, option-sources 계약대로 mock(450ms)이 응답한다. 상태는 스코프별 저장소(`state/scopes.ts`)로 일반화되어, ORG-01의 note가 **다른 스코프**(onboardingDraft)를 읽는다. INV-01·HOME-01K 이동 시 미등록 화면 오류 카드가 뜨는 것은 내비게이션 계약의 정상 동작이다.
- **ORG-01은 elements 배열 순회로 렌더한다**(ONB-01·ONB-02의 화면별 하드코딩과 다름). 화면당 손코딩을 줄이는 방향의 첫 사례다.
- **제출 왕복이 실제로 돈다**(ORG-02): `조직 만들기` → mutations 카탈로그의 mock 전송 → `onSuccess.navigate`로 HOME-01K 이동 + `scopeEvent: complete`로 orgCreationDraft 제거.
- **마찰 로그**: `docs/pilot-onb01.md` 11건 + `docs/pilot-onb02.md` 5건 + `docs/pilot-org01.md` 6건 + `docs/pilot-org02.md` 10건(신규 계급 3건). 잔여 발견은 전부 `docs/BACKLOG.md`에 있다.
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

## 다음 한 단계

INV-01 사이클을 돌며 **AI 읽기 마찰을 처음 측정**했다(`docs/pilot-inv01.md`). 결과: 명세 밖을 본 13건 중 **(A) 스키마에 자리가 없다 = 0건**. 구현하다 명세에 자리가 없어 막힌 것이 하나도 없다는 뜻이다. 반면 명세를 *만드는* 쪽에서는 신규 계급 2건(`summary` 요소, 버튼 강조도)이 나와 수렴 기준(연속 2화면 0건)을 못 맞춘다. **두 축의 상태가 다르다**: 만드는 어휘는 아직 자라는 중이고, 읽고 구현하는 데는 부족함이 없다.

이어서 추출기에 **선례 재사용**을 넣어 화면당 사람 개입을 INV-01 기준 17건 → 6건으로 줄였다(위 파이프라인 항목).

다음 후보는 셋이다.

1. **`HOME-01K` 사이클** — 마지막으로 남은 미작성 이동 대상(경고 2건의 원인). 대시보드라 미개척 영역이고, 신규 계급이 또 나오는지가 수렴 판단의 재료다. 선례 재사용의 효과도 여기서 처음 실측된다.
2. **값의 근거(provenance) 표시** — 읽기 전용 플러그인이 값만 나열하면 확인 대상이 요소 9 × 속성 15 ≈ 135개다. 이제 추출기가 '디자인에서 유도'와 '선례에서 확정'과 '사람이 답함'을 구분할 수 있으므로 계산 재료가 갖춰졌다.
3. **`useFieldDraft` 이관** — ONB-01·ORG-01·ORG-02가 아직 같은 판정 코드를 각자 들고 있다.

**막혀 있는 것**: `HOME-01K`의 `figma.raw.json`이 없다. 사용자가 Figma에서 화면을 지정하고 `Figma 원본 JSON 저장`을 눌러야 한다. `ORG-10`의 실제 Figma 화면 이름도 미확인이다.

## 확인 명령

저장소 루트에 스크립트 모음이 있다(워크스페이스로 묶지는 않았다 — 각 앱이 자기 node_modules를 유지한다).

```powershell
Set-Location 'C:\Users\82108\figma-spec-v2'
npm run check     # test(3개 앱) + validate + e2e + build 일괄

# 개별 실행
npm test          # 플러그인 → spec-service → vada-web
npm run validate  # 명세 검증 CLI
npm run e2e       # Playwright(스크린샷은 apps/vada-web/e2e/shots)
npm run build

# 원본 정규화(화면 저장 후 수동 실행)
node apps/spec-service/src/generate-figma-design.mjs specs/figma/vada-wireframe/screens/ONB-01/figma.raw.json ONB-01
```
