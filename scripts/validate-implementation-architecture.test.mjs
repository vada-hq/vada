import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  canonicalSha256,
  validateArchitecture,
  validateArchitectureRepository,
} from "./validate-implementation-architecture.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function approvedContract() {
  return {
    bundle_id: "CB-TEST-001",
    bundle_revision: 1,
    bundle_status: "approved",
    delivery_unit_ref: "FLOW-TEST-001@R1",
    objective_ko: "사용자가 결과를 끝까지 확인합니다.",
  };
}

function architecture(contract) {
  return {
    schema_version: "0.1.0",
    architecture_id: "IAB-TEST-DU-001",
    architecture_revision: null,
    architecture_status: "review_ready",
    approval_source_ref: null,
    updated_at: "2026-08-03T18:00:00+09:00",
    delivery_unit_ref: contract.delivery_unit_ref,
    objective_ko: contract.objective_ko,
    contract_bundle_ref: {
      path: "contracts/bundles/CB-TEST-001/R1.json",
      bundle_id: contract.bundle_id,
      bundle_revision: contract.bundle_revision,
      canonical_sha256: canonicalSha256(contract),
    },
    decision_scope: {
      mode: "production",
      binding: "binding",
      applies_to_ko: ["FLOW-TEST-001 구현"],
      excludes_ko: ["후속 흐름"],
      production_stack_status: "approved",
    },
    sources: [
      {
        id: "SRC-001",
        type: "approved_artifact",
        captured_at: "2026-08-03T18:00:00+09:00",
        locator: "contracts/bundles/CB-TEST-001/R1.json",
        content_ko: "승인된 실행 계약입니다.",
      },
      {
        id: "SRC-002",
        type: "user_statement",
        captured_at: "2026-08-03T18:00:00+09:00",
        locator: "notion://approved-adr",
        content_ko: "제품 기술 기준선으로 선택한 기록입니다.",
      },
    ],
    decisions: [
      {
        id: "ADR-001",
        revision: 1,
        status: "proposed",
        supersedes: null,
        title_ko: "구현 런타임",
        category: "runtime",
        scope: "production",
        context_ko: "승인 계약을 구현할 런타임이 필요합니다.",
        options: [
          {
            id: "CURRENT_STACK",
            label_ko: "현재 승인 스택",
            selection: { runtime: "current" },
            tradeoffs_ko: ["기존 제품 기준과 일치합니다."],
            source_refs: ["SRC-002"],
          },
          {
            id: "ALTERNATIVE_STACK",
            label_ko: "비교 대안",
            selection: { runtime: "alternative" },
            tradeoffs_ko: ["별도 전환 비용이 필요합니다."],
            source_refs: ["SRC-002"],
          },
        ],
        selected_option_id: "CURRENT_STACK",
        decision_ko: "승인된 현재 스택을 적용합니다.",
        consequences_ko: ["후속 작업은 이 런타임을 기준으로 도출합니다."],
        reversibility: "moderate",
        blast_radius: "product",
        source_refs: ["SRC-001", "SRC-002"],
        approval_source_ref: null,
      },
    ],
    questions: [
      {
        id: "Q-001",
        status: "answered",
        decision_area: "technology",
        origin: "initial_plan",
        depends_on_question_refs: [],
        activation_conditions: [],
        kind: "single_choice",
        response_design: {
          basis: "source_backed_options",
          rationale_ko: "승인 ADR의 선택과 비교 대안을 투영합니다.",
          source_refs: ["SRC-002"],
        },
        question_ko: "어떤 런타임을 적용합니까?",
        reason_ko: "작업 기준선을 고정해야 합니다.",
        target_path: "/decisions/0/selected_option_id",
        blocks_next_step: true,
        options: [
          { id: "CURRENT_STACK", label_ko: "현재 승인 스택" },
          { id: "ALTERNATIVE_STACK", label_ko: "비교 대안" },
        ],
        evidence: { decision_refs: ["ADR-001"], source_refs: ["SRC-002"] },
        answer_source_ref: "SRC-002",
        normalized_answer: { selected_option_ids: ["CURRENT_STACK"], free_text: null },
        dismissal_reason_ko: null,
      },
      {
        id: "Q-002",
        status: "pending",
        decision_area: "approval",
        origin: "approval",
        depends_on_question_refs: ["Q-001"],
        activation_conditions: [],
        kind: "yes_no",
        response_design: {
          basis: "logical_partition",
          rationale_ko: "전체 기준선의 승인 여부를 구분합니다.",
          source_refs: ["SRC-001", "SRC-002"],
        },
        question_ko: "이 구현 아키텍처 기준선을 승인합니까?",
        reason_ko: "작업 도출 전에 전체 적용 범위를 승인해야 합니다.",
        target_path: "/approval",
        blocks_next_step: true,
        options: [
          { id: "YES", label_ko: "승인" },
          { id: "NO", label_ko: "수정 필요" },
        ],
        evidence: { decision_refs: ["ADR-001"], source_refs: ["SRC-001", "SRC-002"] },
        answer_source_ref: null,
        normalized_answer: null,
        dismissal_reason_ko: null,
      },
    ],
  };
}

