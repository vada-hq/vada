# VADA (바다)

대학 학생회·동아리를 위한 조직 운영 SaaS — 행사·업무·재정·문서를 한곳에서.

데스크탑 우선 웹 앱이며, 모바일은 반응형 웹으로 지원합니다.

이 저장소가 VADA 코드·실행 계약·검증·저장소 문서의 정식 Git 루트입니다. 저장소 경계와 이관 기준은 `docs/governance/repository-root.md`를 따릅니다.

## 스택 요약

| 영역 | 선정 |
| --- | --- |
| 웹 | React 19 + React Compiler · Vite 8 · TanStack Router/Query/Form · Tailwind 4 + shadcn/ui(Base UI) · TipTap |
| API | Python 3.13 · FastAPI · SQLAlchemy 2.x + psycopg3 · Alembic |
| 인프라 | AWS(서울) — Lambda 컨테이너 + LWA · API GW HTTP API · RDS PostgreSQL · Cognito · Terraform |
| 품질 | Ruff · Pyright strict · pytest+Testcontainers · ESLint · Vitest · Playwright · oasdiff |

전체 기술 결정(ADR 74건)은 노션에 기록되어 있습니다(근거·대안·재평가 트리거 포함).

## 시작하기

요구: Node ≥ 22.13(권장 24), pnpm(자동 버전 고정), uv, just, Docker

```bash
just setup   # 의존성 설치
just dev-api # http://localhost:8000/health
just dev-web # 웹 개발 서버
just validate-contracts # 실행 계약 검증
just check   # 제품 명세 + 계약 + 아키텍처 + 작업 그래프 + 코드 전체 검증
```

Figma 기반 화면 참고 앱은 `prototypes/wireframe/`, 과거 화면 명세와 QA 자료는 `docs/reference/wireframe/`에 격리되어 있습니다. 제품 구현은 `apps/`, 코드 결합 계약은 `contracts/`가 원본입니다.

## 기여

`AGENTS.md`와 `docs/engineering/README.md`를 먼저 읽어주세요. main 직접 push는 막혀 있으며, 브랜치 → PR → CI 통과 → 스쿼시 머지 흐름을 따릅니다. 커밋·PR 제목은 Conventional Commits.

## 라이선스

MIT
