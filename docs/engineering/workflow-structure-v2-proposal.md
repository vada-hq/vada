# 워크플로 구조 v2 제안

상태: 설계 제안, 미승인, 구현 입력 아님

대상 기준선: `origin/main`의 `e2c25bff651660a70965a209c40ead66ad08501d`

범위: Claude 감사에서 지적된 여섯 구조 문제의 원인 대조와 단계적 개선안

## 결론

기존 승인 리비전은 보존하고, 새 작성 경로에만 다음 네 가지 버전 경계를 추가하는 방식을 권장한다.

1. 실행 계획 v0.2는 **현재 웨이브의 커밋 작업만** 기록한다. 미래 작업은 승인 작업 그래프에서, 완료·진행 중 작업은 정확한 과거 계획·런타임 계보로 만든 원장에서 파생한다.
2. 워크플로 정책 R1의 기존 단일 파일은 그대로 보존하고, R2부터 불변 리비전 경로를 사용한다. 실행 계획·런타임·CI가 같은 정책 해시를 참조해 보증 등급과 유한 재시도를 기계적으로 강제한다.
3. 전달 작업 v0.3은 작업 범위를 한 번만 기록하고 완료 증거는 `all_work_scope` 또는 명시적 부분집합으로 그 범위를 재사용한다.
4. 새 전달 단위 manifest를 승인 제품 흐름·목표 솔루션과 실행 계층 사이의 안정 ID 정본으로 두고, Notion과 기존 `SL-*`는 단방향 투영 또는 레거시 별칭으로 전환한다.

이 제안은 외부 표준을 새 규칙의 권위로 사용하지 않는다. 아래 판단은 현재 저장소의 승인 이력, 스키마, 검증기와 CI가 실제로 수행하는 행동을 근거로 한다.

## 공통 불변식

- 승인된 `R<n>.json`과 기존 스키마 의미를 덮어쓰거나 자동 변환하지 않는다.
- 제품 의미는 승인 `product-specs/`가, 계약 의미는 승인 `contracts/`가, 작업 의미와 선행관계는 승인 `delivery-work/`가, 실제 상태와 증거는 `execution-runtime/`이 계속 소유한다.
- 사람 승인, 독립 검증, 조직 격리, 계약 해시 고정 같은 기존 게이트를 중복 제거 명목으로 약화하지 않는다.
- Notion은 사람용 운영 화면과 입력 근거일 수 있지만 승인 제품·계약·작업 의미의 동시 정본이 되지 않는다.
- 상태·착수 가능성·보증 의무처럼 계산 가능한 값은 직접 다시 쓰지 않고 정본에서 파생한다.
- 새 형식 전환은 새 작성, 이중 검증, 기본 전환, 구형 제거의 순서를 지키며 각 단계에서 구형 리더로 돌아갈 수 있어야 한다.

## 확인된 현재 동작

- [실행 계획 스키마 v0.1](../../delivery-units/schemas/execution-plan.schema.json)은 `work_allocations`에 승인 작업 전수를 요구하고, [실행 계획 검증기](../../scripts/validate-execution-plan.mjs)는 누락 작업을 오류로 처리한다. DU-001 R1~R4는 매번 21개를 모두 기록했으며 `forecast`가 17→14→10→8, `satisfied`가 0→3→6→10으로 바뀌었다.
- [워크플로 정책](../../.vada/workflow-policy.json)에는 세 보증 등급과 위험 경로가 있지만, 실행 계획 스키마에는 `assurance_profile`이나 정책 해시 참조가 없다. [CI](../../.github/workflows/ci.yml)는 정책과 실행 계획 검증을 같은 job에서 차례로 실행할 뿐 두 문서를 교차 검증하지 않는다.
- [DU-001 전달 작업 R1](../../delivery-units/DU-001/delivery-work/R1.json)의 완료 증거 23개 중 20개가 상위 작업의 `design_refs`와 `contract_refs`를 그대로 반복한다. [전달 작업 검증기](../../scripts/validate-delivery-work-plan.mjs)는 이 복사를 전제로 합집합 커버리지를 검사한다.
- [실행 런타임 스키마 v0.1](../../delivery-units/schemas/execution-runtime.schema.json)에는 시도 번호·실패 분류·같은 원인 식별자·최대 횟수가 없다. [런타임 검증기](../../scripts/validate-execution-runtime.mjs)는 `review -> in_progress`와 `done -> in_progress`를 횟수 제한 없이 허용하고, [기록기](../../scripts/record-execution-runtime.mjs)는 재시도 메타데이터를 입력받지 않는다.
- [DU-001 전달 작업 R1](../../delivery-units/DU-001/delivery-work/R1.json)은 `FLOW-FIN-001@R2`를 전달 단위로 쓰지만 실행 계획과 디렉터리는 `DU-001`을 사용한다. [Notion 원장](../../contracts/notion.json)은 `SL-*`, `MS-*`, `TSK-*`를 별도로 매핑하며 `DU-001`과 `WORK:*`의 직접 투영 관계는 없다.
- [SL-EVT-002](../../contracts/slices/SL-EVT-002.json)는 `planned` 상태에서 `DATA:event.lifecycle_transition@R1`의 `review` 리비전을 기준선에 포함한다. [계약 검증기](../../scripts/validate-contracts.mjs)는 이 조합을 매번 경고하고 성공 코드로 끝내므로 [CI](../../.github/workflows/ci.yml)는 항상 같은 경고를 허용한다.

## 목표 구조

```text
승인 FLOW/SOLUTION
        │
        ▼
전달 단위 manifest ───────► Notion 투영 원장
        │                         │
        │                         └─ 사람용 보기·운영 입력
        ▼
계약 → 아키텍처 → 전달 작업 그래프
                         │
                         ▼
                 현재 웨이브 실행 계획
                         │
                         ▼
                 시도·상태·증거 런타임

기존 SL-* ── 레거시 별칭/투영 ──► 전달 단위 manifest
```

이 구조에서 manifest는 새 제품 의미를 복사하지 않는다. `active` manifest는 정확한 승인 흐름과 목표 솔루션의 경로·리비전·해시를 함께 고정하고 둘의 내부 참조가 일치하는지만 검증한다. 이후 계층은 manifest의 안정 ID를 사용한다. 승인 흐름이나 솔루션이 아직 없는 계획 후보는 구현 입력이 아닌 `definition_blocked` 인벤토리로만 표현한다.

## 1. `forecast` 전량 재작성 제거

### 문제