function incrementalArchitecture(contract, baseArchitecture) {
  return {
    schema_version: "0.2.0",
    architecture_id: baseArchitecture.architecture_id,
    architecture_revision: null,
    architecture_status: "review_ready",
    approval_source_ref: null,
    updated_at: "2026-08-04T23:30:00+09:00",
    delivery_unit_ref: contract.delivery_unit_ref,
    objective_ko: contract.objective_ko,
    contract_bundle_ref: {
      path: "contracts/bundles/CB-TEST-001/R2.json",
      bundle_id: contract.bundle_id,
      bundle_revision: contract.bundle_revision,
      canonical_sha256: canonicalSha256(contract),
    },
    base_architecture_ref: {
      path: "delivery-units/DU-001/implementation-architecture/R1.json",
      architecture_id: baseArchitecture.architecture_id,
      architecture_revision: baseArchitecture.architecture_revision,
      canonical_sha256: canonicalSha256(baseArchitecture),
    },
    decision_scope: baseArchitecture.decision_scope,
    sources: [
      {
        id: "SRC-001",
        type: "approved_artifact",
        captured_at: "2026-08-04T23:30:00+09:00",
        locator: "contracts/bundles/CB-TEST-001/R2.json",
        content_ko: "새로 승인된 실행 계약입니다.",
      },
      {
        id: "SRC-002",
        type: "approved_artifact",
        captured_at: "2026-08-04T23:30:00+09:00",
        locator: "delivery-units/DU-001/implementation-architecture/R1.json",
        content_ko: "기존에 승인된 구현 아키텍처입니다.",
      },
    ],
    decisions: [],
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
          rationale_ko: "기존 결정을 새 계약에도 적용할지 승인 또는 수정 요청으로 구분합니다.",
          source_refs: ["SRC-001", "SRC-002"],
        },
        question_ko: "기존 구현 결정을 새 계약의 아키텍처 기준선으로 계속 적용합니까?",
        reason_ko: "기술 결정은 바꾸지 않고 새 계약 참조만 고정합니다.",
        target_path: "/approval",
        blocks_next_step: true,
        options: [
          { id: "YES", label_ko: "승인" },
          { id: "NO", label_ko: "수정 필요" },
        ],
        evidence: {
          decision_refs: baseArchitecture.decisions.map((decision) => decision.id),
          source_refs: ["SRC-001", "SRC-002"],
        },
        answer_source_ref: null,
        normalized_answer: null,
        dismissal_reason_ko: null,
      },
    ],
  };
}

function approvedArchitecture(contract) {
  const artifact = architecture(contract);
  artifact.architecture_revision = 1;
  artifact.architecture_status = "approved";
  artifact.approval_source_ref = "SRC-002";
  artifact.decisions[0].status = "accepted";
  artifact.decisions[0].approval_source_ref = "SRC-002";
  artifact.questions[1].status = "answered";
  artifact.questions[1].answer_source_ref = "SRC-002";
  artifact.questions[1].normalized_answer = {
    selected_option_ids: ["YES"],
    free_text: null,
  };
  return artifact;
}

