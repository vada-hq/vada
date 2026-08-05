import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  canonicalSha256,
  validateDeliveryWorkPlan,
  validateDeliveryWorkPlanRepository,
} from "./validate-delivery-work-plan.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function upstream() {
  const objective = "사용자가 결과를 확인합니다.";
  const solution = {
    id: "SOLUTION-TEST-001",
    revision: 1,
    status: "approved",
    flowRef: { id: "FLOW-TEST-001", revision: 1 },
    implementationContext: { mode: "greenfield" },
    designElements: [{ id: "DESIGN-TEST-001" }],
  };
  const bundle = {
    bundle_id: "CB-TEST-001",
    bundle_revision: 1,
    bundle_status: "approved",
    delivery_unit_ref: "FLOW-TEST-001@R1",
    objective_ko: objective,
    contracts: [
      {
        id: "DATA:test.record@R1",
        status: "ratified",
        revision: 1,
        supersedes: null,
      },
    ],
  };
  const architecture = {
    architecture_id: "IAB-TEST-DU-001",
    architecture_revision: 1,
    architecture_status: "approved",
    delivery_unit_ref: bundle.delivery_unit_ref,
    objective_ko: objective,
    contract_bundle_ref: {
      path: "contracts/bundles/CB-TEST-001/R1.json",
      bundle_id: bundle.bundle_id,
      bundle_revision: bundle.bundle_revision,
      canonical_sha256: canonicalSha256(bundle),
    },
  };
  return { objective, solution, bundle, architecture };
}

function validPlan({ objective, solution, bundle, architecture }) {
  return {
    schema_version: "0.2.0",
    plan_id: "WP-TEST-001",
    plan_revision: null,
    plan_status: "review_ready",
    approval_source_ref: null,
    updated_at: "2026-08-03T20:00:00+09:00",
    solution_ref: {
      path: "product-specs/solutions/SOLUTION-TEST-001/R1.json",
      solution_id: solution.id,
      solution_revision: solution.revision,
      canonical_sha256: canonicalSha256(solution),
    },
    contract_bundle_ref: {
      path: "contracts/bundles/CB-TEST-001/R1.json",
      bundle_id: bundle.bundle_id,
      bundle_revision: bundle.bundle_revision,
      canonical_sha256: canonicalSha256(bundle),
    },
    implementation_architecture_ref: {
      path: "delivery-units/DU-001/implementation-architecture/R1.json",
      architecture_id: architecture.architecture_id,
      architecture_revision: architecture.architecture_revision,
      canonical_sha256: canonicalSha256(architecture),
    },
    delivery_unit_ref: bundle.delivery_unit_ref,
    objective_ko: objective,
    sources: [
      {
        id: "SRC-001",
        type: "approved_artifact",
        captured_at: "2026-08-03T20:00:00+09:00",
        locator: "approved upstream",
        content_ko: "승인된 기준선입니다.",
      },
    ],
    imports: [],
    baseline: {
      mode: "greenfield",
      rationale_ko: "승인 설계가 신규 구현으로 확정했습니다.",
      source_refs: ["SRC-001"],
      observations: [
        {
          id: "OBS-001",
          kind: "approved_artifact",
          locator: "SOLUTION-TEST-001@R1",
          finding_ko: "목표 기능이 구현되지 않았습니다.",
          source_refs: ["SRC-001"],
        },
      ],
    },
    gaps: [
      {
        id: "GAP-001",
        title_ko: "기능 구현 누락",
        state: "missing",
        needed_outcome_ko: "승인된 기능을 구현합니다.",
        design_refs: ["DESIGN-TEST-001"],
        contract_refs: ["DATA:test.record@R1"],
        evidence_refs: ["OBS-001"],
      },
    ],
    work_items: [
      {
        id: "WORK:test-capability@R1",
        key: "test-capability",
        revision: 1,
        status: "proposed",
        change_class: "initial",
        supersedes: null,
        title_ko: "테스트 기능 구현",
        work_type: "build",
        primary_capability: "backend",
        collaborating_capabilities: ["quality"],
        outcome_ko: "승인된 기능이 동작합니다.",
        gap_refs: ["GAP-001"],
        design_refs: ["DESIGN-TEST-001"],
        contract_refs: ["DATA:test.record@R1"],
        blocked_by: [],
        completion_evidence: [
          {
            id: "EVID-001",
            kind: "automated_test",
            description_ko: "기능 동작을 자동 검증합니다.",
            design_refs: ["DESIGN-TEST-001"],
            contract_refs: ["DATA:test.record@R1"],
          },
        ],
      },
    ],
    questions: [
      {
        id: "Q-001",
        status: "pending",
        decision_area: "approval",
        origin: "approval",
        depends_on_question_refs: [],
        activation_conditions: [],
        kind: "yes_no",
        response_design: {
          basis: "logical_partition",
          rationale_ko: "전체 작업 그래프의 승인 여부를 구분합니다.",
          source_refs: ["SRC-001"],
        },
        question_ko: "이 작업 그래프를 승인합니까?",
        reason_ko: "승인 후 실행 계획으로 넘어갑니다.",
        target_path: "/approval",
        blocks_next_step: true,
        options: [
          { id: "YES", label_ko: "승인" },
          { id: "NO", label_ko: "수정 필요" },
        ],
        evidence: { work_item_refs: ["WORK:test-capability@R1"], source_refs: ["SRC-001"] },
        answer_source_ref: null,
        normalized_answer: null,
        dismissal_reason_ko: null,
      },
    ],
  };
}

