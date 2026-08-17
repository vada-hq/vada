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
- **브리지**(apps/spec-service): `127.0.0.1:3846` 고정, 저장 루트 `specs/figma`. 화면 GET/PUT(ETag/If-Match), figma-raw·자산(svg)·reference(png) PUT, 카탈로그 GET. Origin 검사: 헤더 없음(로컬 도구)·`null`(플러그인)·`*.figma.com`만 허용, 그 외 403(null-origin 위조 표적 공격은 잔존 위험 — 필요 시 공유 토큰으로 격상).
- **정규화**(packages/contracts + generate-figma-design.mjs): raw→design 결정적 변환(AI 불필요), `source.hash`(raw SHA-256)로 신선도 추적. 원본 저장→정규화 자동 연결은 보류 — 저장 후 CLI를 수동 실행한다.
- **검증**(validate-specs.mjs): 스키마(ajv) + 교차 참조(중복 fieldKey·nodeId, 출처 key·인자 매핑, enabledWhen/resetOnChangeOf, 상태 스코프, 이동 대상, design nodeId·자산·reference, hash 신선도). 오류 시 종료 코드 1.
- **판정기**(button-execution.mjs): 필수값 존재 판정(공백·null은 누락, 0·false는 값), `executeWhen` 생략=항상 실행, `onExecutionBlocked`와 쌍 규칙. 앱이 재구현 없이 직접 import한다.
- **테스트**: 플러그인 100, spec-service·변환기·검증 25, vada-web(vitest) 13 — 전부 통과. 플러그인은 `manifest.json`을 Figma 데스크톱에서 불러온다.
- **화면 산출물 구조**: 화면의 모든 산출물(screen.json·figma.raw.json·figma.design.json·assets·reference.png)은 `screens/<screenId>/` 폴더 하나에 모인다. 브리지 API 경로는 그대로다.

## 현재 상태 — 제품 vada

- **명세**: ONB-01 완결(동작 + figma.design.json + 자산 11 + reference.png). ONB-02는 동작 명세만(버튼 3개, 실행 조건 없음). ORG-01·INV-00은 이동 대상으로만 등장(검증 경고 2건, 의도된 미완성).
- **구현**(apps/vada-web, Vite+React+TS+Tailwind v4+lucide-react+Pretendard): ONB-01 파일럿 구현·사용자 검증 통과(2026-08-17). 스펙 JSON과 판정기를 직접 import하고, option-sources 계약대로 mock(450ms 지연)이 응답하며, onboardingDraft는 메모리 수준으로 왕복 유지, ONB-02는 자리표시. 독립 코드 리뷰 결함 6건(F1~F6)은 vitest 테스트와 함께 전부 수정했다.
- **마찰 로그**: `docs/pilot-onb01.md`에 11건 — 2·4·5·7·9 해결(관례 반영), 1 기록(interpretation 사례표), 3·6·8·10·11은 백로그·차기 결정. ONB-01 코드 워크스루 리뷰(2026-08-17)의 잔여 발견은 전부 `docs/BACKLOG.md`에 있다.

## 규약 포인터

- 스코프 모델·네임스페이스(3층: 파이프라인/제품/wireframe): `docs/decisions/repo-scopes.md`
- 구현 방법론(구현=검증 실험, 증거 기반 형식화): `docs/decisions/implementation-methodology.md`
- 요소 유형: `docs/decisions/element-types.md`
- vada 구현 관례: `docs/decisions/vada-conventions.md` · wireframe 해석: `specs/figma/vada-wireframe/interpretation.md`
- 보류(의도적 결정): 주기적 자동 감시, 원본 저장 직후 자동 정규화, 변경점 비교 화면, 자동 병합, 개인 계정이 연결되는 원격 Figma MCP 통합.

## 다음 한 단계

리뷰 반영이 끝났다. 다음 후보 두 가지를 사용자와 정한다: ① ONB-02 사이클 — Figma에서 ONB-02 화면의 `Figma 원본 JSON 저장`(사용자) → 정규화 CLI → 구현으로 화면당 비용을 처음 실측한다(버튼만 있는 화면이라 마찰 8번과 무관). ② 백로그 착수(`docs/BACKLOG.md`).

## 확인 명령

```powershell
Set-Location 'C:\Users\82108\figma-spec-v2\apps\figma-plugin'
npm test
npm run build

Set-Location 'C:\Users\82108\figma-spec-v2\apps\spec-service'
npm test
node src/validate-specs.mjs

Set-Location 'C:\Users\82108\figma-spec-v2\apps\vada-web'
npm test
npm run build

Set-Location 'C:\Users\82108\figma-spec-v2'
node apps/spec-service/src/generate-figma-design.mjs specs/figma/vada-wireframe/screens/ONB-01/figma.raw.json ONB-01
```
