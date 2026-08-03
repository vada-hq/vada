# 웹 경로 지침

루트 `AGENTS.md`와 `docs/engineering/`을 먼저 따른다. 이 파일은 `apps/web/`에만 적용되는 추가 규칙이다.

## 명령

- 대상 테스트: `pnpm --filter web test -- <test-path-or-pattern>`
- 린트: `pnpm --filter web lint`
- 타입 검사: `pnpm --filter web typecheck`
- 웹 전체 검사: 리포 루트에서 `just lint-web && just typecheck-web && just test-web && just build-web`

## 구현 경계

- `prototypes/wireframe/` 코드를 import하거나 제품 구현으로 복사하지 않는다. 승인 화면 명세·계약을 기준으로 필요한 상호작용만 구현한다.
- 권한에 따른 노출 제어는 사용자 경험이며 서버 인가를 대체하지 않는다. 서버 거부 결과도 명시적인 화면 상태로 처리한다.
- 사용자 행동을 접근 가능한 쿼리로 검증하고 로딩·빈 상태·검증 실패·서버 실패·성공 후 이동을 정상 경로와 함께 테스트한다.
- 폼 제출에는 한국어 IME 중복 입력 가드를 두고, 실패 시 입력을 보존하며 거짓 성공을 표시하지 않는다.
- 재정 원문이나 인증 정보를 브라우저 영속 저장소에 임의로 저장하지 않는다.

실제 API 연결 전에는 승인 계약 예제와 공통 픽스처를 사용한다. 승인된 생성 클라이언트 기준선이 구현된 뒤에는 계약 타입을 화면에서 다시 손으로 정의하지 않는다.

