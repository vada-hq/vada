import assert from "node:assert/strict";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  canonicalSha256,
  validateExecutionRuntime,
  validateExecutionRuntimeRepository,
} from "./validate-execution-runtime.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function workPlan() {
  return {
    plan_id: "WP-TEST-001",
    plan_revision: 1,
    plan_status: "approved",
    work_items: [
      {
        id: "WORK:test-root@R1",
        status: "ratified",
        blocked_by: [],
        completion_evidence: [{ id: "EVID-001", kind: "automated_test" }],
      },
      {
        id: "WORK:test-child@R1",
        status: "ratified",
        blocked_by: ["WORK:test-root@R1"],
        completion_evidence: [{ id: "EVID-002", kind: "reviewed_artifact" }],
      },
    ],
  };
}

function executionPlan(plan = workPlan()) {
  return {
    execution_plan_id: "EP-TEST-001",
    execution_plan_revision: 1,
    execution_plan_status: "approved",
    delivery_unit_id: "DU-001",
    work_plan_ref: {
      path: "delivery-units/DU-001/delivery-work/R1.json",
      plan_id: plan.plan_id,
      plan_revision: plan.plan_revision,
      canonical_sha256: canonicalSha256(plan),
    },
    executors: [
      { id: "EXEC:worker", execution_roles: ["worker"] },
      { id: "EXEC:verifier", execution_roles: ["verifier"] },
      { id: "EXEC:coordinator", execution_roles: ["coordinator"] },
    ],
    satisfied_prerequisites: [],
    work_allocations: [
      {
        work_item_ref: "WORK:test-root@R1",
        disposition: "committed",
        primary_executor_ref: "EXEC:worker",
      },
      {
        work_item_ref: "WORK:test-child@R1",
        disposition: "forecast",
        primary_executor_ref: null,
      },
    ],
  };
}

function source(id = "SRC-RUN-001") {
  return {
    id,
    type: "user_statement",
    captured_at: "2026-08-03T22:00:00+09:00",
    locator: `test/${id}`,
    content_ko: "실행 기록 테스트 근거입니다.",
  };
}

function initialTransition(id, workRef, executorRef = "EXEC:worker") {
  return {
    id,
    from: null,
    to: "not_started",
    occurred_at: "2026-08-03T22:00:00+09:00",
    actor_ref: "EXEC:coordinator",
    source_ref: "SRC-RUN-001",
    note_ko: `${workRef} 실행 기록을 초기화했습니다.`,
  };
}

function workRun(workRef, transitionId = "TR-001", executorRef = "EXEC:worker") {
  return {
    work_item_ref: workRef,
    executor_ref: executorRef,
    status: "not_started",
    started_at: null,
    completed_at: null,
    transition_log: [initialTransition(transitionId, workRef, executorRef)],
    blockers: [],
    evidence_instances: [],
  };
}

function validRuntime(plan = workPlan(), execution = executionPlan(plan)) {
  return {
    schema_version: "0.1.0",
    runtime_id: "RUN-DU-001-EP-R1",
    runtime_revision: 1,
    runtime_status: "active",
    updated_at: "2026-08-03T22:00:00+09:00",
    delivery_unit_id: "DU-001",
    execution_plan_ref: {
      path: "delivery-units/DU-001/execution-plan/R1.json",
      execution_plan_id: execution.execution_plan_id,
      execution_plan_revision: execution.execution_plan_revision,
      canonical_sha256: canonicalSha256(execution),
    },
    sources: [source()],
    work_runs: [workRun("WORK:test-root@R1")],
  };
}

test("승인 계획의 committed 작업만 not_started로 초기화할 수 있다", async () => {
  const work = workPlan();
  const execution = executionPlan(work);
  const result = await validateExecutionRuntime(validRuntime(work, execution), {
    executionPlan: execution,
    workPlan: work,
  });
  assert.deepEqual(result.errors, []);
});

test("고정한 실행계획 해시가 달라지면 거부한다", async () => {
  const work = workPlan();
  const execution = executionPlan(work);
  const runtime = validRuntime(work, execution);
  runtime.execution_plan_ref.canonical_sha256 = "0".repeat(64);
  const result = await validateExecutionRuntime(runtime, { executionPlan: execution, workPlan: work });
  assert.match(result.errors.join("\n"), /해시/);
});

test("committed 작업을 정확히 한 번 추적하지 않으면 거부한다", async () => {
  const work = workPlan();
  const execution = executionPlan(work);
  const runtime = validRuntime(work, execution);
  runtime.work_runs = [];
  const result = await validateExecutionRuntime(runtime, { executionPlan: execution, workPlan: work });
  assert.match(result.errors.join("\n"), /전수/);
});