실행 계획 v0.1은 롤링 웨이브임에도 모든 작업을 한 번씩 배정해야 한다. 그래서 현재 실행하지 않는 미래 작업의 `forecast`와 이미 끝난 작업의 `satisfied`를 매 계획마다 다시 작성한다. 이는 작업 의미나 실제 상태를 소유하지 않는 실행 계획이 두 정보를 복제하게 만들고, 21개 작업이 늘어날수록 작은 웨이브 승인도 전량 diff가 된다.

### 유지해야 할 불변식

- 승인 작업 그래프의 작업 ID·리비전·선행관계는 실행 계획이 바꾸지 않는다.
- 승인된 한 웨이브가 무엇을 누구에게 커밋했는지는 이후에도 재현할 수 있어야 한다.
- 커밋 당시의 착수 가능 전선과 의도적으로 미룬 작업은 승인자가 확인할 수 있어야 한다.
- 과거 완료는 검증된 런타임 증거 없이 `satisfied`로 간주할 수 없다.

### 대안

#### 대안 A — 이전 실행 계획에 대한 delta

`base_execution_plan_ref`를 두고 추가·변경·삭제 allocation만 기록한다. 파일 크기는 줄지만 현재 계획을 읽을 때 모든 과거 계획을 재귀 합성해야 하고, 미래 `forecast`와 과거 `satisfied`를 실행 계획이 소유하는 근본 문제는 남는다.

#### 대안 B — 현재 웨이브 커밋만 기록

실행 계획에는 이번에 실행할 작업만 둔다. 승인 작업 그래프가 미래 작업을, 검증된 런타임이 완료 작업을 소유한다. 커밋 시점의 파생 결과는 전체 작업 사본이 아니라 현재 `ready` 전선과 근거 digest만 봉인한다.

#### 대안 C — 전량 snapshot을 생성물로 유지

사람이나 에이전트는 커밋 작업만 입력하고 CI가 기존 v0.1 전량 계획을 생성한다. 기존 소비자를 유지하기 쉽지만 생성 snapshot을 승인 원본으로 다시 커밋하면 저장소 diff와 이력 소음은 남는다.

### 권장안

대안 B를 권장한다. v0.2의 핵심 필드는 다음과 같다.

```json
{
  "schema_version": "0.2.0",
  "workflow_policy_ref": { "path": "...", "policy_id": "...", "policy_revision": 2, "canonical_sha256": "..." },
  "work_plan_ref": { "path": "...", "plan_id": "...", "plan_revision": 2, "canonical_sha256": "..." },
  "selection_snapshot": {
    "previous_execution_plan_ref": { "path": "...", "plan_id": "...", "plan_revision": 4, "canonical_sha256": "..." },
    "runtime_input_refs": [
      { "path": "...", "runtime_id": "...", "runtime_revision": 4, "canonical_sha256": "..." }
    ],
    "completion_ledger_sha256": "<sha256>",
    "attempt_ledger_sha256": "<sha256>",
    "active_work_refs": ["WORK:...@R1"],
    "ready_work_refs": ["WORK:...@R2"],
    "derived_frontier_sha256": "<sha256>"
  },
  "commitments": [
    { "work_item_ref": "WORK:...@R1", "primary_executor_ref": "EXEC:..." }
  ],
  "deferred_ready": [
    { "work_item_ref": "WORK:...@R1", "reason_ko": "..." }
  ],
  "released_commitments": [
    { "work_item_ref": "WORK:...@R1", "previous_plan_ref": "EP-...@R4", "approval_source_ref": "SRC-..." }
  ]
}
```

`source_commit`은 사용하지 않는다. 계획이 자신을 포함한 Git commit을 참조하면 자기 참조가 생기고, 이전 commit을 참조하면 shallow checkout과 Git 객체 보존 여부에 검증이 종속되기 때문이다. 대신 snapshot은 승인 작업 그래프, 바로 전 승인 실행 계획, 상태 계산에 실제로 사용한 불변 런타임의 경로·ID·리비전·정규 해시를 모두 고정한다. 검증기는 각 런타임에서 그 런타임이 고정한 계획과 작업 그래프까지 계보를 따라가고, `verified` 완료 증거만 모아 결정적 완료 원장을 만든다.

`ready_work_refs`는 계획 작성 직전의 미커밋 착수 가능 전선만 봉인하며 미래·완료 작업 전수를 포함하지 않는다. 일반적인 새 commitment와 `deferred_ready`의 합집합은 이 전선과 정확히 같아야 한다. `active_work_refs`는 앞선 계획에서 커밋됐지만 검증 완료나 명시적 종결이 없는 작업이다. 새 commitment는 정확한 작업 리비전뿐 아니라 같은 안정 작업 ID의 대체 리비전과도 겹칠 수 없다. 단, 미착수 예약을 재배정할 때만 현재 `active_work_refs`에 있는 작업을 이전 plan ref와 사람 승인 근거를 가진 `released_commitments`로 해제하고 같은 계획에서 새 executor에게 다시 commitment할 수 있다. 따라서 전체 식은 `(ready_work_refs ∪ released_commitments.work_item_ref) = (commitments.work_item_ref ∪ deferred_ready.work_item_ref)`이며 각 집합은 중복이 없어야 한다. 이미 착수한 작업은 release로 우회할 수 없고 이전 실행의 종결·교체·인계 근거가 필요하다.

과거 계획은 자신보다 낮은 계획 리비전의 연속 체인과 snapshot에 고정한 런타임만으로 검증한다. 이후 생긴 계획이나 런타임을 다시 섞지 않으므로 과거 snapshot은 재해석되지 않는다. 반대로 현재 계획을 만들 때는 같은 전달 단위의 더 낮은 승인 계획 리비전이 체인에서 빠지거나, 앞선 커밋 작업이 완료 원장과 활성 원장 어느 쪽에도 없으면 실패한다. 이렇게 해야 snapshot 작성자가 진행 중 작업을 누락해 중복 배정하는 것을 막을 수 있다.

### 새 스키마 리비전과 단계적 마이그레이션

1. `execution-plan-0.2.0.schema.json`과 v0.1·v0.2 이중 리더를 추가한다.
2. 실행 계획 계보와 검증된 완료 증거 원장을 해석하는 공용 resolver를 추가한다. `derive-delivery-status`와 계획 검증기는 이 resolver의 동일한 정규 출력으로 snapshot digest를 계산한다.
3. 다음 웨이브 한 건을 v0.2로 작성하되 기존 R1~R4는 그대로 검증한다. 최초 v0.2 계획은 바로 전 v0.1 계획과 해당 런타임을 정확한 해시로 고정하는 호환 경계를 가진다.
4. 두 웨이브 동안 v0.2 계획과 런타임 생성·상태 파생을 관찰한 뒤 새 작성 기본값만 v0.2로 바꾼다.
5. 모든 활성 도구가 v0.2를 읽는 것이 확인된 뒤 v0.1 작성기만 제거한다. v0.1 리더는 역사 조회를 위해 유지한다.

