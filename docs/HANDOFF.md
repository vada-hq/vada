# Figma Spec v2 작업 인계

이 문서는 **현재 상태 요약과 다음 한 단계**만 담는다. 이력은 git 로그, 결정은 `docs/decisions/`, 미착수 항목은 `docs/BACKLOG.md`, 화면별 구현 발견은 파일럿 문서의 마찰 로그가 원본이다.

## 목표 흐름

1. 개발할 Figma 화면을 선택한다.
2. 플러그인에서 요소를 `입력`, `버튼`, `선택`으로 등록한다.
3. 확정적으로 읽을 수 있는 값은 자동으로 채우고, 나머지는 사용자가 검토·입력한다.
4. 화면 단위 저장 버튼을 한 번 눌러 개발 AI가 사용할 로컬 JSON 명세를 만든다.
5. 개발 AI가 명세 번들로 화면을 구현하고, 마찰 로그가 파이프라인을 개선한다.

## 현재 상태 — 파이프라인

- **플러그인**(apps/figma-plugin): 화면 선택→요소 등록→화면 JSON 저장(Figma sharedPluginData `figmaspecv2`/`screen-spec` + 로컬 브리지, 비밀값 저장 금지). `Figma 원본 JSON 저장`은 raw JSON·벡터 SVG·2배율 reference.png를 함께 브리지로 저장한다. 로컬 초안 변경 감지와 명시적 불러오기로 AI 편집을 왕복하며, 로컬 JSON에서 생략된 버튼 실행 조건은 부재 마커로 왕복 보존된다.
- **브리지**(apps/spec-service): `127.0.0.1:3846` 고정, 저장 루트 `specs/figma`. 화면 GET/PUT(ETag/If-Match), figma-raw·자산(svg)·reference(png) PUT, 카탈로그 GET.
- **화면 폴더 신원 계약(2026-08-18)**: 화면 폴더의 신원은 Figma 노드 id다(`figma.raw.json`의 `document.id` = `screen.json`의 `source.nodeId`). 폴더에 이미 다른 노드의 산출물이 있으면 screen.json·figma-raw PUT을 **409로 거부**한다. 원본은 번들에서 가장 먼저 저장되므로 여기서 막으면 자산 11개·reference.png까지 함께 보호된다. 같은 노드의 재저장(디자인 수정 후 재추출)은 정상 허용. 이 보호 이전에는 screenId를 잘못 지정하면 **reference.png가 조용히 다른 화면 것으로 바뀌었고**, reference는 존재 여부만 검사되므로 어떤 검증도 이를 잡지 못했다. Origin 검사: 헤더 없음(로컬 도구)·`null`(플러그인)·`*.figma.com`만 허용, 그 외 403(null-origin 위조 표적 공격은 잔존 위험 — 필요 시 공유 토큰으로 격상).
- **정규화**(packages/contracts + generate-figma-design.mjs): raw→design 결정적 변환(AI 불필요), `source.hash`(raw SHA-256)로 신선도 추적. 원본 저장→정규화 자동 연결은 보류 — 저장 후 CLI를 수동 실행한다.
- **검증**(validate-specs.mjs): 스키마(ajv) + 교차 참조(중복 fieldKey·nodeId, 출처 key·인자 매핑, enabledWhen/resetOnChangeOf, 상태 스코프, 이동 대상, design nodeId·자산·reference, hash 신선도). 오류 시 종료 코드 1.
- **판정기**(button-execution.mjs): 필수값 존재 판정(공백·null은 누락, 0·false는 값), `executeWhen` 생략=항상 실행, `onExecutionBlocked`와 쌍 규칙. 앱이 재구현 없이 직접 import한다.
- **스펙 체계 확장(2026-08-17)**: 화면 JSON에 선택적 `meta`(title·description·footerNote), select에 선택적 `disabledPlaceholder`(placeholder는 활성 문구), button에 선택적 `description`·`badge`, wireframe 단위 `flows.json` 카탈로그(단계=배열 위치, **단계별 label**, 한 화면은 한 흐름 — 뒤로 이동 판별에도 사용), 내비게이션 정합성 계약(미등록 이동=명시적 오류, element-types.md). 플러그인은 meta를 저장 왕복에서 보존하고(실전 검증됨) 새 텍스트 필드 편집란은 스키마 주도로 자동 생성된다.
- **스펙 체계 확장(2026-08-18, ORG-01 사이클)**: 요소 유형 `note`(다른 상태 스코프의 값을 읽어 표시)와 `group`(필드 묶음 + 제목·설명), `meta.eyebrow`, input·select의 `helperText`, `select.presentation`(dropdown·choiceGroup). 검증기는 note의 스코프·fieldKey 참조와 group의 멤버 존재·단일 소속을 교차 검사한다. 전부 스키마 주도라 플러그인 편집 UI는 자동 생성된다.
- **테스트**: 플러그인 105, spec-service·변환기·검증 28, vada-web(vitest) 29 + Playwright e2e 3 — 전부 통과. e2e는 AI가 직접 실행·스크린샷 판독하는 시각 검증 1차 수단이다(`apps/vada-web`에서 `npm run e2e`). 플러그인은 `manifest.json`을 Figma 데스크톱에서 불러온다.
- **요소 유형 레지스트리 단일화(2026-08-18)**: 검증기의 요소 스키마 목록은 이제 `screen.schema.json`의 `spec.type` enum에서 파생된다. enum에 있는데 스키마 파일이 없으면 기동 실패, 검증기가 모르는 유형은 **오류**다(과거에는 조용히 통과했다). `tests/element-type-registry.test.mjs`가 enum↔스키마 파일↔플러그인 옵션↔플러그인 `schemaByType`의 일치를 강제한다.
- **화면 산출물 구조**: 화면의 모든 산출물(screen.json·figma.raw.json·figma.design.json·assets·reference.png)은 `screens/<screenId>/` 폴더 하나에 모인다. 브리지 API 경로는 그대로다.

