import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  canonicalSha256,
  validateScreenSpec,
  validateScreenSpecRepository,
} from "./validate-screen-specs.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const artifactPath = resolve(
  repositoryRoot,
  "delivery-units/DU-001/screen-spec/review-ready-R2.json",
);
const historicalDraftPath = resolve(
  repositoryRoot,
  "delivery-units/DU-001/screen-spec/draft.json",
);

async function actualSpec() {
  return JSON.parse(await readFile(artifactPath, "utf8"));
}

test("저장소의 실제 화면 명세가 유효하다", async () => {
  const result = await validateScreenSpecRepository(repositoryRoot);
  assert.deepEqual(result.errors, []);
  assert.equal(result.files.length, 2);
});

test("과거 R1 거부 증거의 QUESTION-001 앵커를 보존한다", async () => {
  const spec = JSON.parse(await readFile(historicalDraftPath, "utf8"));

  assert.equal(spec.spec_revision, 1);
  assert.equal(spec.spec_status, "defining");
  assert.equal(spec.work_item_ref, "WORK:purchase-request-screen-spec@R1");
  assert.equal(
    canonicalSha256(spec),
    "4d64dbd0abf34ec246f731c35475dc75c8f99babc873e993e47c84e1c7a1ace2",
  );
  assert.deepEqual(
    spec.review.open_questions.find((question) => question.id === "QUESTION-001"),
    {
      id: "QUESTION-001",
      status: "open",
      kind: "contract_gap",
      gap_ref: "CONTRACT-GAP-001",
      owner_capability: "technical_design",
      question_ko:
        "AC-07의 요청자·행사 표시명을 상세 재조회에서 어떤 서버 계약으로 제공할 것인가요?",
      reason_ko:
        "현재 요청 상세 응답은 두 값을 ID로만 제공하므로 새로고침 뒤 표시명을 신뢰 가능하게 복원할 수 없습니다.",
      blocks_promotion: true,
    },
  );
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

test("R2 상세의 401 계약 참조가 바뀌면 거부한다", async () => {
  const spec = await actualSpec();
  const unauthenticated = spec.state_matrix.find(
    (state) => state.id === "STATE-DETAIL-UNAUTHENTICATED",
  );
  unauthenticated.contract_refs = ["ERROR:http.resource_not_found@R1"];

  const errors = await validateScreenSpec(spec, { artifactPath });

  assert.ok(errors.some((error) => error.includes("ERROR:http.unauthenticated@R1")));
});

test("R2 상세의 display.eventName과 display.requesterName 표시가 빠지면 거부한다", async () => {
  const spec = await actualSpec();
  const summary = spec.surfaces
    .find((surface) => surface.id === "SURFACE-PURCHASE-REQUEST-DETAIL")
    .regions.find((region) => region.id === "DETAIL-SUMMARY");
  summary.content_ko = "저장된 구매 요청 요약을 표시합니다.";

  const errors = await validateScreenSpec(spec, { artifactPath });

  assert.ok(
    errors.some((error) =>
      error.includes("display.eventName과 display.requesterName"),
    ),
  );
});

test("R2 상세의 로딩 상태가 빠지면 거부한다", async () => {
  const spec = await actualSpec();
  spec.state_matrix = spec.state_matrix.filter(
    (state) => state.id !== "STATE-DETAIL-LOADING-READY",
  );

  const errors = await validateScreenSpec(spec, { artifactPath });

  assert.ok(errors.some((error) => error.includes("상세 로딩 상태")));
});

test("R2 상세의 404와 503 계약 상태가 각각 빠지면 거부한다", async () => {
  for (const omittedRef of [
    "ERROR:http.resource_not_found@R1",
    "ERROR:purchase_request.persistence_unavailable@R1",
  ]) {
    const spec = await actualSpec();
    const failed = spec.state_matrix.find(
      (state) => state.id === "STATE-DETAIL-FAILED",
    );
    failed.contract_refs = [
      "ERROR:http.resource_not_found@R1",
      "ERROR:purchase_request.persistence_unavailable@R1",
    ].filter((ref) => ref !== omittedRef);

    const errors = await validateScreenSpec(spec, { artifactPath });

    assert.ok(errors.some((error) => error.includes(omittedRef)));
  }
});

test("R2 상세의 새로고침 재조회 요구가 빠지면 거부한다", async () => {
  const spec = await actualSpec();
  const loading = spec.state_matrix.find(
    (state) => state.id === "STATE-DETAIL-LOADING-READY",
  );
  loading.trigger_ko = "목록에서 상세를 열 때";
  loading.interaction_ko = "상세 GET을 실행하며 목록에 복귀할 수 있습니다.";

  const errors = await validateScreenSpec(spec, { artifactPath });

  assert.ok(errors.some((error) => error.includes("새로고침 재조회")));
});

test("R2 상세의 키보드와 접근 가능한 상태 피드백 요구가 빠지면 거부한다", async () => {
  const spec = await actualSpec();
  spec.accessibility_contract.requirements_ko =
    spec.accessibility_contract.requirements_ko.filter(
      (requirement) =>
        !requirement.includes("목록·상세 이동과 재시도") &&
        !requirement.includes("저장·삭제·제출의 진행·성공"),
    );

  const errors = await validateScreenSpec(spec, { artifactPath });

  assert.ok(errors.some((error) => error.includes("키보드·접근성")));
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