### 롤백과 검증 기준

- 롤백은 v0.2 작성 기본값을 끄고 새 웨이브를 v0.1로 작성하는 방식으로 한다. 이미 승인된 v0.2 파일은 삭제하거나 v0.1로 재작성하지 않는다.
- v0.2 계획에 `forecast`·`satisfied`·작업 전수 allocation이 들어가면 검증 실패해야 한다.
- snapshot의 `ready` 전선과 `commitments + deferred_ready`가 다르거나, 커밋 작업의 선행 증거가 snapshot에 없으면 실패해야 한다.
- 앞선 계획에서 완료되지 않은 작업, 같은 안정 ID의 대체 리비전, 런타임이 아직 만들어지지 않은 예약 작업을 다시 커밋하면 실패해야 한다.
- 미착수 release에 이전 계획 ref나 사람 승인 근거가 없거나, 이미 착수한 run을 release하려 하면 실패해야 한다. 유효 release와 새 commitment는 같은 계획에서 원자적으로 검증돼야 한다.
- 이전 계획·런타임 입력 ref 하나를 빼거나 해시를 바꾸면 실패하고, 동일한 작업 그래프·계획 계보·런타임 입력에서는 snapshot digest가 두 번 모두 같아야 한다.
- 검증은 현재 checkout에 존재하는 불변 리비전 파일만 사용해야 하며 Git history나 네트워크 fetch 없이 통과해야 한다.

## 2. `assurance_profile` 실행 계획·검증기·CI 배선

### 문제

워크플로 정책은 `mechanical`, `standard`, `high_assurance`와 위험 경로를 정의한다. 그러나 실행 계획은 모든 커밋 작업에 분리 검증자를 일률적으로 요구할 뿐 정책 리비전, 위험 trigger, 선택된 보증 등급을 기록하지 않는다. 따라서 정책의 `mechanical` 예외는 실제 계획에서 사용할 수 없고, 반대로 고위험 작업이 `high_assurance` 검사를 모두 받았는지도 계획 검증만으로 증명할 수 없다.

### 유지해야 할 불변식

- 작업자가 임의로 보증 등급을 낮출 수 없어야 한다.
- 권한·조직 격리·재정 원자성·마이그레이션·파괴적 작업 등 현재 고위험 경로는 계속 `high_assurance`여야 한다.
- 기존 v0.1 계획이 요구하는 분리 검증은 새 정책 도입으로 완화되지 않는다.
- CI 성공은 사람 승인이나 운영 배포 승인을 가장하지 않아야 한다.

### 대안

#### 대안 A — CI 경로 기반 추정만 사용

변경 파일 경로로 위험을 추정해 job을 선택한다. 빠르지만 파일 경로만으로 제품 정책·파괴적 의미를 완전히 판별할 수 없고 실행 계획과 감사 이력이 연결되지 않는다.

#### 대안 B — 실행 계획에 등급을 자유 입력

각 allocation에 `assurance_profile`을 넣고 CI가 그 값대로 검사한다. 구현은 쉽지만 낮은 등급을 선택해 게이트를 우회할 수 있다.

#### 대안 C — 정책 참조 + trigger + 검증된 파생 등급

실행 계획이 정확한 정책 리비전·해시를 고정하고 작업별 `risk_triggers`와 `assurance_profile`을 기록한다. 검증기는 정책 route에서 요구되는 가장 강한 등급을 계산해 기록값과 비교한다.

### 권장안

대안 C를 권장한다.

- 기존 `.vada/workflow-policy.json`은 R1의 불변 레거시 경로로 유지한다. R2부터 `.vada/workflow-policies/R<n>.json`에 새 파일로 추가하며, `.vada/workflow-policy-registry.json`은 `(policy_id, revision) → path + canonical_sha256`와 새 계획 작성에 사용할 기본 ref만 관리한다. registry의 기존 리비전 항목은 append-only이며 path·hash를 바꿀 수 없다. 실행 계획은 registry나 “최신”을 참조하지 않고 항상 정확한 정책 파일을 고정한다.
- 워크플로 정책 v0.2는 등급의 순서와 요구 검사, 위험 trigger→등급 route, CI 경로별 최소 trigger, 기본 retry 정책을 소유한다. registry와 정책 자체의 변경도 `workflow_governance`로 분류한다.
- 계획 보증 trigger는 승인 작업 그래프의 계약 ref·역량·새 `risk_declarations`에서 resolver가 계산한 의미 trigger와 계획 작성자가 보수적으로 추가한 trigger의 합집합이다. 현재 전달 작업 스키마에는 `risk_declarations`가 없으므로 새 delivery-work 스키마에 근거 종류와 source ref를 함께 추가하기 전에는 이를 존재한다고 가정하지 않는다.
- 실행 계획 v0.2는 `workflow_policy_ref`를 한 번 고정하고 각 commitment에 계획 보증 `risk_triggers`와 `assurance_profile`을 봉인한다. 계획 작성자는 trigger를 추가할 수만 있고 제거할 수 없다. 아직 발생하지 않은 PR의 변경 경로는 계획에 예측해 쓰지 않는다.
- 실행 계획 검증기는 resolver가 계산한 trigger별 요구 등급 중 가장 강한 값보다 기록된 등급이 낮지 않은지 확인한다. 명시적 상향은 허용하고 하향은 거부한다.
- 런타임 검증기는 `standard`·`high_assurance`에 분리 검증 증거가 있는지, `high_assurance`에 사람 승인 근거와 필수 검사 증거가 있는지 확인한다.
- CI는 실제 diff 경로에서 제거 불가능한 변경 보증 trigger를 별도로 계산하고, 계획 보증 등급과 변경 보증 등급 중 더 강한 값을 PR의 유효 등급으로 사용한다. `derive-assurance-matrix`와 `assurance-gate` job은 항상 실행하고, 유효 `high_assurance`가 하나라도 있으면 전체 통합 검사 job을 필수로 요구한다. 기존 `contracts`, `api`, `web`, `terraform` job 결과를 `if: always()` 집계하되 스코프 밖 skip과 실패를 구분한다. 전체 통합 검사가 필요한 경우에는 기존 경로 스코프의 skip을 성공으로 보지 말고 해당 job을 실제 실행하도록 scope 출력을 상향한다.

`.vada/`, 워크플로 스키마, 실행 기록기·상태 파생기·검증기처럼 거버넌스 자체를 바꾸는 경로는 실행 계획이 없어도 경로 기반 최소 trigger가 `workflow_governance`를 부여한다. 계획이 없다는 이유로 등급을 낮추지 않으며, 이 경우에도 사람 review와 전체 통합 검사를 요구한다. 반대로 제품·계약 의미를 바꾸는 변경인데 대응 승인 작업을 찾을 수 없으면 낮은 기본값으로 진행하지 않고 “승인 작업 입력 없음”으로 실패한다.

