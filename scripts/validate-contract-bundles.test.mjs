import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import test from "node:test";

import Ajv2020 from "ajv/dist/2020.js";

import {
  canonicalSha256,
  validateBaseBundleReference,
  validateContractBundleDocument,
  validateContractBundleRepository,
} from "./validate-contract-bundles.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function approvedSolution() {
  return {
    id: "SOLUTION-TEST-001",
    revision: 1,
    status: "approved",
    title: "검증용 목표 설계",
    flowRef: { id: "FLOW-TEST-001", revision: 1 },
    designElements: [
      {
        id: "DESIGN-TEST-001",
        kind: "system_responsibility",
        title: "검증할 책임",
        description: "검증 대상입니다.",
      },
    ],
  };
}

function source(id = "SRC-001", type = "document") {
  return {
    id,
    type,
    captured_at: "2026-08-03T17:00:00+09:00",
    locator: "product-specs/test.json",
    content_ko: "검증 근거",
  };
}

function contract(kind, key, specification) {
  return {
    id: `${kind}:${key}@R1`,
    kind,
    key,
    revision: 1,
    status: "proposed",
    change_class: "initial",
    supersedes: null,
    summary_ko: `${kind} 검증 계약`,
    specification,
    source_refs: ["SRC-001"],
  };
}

function reviewReadyBundle(solution = approvedSolution()) {
  const dataId = "DATA:test.payload@R1";
  const authId = "AUTH:test.execute@R1";
  const errorId = "ERROR:test.invalid@R1";
  return {
    schema_version: "0.1.0",
    bundle_id: "CB-TEST-001",
    bundle_revision: null,
    bundle_status: "review_ready",
    approval_source_ref: null,
    updated_at: "2026-08-03T17:00:00+09:00",
    solution_ref: {
      path: "product-specs/solutions/SOLUTION-TEST-001/R1.json",
      solution_id: solution.id,
      solution_revision: solution.revision,
      canonical_sha256: canonicalSha256(solution),
    },
    delivery_unit_ref: "FLOW-TEST-001@R1",
    objective_ko: "검증 가능한 결과를 만듭니다.",
    standards_profile: {
      openapi_version: "3.1.1",
      json_schema_dialect: "https://json-schema.org/draft/2020-12/schema",
      http_problem_details: "RFC9457",
    },
    sources: [source()],
    imports: [],
    contracts: [
      contract("DOMAIN", "test", {
        invariants: ["검증 결과는 한 번만 생성합니다."],
      }),
      contract("DATA", "test.payload", {
        json_schema: {
          $schema: "https://json-schema.org/draft/2020-12/schema",
          $id: "urn:vada:test-payload:r1",
          type: "object",
          additionalProperties: false,
          required: ["value"],
          properties: { value: { type: "string", minLength: 1 } },
        },
        semantic_notes_ko: ["value는 검증 값입니다."],
        schema_contract_refs: [],
      }),
      contract("AUTH", "test.execute", {
        action: "test.execute",
        resource_ko: "검증 리소스",
        default_decision: "deny",
        enforcement: "trusted_server",
        allow_any: [
          {
            all_of: [
              {
                left_fact: "actor.is_active_member",
                operator: "is_true",
                right: { literal: true },
              },
            ],
          },
        ],
      }),
      contract("ERROR", "test.invalid", {
        code: "TEST_INVALID",
        http_status: 422,
        problem_type_uri: "https://vada.example/problems/test-invalid",
        title_ko: "검증 값이 올바르지 않습니다.",
        when_ko: "검증 값이 비어 있을 때",
        disclosure_ko: "허용된 필드 오류만 반환합니다.",
        details_schema_ref: dataId,
      }),
      contract("API", "test.execute", {
        operation_id: "executeTest",
        method: "POST",
        path: "/tests",
        authorization_ref: authId,
        request: { body_contract_ref: dataId, parameters: [] },
        success: { http_status: 201, body_contract_ref: dataId },
        error_refs: [errorId],
      }),
      contract("EVENT", "test.executed", {
        event_name: "test.executed",
        payload_schema_ref: dataId,
        emission_condition_ko: "검증 결과가 확정된 뒤 발생합니다.",
        sensitivity: "internal",
      }),
      contract("QUALITY", "test.verification", {
        category: "verification",
        obligation_ko: "검증 결과를 자동 테스트로 증명합니다.",
        verification_ko: "계약 테스트가 통과합니다.",
      }),
    ],
    design_coverage: [
      {
        design_ref: "DESIGN-TEST-001",
        disposition: "contracted",
        contract_refs: [
          "DOMAIN:test@R1",
          "DATA:test.payload@R1",
          "AUTH:test.execute@R1",
          "ERROR:test.invalid@R1",
          "API:test.execute@R1",
          "EVENT:test.executed@R1",
          "QUALITY:test.verification@R1",
        ],
        rationale_ko: "시스템 책임을 도메인과 품질 계약으로 고정합니다.",
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
          rationale_ko: "승인 또는 반려만 선택합니다.",
          source_refs: ["SRC-001"],
        },
        question_ko: "이 실행 계약 묶음을 승인합니까?",
        reason_ko: "승인 뒤 구현 기준선으로 고정하기 위해 필요합니다.",
        target_path: "/approval",
        blocks_next_step: true,
        options: [
          { id: "YES", label_ko: "승인" },
          { id: "NO", label_ko: "반려" },
        ],
        evidence: {
          solution_design_refs: ["DESIGN-TEST-001"],
          source_refs: ["SRC-001"],
        },
        answer_source_ref: null,
        normalized_answer: null,
        dismissal_reason_ko: null,
      },
    ],
  };
}