test("허용되지 않은 상태 전이를 거부한다", async () => {
  const work = workPlan();
  const execution = executionPlan(work);
  const runtime = validRuntime(work, execution);
  runtime.work_runs[0].status = "done";
  runtime.work_runs[0].transition_log.push({
    id: "TR-002",
    from: "not_started",
    to: "done",
    occurred_at: "2026-08-03T22:01:00+09:00",
    actor_ref: "EXEC:worker",
    source_ref: "SRC-RUN-001",
    note_ko: "잘못된 직접 완료 전이입니다.",
  });
  runtime.work_runs[0].completed_at = "2026-08-03T22:01:00+09:00";
  const result = await validateExecutionRuntime(runtime, { executionPlan: execution, workPlan: work });
  assert.match(result.errors.join("\n"), /전이/);
});

test("완료 작업은 모든 요구 증거의 독립 검증을 필요로 한다", async () => {
  const work = workPlan();
  const execution = executionPlan(work);
  const runtime = validRuntime(work, execution);
  const run = runtime.work_runs[0];
  run.status = "done";
  run.started_at = "2026-08-03T22:01:00+09:00";
  run.completed_at = "2026-08-03T22:03:00+09:00";
  run.transition_log.push(
    {
      id: "TR-002",
      from: "not_started",
      to: "in_progress",
      occurred_at: "2026-08-03T22:01:00+09:00",
      actor_ref: "EXEC:worker",
      source_ref: "SRC-RUN-001",
      note_ko: "작업을 시작했습니다.",
    },
    {
      id: "TR-003",
      from: "in_progress",
      to: "review",
      occurred_at: "2026-08-03T22:02:00+09:00",
      actor_ref: "EXEC:worker",
      source_ref: "SRC-RUN-001",
      note_ko: "검토를 요청했습니다.",
    },
    {
      id: "TR-004",
      from: "review",
      to: "done",
      occurred_at: "2026-08-03T22:03:00+09:00",
      actor_ref: "EXEC:verifier",
      source_ref: "SRC-RUN-001",
      note_ko: "증거 없이 완료했습니다.",
    },
  );
  const result = await validateExecutionRuntime(runtime, { executionPlan: execution, workPlan: work });
  assert.match(result.errors.join("\n"), /완료 증거/);
});

test("완료되지 않은 선행 작업에 막힌 작업은 시작할 수 없다", async () => {
  const work = workPlan();
  const execution = executionPlan(work);
  execution.work_allocations[1] = {
    work_item_ref: "WORK:test-child@R1",
    disposition: "committed",
    primary_executor_ref: "EXEC:worker",
  };
  const runtime = validRuntime(work, execution);
  runtime.execution_plan_ref.canonical_sha256 = canonicalSha256(execution);
  runtime.updated_at = "2026-08-03T22:01:00+09:00";
  runtime.work_runs.push(workRun("WORK:test-child@R1", "TR-101"));
  const child = runtime.work_runs[1];
  child.status = "in_progress";
  child.started_at = "2026-08-03T22:01:00+09:00";
  child.transition_log.push({
    id: "TR-102",
    from: "not_started",
    to: "in_progress",
    occurred_at: "2026-08-03T22:01:00+09:00",
    actor_ref: "EXEC:worker",
    source_ref: "SRC-RUN-001",
    note_ko: "선행 작업보다 먼저 시작했습니다.",
  });
  const result = await validateExecutionRuntime(runtime, { executionPlan: execution, workPlan: work });
  assert.match(result.errors.join("\n"), /선행 작업/);
});

test("사람 실행자의 작업은 실제 인계 확인 근거 없이는 착수할 수 없다", async () => {
  const work = workPlan();
  const execution = executionPlan(work);
  execution.executors.push({
    id: "EXEC:human-worker",
    kind: "human",
    execution_roles: ["worker"],
  });
  execution.work_allocations[0].primary_executor_ref = "EXEC:human-worker";

  const runtime = validRuntime(work, execution);
  runtime.execution_plan_ref.canonical_sha256 = canonicalSha256(execution);
  runtime.updated_at = "2026-08-03T22:01:00+09:00";
  const run = runtime.work_runs[0];
  run.executor_ref = "EXEC:human-worker";
  run.status = "in_progress";
  run.started_at = "2026-08-03T22:01:00+09:00";
  run.transition_log.push({
    id: "TR-002",
    from: "not_started",
    to: "in_progress",
    occurred_at: "2026-08-03T22:01:00+09:00",
    actor_ref: "EXEC:coordinator",
    source_ref: "SRC-RUN-001",
    note_ko: "담당자의 응답 없이 사람 작업을 시작 처리했습니다.",
  });

  const rejected = await validateExecutionRuntime(runtime, { executionPlan: execution, workPlan: work });
  assert.match(rejected.errors.join("\n"), /사람 실행자.*인계 확인/);

  runtime.sources[0].type = "handoff_acknowledgement";
  const accepted = await validateExecutionRuntime(runtime, { executionPlan: execution, workPlan: work });
  assert.doesNotMatch(accepted.errors.join("\n"), /사람 실행자.*인계 확인/);
});

test("저장소의 실제 실행 런타임이 모두 유효하다", async () => {
  const result = await validateExecutionRuntimeRepository(repositoryRoot);
  assert.deepEqual(result.errors, []);
});