사람 승인은 GitHub job 성공으로 대체하지 않는다. 승인 실행 계획의 `user_statement`와 보호 브랜치의 사람 review 중 프로젝트가 정한 하나 이상의 근거가 별도로 필요하다.

### 새 스키마 리비전과 단계적 마이그레이션

1. registry에 기존 `.vada/workflow-policy.json`을 R1 경로와 현재 정규 해시로 등록한다. 파일을 이동·복사·수정하지 않는다. 같은 `(policy_id, revision)`의 중복 경로와 registry 해시 불일치를 거부한다.
2. `workflow-policy-0.2.0.schema.json`에 정책 우선순위, CI check mapping, 경로 기반 최소 trigger, retry profile을 추가하고 `.vada/workflow-policies/R2.json`을 별도 사람 승인 대상으로 만든다.
3. 새 delivery-work 스키마에 source-backed `risk_declarations`를 추가하고 계약 유형·작업 역량 resolver와 CI 변경 경로 resolver의 결정표를 각각 테스트 fixture로 고정한다. 자유 문자열 trigger는 허용하지 않는다.
4. 실행 계획 v0.2에 정확한 정책 ref·trigger·파생 등급을 추가하고 교차 검증기를 만든다.
5. CI에는 처음 두 주기 동안 보고 전용 `assurance-gate`를 추가해 현행 PR이 어떤 등급으로 분류되는지 비교한다. 실행 계획이 없는 거버넌스 fixture도 반드시 `high_assurance`로 계산돼야 한다.
6. 오분류가 없으면 새 v0.2 계획에 한해 계획 기반 gate를 필수화한다. 경로 기반 최소 gate는 계획 버전과 무관하게 적용하고, v0.1 계획은 기존 분리 검증 규칙을 유지한다.
7. 런타임 v0.2 증거 검증까지 연결된 뒤 `mechanical`의 검증자 생략을 실제로 허용한다.

### 롤백과 검증 기준

- 정책·계획 교차 검증에 문제가 생기면 `mechanical` 최적화만 비활성화하고 모든 작업을 기존처럼 분리 검증하는 안전한 기본값으로 돌아간다. 이미 승인된 R2 정책과 계획은 삭제하지 않는다.
- R1 파일 변경, registry 기존 항목 삭제·변경, registry 해시 불일치, 정책 해시 불일치, 알려지지 않은 trigger, route보다 낮은 등급, 필수 CI job 누락은 실패해야 한다.
- 권한 또는 재정 원자성 fixture를 `standard`로 바꾼 음성 테스트가 반드시 실패해야 한다.
- `mechanical`은 제품·계약·보안 경계를 참조하지 않는 허용 fixture에서만 검증자 생략이 가능해야 한다.
- 실행 계획 없이 워크플로 검증기만 바꾼 fixture와 계획에서 trigger를 누락한 fixture가 모두 `high_assurance` 아래에서만 통과해야 한다.

## 3. `completion_evidence` 범위 참조 중복 제거

### 문제

작업은 `design_refs`와 `contract_refs`로 책임 범위를 정의하고, 각 완료 증거가 같은 배열을 다시 쓴다. 현재 23개 증거 중 20개가 두 배열을 상위 작업과 정확히 동일하게 복사한다. 한쪽만 바뀌면 검증기 오류가 나므로 안전성은 있지만, 대규모 ref 배열을 두 군데 동시에 편집해야 하며 리뷰 diff도 실제 의미 변경보다 커진다.

안정 `EVID-*` ID와 런타임의 `requirement_ref`, 화면 명세의 `completion_evidence_ref`는 중복 데이터가 아니라 필요한 외래 키다. 이것까지 제거하면 어느 증거가 어느 요구를 충족했는지 추적할 수 없으므로 유지한다.

### 유지해야 할 불변식

- 모든 작업 범위의 설계·계약은 하나 이상의 완료 증거로 덮여야 한다.
- 한 증거가 작업 범위 밖의 설계·계약을 증명한다고 주장할 수 없어야 한다.
- 여러 증거가 작업 범위를 나눠 검증하는 경우 그 부분집합을 정확히 표현할 수 있어야 한다.
- `EVID-*` 안정 ID와 런타임 `PROOF-*` 인스턴스의 관계는 유지해야 한다.

### 대안

#### 대안 A — 작업의 상위 범위를 제거

증거 배열의 합집합만으로 작업 범위를 정의한다. 복사는 사라지지만 “무엇을 만들 것인가”와 “어떻게 증명할 것인가”가 분리되지 않아 작업 범위를 이해하기 어려워진다.

#### 대안 B — 증거 ref를 제거하고 작업 전체를 항상 한 증거로 처리

단순하지만 브라우저 검증처럼 자동 E2E·접근성·수동 시각 검토가 서로 다른 부분집합을 담당하는 작업을 표현하지 못한다.

#### 대안 C — 작업 범위 1회 + 증거 coverage mode

작업이 범위를 소유하고 증거는 `all_work_scope` 또는 `subset`만 선언한다. 대부분은 ref 배열 없이 전체 범위를 재사용하고, 여러 증거가 나눠 맡을 때만 부분집합을 쓴다.

### 권장안

대안 C를 권장하되 필드 이름은 `completion_evidence`로 유지한다. 현재 화면 명세·OpenAPI·런타임·상태 파생기가 이 이름과 안정 `EVID-*` ID를 사용하므로, 중복 제거와 무관한 rename은 소비자 전환 범위만 늘린다. 이름 변경이 정말 필요하면 coverage 전환과 분리된 후속 메이저 스키마 제안으로 다룬다.

```json
{
  "design_refs": ["DESIGN-..."],
  "contract_refs": ["API:...@R1"],
  "completion_evidence": [
    {
      "id": "EVID-001",
      "kind": "reviewed_artifact",
      "description_ko": "...",
      "coverage": { "mode": "all_work_scope" }
    }
  ]
}
```

부분 검증은 `coverage.mode: subset`과 함께 그 증거가 담당하는 ref만 둔다. resolver가 각 요구의 유효 범위를 계산하고 전달 작업·화면 명세·OpenAPI·런타임 검증기가 모두 같은 resolver를 사용한다.

### 새 스키마 리비전과 단계적 마이그레이션