function approvedBaseBundle(solution = approvedSolution()) {
  const bundle = reviewReadyBundle(solution);
  bundle.bundle_id = "CB-TEST-BASE";
  bundle.bundle_revision = 1;
  bundle.bundle_status = "approved";
  bundle.sources.push(source("SRC-002", "user_statement"));
  bundle.approval_source_ref = "SRC-002";
  bundle.contracts.forEach((item) => {
    item.status = "ratified";
  });
  const approval = bundle.questions[0];
  approval.status = "answered";
  approval.answer_source_ref = "SRC-002";
  approval.normalized_answer = { selected_option_ids: ["YES"], free_text: null };
  return bundle;
}

function reviewReadyDeltaBundle(solution = approvedSolution()) {
  const base = approvedBaseBundle(solution);
  const bundle = reviewReadyBundle(solution);
  const quality = bundle.contracts.find((item) => item.kind === "QUALITY");
  quality.id = "QUALITY:test.verification@R2";
  quality.revision = 2;
  quality.change_class = "additive";
  quality.supersedes = "QUALITY:test.verification@R1";
  quality.summary_ko = "검증 계약을 확장합니다.";
  bundle.schema_version = "0.2.0";
  bundle.bundle_id = "CB-TEST-DELTA";
  bundle.base_bundle_ref = {
    bundle_path: "contracts/bundles/CB-TEST-BASE/R1.json",
    bundle_id: base.bundle_id,
    bundle_revision: base.bundle_revision,
    canonical_sha256: canonicalSha256(base),
  };
  delete bundle.imports;
  bundle.contracts = [quality];
  bundle.design_coverage[0].contract_refs = [quality.id];
  return { base, bundle };
}

test("승인 설계를 완전히 덮는 검토 준비 계약 묶음을 허용한다", () => {
  const solution = approvedSolution();
  assert.deepEqual(validateContractBundleDocument(reviewReadyBundle(solution), solution), []);
});

test("승인 설계의 고정 해시가 다르면 거부한다", () => {
  const solution = approvedSolution();
  const bundle = reviewReadyBundle(solution);
  bundle.solution_ref.canonical_sha256 = "0".repeat(64);

  assert.match(
    validateContractBundleDocument(bundle, solution).join("\n"),
    /설계 해시|solution hash/,
  );
});

test("클라이언트 권한 판정이나 기본 허용을 거부한다", () => {
  const solution = approvedSolution();
  const bundle = reviewReadyBundle(solution);
  const authorization = bundle.contracts.find((item) => item.kind === "AUTH");
  authorization.specification.default_decision = "allow";
  authorization.specification.enforcement = "client";

  assert.match(
    validateContractBundleDocument(bundle, solution).join("\n"),
    /기본 거부|trusted_server|신뢰.*서버/,
  );
});

test("설계 요소가 계약 귀속에서 빠지면 거부한다", () => {
  const solution = approvedSolution();
  const bundle = reviewReadyBundle(solution);
  bundle.design_coverage = [];

  assert.match(
    validateContractBundleDocument(bundle, solution).join("\n"),
    /누락|uncovered/,
  );
});

test("검토 준비 상태에는 승인 질문만 하나 남아야 한다", () => {
  const solution = approvedSolution();
  const bundle = reviewReadyBundle(solution);
  bundle.questions.push({
    ...structuredClone(bundle.questions[0]),
    id: "Q-002",
    decision_area: "data",
    origin: "late_discovery",
    question_ko: "추가 데이터 결정이 필요합니까?",
    target_path: "/contracts/1/specification",
  });

  assert.match(
    validateContractBundleDocument(bundle, solution).join("\n"),
    /승인 질문.*하나|review-ready/,
  );
});

