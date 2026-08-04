# VADA 엔지니어링 운영 지도

이 디렉터리는 **AI 에이전트가 주 구현자이고 사람이 최종 책임자**인 개발 운영 기준의 정본이다. 제품 의미나 계약을 다시 설명하지 않고, 승인된 작업을 안전하게 구현·검증·운영하는 방법만 정의한다.

## 읽는 순서와 우선순위

구현 전에 현재 작업에 필요한 범위만 아래 순서로 읽는다.

1. `product-specs/`의 승인 도메인·플로우·목표 동작 설계 — 사용자가 무엇을 할 수 있어야 하는가
2. `contracts/`의 승인 계약 묶음 — 권한·데이터·API·오류·품질 경계가 무엇인가
3. `delivery-units/<DU>/implementation-architecture/`와 `delivery-work/`의 승인 리비전 — 어떤 기술 기준으로 무엇을 만들어야 하는가
4. 이 디렉터리의 엔지니어링 기준 — 작업을 어떻게 실행하고 증명하는가
5. 루트와 작업 경로에서 가장 가까운 `AGENTS.md` — 해당 경로에서 실행할 명령과 추가 제약

충돌하면 위에서 먼저 나온 제품·계약·승인 기준선이 우선한다. 하위 `AGENTS.md`는 상위 규칙을 완화하지 않고 경로별 규칙만 추가한다. 외부 글은 결정 근거이며 저장소 규칙을 직접 대체하지 않는다.

## 문서별 책임

- [워크플로 유지보수](workflow-maintenance.md) — 책임 기본값, 위험별 보증 등급, 계약 변경분과 상태 파생
- [에이전트 실행](agent-execution.md) — 책임 분리, 착수 판정, 작업 격리, 병렬화, 검토·재작업
- [테스트와 완료 증거](testing-and-evidence.md) — RED→GREEN→REFACTOR, 테스트 계층, PR 증거
- [아키텍처 경계](architecture-boundaries.md) — 디렉터리 책임, 의존 방향, 변경 동기화
- [보안과 운영](security-and-operations.md) — 최소 권한, 사람 승인 게이트, 배포·관측·롤백

## 유지보수 원칙

- 같은 규칙을 여러 문서에 복사하지 않는다. 정본 한 곳에 쓰고 다른 곳에서는 링크한다.
- 유지보수성은 파일·계층 수가 아니라 **국소적으로 이해 가능한 책임, 안정된 경계, 자동 검증, 복구 가능성**으로 판단한다.
- 새로운 추상화는 현재 승인 작업을 단순하게 만들고 책임 주체가 분명할 때만 도입한다. 미래 요구를 추정해 범용 프레임워크를 먼저 만들지 않는다.
- 문서와 코드가 어긋나면 둘 중 하나를 조용히 맞추지 않는다. 승인 제품 의미가 바뀌는지 판정한 뒤 같은 변경 집합에서 필요한 정본과 검증을 함께 갱신한다.

## 설계 근거

이 운영 기준은 하나의 공식 표준을 주장하지 않는다. 다음 공식 자료에서 반복적으로 확인되는 공통 패턴을 VADA에 맞게 적용한다.

- [OpenAI Harness Engineering](https://openai.com/index/harness-engineering/) — 짧은 저장소 지도, 구조화된 정본, 에이전트가 사용할 수 있는 피드백 루프와 관측성
- [OpenAI Symphony](https://openai.com/index/open-source-codex-orchestration-symphony/) — 의존성 기반 착수, 작업별 격리 공간, 재시도와 조정
- [Anthropic: Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents) — 세션 간 구조화된 진행 기록, 작은 증명 가능한 작업, 깨끗한 인계
- [Google Research: Scaling agent systems](https://research.google/blog/towards-a-science-of-scaling-agent-systems-when-and-why-agent-systems-work/) — 독립 작업만 병렬화하고 순차 의존 작업에 에이전트를 과도하게 늘리지 않는 기준
- [GitHub Agentic Workflows](https://docs.github.com/en/copilot/concepts/agents/about-github-agentic-workflows)와 [OWASP State of Agentic AI Security 2026](https://genai.owasp.org/download/50592/?tmstv=1754459367) — 최소 권한, 안전한 출력 경로, 감사 가능성, 고위험 변경의 사람 승인
