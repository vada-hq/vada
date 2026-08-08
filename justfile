# VADA 모노레포 명령 표면 — AGENTS.md의 명령 표와 1:1 유지
set windows-shell := ["pwsh", "-NoLogo", "-NoProfile", "-Command"]

default:
    @just --list

# 최초 1회: 전체 의존성 설치
setup:
    pnpm install
    cd apps/api && uv sync

# 작업 할당 전 공통 실행 환경 검사
preflight:
    pnpm preflight

# 실제 PostgreSQL을 로컬에서 검증할 때만 사용하는 실행 환경 검사
preflight-postgresql:
    pnpm preflight:postgresql

# 개발 서버
dev-api:
    cd apps/api && uv run uvicorn vada_api.main:app --reload --port 8000

dev-web:
    pnpm --filter web dev

# 승인 계약 예제로 화면을 브라우저에서 확인하는 개발 서버
dev-web-mock:
    pnpm --filter web dev:mock

# 와이어프레임 정본을 브라우저에서 확인하는 개발 서버 — http://localhost:5180/ (화면 87개)
dev-wireframe:
    pnpm --filter @vada/wireframe dev

# 서버 API·권한·데이터·오류 계약
validate-contracts:
    pnpm test:contracts
    pnpm validate:contracts

# 승인 구매 요청 OpenAPI 입력과 결정적 생성 클라이언트
generate-openapi-client:
    pnpm generate:openapi-client

validate-openapi-client:
    pnpm test:openapi-client
    pnpm validate:openapi-client

# 화면 정본의 와이어프레임·계약 참조
validate-screens:
    pnpm test:screens
    pnpm validate:screens

# 저장소 와이어프레임이 공유본 기준선과 같은지. VADA_WIREFRAME_SHARE로 공유본 경로를 준다
validate-wireframe-sync:
    pnpm test:wireframe-sync
    pnpm validate:wireframe-sync

# 개발용 데이터베이스에 화면을 돌려 볼 데이터를 넣는다. VADA_DATABASE_URL 필요
seed *ARGS:
    cd apps/api && uv run python scripts/seed_local.py {{ARGS}}

# 마이그레이션을 개발용 데이터베이스에 적용한다. 기동 시 자동 실행은 하지 않는다
migrate:
    cd apps/api && uv run alembic upgrade head

# 살아 있는 근거와 역사의 경계. 역사에 든 것을 계약이 참조하면 실패한다
validate-canon-boundaries:
    pnpm validate:canon-boundaries

# CI 스코프 판별과 착수 전 도구 점검
validate-tooling:
    pnpm test:tooling

# MVP 화면 몇 개 중 몇 개가 어디까지 왔는지. 저장소 사실에서 계산한다
status:
    pnpm status

# API 하나하나가 계획인지 구현인지. `just api --html`이면 브라우저로 볼 파일을 굽는다
api *ARGS:
    pnpm api {{ARGS}}

# 브라우저에서 무엇을 봐야 하는지. 화면 정본에서 뽑는다. 예: just qa EVT-FIN-01
qa SCREEN:
    pnpm qa {{SCREEN}}

# 화면을 가로지르는 흐름을 어떻게 따라가는지. 예: just flow FLOW-FIN-001
flow *FLOW:
    pnpm flow {{FLOW}}

# 테스트
test: test-api test-web test-wireframe

test-api:
    cd apps/api && uv run pytest

# 일회용 실제 PostgreSQL이 준비된 환경(로컬 또는 CI)에서만 실행
test-api-postgresql: preflight-postgresql
    cd apps/api && uv run pytest -m postgres

# 실제 PostgreSQL 통합 검사를 제외한 빠른 API 검사
test-api-fast:
    cd apps/api && uv run pytest -m "not postgres"

test-web:
    pnpm --filter web test

# 와이어프레임 정본의 재정 규칙 회귀 검사
test-wireframe:
    pnpm --filter @vada/wireframe test

# 작업자·검증자용 경로별 검사
check-api: lint-api typecheck-api test-api

check-web: validate-openapi-client lint-web typecheck-web test-web build-web

# 린트 + 포맷 검사
lint: lint-api lint-web

lint-api:
    cd apps/api && uv run ruff check . && uv run ruff format --check .

lint-web:
    pnpm --filter web lint

# 타입 검사
typecheck: typecheck-api typecheck-web

typecheck-api:
    cd apps/api && uv run pyright

typecheck-web:
    pnpm --filter @vada/api-client typecheck
    pnpm --filter web typecheck

# 빌드
build: build-web build-wireframe

build-web:
    pnpm --filter web build

build-wireframe:
    pnpm --filter @vada/wireframe build

# ⭐ 완료 기준: 전부 통과해야 작업 완료
check: validate-contracts validate-screens validate-canon-boundaries validate-wireframe-sync validate-tooling lint typecheck test build
