# Figma Spec v2

Figma에서 선택한 화면을 분석하여 개발 구현에 사용할 JSON 명세를 만드는 프로젝트이다.

## 디렉터리 구조

```text
figma-spec-v2/
├─ apps/
│  ├─ spec-service/    # [파이프라인] Figma REST 수신·초안 추출·명세 검증 CLI
│  └─ vada-web/        # [제품 vada] 명세 번들로 구현하는 프론트엔드
├─ packages/
│  └─ contracts/       # [파이프라인] JSON 형식과 검증 규칙의 유일한 원본
│     └─ schemas/      # 사람이 직접 관리하는 JSON Schema 원본
├─ docs/
│  └─ decisions/       # 설계 결정 기록 (접두 없음=파이프라인, <제품>-*.md=제품)
├─ specs/figma/         # [wireframe] 화면·옵션 출처·상태 스코프 JSON·원본 해석
└─ tests/               # [파이프라인] 구성 요소 사이의 통합 검증
```

## 스코프와 기록 위치

이 저장소는 제품 무관 파이프라인과 여러 제품의 콘텐츠를 담는 모노레포다. 모든 산출물·기록은 세 스코프 중 하나에 속한다. 상세 규칙(네임스페이스, 확장 트리거)은 `docs/decisions/repo-scopes.md`.

- 파이프라인(제품 무관) 결정: `docs/decisions/*.md` (접두 없음, 예: `element-types.md`)
- 제품 결정(스택·폰트·관례): `docs/decisions/<제품>-*.md` (예: `vada-conventions.md`), 앱은 `apps/<제품>-web`
- wireframe 원본을 읽는 법과 화면별 특이사항: `specs/figma/<wireframeKey>/interpretation.md`
- 진행 상태와 다음 단계: `docs/HANDOFF.md`
- 미착수 백로그(스코프 태그·트리거 포함): `docs/BACKLOG.md`
- 흐름 하나를 서버에 붙이는 차례(여럿이 나란히 갈 때의 규칙 포함): `docs/adding-a-flow.md`

## 화면별 산출물

화면 하나의 모든 산출물은 `specs/figma/<wireframeKey>/screens/<screenId>/` 폴더 하나에 모인다.

- `screen.json`: 동작 명세 (AI가 작성한다 — `docs/decisions/plugin-role.md`)
- `figma.raw.json`: Figma REST에서 받은 원본
- `figma.design.json`: 원본을 결정적 규칙으로 정규화한 구현용 디자인 문서
- `assets/*.svg`, `reference.png`: 벡터 추출 증거물과 검증 기준 스크린샷

```powershell
node apps/spec-service/src/generate-figma-design.mjs specs/figma/<wireframeKey>/screens/<screenId>/figma.raw.json <screenId>
```

변환 결과는 원본과 같은 화면 폴더의 `figma.design.json`에 원자적으로 저장된다.

## 전체 검사

저장소 루트에서 세 앱의 테스트·검증·e2e·빌드를 일괄 실행한다. 각 앱은 자기 `package.json`과 `node_modules`를 그대로 유지하며, 루트는 스크립트만 모은다.

```powershell
npm run check     # test + validate + e2e + build
npm test          # 세 앱의 테스트만
```

CI의 `screens` 작업은 테스트·빌드에 앞서 API 전용 타입 검사와 웹 린트를 필수로 실행한다. 웹 린트는 경고도 실패로 처리한다. 같은 검사를 로컬에서 실행하려면:

```powershell
npm --prefix apps/api run typecheck
npm --prefix apps/vada-web run lint
```

API 테스트의 공통 서버 설정은 [`createTestDeps`](apps/api/src/testing/create-test-deps.ts)로 만든다. DB·사용자·초대 설정(시간 포함)·ID 생성은 각 시나리오가 지정하고, 필요한 로그인·권한·감사 대역을 재정의한다. 기본 중복 요청 기록과 호출 횟수 저장소는 호출마다 새로 생성된다. 업무별 초기 데이터와 DB 정리 방식은 각 영역의 테스트에서 관리한다.

API 타입은 `npm run openapi`로 OpenAPI·요청 스키마와 함께 생성한다. 현재 연결 대상은 `app.start`, `auth.signInGoogle`, `auth.signInKakao`와 홈 조회 7개(`home.*`), 총 10개이며, [`api-type-operations.json`](specs/figma/vada-wireframe/api-type-operations.json)에 목록을 관리한다. 생성한 [`api-types.d.ts`](specs/figma/vada-wireframe/api-types.d.ts)의 `ApiResponse`를 서버 반환과 웹 응답 해석에 함께 사용한다. 계약 검사가 원본 카탈로그에서 다시 생성한 타입과 비교하므로, 명세를 바꾸고 타입 갱신을 빠뜨리면 CI에서 실패한다.

