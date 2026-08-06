# VADA — AGENTS.md

대학 학생회·동아리 조직관리 SaaS. 데스크탑 우선 웹(React SPA) + FastAPI(AWS 서버리스) 모노레포.
이 파일이 저장소 전체 에이전트 지침의 진입점이다. 하위 `AGENTS.md`는 해당 경로의 규칙만 추가하며, `CLAUDE.md`는 이 파일을 import만 한다.

## 정식 저장소 경계

- 프로젝트 ID는 `.vada/project.json`의 `vada`, 정식 원격은 `https://github.com/vada-hq/vada.git`이다.
- VADA 작업은 이 Git 루트 또는 그 하위에서만 수행한다. 기계별 절대 경로를 문서나 코드에 정본으로 넣지 않는다.
- 와이어프레임 정본은 `prototypes/wireframe/`, 화면 정본은 `screens/`, 서버 계약은 `contracts/`, 제품 코드는 `apps/`다.
- 와이어프레임은 저장소 밖에서 편집된 뒤 **공유본으로 반입**된다. 외부 `VADA-wireframe` 폴더는 백업이 아니라 그 공유본의 압축 해제본이며, 저장소보다 최신일 수 있다. 와이어프레임을 근거로 삼기 전에 `prototypes/wireframe/AGENTS.md`의 반입 절차로 최신 여부를 먼저 확인한다.

## 정본은 셋뿐이다

| 정본 | 소유하는 것 |
| --- | --- |
| `prototypes/wireframe/src/app/App.tsx` | 화면의 UI 구조와 시각 표현 |
| `contracts/` | 서버 API·권한·데이터·오류. 와이어프레임이 알려주지 못하는 것 |
| `screens/<ID>.md` | 화면별 구조·상태와 와이어프레임에서 벗어난 결정 |

**UI는 와이어프레임이 기준이다.** 데이터 저장 위치, 접근성, 서버 계약 필드는 `contracts/`가 기준이다. 충돌하면 그 판정을 화면 파일의 `와이어프레임과 다르게 하는 것`에 근거와 함께 남긴다.

진행 상태(착수·검토·완료)는 GitHub Issue와 PR이 소유한다. 파일에 상태를 복사하지 않는다.

## 명령어 (전부 리포 루트에서 실행)