async function withIncrementalFixture(run) {
  const root = await mkdtemp(resolve(tmpdir(), "vada-architecture-incremental-"));
  try {
    await writeJson(resolve(root, ".vada/project.json"), { projectId: "test" });
    const baseContract = approvedContract();
    const baseArchitecture = approvedArchitecture(baseContract);
    const nextContract = { ...baseContract, bundle_revision: 2 };
    await writeJson(resolve(root, "contracts/bundles/CB-TEST-001/R2.json"), nextContract);
    await writeJson(
      resolve(root, "delivery-units/DU-001/implementation-architecture/R1.json"),
      baseArchitecture,
    );
    const artifactPath = resolve(root, "delivery-units/DU-001/implementation-architecture/draft.json");
    const artifact = incrementalArchitecture(nextContract, baseArchitecture);
    await run({ artifact, artifactPath, baseArchitecture });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("VADA의 FLOW 리비전을 전달 단위로 사용하는 검토 준비 아키텍처를 허용한다", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "vada-architecture-"));
  try {
    await writeJson(resolve(root, ".vada/project.json"), { projectId: "test" });
    const contract = approvedContract();
    const contractPath = resolve(root, "contracts/bundles/CB-TEST-001/R1.json");
    const artifactPath = resolve(root, "delivery-units/DU-001/implementation-architecture/draft.json");
    await writeJson(contractPath, contract);
    const errors = await validateArchitecture(architecture(contract), { artifactPath });
    assert.deepEqual(errors, []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("고정한 실행 계약 해시가 바뀌면 거부한다", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "vada-architecture-"));
  try {
    await writeJson(resolve(root, ".vada/project.json"), { projectId: "test" });
    const contract = approvedContract();
    const contractPath = resolve(root, "contracts/bundles/CB-TEST-001/R1.json");
    const artifactPath = resolve(root, "delivery-units/DU-001/implementation-architecture/draft.json");
    await writeJson(contractPath, { ...contract, objective_ko: "몰래 바뀐 목표" });
    const errors = await validateArchitecture(architecture(contract), { artifactPath });
    assert.ok(errors.some((error) => error.includes("계약 묶음 해시")));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("0.2 아키텍처는 승인된 기준선을 한 번 참조하고 변경된 결정만 기록한다", async () => {
  await withIncrementalFixture(async ({ artifact, artifactPath }) => {
    const errors = await validateArchitecture(artifact, { artifactPath });
    assert.deepEqual(errors, []);
  });
});

test("0.2 아키텍처의 기준 아키텍처 해시가 다르면 거부한다", async () => {
  await withIncrementalFixture(async ({ artifact, artifactPath }) => {
    artifact.base_architecture_ref.canonical_sha256 = "0".repeat(64);
    const errors = await validateArchitecture(artifact, { artifactPath });
    assert.ok(errors.some((error) => error.includes("기준 아키텍처 해시")));
  });
});

test("0.2 아키텍처가 기존 결정을 같은 리비전으로 다시 쓰면 거부한다", async () => {
  await withIncrementalFixture(async ({ artifact, artifactPath, baseArchitecture }) => {
    artifact.decisions = [
      {
        ...baseArchitecture.decisions[0],
        status: "proposed",
        approval_source_ref: null,
      },
    ];

    const errors = await validateArchitecture(artifact, { artifactPath });
    assert.ok(errors.some((error) => error.includes("리비전을 1 높이고")));
  });
});

test("검토 준비 상태에는 전체 승인 질문만 대기할 수 있다", async () => {
  const contract = approvedContract();
  const artifact = architecture(contract);
  artifact.questions[0].status = "pending";
  artifact.questions[0].answer_source_ref = null;
  artifact.questions[0].normalized_answer = null;
  const errors = await validateArchitecture(artifact);
  assert.ok(errors.some((error) => error.includes("전체 승인 질문만")));
});

test("저장소의 실제 구현 아키텍처가 모두 유효하다", async () => {
  const result = await validateArchitectureRepository(repositoryRoot);
  assert.deepEqual(result.errors, []);
});