test("승인된 VADA 기준선을 완전히 덮는 검토 준비 작업 그래프를 허용한다", async () => {
  const values = upstream();
  const errors = await validateDeliveryWorkPlan(validPlan(values), values);
  assert.deepEqual(errors, []);
});

test("구현 아키텍처 해시가 달라지면 작업 그래프를 거부한다", async () => {
  const values = upstream();
  const plan = validPlan(values);
  plan.implementation_architecture_ref.canonical_sha256 = "0".repeat(64);
  const errors = await validateDeliveryWorkPlan(plan, values);
  assert.ok(errors.some((error) => error.includes("구현 아키텍처 해시")));
});

test("승인 설계나 계약이 작업 증거에서 빠지면 거부한다", async () => {
  const values = upstream();
  const plan = validPlan(values);
  plan.work_items[0].design_refs = [];
  plan.work_items[0].contract_refs = [];
  plan.work_items[0].completion_evidence[0].design_refs = [];
  plan.work_items[0].completion_evidence[0].contract_refs = [];
  const errors = await validateDeliveryWorkPlan(plan, values);
  assert.ok(errors.some((error) => error.includes("덮지 않은 설계")));
  assert.ok(errors.some((error) => error.includes("덮지 않은 계약")));
});

test("작업 선행관계 순환을 거부한다", async () => {
  const values = upstream();
  const plan = validPlan(values);
  plan.work_items[0].blocked_by = [plan.work_items[0].id];
  const errors = await validateDeliveryWorkPlan(plan, values);
  assert.ok(errors.some((error) => error.includes("자기 자신")));
  assert.ok(errors.some((error) => error.includes("순환")));
});