| 명령 | 용도 |
| --- | --- |
| `just setup` | 최초 1회: 전체 의존성 설치 |
| `just preflight` / `just preflight-postgresql` | 공통 도구 / 선택적 로컬 PostgreSQL 환경 점검 |
| `just dev-api` | API 개발 서버 (http://localhost:8000) |
| `just dev-web` | 웹 개발 서버 |
| `just dev-web-mock` | 계약 예제로 화면을 브라우저에서 확인 |
| `just dev-wireframe` | 와이어프레임 정본을 브라우저에서 확인 (http://localhost:5180/) |
| `just validate-contracts` | 서버 계약 검증 |
| `just validate-screens` | 화면 정본의 와이어프레임·계약 참조 검증 |
| `just validate-tooling` | CI 스코프 판별과 착수 전 도구 점검 |
| `just generate-openapi-client` / `just validate-openapi-client` | 생성 API 클라이언트 |
| `just test` / `just test-api` / `just test-api-postgresql` / `just test-web` | 전체 / API / 실제 PostgreSQL / 웹 테스트 |
| `just lint` | 린트 + 포맷 검사 |
| `just typecheck` | Pyright strict + tsc |
| `just check-api` / `just check-web` | 작업 중 쓰는 경로별 검사 |
| `just build` | 제품 웹 + 와이어프레임 프로토타입 빌드 |
| `just check` | ⭐ 계약 + 화면 + 도구 + lint + typecheck + test + build 전부 |

**완료의 정의 = `just check` 통과 + 사람이 브라우저에서 확인.** "됐다"는 주장이 아니라 명령 출력과 실제 화면이 증거다.

## 구조

- `screens/` — 화면 정본. 화면 하나당 파일 하나.
- `contracts/` — 권한·데이터·API·오류 계약과 계약 예제 픽스처.
- `apps/api` — FastAPI 모듈형 모놀리스. Python 3.13(uv), SQLAlchemy 2.x **동기** 엔진 + psycopg3, Alembic.
- `apps/web` — Vite 8 React SPA. TS 6.0, TanStack Router/Query/Form/Table, Zustand, Zod 4, Tailwind 4 + shadcn/ui(**Base UI 기반**), TipTap v3.
- `packages/` — 웹·모바일 공유용 **순수 TS만** (Zod 스키마, 생성 API 클라이언트, queryOptions).
- `prototypes/wireframe/` — 와이어프레임 정본. 화면 87개. 제품 명세는 `prototypes/wireframe/docs/`, 도메인 용어집은 `prototypes/wireframe/CONTEXT.md`. 코드를 제품으로 복사하지 않는다.
- `infra/` — Terraform. 리전은 서울(ap-northeast-2), 상태는 S3 + use_lockfile.
- `docs/engineering/` — 실행·테스트·아키텍처·보안 기준.
- `docs/` — 그 밖의 리포 문서. **기술 결정(ADR 74건)의 원본은 노션**: https://app.notion.com/p/3a068a85148e80ca89e0f726a38d49f3

`product-specs/`와 `delivery-units/`는 2026-08-06까지의 기획·실행 기록을 역사로 보존한다. 새로 만들지 않는다.

## 화면 작업 방법

1. `screens/<ID>.md`를 읽는다. 없으면 만든다.
2. `wireframe` 항목이 가리키는 위치를 **반드시 열어본다.** 화면 구조는 거기서 가져온다.
3. 그 화면을 다루는 `prototypes/wireframe/docs/`의 명세를 읽는다. 재정은 `VADA_FINANCE_SPEC.md`, 권한은 `VADA_PERMISSION_MATRIX.md`, 화면별 검증 항목은 `VADA_SCREEN_QA.md`가 기준이다. **"계약에 없다"는 판단은 이 명세들을 읽은 뒤에만 내린다.**
4. `contracts` 항목의 계약을 읽는다. 필드·상태·오류 코드는 계약이 기준이다.
5. 와이어프레임과 계약이 다르면 판정하고 그 결정을 화면 파일에 남긴다.
6. RED → GREEN으로 구현한다. 상태 목록이 곧 테스트 목록이다.
7. `just check-web` 또는 `just check-api`를 돌린다.
8. `just dev-web-mock`으로 브라우저에서 직접 확인한다.
9. PR을 올린다. 사람이 브라우저에서 보고 판정한다.

새 계약이 필요하면 `contracts/`에 추가한다. 계약 의미가 바뀌면 활성 리비전을 덮어쓰지 말고 새 리비전을 만든다.

## 불변 규칙 (위반 = CI 실패 또는 리뷰 반려)

- 커밋 메시지는 **Conventional Commits**(`feat:`, `fix:`, `chore:` …). 스쿼시 머지를 쓰므로 PR 제목도 동일 규약.
- **main 직접 push 금지.** 브랜치 → PR → CI green → 스쿼시 머지. 에이전트도 예외 없다.
- 모든 API 라우트에 권한 의존성 명시(`require_permission("리소스.행동")` 패턴). 역할명 직접 비교 금지.
- **모든 쿼리는 org 스코프 필수** — 멀티테넌트 격리가 이 프로젝트 최대 보안 리스크다. 도메인마다 크로스 테넌트 접근 테스트를 짝으로 작성.
- DB 마이그레이션은 expand → migrate → contract 분리. rename/drop을 코드 변경과 같은 릴리스에 넣지 마라. 기동 시 자동 마이그레이션 금지.
- API는 additive-only(파괴적 변경 금지). 에러 응답은 RFC 9457 problem+json 통일.
- 의존성 추가는 `uv add` / `pnpm add`만. lockfile 커밋 필수.
- 시간은 **UTC로 저장**, 표시만 KST.
- 폼 submit 핸들러에는 `event.isComposing` 가드(한국어 IME의 Enter 이중 입력 방지).
- 재정 원문이나 인증 정보를 브라우저 영속 저장소에 저장하지 마라.
- 비밀값을 코드·로그에 넣지 마라. 설정은 환경변수(배포 시 SSM Parameter Store).
- 서버 응답 실패를 샘플·하드코딩 데이터로 대체해 표시하지 마라. 거짓 성공을 만들지 마라.

## 사람에게 물어야 할 때

제품 의미, 비용·일정, 보안·운영 위험, 비가역성, 또는 여러 타당한 대안 중 선택이 결과를 실질적으로 바꿀 때만 묻는다. 승인된 기준과 저장소 증거에서 단일 권장안이 도출되면 결정하고 근거를 남긴 뒤 계속한다.

와이어프레임에 없고 계약에도 없는 것을 발견하면 추정하지 말고 화면 파일의 열린 질문으로 남기고 보고한다.

## 기술 결정에 대한 태도

스택은 확정이다. 임의로 바꾸지 마라. 재검토는 노션 ADR의 "재평가 트리거"가 충족됐을 때만 하며, 대안 제안 시 해당 ADR을 근거로 첨부하라.
