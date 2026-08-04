import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  validateScreenSpec,
  validateScreenSpecRepository,
} from "./validate-screen-specs.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const artifactPath = resolve(
  repositoryRoot,
  "delivery-units/DU-001/screen-spec/draft.json",
);

async function actualSpec() {
  return JSON.parse(await readFile(artifactPath, "utf8"));
}

test("저장소의 실제 화면 명세가 유효하다", async () => {
  const result = await validateScreenSpecRepository(repositoryRoot);
  assert.deepEqual(result.errors, []);
  assert.equal(result.files.length, 1);
});

test("고정한 전달 작업 그래프의 해시가 바뀌면 거부한다", async () => {
  const spec = await actualSpec();
  spec.baseline.delivery_work_ref.canonical_sha256 = "0".repeat(64);

  const errors = await validateScreenSpec(spec, { artifactPath });

  assert.ok(errors.some((error) => error.includes("전달 작업 그래프 해시")));
});

test("완료 증거가 요구한 설계 커버리지가 빠지면 거부한다", async () => {
  const spec = await actualSpec();
  spec.coverage.design_refs = spec.coverage.design_refs.slice(1);

  const errors = await validateScreenSpec(spec, { artifactPath });

  assert.ok(errors.some((error) => error.includes("설계 커버리지")));
});

test("상태 ID 중복을 거부한다", async () => {
  const spec = await actualSpec();
  spec.state_matrix.push(structuredClone(spec.state_matrix[0]));

  const errors = await validateScreenSpec(spec, { artifactPath });

  assert.ok(errors.some((error) => error.includes("상태 ID가 중복")));
});

test("인증이 필요한 DU-001 화면에서 401 상태가 빠지면 거부한다", async () => {
  const spec = await actualSpec();
  spec.state_matrix = spec.state_matrix.filter(
    (state) => state.id !== "STATE-DETAIL-UNAUTHENTICATED",
  );

  const errors = await validateScreenSpec(spec, { artifactPath });

  assert.ok(errors.some((error) => error.includes("STATE-DETAIL-UNAUTHENTICATED")));
});

test("공통 인증 상태는 설계 의미를 빌리지 않고 계약 참조만으로 정의할 수 있다", async () => {
  const spec = await actualSpec();
  for (const state of spec.state_matrix.filter((item) =>
    item.id.endsWith("-UNAUTHENTICATED"),
  )) {
    delete state.design_refs;
  }

  const errors = await validateScreenSpec(spec, { artifactPath });

  assert.deepEqual(errors, []);
});

test("화면 상태에는 설계 또는 계약 근거 중 하나가 반드시 필요하다", async () => {
  const spec = await actualSpec();
  spec.state_matrix[0].design_refs = [];
  delete spec.state_matrix[0].contract_refs;

  const errors = await validateScreenSpec(spec, { artifactPath });

  assert.ok(errors.some((error) => error.includes("/state_matrix/0")));
});

test("DU-001 화면 명세 후보가 승인된 상세 계약 R2를 추적한다", async () => {
  const spec = await actualSpec();
  const detailStep = spec.interaction_flow.find(
    (step) => step.design_ref === "DESIGN-INTERACTION-006",
  );

  assert.equal(spec.spec_revision, 2);
  assert.equal(spec.work_item_ref, "WORK:purchase-request-screen-spec@R2");
  assert.equal(spec.completion_evidence_ref, "EVID-024");
  assert.equal(spec.baseline.contract_bundle_ref.bundle_revision, 2);
  assert.equal(
    spec.baseline.implementation_architecture_ref.architecture_revision,
    2,
  );
  assert.equal(spec.baseline.delivery_work_ref.plan_revision, 2);
  assert.ok(
    detailStep.contract_refs.includes("DATA:purchase_request.detail_view@R1"),
  );
  assert.ok(
    detailStep.contract_refs.includes("API:purchase_request.get_detail@R2"),
  );
  assert.deepEqual(
    spec.contract_gaps.filter(
      (gap) => gap.status === "open" && gap.blocks_promotion,
    ),
    [],
  );

  const errors = await validateScreenSpec(spec, { artifactPath });
  assert.deepEqual(errors, []);
});

test("증분 묶음의 상속 계약은 허용하고 대체된 상세 R1 계약은 거부한다", async () => {
  const spec = await actualSpec();
  const detailStep = spec.interaction_flow.find(
    (step) => step.design_ref === "DESIGN-INTERACTION-006",
  );

  detailStep.contract_refs = detailStep.contract_refs.map((ref) =>
    ref === "API:purchase_request.get_detail@R2"
      ? "API:purchase_request.get_detail@R1"
      : ref,
  );

  const errors = await validateScreenSpec(spec, { artifactPath });

  assert.ok(
    errors.some((error) =>
      error.includes("활성 계약에 없는 참조 API:purchase_request.get_detail@R1"),
    ),
  );
  assert.ok(
    errors.every(
      (error) =>
        !error.includes("활성 계약에 없는 참조 API:purchase_request.list_own@R1"),
    ),
  );
});

test("승격을 막는 계약 공백에는 대응하는 열린 질문이 필요하다", async () => {
  const spec = await actualSpec();
  spec.contract_gaps[0].status = "open";
  spec.contract_gaps[0].blocks_promotion = true;
  spec.review.open_questions = [];

  const errors = await validateScreenSpec(spec, { artifactPath });

  assert.ok(errors.some((error) => error.includes("열린 질문")));
});
