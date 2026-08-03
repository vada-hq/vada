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

# 실제 PostgreSQL 검증이 필요한 작업의 실행 환경 검사
preflight-postgresql:
    pnpm preflight:postgresql

# 개발 서버
dev-api:
    cd apps/api && uv run uvicorn vada_api.main:app --reload --port 8000

dev-web:
    pnpm --filter web dev

# 실행 계약
validate-contracts:
    pnpm test:contracts
    pnpm validate:contracts

# AI용 제품 명세
validate-product-specs:
    pnpm test:product-specs
    pnpm validate:product-specs

# 전달 단위 구현 아키텍처
validate-architecture:
    pnpm test:architecture
    pnpm validate:architecture

# 승인 기준선에서 도출한 전달 작업 그래프
validate-delivery-work:
    pnpm test:delivery-work
    pnpm validate:delivery-work

# 승인 작업 그래프의 실행 범위·실행자·추정·일정 기준선
validate-execution-plan:
    pnpm test:execution-plan
    pnpm validate:execution-plan

# 승인 실행 계획에 대한 실제 상태·전이·증거 기록
validate-execution-runtime:
    pnpm test:execution-preflight
    pnpm test:execution-runtime
    pnpm validate:execution-runtime

# 테스트
test: test-api test-web

test-api:
    cd apps/api && uv run pytest

test-web:
    pnpm --filter web test

# 작업자용 경로별 검사 — 전체 통합 검사는 총괄이 just check로 한 번 실행
check-api: lint-api typecheck-api test-api

check-web: lint-web typecheck-web test-web build-web

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
    pnpm --filter web typecheck

# 빌드
build: build-web build-wireframe

build-web:
    pnpm --filter web build

build-wireframe:
    pnpm --filter @vada/wireframe build

# ⭐ 완료 기준: 전부 통과해야 작업 완료
check: validate-contracts validate-product-specs validate-architecture validate-delivery-work validate-execution-plan validate-execution-runtime lint typecheck test build