## 현재 상태 — 제품 vada

- **명세**: ONB-01·ONB-02·ORG-01 완결(각각 동작 + figma.design.json + 자산 11 + reference.png). ORG-02·INV-00은 이동 대상으로만 등장(검증 경고 3건, 의도된 미완성).
- **구현**(apps/vada-web, Vite+React+TS+Tailwind v4+lucide-react+Pretendard): ONB-01·ONB-02·ORG-01 모두 구현·검증 통과. 스펙 JSON·판정기·flows 카탈로그를 직접 import하고, option-sources 계약대로 mock(450ms)이 응답한다. 상태는 스코프별 저장소(`state/scopes.ts`)로 일반화되어, ORG-01의 note가 **다른 스코프**(onboardingDraft)를 읽는다. ORG-02·INV-00 이동 시 미등록 화면 오류 카드가 뜨는 것은 내비게이션 계약의 정상 동작이다.
- **ORG-01은 elements 배열 순회로 렌더한다**(ONB-01·ONB-02의 화면별 하드코딩과 다름). 화면당 손코딩을 줄이는 방향의 첫 사례다.
- **마찰 로그**: `docs/pilot-onb01.md` 11건 + `docs/pilot-onb02.md` 5건 + `docs/pilot-org01.md` 6건(신규 계급 2건). 잔여 발견은 전부 `docs/BACKLOG.md`에 있다.
- **주의(다음 플러그인 사용 시)**: Figma 안의 ONB-01·ONB-02 공유 사본에는 이번에 추가된 확장(`helperText`·`presentation`·`group` 등)이 없다. 각 화면에서 **`로컬 초안 불러오기` → `이 화면 저장`**으로 동기화한다. `presentation`은 선택적 enum이라 저장 시 모든 select에 `"dropdown"`이 명시적으로 기록된다(무해).

## 규약 포인터

- 스코프 모델·네임스페이스(3층: 파이프라인/제품/wireframe): `docs/decisions/repo-scopes.md`
- 구현 방법론(구현=검증 실험, 증거 기반 형식화): `docs/decisions/implementation-methodology.md`
- 요소 유형: `docs/decisions/element-types.md`
- vada 구현 관례: `docs/decisions/vada-conventions.md` · wireframe 해석: `specs/figma/vada-wireframe/interpretation.md`
- 보류(의도적 결정): 주기적 자동 감시, 원본 저장 직후 자동 정규화, 변경점 비교 화면, 자동 병합, 개인 계정이 연결되는 원격 Figma MCP 통합.

## 다음 한 단계

ORG-01 사이클 완료(신규 마찰 계급 2건 → 스키마 2건으로 처분, 수렴 미달성). 다음은 **변경 전파 시험**이다 — 이 시스템이 푸는 문제("문서와 디자인이 따로 놀아 관리가 어렵다")의 정중앙이며, 지금까지 한 번도 측정된 적이 없다.

절차(사용자, 10분): Figma에서 ONB-01의 필드 하나를 **라벨 변경** 1건, **필수 해제** 1건으로 바꾸고 `이 화면 저장`만 누른다. 그 외에는 아무것도 하지 않는다. 그 다음 `npm test`·`npm run e2e`·`validate-specs`를 돌린다.

관측 지점: 라벨 변경은 e2e가 깨져서 잡힐 것이다. **필수 해제는 아마 아무것도 깨지지 않는다** — 스펙은 바뀌었는데 구현은 그대로고 시스템은 조용하다. 사실이면 백로그의 *스펙 필드 소비 커버리지*가 최우선 과제로 올라간다.

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
