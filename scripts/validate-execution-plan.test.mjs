import assert from "node:assert/strict";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  canonicalSha256,
  validateExecutionPlan,
  validateExecutionPlanRepository,
} from "./validate-execution-plan.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function approvedWorkPlan() {
  return {
    plan_id: "WP-TEST-001",
    plan_revision: 1,
    plan_status: "approved",
    delivery_unit_ref: "FLOW-TEST-001@R1",
    objective_ko: "사용자가 결과를 확인합니다.",
    imports: [],
    work_items: [
      {
        id: "WORK:test-contract@R1",
        status: "ratified",
        primary_capability: "technical_design",
        blocked_by: [],
      },
      {
        id: "WORK:test-ui@R1",
        status: "ratified",
        primary_capability: "frontend",
        blocked_by: ["WORK:test-contract@R1"],
      },
    ],
  };
}

function source(id, type = "user_statement") {
  return {
    id,
    type,
    captured_at: "2026-08-03T22:00:00+09:00",
    locator: `test/${id}`,
    content_ko: "실행 계획 검증 근거입니다.",
  };
}

function unavailable() {
  return {
    status: "unknown",
    capacity_value: null,
    capacity_unit: null,
    available_from: null,
    available_until: null,
  };
}

function estimate(status) {
  if (status === "not_applicable") {
    return {
      status,
      low: null,
      high: null,
      unit: "not_applicable",
      basis_ko: null,
      source_refs: [],
    };
  }
  return {
    status: "unknown",
    low: null,
    high: null,
    unit: "undetermined",
    basis_ko: null,
    source_refs: [],
  };
}

function approvalQuestion() {
  return {
    id: "Q-001",
    status: "pending",
    decision_area: "approval",
    origin: "approval",
    depends_on_question_refs: [],
    activation_conditions: [],
    kind: "yes_no",
    response_design: {
      basis: "logical_partition",
      rationale_ko: "전체 실행 계획의 승인 여부를 구분합니다.",
      source_refs: ["SRC-001"],
    },
    question_ko: "이 실행 계획을 승인합니까?",
    reason_ko: "승인 뒤 런타임 실행 기록을 시작합니다.",
    target_path: "/approval",
    blocks_next_step: true,
    options: [
      { id: "YES", label_ko: "승인" },
      { id: "NO", label_ko: "수정 필요" },
    ],
    evidence: {
      work_item_refs: ["WORK:test-contract@R1", "WORK:test-ui@R1"],
      executor_refs: ["EXEC:technical", "EXEC:frontend"],
      source_refs: ["SRC-001"],
    },
    answer_source_ref: null,
    normalized_answer: null,
    dismissal_reason_ko: null,
  };
}

function validExecutionPlan(workPlan = approvedWorkPlan()) {
  return {
    schema_version: "0.1.0",
    execution_plan_id: "EP-TEST-DU-001",
    execution_plan_revision: null,
    execution_plan_status: "review_ready",
    approval_source_ref: null,
    updated_at: "2026-08-03T22:00:00+09:00",
    delivery_unit_id: "DU-001",
    work_plan_ref: {
      path: "delivery-units/DU-001/delivery-work/R1.json",
      plan_id: workPlan.plan_id,
      plan_revision: workPlan.plan_revision,
      canonical_sha256: canonicalSha256(workPlan),
    },
    objective_ko: workPlan.objective_ko,
    sources: [source("SRC-001", "approved_artifact"), source("SRC-002")],
    satisfied_prerequisites: [],
    planning_policy: {
      scope_mode: "rolling_wave",
      estimate_mode: "none",
      estimate_unit: "not_applicable",
      schedule_mode: "none",
      target_window: null,
      rationale_ko: "현재 의존성 시작점만 확정하고 후속 작업은 예측으로 둡니다.",
      source_refs: ["SRC-002"],
    },
    orchestration: {
      human_approver_ref: "EXEC:owner",
      coordinator_executor_ref: "EXEC:coordinator",
      verifier_executor_refs: ["EXEC:verifier"],
      worker_isolation: "git_worktree",
      parallelism_mode: "dependency_frontier",
      max_parallel_workers: null,
      independent_verification_required: true,
      rationale_ko: "총괄과 구현·검증을 분리합니다.",
      source_refs: ["SRC-002"],
    },
    executors: [
      {
        id: "EXEC:owner",
        kind: "human",
        display_name: "제품 책임자",
        execution_roles: ["accountable_owner"],
        capabilities: [],
        availability: unavailable(),
        source_refs: ["SRC-002"],
      },
      {
        id: "EXEC:coordinator",
        kind: "ai_agent",
        display_name: "총괄 AI 에이전트",
        execution_roles: ["coordinator"],
        capabilities: ["technical_design", "quality"],
        availability: unavailable(),
        source_refs: ["SRC-002"],
      },
      {
        id: "EXEC:technical",
        kind: "ai_agent",
        display_name: "기술 설계 작업 에이전트",
        execution_roles: ["worker"],
        capabilities: ["technical_design"],
        availability: unavailable(),
        source_refs: ["SRC-002"],
      },
      {
        id: "EXEC:frontend",
        kind: "ai_agent",
        display_name: "프론트엔드 작업 에이전트",
        execution_roles: ["worker"],
        capabilities: ["frontend"],
        availability: unavailable(),
        source_refs: ["SRC-002"],
      },
      {
        id: "EXEC:verifier",
        kind: "ai_agent",
        display_name: "독립 검증 에이전트",
        execution_roles: ["verifier"],
        capabilities: ["quality"],
        availability: unavailable(),
        source_refs: ["SRC-002"],
      },
    ],
    work_allocations: [
      {
        work_item_ref: "WORK:test-contract@R1",
        disposition: "committed",
        primary_executor_ref: "EXEC:technical",
        collaborator_refs: ["EXEC:verifier"],
        estimate: estimate("not_applicable"),
        target_window: null,
        rationale_ko: "의존성 시작점입니다.",
        source_refs: ["SRC-002"],
      },
      {
        work_item_ref: "WORK:test-ui@R1",
        disposition: "forecast",
        primary_executor_ref: null,
        collaborator_refs: [],
        estimate: estimate("unknown"),
        target_window: null,
        rationale_ko: "선행 작업 완료 후 다음 파동에서 확정합니다.",
        source_refs: ["SRC-002"],
      },
    ],
    questions: [approvalQuestion()],
  };
}

