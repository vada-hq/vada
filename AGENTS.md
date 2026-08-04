# VADA — AGENTS.md

대학 학생회·동아리 조직관리 SaaS. 데스크탑 우선 웹(React SPA) + FastAPI(AWS 서버리스) 모노레포.
이 파일이 저장소 전체 에이전트 지침의 진입점이다. 하위 `AGENTS.md`는 해당 경로의 규칙만 추가하며, `CLAUDE.md`는 이 파일을 import만 한다.

## 정식 저장소 경계

- 프로젝트 ID는 `.vada/project.json`의 `vada`, 정식 원격은 `https://github.com/vada-hq/vada.git`이다.
- VADA 작업은 이 Git 루트 또는 그 하위에서만 수행한다. 기계별 절대 경로를 문서나 코드에 정본으로 넣지 않는다.
- 외부 `VADA-wireframe` 폴더는 통합 검증용 백업일 뿐이다. 실행 계약은 `contracts/`, 제품 코드는 `apps/`, 화면 참고 앱은 `prototypes/wireframe/`가 정본 위치다.

## 명령어 (전부 리포 루트에서 실행)

| 명령 | 용도 |
| --- | --- |
| `just setup` | 최초 1회: 전체 의존성 설치 |
| `just preflight` / `just preflight-postgresql` | 작업 할당 전 공통 도구 / 선택적 로컬 PostgreSQL 환경 점검 |
| `just dev-api` | API 개발 서버 (http://localhost:8000) |
| `just dev-web` | 웹 개발 서버 |
| `just test` / `just test-api` / `just test-api-postgresql` / `just test-web` | 전체 / API / 실제 PostgreSQL / 웹 테스트 |
| `just lint` | 린트 + 포맷 검사 |
| `just typecheck` | Pyright strict + tsc |
| `just validate-contracts` | 계약 구조 테스트 + 슬라이스·Notion 매핑 검증 |
| `just validate-product-specs` | AI용 제품 명세 구조·출처·리비전·참조 검증 |
| `just validate-architecture` | 전달 단위 구현 아키텍처 구조·출처·승인·계약 고정 검증 |
| `just validate-delivery-work` | 승인 기준선에서 도출한 작업·증거·선행관계·전체 커버리지 검증 |
| `just validate-screen-specs` | 구현용 화면 상태·와이어프레임 대조·완료 증거 추적 검증 |
| `just validate-execution-plan` | 승인 작업 그래프의 실행 범위·실행자·추정·일정과 기준선 고정 검증 |
| `just validate-execution-runtime` | 승인 실행 계획의 실제 상태 전이·차단 사유·완료 증거 검증 |
| `just check-api` / `just check-web` | 작업자·검증자용 경로별 검사 |
| `just build` | 제품 웹 + 와이어프레임 프로토타입 빌드 |
| `just check` | ⭐ 제품 명세 + 계약 + lint + typecheck + test + build 전부 |

**통합 완료의 정의 = 총괄 실행선에서 `just check` 통과.** 작업자와 검증자는 할당 범위의 대상 검사와 `just check-api`·`just check-web` 또는 관련 명세 검증만 실행하고, 총괄이 승인 결과를 통합한 뒤 전체 검사를 한 번 실행한다. "됐다"는 주장이 아니라 명령 출력이 증거다.

## 구조

- `apps/api` — FastAPI 모듈형 모놀리스. Python 3.13(uv), SQLAlchemy 2.x **동기** 엔진 + psycopg3, Alembic. 도메인 모듈 간 직접 import 금지(import-linter 계약 예정).
- `apps/web` — Vite 8 React SPA. TS 6.0(7 전환 대기), TanStack Router/Query/Form/Table, Zustand, Zod 4, Tailwind 4 + shadcn/ui(**Base UI 기반**), TipTap v3.
- `packages/` — 웹·모바일 공유용 **순수 TS만** (Zod 스키마, 생성 API 클라이언트, queryOptions). TanStack Router 코드·UI 컴포넌트 넣기 금지.
- `product-specs/` — AI가 제품 의미를 읽는 구조화 정본. 승인된 도메인·사용자 흐름만 구현 기준선으로 사용한다.
- `contracts/` — 권한·데이터·도메인·API 계약과 슬라이스 기준선의 실행 원본.
- `delivery-units/` — 승인 계약에 연결된 구현 아키텍처·전달 작업과 변경 불가능한 실행 계획의 리비전 원본. 실제 진행 상태는 별도 런타임 기록으로 관리한다.
- `prototypes/wireframe/` — Figma 기반 화면 참고 앱. 제품 계약이나 실제 프론트엔드의 원본이 아니다.
- `infra/` — Terraform. 리전은 서울(ap-northeast-2), 상태는 S3 + use_lockfile.
- `docs/engineering/` — AI 주도 개발의 실행·테스트·아키텍처·보안·운영 기준.
- `docs/` — 그 밖의 리포 문서. **기술 결정(ADR 74건)의 원본은 노션**: https://app.notion.com/p/3a068a85148e80ca89e0f726a38d49f3

## 제품 기획 정본

- 활성 제품 명세 구조는 `product-specs/schemas/v2/`다. v1은 기존 문서 읽기만 지원하며, 구조 변경은 기존 폴더를 덮어쓰지 말고 새 버전과 마이그레이션으로 추가한다.
- 제품 행동의 구현 기준선은 `product-specs/domains/*/R<n>.json`과 `product-specs/flows/*/R<n>.json`의 승인 리비전이다. 목표 동작 설계는 `product-specs/solutions/*/R<n>.json`에서 정확한 제품 리비전을 참조하며 제품 의미를 새로 만들지 않는다. `draft.json`은 검토용이며 코드·계약·태스크의 확정 입력으로 사용하지 않는다.
- Notion·Figma·대화·기존 Markdown은 입력 근거 또는 작업 도구다. 그 변경은 `product-specs/`의 새 승인 리비전에 반영되기 전까지 제품 의미를 바꾸지 않는다.
- AI는 현재 작업과 관련된 최신 승인 도메인 한 개와 플로우 한 개를 우선 읽고, 실행 계약·구현 작업에서는 해당 플로우의 승인 목표 동작 설계 한 개를 추가로 읽는다. 전체 기획을 한꺼번에 적재하거나 빈칸을 추정하지 말고, 미확정 사항은 `review.openQuestions`와 `candidateChanges`로 기록한다.
- 제품 명세를 작성·변경한 작업은 `just validate-product-specs`를 통과해야 한다. 후속 실행 계약과 작업 계획이 제품 명세를 참조하며, 제품 명세에서 태스크·담당자·일정·기술 구현을 역참조하지 않는다.

## 개발 실행 기준

- 코드 작업 전 [엔지니어링 운영 지도](docs/engineering/README.md)와 작업 경로에서 가장 가까운 `AGENTS.md`를 읽는다.
- 총괄은 할당 전에 `just preflight`를 실행하고 작업 패킷에 통합 검증 위치(`local` 또는 `ci`)를 명시한다. 실제 PostgreSQL을 로컬에서 검증할 때만 `just preflight-postgresql`을 요구한다. CI 검증을 선택하면 로컬 Docker 없이 착수할 수 있지만 연결된 PostgreSQL CI 작업이 통과하기 전에는 완료할 수 없다.
- 사용자 동작 변경은 [테스트와 완료 증거](docs/engineering/testing-and-evidence.md)의 RED → GREEN → REFACTOR → CHECK 순서를 따른다. PR에 RED·GREEN·`just check` 증거를 남긴다.
- 한 작업에는 한 쓰기 주체와 격리된 브랜치·worktree를 사용한다. 선행관계와 공유 변경 경로가 없는 작업만 병렬화한다.
- 구현 작성자와 완료 검증자를 분리한다. 총괄 에이전트는 최종 diff·계약·문서 영향을 다시 검토하고, 운영 배포·비밀 접근·파괴적 변경은 사람 승인을 받는다.
- 사람 작업은 담당자의 실제 인계 확인 전에는 `in_progress`로 전환하지 않는다. 확인 근거는 실행 런타임에 `handoff_acknowledgement`로 남긴다.
- 실행 런타임의 ID와 시각을 수동으로 만들지 않는다. `pnpm record:execution-runtime -- --runtime <경로>`에 갱신 JSON을 표준 입력으로 전달하고 먼저 `--dry-run`으로 검증한다. 과거 기록 정정은 Git·PR·CI의 영구 메타데이터와 새 정정 근거를 함께 남긴다.

## 불변 규칙 (위반 = CI 실패 또는 리뷰 반려)

- 커밋 메시지는 **Conventional Commits**(`feat:`, `fix:`, `chore:` …). 스쿼시 머지를 쓰므로 PR 제목도 동일 규약.
- **main 직접 push 금지.** 브랜치 → PR → CI green → 스쿼시 머지. 에이전트도 예외 없다.
- 모든 API 라우트에 권한 의존성 명시(`require_permission("리소스.행동")` 패턴). 역할명 직접 비교 금지.
- **모든 쿼리는 org 스코프 필수** — 멀티테넌트 격리가 이 프로젝트 최대 보안 리스크다. 도메인마다 크로스 테넌트 접근 테스트를 짝으로 작성.
- DB 마이그레이션은 expand → migrate → contract 분리. rename/drop을 코드 변경과 같은 릴리스에 넣지 마라. 기동 시 자동 마이그레이션 금지.
- API는 additive-only(파괴적 변경 금지). 에러 응답은 RFC 9457 problem+json 통일.
- 의존성 추가는 `uv add` / `pnpm add`만. lockfile 커밋 필수. pip/npm 직접 설치 금지.
- 시간은 **UTC로 저장**, 표시만 KST.
- 폼 submit 핸들러에는 `event.isComposing` 가드(한국어 IME의 Enter 이중 입력 방지).
- 비밀값을 코드·로그에 넣지 마라. 설정은 환경변수(배포 시 SSM Parameter Store).

## 에이전트 작업 수명주기

- 기획 태스크 작성·변경 전: Notion의 [기획 태스크 작성 전 기준](https://app.notion.com/p/3ab68a85148e81f4beade06c94ebcd84)을 작업 체크리스트로 읽는다. 기존 `결정 필요` 목록을 완전하다고 가정하지 말고, 흐름의 모든 행동·판단을 주체·입력·기준·단위·결과·기록·상태·노출로 분해한다. 각 항목을 승인된 제품 명세 참조·기획 질문·명시적 범위 밖 중 하나로 분류한다. Notion 답변은 근거이며 `product-specs/` 승인 리비전에 반영되기 전에는 구현 규칙이 아니다.
- 계획·작업 항목 변경 전: `contracts/notion.json`의 `planningDatabases`가 가리키는 V2 데이터베이스만 현재 정본으로 사용한다. 여러 슬라이스가 공유하는 기획 결정은 가장 가까운 상위 마일스톤에서 관리하되, 서로 다른 슬라이스나 후속 작업의 착수 시점을 바꾸는 결정 묶음은 별도 작업으로 분리한다. `선행 작업`은 착수 자체를 막는 관계에만 사용하고 병렬 착수 후 완료 전에 반영할 입력은 `참조 작업`으로 연결한다. 작업 상태와 WIP는 `PROCESS:work_item_flow@R1`을 따른다. `legacyPlanningDatabases`에는 새 항목을 만들거나 현재 상태를 기록하지 않는다.
- 슬라이스 신규 생성 전: 사용자 완주 결과, 별도 순서·시연 가치, 고유 AC와 디자인·개발 작업 묶음이 모두 있는지 확인한다. 마일스톤 자체가 단일 전달 단위면 슬라이스를 생략하고 작업 항목을 마일스톤에 직접 연결한다.
- 작업 전: Git 루트와 브랜치를 확인하고, 관련 제품 도메인·플로우·목표 동작 설계의 최신 승인 리비전, 해당 전달 단위가 고정한 `contracts/bundles/*/R<n>.json` 또는 기존 `contracts/slices/*.json`, 승인된 `delivery-units/*/implementation-architecture/R<n>.json`, `delivery-work/R<n>.json`과 `execution-plan/R<n>.json`을 읽는다. `draft.json`·`review_ready`는 구현 기준선으로 사용하지 않는다. 제품 명세·계약·구현 아키텍처·전달 작업 그래프·실행 계획이 없거나 구현을 바꿀 미결정 사안이 있으면 추정하지 말고 책임자에게 보고한다.
- 슬라이스 작성·변경: `docs/governance/slice-operating-model.md`를 따르고 저장소 `specRevision`과 Notion `명세 리비전`을 확인한다. 담당자·일정·추정은 태스크 DB에서만 관리한다.
- 작업 중: 계약 의미가 바뀌면 활성 리비전을 덮어쓰지 말고 새 리비전으로 추적한다. 실제 착수·검토·완료·재작업과 증거는 승인 계획을 수정하지 말고 `delivery-units/*/execution-runtime/R<n>.json`에 누적한다. 에이전트 실행·인계·재작업은 `docs/engineering/agent-execution.md`를 따르며 총괄 에이전트가 계약·문서 영향과 최종 diff를 검토한다.
- 작업 후: 작업자는 코드·테스트·계약·문서를 같은 변경 집합에서 갱신하고 범위별 검사를 인계한다. 검증자는 이를 독립 재실행하며, 총괄은 승인 변경을 통합한 뒤 `just check`를 한 번 실행한다. 보고에는 변경, 검증 결과, 미결정 사항과 잔여 위험을 포함한다.

## 기술 결정에 대한 태도

스택은 확정이다. 임의로 바꾸지 마라. 재검토는 노션 ADR의 "재평가 트리거"가 충족됐을 때만 하며, 대안 제안 시 해당 ADR을 근거로 첨부하라.