1. 현재 실제 스키마는 `delivery-work-plan-0.2.0`이다. `delivery-work-plan-0.3.0.schema.json`과 `resolveEvidenceCoverage(work, requirement)` 공용 모듈을 추가한다.
2. 기존 v0.2 reader는 현재 `completion_evidence` 배열을 그대로 읽고, v0.3 reader만 각 항목의 `coverage`를 해석한다. 저장소에 존재하지 않는 v0.1 입력을 위한 adapter는 만들지 않는다.
3. DU-001을 변환하지 않고 테스트 fixture 하나로 20개 `all_work_scope`와 3개 `subset` 동등성을 증명한다.
4. 다음 신규 작업 그래프부터 v0.3을 사용한다. 화면 명세와 런타임의 `EVID-*` 참조 형식은 바꾸지 않는다.
5. 모든 소비자가 resolver를 사용한 뒤 각 검증기에 중복 구현된 ref 비교 로직을 제거한다.

### 롤백과 검증 기준

- v0.3 작성에 문제가 생기면 v0.2 writer로 돌아가되 v0.3 reader와 승인 파일은 유지한다.
- v0.2의 ref 합집합과 v0.3 resolver 결과가 바이트 정렬 후 동일해야 한다.
- `all_work_scope`와 `subset`의 합집합이 작업 범위를 덮지 못하거나 범위 밖 ref를 포함하면 실패해야 한다.
- 안정 `EVID-*` ID를 바꾸지 않은 상태에서 기존 런타임 증거가 동일 요구를 해석해야 한다.

## 4. 재시도 한도와 중단 기계화

### 문제

[에이전트 실행 기준](agent-execution.md)은 재시도를 유한하게 정하고 같은 원인의 반복이나 입력 부족 시 사람에게 올리라고 규정한다. 그러나 실행 계획과 런타임에는 그 한도와 원인을 표현할 필드가 없다. 현재 상태 전이만으로는 첫 구현과 같은 실패의 세 번째 반복을 구분할 수 없고 기록기가 한도 초과 전이를 거부할 수도 없다.

### 유지해야 할 불변식

- 일시적 환경 실패와 제품·계약 입력 부족을 같은 방식으로 재시도하지 않는다.
- 재시도 횟수와 같은 원인 반복 횟수는 자동 증가하며 사람이 수동으로 낮출 수 없어야 한다.
- 한도는 실행 계획이나 런타임 파일 하나가 아니라 정확한 작업 ID·리비전 전체에 적용돼야 하며 새 계획을 만드는 것으로 초기화할 수 없어야 한다.
- 비밀 접근, 운영 배포, 파괴적 변경, 승인되지 않은 제품 의미는 횟수가 남아도 즉시 멈춰야 한다.
- 멈춤은 실패 은폐가 아니라 근거와 에스컬레이션 대상을 가진 명시적 결과여야 한다.

### 대안

#### 대안 A — 프롬프트·문서 규칙만 유지

구현 비용은 없지만 에이전트마다 해석이 달라지고 무한 루프를 검증할 수 없다.

#### 대안 B — 단순 `max_retries` 숫자만 추가

횟수 제한은 가능하지만 같은 원인과 다른 원인, 즉시 중단 조건, 사람 결정 후 재개를 구분하지 못한다.

#### 대안 C — 정책 참조 + 구조화된 attempt log

정책이 최대 시도·같은 원인 한도·재시도 가능 실패 분류·즉시 중단 분류를 소유하고, 런타임은 자동 번호가 붙은 시도와 원인 fingerprint를 기록한다.

### 권장안

대안 C를 권장한다.

- 워크플로 정책 v0.2에 `retry_profiles`를 둔다. 예: `max_attempts`, `same_cause_limit`, `retryable_failure_classes`, `stop_failure_classes`, `escalation_role`.
- 실행 계획 v0.2의 각 commitment는 `retry_policy_ref`만 기록하며 숫자를 복사하지 않는다. 더 엄격한 하향 override만 허용하고 완화는 새 정책 승인으로만 한다.
- 공용 attempt ledger resolver는 같은 전달 단위의 모든 계획·런타임에서 정확한 `WORK:<id>@R<n>`의 시도를 모은다. 실행 계획 snapshot은 사용한 런타임 ref와 `attempt_ledger_sha256`을 고정하고, 기록기는 다음 번호를 이 전체 원장에서 계산한다. 새 실행 계획이나 새 런타임은 카운터를 1로 되돌리지 못한다.
- 실행 런타임 v0.2에 `attempt_log`를 추가한다. 기록기는 시도 ID·번호·시각을 자동 생성하고 실패 종료 시 `failure_class`, `cause_fingerprint`, `source_ref`, `outcome`을 요구한다.
- `stopped`를 terminal 상태로 추가한다. 한도 소진, 같은 원인 반복, 즉시 중단 분류 발생 시 기록기가 다음 `in_progress`를 거부하고 `stopped`와 에스컬레이션 근거만 허용한다.
- `done`은 같은 런타임에서 다시 열지 않는다. 완료 후 발견된 결함은 새 corrective work 또는 새 작업 리비전으로 추적한다.

`cause_fingerprint`는 자유 서술문 hash가 아니라 실패 분류와 안정 오류·검사 ID를 조합해 기록기가 결정적으로 생성해야 한다. 비밀값이나 로그 원문을 포함하지 않는다. 새 작업 리비전은 승인 작업 그래프 변경이므로 자동 재시도 우회로 취급하지 않지만, 대체 리비전에 기존 시도를 승계할지는 정책 책임자의 별도 승인 없이는 결정하지 않는다.

개별 work run이 `stopped`면 전체 runtime 상태는 단순 `active`가 아니라 파생 `intervention_required`가 되어야 한다. `needs_replan`은 사람이 직접 쓰는 작업 상태가 아니라 중단 원인과 정책에서 계산하는 조회 결과로 둔다.

### 새 스키마 리비전과 단계적 마이그레이션

1. 정책 v0.2에 retry profile을 추가하되 초기 한도는 현재 실행 이력의 시도·동일 원인 반복을 보고 전용으로 측정한 뒤 제품 책임자에게 별도 승인받는다. 이 제안은 근거 없는 기본 숫자를 확정하지 않는다.
2. 정확한 작업 리비전별로 모든 기존 계획·런타임을 순회하는 attempt ledger resolver와 누락·중복 검증을 먼저 보고 전용으로 추가한다.
3. `execution-runtime-0.2.0.schema.json`과 기록기 operation `attempt_start`, `attempt_finish`, `stop`을 추가한다.
4. 기존 v0.1의 각 `in_progress` 진입은 순서가 있는 `legacy_attempt`로 읽되 실패 원인을 추정하지 않는다. 기존 R1~R4 런타임 파일은 변환하거나 소급 차단하지 않는다.
5. 보고 전용 모드에서 기존 이력을 재생해 어디에서 중단됐을지 확인한다.
6. 신규 v0.2 실행 계획부터 전체 attempt ledger 기반 기록기 차단을 강제하고 상태 파생에 `stopped`·`intervention_required`·`needs_replan`을 연결한다.