test("승인 작업 그래프의 시작점만 커밋한 rolling-wave 계획을 허용한다", async () => {
  const workPlan = approvedWorkPlan();
  assert.deepEqual(await validateExecutionPlan(validExecutionPlan(workPlan), { workPlan }), []);
});

test("고정한 작업 그래프 해시가 달라지면 거부한다", async () => {
  const workPlan = approvedWorkPlan();
  const plan = validExecutionPlan(workPlan);
  plan.work_plan_ref.canonical_sha256 = "0".repeat(64);
  const errors = await validateExecutionPlan(plan, { workPlan });
  assert.ok(errors.some((error) => error.includes("작업 그래프 해시")));
});

test("모든 확정 작업을 정확히 한 번 배정하지 않으면 거부한다", async () => {
  const workPlan = approvedWorkPlan();
  const plan = validExecutionPlan(workPlan);
  plan.work_allocations.pop();
  const errors = await validateExecutionPlan(plan, { workPlan });
  assert.ok(errors.some((error) => error.includes("배정되지 않은 작업")));
});

test("rolling-wave에서 현재 시작점이 아닌 작업을 커밋하면 거부한다", async () => {
  const workPlan = approvedWorkPlan();
  const plan = validExecutionPlan(workPlan);
  plan.work_allocations[0].disposition = "forecast";
  plan.work_allocations[0].primary_executor_ref = null;
  plan.work_allocations[0].collaborator_refs = [];
  plan.work_allocations[0].estimate = estimate("unknown");
  plan.work_allocations[1].disposition = "committed";
  plan.work_allocations[1].primary_executor_ref = "EXEC:frontend";
  plan.work_allocations[1].collaborator_refs = ["EXEC:verifier"];
  plan.work_allocations[1].estimate = estimate("not_applicable");
  const errors = await validateExecutionPlan(plan, { workPlan });
  assert.ok(errors.some((error) => error.includes("현재 의존성 시작점")));
});

test("주 실행자의 역량이 작업 주 역량과 다르면 거부한다", async () => {
  const workPlan = approvedWorkPlan();
  const plan = validExecutionPlan(workPlan);
  plan.work_allocations[0].primary_executor_ref = "EXEC:frontend";
  const errors = await validateExecutionPlan(plan, { workPlan });
  assert.ok(errors.some((error) => error.includes("주 역량")));
});

test("실행 계획에 런타임 진행 상태를 섞으면 거부한다", async () => {
  const workPlan = approvedWorkPlan();
  const plan = validExecutionPlan(workPlan);
  plan.runtime_status = "in_progress";
  const errors = await validateExecutionPlan(plan, { workPlan });
  assert.ok(errors.some((error) => error.includes("허용되지 않는 필드")));
});

test("저장소의 실제 실행 계획이 모두 유효하다", async () => {
  const result = await validateExecutionPlanRepository(repositoryRoot);
  assert.deepEqual(result.errors, []);
});
