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
| `just dev-api` | API 개발 서버 (http://localhost:8000) |
| `just dev-web` | 웹 개발 서버 |
| `just test` / `just test-api` / `just test-web` | 테스트 |
| `just lint` | 린트 + 포맷 검사 |
| `just typecheck` | Pyright strict + tsc |
| `just validate-contracts` | 계약 구조 테스트 + 슬라이스·Notion 매핑 검증 |
| `just build` | 제품 웹 + 와이어프레임 프로토타입 빌드 |
| `just check` | ⭐ 계약 + lint + typecheck + test + build 전부 |

**작업 완료의 정의 = `just check` 통과.** 통과 전에 작업을 끝내지 마라. "됐다"는 주장이 아니라 명령 출력이 증거다.

## 구조

- `apps/api` — FastAPI 모듈형 모놀리스. Python 3.13(uv), SQLAlchemy 2.x **동기** 엔진 + psycopg3, Alembic. 도메인 모듈 간 직접 import 금지(import-linter 계약 예정).
- `apps/web` — Vite 8 React SPA. TS 6.0(7 전환 대기), TanStack Router/Query/Form/Table, Zustand, Zod 4, Tailwind 4 + shadcn/ui(**Base UI 기반**), TipTap v3.
- `packages/` — 웹·모바일 공유용 **순수 TS만** (Zod 스키마, 생성 API 클라이언트, queryOptions). TanStack Router 코드·UI 컴포넌트 넣기 금지.
- `contracts/` — 권한·데이터·도메인·API 계약과 슬라이스 기준선의 실행 원본.
- `prototypes/wireframe/` — Figma 기반 화면 참고 앱. 제품 계약이나 실제 프론트엔드의 원본이 아니다.
- `infra/` — Terraform. 리전은 서울(ap-northeast-2), 상태는 S3 + use_lockfile.
- `docs/` — 리포 문서. **기술 결정(ADR 74건)의 원본은 노션**: https://app.notion.com/p/3a068a85148e80ca89e0f726a38d49f3

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

- 작업 전: Git 루트와 브랜치를 확인하고, 관련 `contracts/slices/*.json`의 계약 기준선과 `review` 계약을 읽는다. 구현을 바꿀 미결정 사안은 작업 전에 책임자에게 보고한다.
- 슬라이스 작성·변경: `docs/governance/slice-operating-model.md`를 따르고 저장소 `specRevision`과 Notion `명세 리비전`을 확인한다. 담당자·일정·추정은 태스크 DB에서만 관리한다.
- 작업 중: 계약 의미가 바뀌면 활성 리비전을 덮어쓰지 말고 새 리비전으로 추적한다. 서브에이전트가 코드를 맡더라도 총괄 에이전트가 계약·문서 영향과 최종 diff를 검토한다.
- 작업 후: 코드·테스트·계약·문서를 같은 변경 집합에서 갱신하고 `just check`를 실행한다. 보고에는 변경, 검증 결과, 미결정 사항과 잔여 위험을 포함한다.

## 기술 결정에 대한 태도

스택은 확정이다. 임의로 바꾸지 마라. 재검토는 노션 ADR의 "재평가 트리거"가 충족됐을 때만 하며, 대안 제안 시 해당 ADR을 근거로 첨부하라.