### 롤백과 검증 기준

- 자동 중단 오탐이 발생하면 강제 차단을 보고 전용으로 돌리되 attempt 기록 자체는 유지한다. 최대 횟수를 무제한으로 바꾸지 않는다.
- 같은 원인 한도 또는 전체 시도 한도를 넘는 `in_progress` operation이 거부돼야 한다.
- 같은 작업 리비전을 새 실행 계획·런타임에 다시 배정해도 누적 attempt 번호와 한도가 유지돼야 한다.
- 즉시 중단 분류 fixture는 첫 시도에서도 `stopped`가 되어야 한다.
- 서로 다른 일시 실패는 전체 한도 내에서 재시도할 수 있고, 사람의 새 승인·새 계획 없이 `stopped`에서 재개할 수 없어야 한다.
- 기록기 자동 ID·시각·번호를 입력 JSON으로 위조하면 거부해야 한다.
- attempt ledger 입력 ref나 digest를 하나 빼면 실패하고, 새 작업 리비전의 승계 정책이 미승인인 경우 임의로 이전 시도를 합치거나 버리지 않아야 한다.

## 5. 전달 단위 JSON과 Notion·슬라이스 정본 통합

### 문제

현재 `DU-001`, `FLOW-FIN-001@R2`, `SOLUTION-FIN-001@R1`, Notion의 `SL-FIN-007`·`TSK-*`, 저장소의 `SL-EVT-*`가 서로 다른 ID 체계로 공존한다. `delivery-units/DU-001`에는 “DU-001이 어느 승인 흐름과 목표 솔루션을 구현하는가”를 소유하는 독립 manifest가 없고 하위 JSON이 각자 `delivery_unit_id`, `delivery_unit_ref`, `solution_ref`를 쓴다. Notion 원장은 기존 슬라이스 리비전 일치만 검사하며 DU·WORK 투영의 드리프트는 검사하지 않는다.

이 상태에서 Notion 또는 기존 슬라이스를 또 다른 정본으로 인정하면 제품 의미와 실행 상태가 어느 쪽에서 바뀌어야 하는지 결정할 수 없다.

### 유지해야 할 불변식

- 승인 제품 흐름·솔루션의 의미와 AC는 manifest나 Notion에 복사하지 않는다.
- 담당자·기한·우선순위 같은 운영 입력과 제품·계약 의미의 필드 소유권을 구분한다.
- 외부 Notion 장애가 저장소 계약·CI 검증을 무력화하지 않아야 한다.
- 기존 `SL-*`와 Notion URL은 감사·링크 호환을 위해 별칭 이력으로 보존한다.
- 양방향 동기화는 필드별 단일 writer가 정해진 경우에만 허용한다.
- 하나의 승인 flow를 여러 전달 단위가 단계적으로 구현할 가능성을 근거 없이 금지하지 않는다. 유일성은 안정 DU ID와 레거시 별칭에 적용하고 flow:DU 카디널리티는 별도 제품 전달 결정으로 남긴다.

### 대안

#### 대안 A — Notion을 최상위 정본으로 전환

사람에게 편하지만 CI 재현성과 승인 해시가 약해지고 Notion API·권한·가용성에 빌드가 종속된다.

#### 대안 B — 현재 세 체계를 유지하고 매핑만 추가

변경 비용은 낮지만 결과·AC·상태가 중복된 채 남아 매핑 자체가 드리프트를 감출 수 있다.

#### 대안 C — 전달 단위 manifest를 안정 ID 정본으로 추가

제품 의미는 승인 흐름과 목표 솔루션에 남기고 manifest가 `DU-*` ID와 정확한 흐름·솔루션 ref만 소유한다. Notion과 기존 `SL-*`는 manifest에 대한 투영·별칭으로 명시한다.

### 권장안

대안 C를 권장한다. 신규 `delivery-unit-0.1.0` manifest의 `active` 형태는 최소 정보만 가진다.

```json
{
  "schema_version": "0.1.0",
  "delivery_unit_id": "DU-001",
  "revision": 1,
  "status": "active",
  "product_baseline": {
    "flow_ref": {
      "path": "product-specs/flows/FLOW-FIN-001/R2.json",
      "flow_id": "FLOW-FIN-001",
      "flow_revision": 2,
      "canonical_sha256": "..."
    },
    "solution_ref": {
      "path": "product-specs/solutions/SOLUTION-FIN-001/R1.json",
      "solution_id": "SOLUTION-FIN-001",
      "solution_revision": 1,
      "canonical_sha256": "..."
    }
  },
  "legacy_aliases": ["SL-FIN-007"]
}
```

- 제품 결과·AC·계약 기준선은 해당 계층이 계속 소유하고 manifest에는 복사하지 않는다.
- validator는 solution이 내부에서 참조한 flow와 manifest의 `flow_ref`가 정확히 같은 리비전·해시인지 확인한다. 하위 계약·아키텍처·작업·실행 파일은 `DU-001@R1`을 참조하고 manifest를 통해 두 승인 제품 입력을 해석한다.
- 하나의 flow에 여러 활성 DU가 존재하는 것을 자동 오류로 만들지 않는다. 같은 flow나 solution을 나누는 경우 각 DU의 전달 범위가 어디에서 승인됐는지는 별도 source ref로 요구하되, 이 문서가 1:1 또는 1:N 정책을 임의 확정하지 않는다.
- `contracts/notion.json`의 여러 책임은 장기적으로 `.vada/projections/notion.json`으로 이동한다. 각 투영은 `canonical_ref`, data source/page ID, `projected_revision`, `projected_sha256`, `sync_direction`, `field_ownership`을 가진다.
- 기존 `contracts/slices/*.json`은 곧바로 삭제하지 않는다. 승인 flow와 solution이 있는 항목은 DU 별칭 projection으로 고정하고, 제품 기준선이 없는 항목은 `definition_blocked` 후보 인벤토리로 분류한다.

`definition_blocked` 후보는 `product_baseline: null`, `candidate_source_refs`, `readiness_blockers`, `legacy_aliases`만 가질 수 있다. 승인 flow·solution을 가장하지 않으며 계약·아키텍처·작업·실행 파일의 입력으로 참조할 수 없다. 두 제품 기준선이 승인되면 사람이 새 `active` manifest 리비전을 승인하고 그때부터 하위 실행 계층을 만들 수 있다.

필드 소유권은 “현재 운영 입력”과 “승인 당시 실행 결정”을 구분한다.