로그인 응답은 두 제공자 모두 `url`을 필수 문자열로 선언하고, 공통 웹 해석 함수가 두 응답 계약을 모두 만족하도록 검사한다. 검증 쿠키는 기존대로 HTTP 헤더로 전달한다. 홈의 서버 응답 타입은 생성 타입을 참조하고, 웹의 `readHomeSource`는 화면 명세의 API 연결을 확인한 뒤 기존 조회·캐시를 사용한다. 응답 필드·자료형·필수 여부의 런타임 검사도 데이터 출처 명세를 읽으므로 별도 필드 목록을 관리하지 않는다. 동적으로 선택하는 표시 필드는 `homeField`로 존재를 확인하고, 고정 필드는 생성 타입으로 검사한다.

## 운영·개발 데이터 연결

웹의 조회·선택지·제출 코드는 서버 연결이 있으면 항상 서버를 사용한다. 서버 오류나 미구현 응답을 개발용 데이터로 대체하지 않는다. 서버가 없을 때의 구현은 `vite.config.ts`의 `#offline-client` 별칭으로 선택한다.

- 기본 운영 빌드는 `src/data-sources/offline-client.ts`를 연결하며, 서버 초기화가 빠지면 오류를 낸다. `src/development/`가 운영 모듈 그래프에 들어오면 빌드도 실패한다.
- 개발 서버·단위 검사와 `VITE_FIXTURES=1` 빌드는 `src/development/client.ts`를 연결한다. 데이터·선택지·제출 대역과 예시 값은 이 디렉터리에서 관리한다. 일반 개발 서버도 앱을 시작하면 실제 서버에 연결하며, `VITE_FIXTURES=1`일 때만 서버 연결을 생략한다.
- `npm run e2e`는 개발용 빌드를 `dist-e2e/`에 만들고, 기본 `npm run build`는 운영 빌드를 `dist/`에 만든다. 운영 빌드는 소스 코드를 빈 값으로 치환하지 않는다.

## 화면 코드 불러오기

`screens/routing/`의 등록부는 화면 ID와 전달할 인자를 관리하고, 실제 화면은 `lazyScreen(() => import(...))`으로 처음 진입할 때 불러온다. 선언은 모듈 수준에 두어 재렌더링과 같은 화면의 변형 사이에서 컴포넌트와 입력 상태가 유지되도록 한다. 파일을 받는 동안 기존 로딩 표시를 사용하며, 파일 로딩 실패에는 새로고침 안내를 제공한다. 일반 렌더 오류는 기존 오류 경계가 처리한다.

빌드 검사 `vite-screen-boundary.ts`는 초기 JS와 그 정적 의존성에 실제 화면 구현이 들어가면 실패한다. 운영 브라우저 검사는 로그인에서 다른 화면 파일을 요청하지 않는지 확인하고, 실제 요청한 공통·로그인 JS의 gzip 합계를 250KB 미만으로 제한한다. `npm run smoke`는 Vite가 생성한 `assets/bundle-manifest.json`을 읽어 분리된 JS도 빠짐없이 검사한다.

Figma 그림은 `figma-asset-urls.ts`의 `?url&no-inline`으로 개별 정적 파일을 내보낸다. 주소표는 공통으로 읽고, 그림 내용은 `<img>`가 사용하는 것만 요청한다. 파일명 해시와 같은 내용의 중복 제거는 Vite가 담당한다. 그림을 추가할 때 별도의 목록을 수정하지 않는다.

배포용 브라우저 검사는 모든 그림 파일을 원본과 대조하고, 홈에서 표시하는 그림만 요청·표시되는지 확인한다. 홈의 공통 JS·화면 JS·그림 다운로드는 gzip 합계 300KB 미만으로 제한한다. 운영 점검도 manifest에 있는 SVG·PNG의 HTTP 상태와 콘텐츠 유형을 확인한다.

전체 화면 명세는 라우터의 조회 준비와 여러 화면이 공유하는 초안의 제출 변환에 계속 사용한다. 공통 명세와 자산 주소표의 추가 분리는 별도 최적화 대상이다.

## 커밋 훅

스펙 검증은 pre-commit 훅으로 강제된다(오류 시 커밋 차단). 새로 클론하면 한 번 활성화한다:

```powershell
git config core.hooksPath .githooks
```

## 명세 검증

모든 명세를 JSON Schema와 교차 참조 규칙(중복 fieldKey, 선택지 출처·인자 매핑, 상태 스코프, 이동 대상 화면, design.json nodeId·자산 존재)으로 검사한다. 오류가 있으면 종료 코드 1을 반환한다.

교차 참조 검사의 진입점은 [`collectSpecFindings`](packages/contracts/src/spec-validation.mjs)다. 권한 조건·API 권한 참조·공개 인자의 비밀값 선언·화면 사용자의 접근 가능성은 [`collectPermissionFindings`](packages/contracts/src/permission-validation.mjs)가 담당한다. 필요한 명세를 인자로 받고 결과 배열을 반환하며, 진입점은 권한 결과 뒤에 나머지 검사 결과를 모은다. 두 모듈의 공통 값 해석은 `spec-validation-values.mjs`에 둔다.

```powershell
node apps/spec-service/src/validate-specs.mjs            # specs/figma 전체
node apps/spec-service/src/validate-specs.mjs specs/figma/vada-wireframe
```
