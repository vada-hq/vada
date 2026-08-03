# API 경로 지침

루트 `AGENTS.md`와 `docs/engineering/`을 먼저 따른다. 이 파일은 `apps/api/`에만 적용되는 추가 규칙이다.

## 명령

- 대상 테스트: `uv run pytest <test-path>`
- 린트·포맷 검사: `uv run ruff check . && uv run ruff format --check .`
- 타입 검사: `uv run pyright`
- 작업자·검증자용 API 범위 검사: 리포 루트에서 `just check-api`
- 실제 PostgreSQL 테스트가 필요한 작업은 할당 전에 리포 루트에서 `just preflight-postgresql`

저장소 전체 `just check`는 승인 변경을 통합한 총괄이 한 번 실행한다.

## 구현 경계

- 라우트는 입력·출력과 인증 경계를 조정하고, 제품 불변식·권한·트랜잭션을 라우트 함수에 흩뿌리지 않는다.
- 역할명을 직접 비교하지 않고 승인 권한 키와 조직·행사·사용자 관계로 서버에서 판정한다.
- 모든 데이터 접근은 조직 스코프를 명시한다. 허용 테스트와 다른 조직·무권한 거부 테스트를 짝으로 작성한다.
- HTTP 동작은 승인 OpenAPI 계약의 `x-vada-*` 추적 정보와 RFC 9457 오류 의미를 보존한다.
- 마이그레이션은 expand → migrate → contract로 나누고 기동 시 자동 실행하지 않는다.

동작 변경은 실패하는 pytest로 먼저 재현한다. 구체적인 도메인 모듈 구조는 승인 구현 아키텍처와 첫 실제 기능의 책임을 기준으로 확정하며, 현재 최소 뼈대를 근거로 범용 계층을 미리 만들지 않는다.