test("승인된 이전 작업을 가져오고 증분 계약 작업만 추가할 수 있다", async (t) => {
  const values = upstream();
  const root = await mkdtemp(resolve(tmpdir(), "vada-delivery-work-incremental-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const baseBundlePath = resolve(root, "contracts/bundles/CB-TEST-001/R1.json");
  const basePlanPath = resolve(root, "delivery-units/DU-001/delivery-work/R1.json");
  const draftPath = resolve(root, "delivery-units/DU-001/delivery-work/draft.json");
  await mkdir(resolve(root, ".vada"), { recursive: true });
  await mkdir(dirname(baseBundlePath), { recursive: true });
  await mkdir(dirname(basePlanPath), { recursive: true });
  await writeFile(resolve(root, ".vada/project.json"), "{}\n", "utf8");
  await writeFile(baseBundlePath, `${JSON.stringify(values.bundle, null, 2)}\n`, "utf8");

  const basePlan = validPlan(values);
  basePlan.plan_revision = 1;
  basePlan.plan_status = "approved";
  basePlan.approval_source_ref = "SRC-002";
  basePlan.sources.push({
    id: "SRC-002",
    type: "user_statement",
    captured_at: "2026-08-03T20:01:00+09:00",
    locator: "test/base-approval",
    content_ko: "기준 작업을 승인했습니다.",
  });
  basePlan.work_items[0].status = "ratified";
  basePlan.questions[0].status = "answered";
  basePlan.questions[0].answer_source_ref = "SRC-002";
  basePlan.questions[0].normalized_answer = {
    selected_option_ids: ["YES"],
    free_text: null,
  };
  await writeFile(basePlanPath, `${JSON.stringify(basePlan, null, 2)}\n`, "utf8");

  const deltaContract = {
    id: "DATA:test.view@R1",
    status: "ratified",
    revision: 1,
    supersedes: null,
  };
  const bundle = {
    ...values.bundle,
    schema_version: "0.2.0",
    bundle_revision: 2,
    base_bundle_ref: {
      bundle_path: "contracts/bundles/CB-TEST-001/R1.json",
      bundle_id: values.bundle.bundle_id,
      bundle_revision: values.bundle.bundle_revision,
      canonical_sha256: canonicalSha256(values.bundle),
    },
    contracts: [deltaContract],
  };
  const architecture = {
    ...values.architecture,
    architecture_revision: 2,
    contract_bundle_ref: {
      path: "contracts/bundles/CB-TEST-001/R2.json",
      bundle_id: bundle.bundle_id,
      bundle_revision: bundle.bundle_revision,
      canonical_sha256: canonicalSha256(bundle),
    },
  };
  const plan = validPlan({ ...values, bundle, architecture });
  plan.contract_bundle_ref.path = "contracts/bundles/CB-TEST-001/R2.json";
  plan.implementation_architecture_ref.path =
    "delivery-units/DU-001/implementation-architecture/R2.json";
  plan.imports = [
    {
      plan_path: "delivery-units/DU-001/delivery-work/R1.json",
      plan_id: basePlan.plan_id,
      plan_revision: basePlan.plan_revision,
      canonical_sha256: canonicalSha256(basePlan),
      work_item_ids: [basePlan.work_items[0].id],
    },
  ];
  plan.gaps = [
    {
      id: "GAP-002",
      title_ko: "추가 표시 계약 구현 누락",
      state: "missing",
      needed_outcome_ko: "추가 표시 계약을 구현합니다.",
      design_refs: [],
      contract_refs: [deltaContract.id],
      evidence_refs: ["OBS-001"],
    },
  ];
  plan.work_items = [
    {
      id: "WORK:test-view@R1",
      key: "test-view",
      revision: 1,
      status: "proposed",
      change_class: "initial",
      supersedes: null,
      title_ko: "표시 계약 구현",
      work_type: "build",
      primary_capability: "backend",
      collaborating_capabilities: ["quality"],
      outcome_ko: "추가 표시 계약이 동작합니다.",
      gap_refs: ["GAP-002"],
      design_refs: [],
      contract_refs: [deltaContract.id],
      blocked_by: [basePlan.work_items[0].id],
      completion_evidence: [
        {
          id: "EVID-002",
          kind: "automated_test",
          description_ko: "추가 표시 계약을 자동 검증합니다.",
          design_refs: [],
          contract_refs: [deltaContract.id],
        },
      ],
    },
  ];
  plan.questions[0].evidence.work_item_refs = [
    basePlan.work_items[0].id,
    plan.work_items[0].id,
  ];

  const errors = await validateDeliveryWorkPlan(plan, {
    solution: values.solution,
    bundle,
    architecture,
    artifactPath: draftPath,
    effectiveContracts: new Map([
      ...values.bundle.contracts.map((contract) => [contract.id, contract]),
      [deltaContract.id, deltaContract],
    ]),
  });
  assert.deepEqual(errors, []);
});

test("후속 작업 리비전이 바로 이전 작업을 가리키지 않으면 거부한다", async () => {
  const values = upstream();
  const plan = validPlan(values);
  plan.work_items[0].id = "WORK:test-capability@R2";
  plan.work_items[0].revision = 2;
  plan.work_items[0].change_class = "additive";
  plan.work_items[0].supersedes = "WORK:test-capability@R1";
  plan.questions[0].evidence.work_item_refs = [plan.work_items[0].id];

  const errors = await validateDeliveryWorkPlan(plan, values);
  assert.ok(errors.some((error) => error.includes("바로 이전 작업 리비전")));
});

test("저장소의 실제 전달 작업 그래프가 모두 유효하다", async () => {
  const result = await validateDeliveryWorkPlanRepository(repositoryRoot);
  assert.deepEqual(result.errors, []);
});