- Notion은 아직 커밋되지 않은 작업의 희망 담당자·희망 기한·우선순위·메모를 작성하는 운영 입력 writer다.
- 승인 실행 계획은 현재 웨이브의 실제 executor와 선택된 일정 정책을 불변 snapshot으로 소유하고, 실행 런타임은 실제 상태·인계·증거를 소유한다. Notion은 이 두 값을 읽기 전용으로 투영한다.
- 커밋 후 담당자를 바꾸려면 Notion 값만 덮어쓰지 않는다. 미착수 작업은 새 실행 계획의 `released_commitments`와 새 commitment를 같은 승인에서 원자적으로 기록한다. 착수 작업은 기존 run을 pause한 뒤 승인된 인계 근거와 `stopped(reason: reassigned)` 종결을 기록하고 새 계획·런타임으로 재배정한다. 재시도 한도 소진으로 중단된 작업은 이 경로로 우회할 수 없다. projection은 그 전까지 `pending_reassignment` drift를 표시한다.

### 새 스키마 리비전과 단계적 마이그레이션

1. `delivery-unit-0.1.0.schema.json`과 `planning-projection-ledger-0.1.0.schema.json`을 추가한다. 기존 파일에 영향 없는 인벤토리 모드로 시작한다.
2. `DU-001 ↔ FLOW-FIN-001@R2 ↔ SOLUTION-FIN-001@R1 ↔ Notion 계획 항목 ↔ WORK:*` crosswalk를 생성하고 사람이 충돌을 검토한다.
3. Notion의 새 뷰에 안정 `DU-*`·`WORK:*` ID를 추가하되 기존 `SL-FIN-*`·`TSK-*`를 별칭으로 계속 표시한다.
4. 신규 전달 단위부터 manifest를 의무화하고 새 `contracts/slices` 작성을 금지한다.
5. 기존 이벤트 슬라이스는 대응 제품 흐름과 솔루션이 모두 승인된 것부터 `active` manifest로 옮긴다. 둘 중 하나가 없으면 `definition_blocked` 후보로만 기록하며 자동 변환으로 제품 의미를 승인하지 않는다.
6. 커밋 전 희망 담당자와 승인 plan executor, 현재 runtime actor를 서로 다른 projection 필드로 먼저 표시해 재배정 drift 규칙을 검증한다.
7. 미매핑 활성 항목이 0이고 두 동기화 주기 동안 drift가 없을 때 기존 Notion 필드와 slice writer를 읽기 전용으로 전환한다.

### 롤백과 검증 기준

- Notion 투영 문제가 생기면 projection writer만 중단하고 기존 Notion 뷰로 돌아간다. 승인 manifest와 저장소 정본은 삭제하지 않는다.
- 하나의 DU manifest가 서로 다른 제품 기준선을 동시에 가리키거나 하나의 Notion page가 서로 다른 canonical ref를 가지면 실패해야 한다. 동일 flow의 여러 DU는 보고하되 별도 승인 규칙 없이 오류로 만들지 않는다.
- 저장소 소유 필드의 projected hash가 다르면 drift로 보고하되 Notion 값을 자동으로 저장소에 역수입하지 않는다.
- 모든 하위 DU 파일의 ID와 manifest ID가 같고, flow·solution ref의 리비전·해시와 두 문서의 내부 연결이 승인본과 일치해야 한다. `definition_blocked` 후보를 하위 실행 파일이 참조하면 실패해야 한다.
- 레거시 별칭은 전역에서 유일해야 하며 삭제 대신 `retired` 이력을 남겨야 한다.
- 승인 plan executor와 Notion 희망 담당자가 다를 때는 조용히 덮어쓰지 않고 `pending_reassignment`가 파생돼야 하며, 승인된 재계획·인계 뒤에만 해소돼야 한다.

## 6. `SL-EVT-002` 상시 경고 제거

### 문제

`SL-EVT-002`는 아직 확정되지 않은 상태 전환 데이터 계약을 계획 기준선에 넣고 있다. 검증기는 `planned` 상태에서는 이를 오류 대신 경고로 허용한다. 따라서 경고는 실제 준비 장애를 표현하지만 CI는 계속 성공하고, 반복 노출로 인해 새 경고도 무시하게 되는 경고 피로가 생긴다.

### 유지해야 할 불변식

- `review` 계약을 활성 구현 기준선으로 승격하거나 경고 제거를 위해 임의 비준하지 않는다.
- 준비됨·진행 중·완료 상태는 계속 ratified 계약만 사용한다.
- 아직 제품·계약 결정이 필요한 계획 후보를 삭제하지 않고 명시적 차단 상태로 보존한다.
- CI의 조용함보다 실제 미결정 사항의 가시성을 우선한다.

### 대안

#### 대안 A — 계약을 즉시 비준

경고는 사라지지만 미결정 필드와 계산 기준을 확정한 척하게 되어 불변식을 위반한다.

#### 대안 B — warning allowlist 또는 메시지 억제

CI 출력은 깨끗해지지만 부채가 기계적으로 추적되지 않고 만료되지 않는 예외가 된다.

#### 대안 C — 후보 계약과 활성 기준선을 분리한 구조화 blocker

`planned`를 세분화해 `definition_blocked`를 표현하고, ratified 계약만 `contract_baseline`에 두며 review 계약은 `candidate_contract_refs`와 blocker에 둔다. 선언된 blocker는 경고가 아니라 파생 상태로 보인다.

### 권장안

대안 C를 권장한다. 5번의 전달 단위 manifest와 함께 해결하되, 기존 슬라이스 파일을 수정하지 않고 활성 진단에서 제외할 수 있는 명시적 retirement/supersession 원장이 필요하다.

- 신규 DU candidate에는 `lifecycle_state: definition_blocked`, `readiness_blockers`, `candidate_contract_refs`를 둔다. `DATA:event.lifecycle_transition@R1`은 승인 baseline이 아니라 blocker가 가리키는 후보 계약으로만 표현한다.
- `.vada/projections/legacy-slices.json`은 각 기존 slice의 경로·ID·리비전·정규 해시, `disposition: active | superseded | retired`, 정확한 후속 manifest/candidate ref, 전환 승인 source ref를 기록한다. 단순 ID allowlist나 경고 문자열 억제는 허용하지 않는다.
- 레거시 reader는 모든 기존 slice를 계속 스키마·참조 무결성 관점에서 역사 검증한다. 활성 진단 reader만 원장을 따라 `active` 항목의 준비 상태를 계산하고, `superseded`·`retired` 항목은 유효한 후속 ref와 승인 근거가 있을 때만 활성 경고에서 제외한다.
- 미선언 review 계약을 활성 baseline에 넣으면 오류로 처리한다. 선언된 후보 계약은 후속 candidate의 blocker로 동일하게 관찰되고 `derive-delivery-status`가 `definition_blocked`로 출력한다.
- CI는 역사 검증 오류 0개, 활성 기준선의 분류되지 않은 경고 0개를 각각 요구한다. 구조화 blocker의 존재는 성공을 가장하지 않고 별도 상태 보고에 포함한다.

