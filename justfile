# VADA 모노레포 명령 표면 — AGENTS.md의 명령 표와 1:1 유지
set windows-shell := ["bash", "-cu"]

default:
    @just --list

# 최초 1회: 전체 의존성 설치
setup:
    pnpm install
    cd apps/api && uv sync

# 개발 서버
dev-api:
    cd apps/api && uv run uvicorn vada_api.main:app --reload --port 8000

dev-web:
    pnpm --filter web dev

# 테스트
test: test-api test-web

test-api:
    cd apps/api && uv run pytest

test-web:
    pnpm --filter web test

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

# ⭐ 완료 기준: 전부 통과해야 작업 완료
check: lint typecheck test