test("승인된 다른 묶음의 DATA 스키마를 정확한 리비전으로 재사용할 수 있다", () => {
  const solution = approvedSolution();
  const bundle = reviewReadyBundle(solution);
  const payload = bundle.contracts.find((item) => item.id === "DATA:test.payload@R1");
  payload.specification.json_schema = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: "urn:vada:test-payload:r1",
    $ref: "urn:vada:shared-value:r1",
  };
  payload.specification.schema_contract_refs = ["DATA:shared.value@R1"];
  const imported = contract("DATA", "shared.value", {
    json_schema: {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "urn:vada:shared-value:r1",
      type: "object",
      additionalProperties: false,
      required: ["value"],
      properties: { value: { type: "string", minLength: 1 } },
    },
    semantic_notes_ko: ["공유 검증 값입니다."],
    schema_contract_refs: [],
  });
  imported.status = "ratified";

  assert.deepEqual(
    validateContractBundleDocument(bundle, solution, {
      importedContracts: new Map([[imported.id, imported]]),
    }),
    [],
  );
});

test("0.2 계약 묶음은 승인된 기준 묶음 전체를 한 번 참조하고 변경분만 기록한다", () => {
  const solution = approvedSolution();
  const { base, bundle } = reviewReadyDeltaBundle(solution);
  const baseContracts = new Map(base.contracts.map((item) => [item.id, item]));

  assert.deepEqual(
    validateContractBundleDocument(bundle, solution, { importedContracts: baseContracts }),
    [],
  );
  assert.equal(bundle.contracts.length, 1);
  assert.equal("imports" in bundle, false);
});

test("0.2 계약 묶음의 기준 묶음 해시가 다르면 거부한다", () => {
  const { base, bundle } = reviewReadyDeltaBundle();
  bundle.base_bundle_ref.canonical_sha256 = "0".repeat(64);

  assert.match(
    validateBaseBundleReference(bundle.base_bundle_ref, base).join("\n"),
    /기준 묶음 해시/,
  );
});

test("저장소 검증은 0.2 기준 묶음을 한 번 읽어 상속 계약 전체를 해석한다", async () => {
  const root = await mkdtemp(join(tmpdir(), "vada-contract-v2-"));
  try {
    const solution = approvedSolution();
    const { base, bundle } = reviewReadyDeltaBundle(solution);
    const paths = [
      "contracts/bundles/CB-TEST-BASE",
      "contracts/bundles/CB-TEST-DELTA",
      "product-specs/solutions/SOLUTION-TEST-001",
      "product-specs/flows/FLOW-TEST-001",
    ];
    await Promise.all(paths.map((path) => mkdir(resolve(root, path), { recursive: true })));
    await Promise.all([
      writeFile(
        resolve(root, "contracts/bundles/CB-TEST-BASE/R1.json"),
        JSON.stringify(base),
      ),
      writeFile(
        resolve(root, "contracts/bundles/CB-TEST-DELTA/draft.json"),
        JSON.stringify(bundle),
      ),
      writeFile(
        resolve(root, "product-specs/solutions/SOLUTION-TEST-001/R1.json"),
        JSON.stringify(solution),
      ),
      writeFile(
        resolve(root, "product-specs/flows/FLOW-TEST-001/R1.json"),
        JSON.stringify({
          id: "FLOW-TEST-001",
          revision: 1,
          status: "approved",
          spec: { outcome: { result: bundle.objective_ko } },
        }),
      ),
    ]);

    assert.deepEqual((await validateContractBundleRepository(root)).errors, []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("저장소의 실제 실행 계약 묶음이 모두 유효하다", async () => {
  const result = await validateContractBundleRepository();
  assert.deepEqual(result.errors, []);
});

test("작성 중 초안은 불완전한 입력을 보존하지만 같은 입력을 제출할 수는 없다", async () => {
  const bundle = JSON.parse(
    await readFile(resolve(repositoryRoot, "contracts/bundles/CB-FIN-001/R1.json"), "utf8"),
  );
  const draftSchema = bundle.contracts.find(
    (item) => item.id === "DATA:purchase_request.draft_content@R1",
  )?.specification.json_schema;
  const submitSchema = bundle.contracts.find(
    (item) => item.id === "DATA:purchase_request.input@R1",
  ).specification.json_schema;
  assert.ok(draftSchema, "작성 중 초안 데이터 계약이 필요합니다.");

  const ajv = new Ajv2020({ strict: true, allErrors: true, allowUnionTypes: true });
  const validateDraft = ajv.compile(draftSchema);
  const validateSubmission = ajv.compile(submitSchema);
  const incompleteInput = { title: "", items: [] };

  assert.equal(validateDraft(incompleteInput), true);
  assert.equal(validateSubmission(incompleteInput), false);
});