### 새 스키마 리비전과 단계적 마이그레이션

1. 단기에는 경고를 숨기지 말고 `SL-EVT-002`를 현재 유일한 알려진 경고로 측정한다.
2. `delivery-unit-0.1.0`의 candidate 형태와 `legacy-slices` 원장 스키마를 추가한다. 원장에 없는 기존 slice는 안전한 기본값인 `active`로 해석한다.
3. `SL-EVT-002` 의미와 파일을 변경하지 않고 대응 DU 후보를 `definition_blocked`로 작성한다. 제품 책임자는 제품 정책이 아니라 “기존 slice를 이 후보가 대체해 추적한다”는 crosswalk만 승인한다.
4. 원장에 `SL-EVT-002`의 정확한 기존 해시, 후속 candidate ref와 승인 근거를 추가한다. 해시나 후속 ref가 다르면 전환은 무효다.
5. 새 validator를 보고 전용으로 실행해 기존 경고 1건과 새 blocker 1건이 같은 미결정 계약을 가리키는지 비교한다. 역사 검증과 활성 진단의 결과 채널을 분리한다.
6. 두 주기 동안 동등성이 확인되면 `validate-contracts` 기본 진입점을 새 이중 reader로 바꾼다. 기존 reader는 `--legacy-diagnostics`로 유지하고, 활성 진단에서 분류되지 않은 warning을 오류화한다.

### 롤백과 검증 기준

- blocker 파생이 잘못되면 기본 진입점만 레거시 validator 출력으로 돌리고 원장·candidate·승인 이력은 보존한다. warning allowlist는 추가하지 않는다.
- review 계약이 활성 baseline에 들어간 fixture는 실패하고, 같은 계약이 candidate+blocker에 있으면 `definition_blocked`로 성공해야 한다.
- 기존 slice의 바이트나 원장에 고정한 해시가 달라지거나, 후속 candidate가 없거나, 승인 source ref가 없으면 `superseded` 전환이 실패해야 한다.
- 원장 항목을 삭제하면 해당 slice가 다시 `active`로 해석돼 기존 경고가 재현돼야 하며, 역사 무결성 검사는 disposition과 무관하게 항상 실행돼야 한다.
- blocker를 제거하려면 해당 계약의 ratified 후속 리비전과 명시적 baseline 갱신이 모두 필요해야 한다.
- `pnpm validate:contracts`의 최종 목표는 역사 오류 0·활성 기준선의 분류되지 않은 경고 0이며, `derive-delivery-status`에는 해당 장애가 구조화 blocker로 계속 보여야 한다.

## 권장 구현 순서

### 단계 A — 공용 resolver와 이중 리더

- 완료 증거 coverage resolver를 먼저 추가해 중복 제거 전후 의미가 같은지 증명한다.
- 실행 계획 계보·완료 원장·활성 commitment·attempt 원장을 같은 불변 입력 ref에서 계산하는 공용 resolver를 추가한다.
- 정책 registry와 실행 계획·정책·런타임의 새 스키마는 기존 reader를 유지한 채 추가한다.
- 전달 단위 manifest, Notion projection ledger, legacy slice retirement 원장은 보고 전용 인벤토리로 시작한다.

### 단계 B — 새 웨이브 한 건으로 검증

- 실행 계획 v0.2에 현재 커밋만 기록한다.
- 정확한 작업·이전 계획·런타임 입력 ref와 완료·활성·attempt 원장 digest를 고정한다.
- 정책 ref, 경로+작업 기반 risk trigger, assurance profile, retry policy ref를 함께 고정한다.
- 실행 런타임 v0.2가 attempt와 증거를 기록하고 기존 상태 파생과 같은 완료 결과를 내는지 비교한다.

### 단계 C — projection 전환

- DU-001, 승인 flow·solution과 Notion의 실제 항목을 안정 ID로 연결한다.
- 신규 전달 단위는 manifest만 정본으로 만들고 `SL-*` 신규 작성을 중단한다.
- 레거시 이벤트 슬라이스는 승인 제품 흐름·솔루션이 준비된 순서로 옮기고, 준비되지 않은 항목은 구현 불가 candidate와 구조화 blocker로만 투영한다.

### 단계 D — 강제 게이트 전환

- assurance CI gate와 유한 재시도 차단을 필수화한다.
- 분류되지 않은 경고를 CI 실패로 전환한다.
- 구형 writer를 제거하되 v0.1 reader와 승인 역사 파일은 유지한다.

## 전체 완료 기준

- 기존 정책 R1, 승인 계획 R1~R4, 전달 작업 R1, 런타임 R1~R4와 레거시 slice가 바이트 변경 없이 계속 검증된다.
- 신규 실행 계획에는 미래 `forecast`와 과거 `satisfied` 전량 사본이 없다.
- 신규 실행 계획이 불변 작업·계획·런타임 입력만으로 재현되고, 앞선 활성 작업을 다른 계획에서 중복 배정할 수 없다.
- 정책 route보다 낮은 보증 등급, 무계획 거버넌스 우회와 작업 리비전 전체의 재시도 한도 초과가 검증기·기록기에서 거부된다.
- 작업 범위와 증거 범위가 한 정본에서 해석되며 기존 23개 증거의 유효 범위가 동일하다.
- `DU-*`, 승인 flow·solution, Notion page, 레거시 별칭의 관계가 추적되고, 동일 flow의 여러 DU를 임의 금지하지 않으면서 안정 ID·별칭 충돌과 담당자 재배정 drift가 탐지된다.
- `SL-EVT-002`의 미확정 계약은 사라지거나 숨겨지는 대신 구조화 blocker로 보이며 상시 warning은 0이 된다.
- rollback 연습에서 새 writer를 끈 뒤에도 기존 reader로 승인 역사와 현재 상태를 읽을 수 있다.

## 비목표

- 이 제안에서 기존 승인 JSON, 스키마, validator, CI 또는 Notion 데이터를 변경하지 않는다.
- `SL-EVT-002`의 제품 정책이나 상태 전환 필드를 결정하지 않는다.
- retry 횟수의 최종 숫자를 제품 책임자 승인 없이 확정하지 않는다.
- Notion을 CI 실행에 필요한 온라인 의존성으로 만들지 않는다.
