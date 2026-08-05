import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import Ajv2020 from "ajv/dist/2020.js";

import { resolveEffectiveContracts } from "./validate-contract-bundles.mjs";

const defaultRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const schemaPath = resolve(
  defaultRoot,
  "delivery-units/schemas/screen-spec.schema.json",
);
const schema = JSON.parse(await readFile(schemaPath, "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: true });
ajv.addFormat("date-time", {
  type: "string",
  validate: (value) => !Number.isNaN(Date.parse(value)),
});
const validateSchema = ajv.compile(schema);

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function canonicalSha256(value) {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function formatSchemaError(error) {
  const location = error.instancePath || "/";
  if (error.keyword === "additionalProperties") {
    return `${location}: 허용되지 않는 필드 ${error.params.additionalProperty}`;
  }
  if (error.keyword === "required") {
    return `${location}: 필수 필드 ${error.params.missingProperty}가 없습니다.`;
  }
  return `${location}: ${error.message}`;
}

function duplicates(values) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts].filter(([, count]) => count > 1).map(([value]) => value);
}

function sameSet(actual, expected) {
  return (
    actual.length === expected.length &&
    actual.every((value) => expected.includes(value))
  );
}

async function findProjectRoot(artifactPath) {
  let current = resolve(dirname(artifactPath));
  while (true) {
    try {
      await readFile(resolve(current, ".vada/project.json"), "utf8");
      return current;
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
    const parent = dirname(current);
    if (parent === current) {
      throw new Error(".vada/project.json이 있는 프로젝트 루트를 찾을 수 없습니다.");
    }
    current = parent;
  }
}

async function loadProjectJson(root, rawPath, label) {
  if (typeof rawPath !== "string" || !rawPath || isAbsolute(rawPath)) {
    throw new Error(`${label} 경로는 프로젝트 상대 경로여야 합니다.`);
  }
  const segments = rawPath.split(/[\\/]+/);
  if (segments.includes("..")) {
    throw new Error(`${label} 경로에 상위 이동을 사용할 수 없습니다.`);
  }
  const path = resolve(root, rawPath);
  const rel = relative(root, path);
  if (rel === ".." || rel.startsWith(`..${sep}`)) {
    throw new Error(`${label} 경로가 프로젝트 밖을 가리킵니다.`);
  }
  return { path, value: JSON.parse(await readFile(path, "utf8")) };
}

function validatePinnedReference(reference, target, fields, label, errors) {
  for (const [referenceField, targetField] of fields) {
    if (reference?.[referenceField] !== target?.[targetField]) {
      errors.push(`${label} ${referenceField}가 승인본과 다릅니다.`);
    }
  }
  if (reference?.canonical_sha256 !== canonicalSha256(target)) {
    errors.push(`${label} 해시가 승인본과 다릅니다.`);
  }
}

function activeContractIds(contracts) {
  const ratified = contracts.filter(
    (contract) => contract?.status === "ratified",
  );
  const superseded = new Set(
    ratified.map((contract) => contract.supersedes).filter(Boolean),
  );
  return new Set(
    ratified
      .map((contract) => contract.id)
      .filter((id) => !superseded.has(id)),
  );
}

function validateUniqueIds(spec, errors) {
  const groups = [
    ["화면", spec.surfaces?.map((surface) => surface.id) ?? []],
    [
      "영역",
      spec.surfaces?.flatMap((surface) =>
        (surface.regions ?? []).map((region) => region.id),
      ) ?? [],
    ],
    ["상태", spec.state_matrix?.map((state) => state.id) ?? []],
    [
      "와이어프레임 비교",
      spec.wireframe_comparison?.map((comparison) => comparison.id) ?? [],
    ],
    ["계약 공백", spec.contract_gaps?.map((gap) => gap.id) ?? []],
    [
      "검토 질문",
      spec.review?.open_questions?.map((question) => question.id) ?? [],
    ],
  ];
  for (const [label, ids] of groups) {
    for (const duplicate of duplicates(ids)) {
      errors.push(`${label} ID가 중복됐습니다: ${duplicate}`);
    }
  }
}

function validateReferences(spec, solution, contractIds, errors) {
  const designIds = new Set(
    (solution.designElements ?? []).map((element) => element.id),
  );
  const surfaceIds = new Set((spec.surfaces ?? []).map((surface) => surface.id));

  const included = spec.scope?.included_surface_refs ?? [];
  if (!sameSet(included, [...surfaceIds])) {
    errors.push("범위의 화면 참조와 실제 화면 목록이 정확히 일치하지 않습니다.");
  }

  for (const [index, step] of (spec.interaction_flow ?? []).entries()) {
    if (!surfaceIds.has(step.surface_ref)) {
      errors.push(`/interaction_flow/${index}: 존재하지 않는 화면 ${step.surface_ref}`);
    }
    if (!designIds.has(step.design_ref)) {
      errors.push(`/interaction_flow/${index}: 존재하지 않는 설계 ${step.design_ref}`);
    }
    for (const ref of step.contract_refs ?? []) {
      if (!contractIds.has(ref)) {
        errors.push(`/interaction_flow/${index}: 활성 계약에 없는 참조 ${ref}`);
      }
    }
  }

  const orders = (spec.interaction_flow ?? []).map((step) => step.order);
  for (const duplicate of duplicates(orders)) {
    errors.push(`상호작용 순서가 중복됐습니다: ${duplicate}`);
  }
  const expectedOrders = Array.from({ length: orders.length }, (_, index) => index + 1);
  if (!sameSet(orders, expectedOrders)) {
    errors.push("상호작용 순서는 1부터 빠짐없이 이어져야 합니다.");
  }

  for (const [index, state] of (spec.state_matrix ?? []).entries()) {
    if (!surfaceIds.has(state.surface_ref)) {
      errors.push(`/state_matrix/${index}: 존재하지 않는 화면 ${state.surface_ref}`);
    }
    for (const ref of state.design_refs ?? []) {
      if (!designIds.has(ref)) {
        errors.push(`/state_matrix/${index}: 존재하지 않는 설계 ${ref}`);
      }
    }
    for (const ref of state.contract_refs ?? []) {
      if (!contractIds.has(ref)) {
        errors.push(`/state_matrix/${index}: 활성 계약에 없는 참조 ${ref}`);
      }
    }
  }

  const accessibilityRef = spec.accessibility_contract?.contract_ref;
  if (accessibilityRef && !contractIds.has(accessibilityRef)) {
    errors.push(`접근성 계약이 활성 계약에 없습니다: ${accessibilityRef}`);
  }

  for (const [index, comparison] of (
    spec.wireframe_comparison ?? []
  ).entries()) {
    for (const ref of comparison.approved_refs ?? []) {
      if (ref.startsWith("DESIGN-") && !designIds.has(ref)) {
        errors.push(`/wireframe_comparison/${index}: 존재하지 않는 설계 ${ref}`);
      } else if (!ref.startsWith("DESIGN-") && !contractIds.has(ref)) {
        errors.push(`/wireframe_comparison/${index}: 활성 계약에 없는 참조 ${ref}`);
      }
    }
  }

  for (const [index, gap] of (spec.contract_gaps ?? []).entries()) {
    if (!surfaceIds.has(gap.affected_surface_ref)) {
      errors.push(`/contract_gaps/${index}: 존재하지 않는 화면 ${gap.affected_surface_ref}`);
    }
    for (const ref of gap.current_contract_refs ?? []) {
      if (!contractIds.has(ref)) {
        errors.push(`/contract_gaps/${index}: 활성 계약에 없는 참조 ${ref}`);
      }
    }
  }
}

function validateWorkEvidence(spec, workPlan, errors) {
  const work = (workPlan.work_items ?? []).find(
    (item) => item.id === spec.work_item_ref,
  );
  if (!work || work.status !== "ratified") {
    errors.push(`확정된 화면 명세 작업을 찾을 수 없습니다: ${spec.work_item_ref}`);
    return;
  }
  const evidence = (work.completion_evidence ?? []).find(
    (item) => item.id === spec.completion_evidence_ref,
  );
  if (!evidence) {
    errors.push(
      `화면 명세 작업의 완료 증거를 찾을 수 없습니다: ${spec.completion_evidence_ref}`,
    );
    return;
  }
  if (!sameSet(spec.coverage?.design_refs ?? [], evidence.design_refs ?? [])) {
    errors.push("화면 명세의 설계 커버리지가 완료 증거 요구사항과 다릅니다.");
  }
  if (!sameSet(spec.coverage?.contract_refs ?? [], evidence.contract_refs ?? [])) {
    errors.push("화면 명세의 계약 커버리지가 완료 증거 요구사항과 다릅니다.");
  }
  const comparisonIds = (spec.wireframe_comparison ?? []).map(
    (comparison) => comparison.id,
  );
  if (!sameSet(spec.coverage?.comparison_entry_refs ?? [], comparisonIds)) {
    errors.push("와이어프레임 비교 커버리지가 실제 비교 항목과 다릅니다.");
  }
}

function validateReview(spec, errors) {
  const gaps = new Map((spec.contract_gaps ?? []).map((gap) => [gap.id, gap]));
  const questions = spec.review?.open_questions ?? [];
  for (const [index, question] of questions.entries()) {
    if (question.gap_ref && !gaps.has(question.gap_ref)) {
      errors.push(`/review/open_questions/${index}: 존재하지 않는 계약 공백 ${question.gap_ref}`);
    }
  }

  const blockingGaps = (spec.contract_gaps ?? []).filter(
    (gap) => gap.status === "open" && gap.blocks_promotion,
  );
  for (const gap of blockingGaps) {
    const matchingQuestion = questions.find(
      (question) =>
        question.gap_ref === gap.id &&
        question.status === "open" &&
        question.blocks_promotion,
    );
    if (!matchingQuestion) {
      errors.push(`승격을 막는 계약 공백 ${gap.id}에는 대응하는 열린 질문이 필요합니다.`);
    }
  }

  const blockingQuestions = questions.filter(
    (question) => question.status === "open" && question.blocks_promotion,
  );
  if (["review_ready", "approved"].includes(spec.spec_status)) {
    if (blockingGaps.length || blockingQuestions.length) {
      errors.push("검토 준비 또는 승인 명세에는 미해결 차단 항목을 둘 수 없습니다.");
    }
  }
  if (spec.spec_status === "approved") {
    const incomplete = (spec.review?.required_reviews ?? []).filter(
      (review) => review.status !== "passed",
    );
    if (incomplete.length || spec.review?.review_status !== "approved") {
      errors.push("승인 명세에는 모든 필수 검토 통과와 승인 검토 상태가 필요합니다.");
    }
  }
}

function validateDu001StateCoverage(spec, errors) {
  if (spec.spec_id !== "SCREEN-SPEC-DU-001-PURCHASE-REQUEST") return;
  const stateIds = new Set((spec.state_matrix ?? []).map((state) => state.id));
  const required = [
    "STATE-EDITOR-UNAUTHENTICATED",
    "STATE-OWN-LIST-UNAUTHENTICATED",
    "STATE-DETAIL-UNAUTHENTICATED",
  ];
  for (const id of required) {
    if (!stateIds.has(id)) {
      errors.push(`인증이 필요한 DU-001 화면 상태가 빠졌습니다: ${id}`);
    }
  }
}

function validateDu001R2DetailCoverage(spec, errors) {
  if (spec.work_item_ref !== "WORK:purchase-request-screen-spec@R2") return;

  const detailSurface = (spec.surfaces ?? []).find(
    (surface) => surface.id === "SURFACE-PURCHASE-REQUEST-DETAIL",
  );
  const summary = (detailSurface?.regions ?? []).find(
    (region) => region.id === "DETAIL-SUMMARY",
  );
  if (
    !summary?.content_ko?.includes("display.eventName") ||
    !summary?.content_ko?.includes("display.requesterName")
  ) {
    errors.push(
      "R2 상세 요약에는 display.eventName과 display.requesterName 표시가 필요합니다.",
    );
  }

  const detailStates = new Map(
    (spec.state_matrix ?? [])
      .filter(
        (state) =>
          state.surface_ref === "SURFACE-PURCHASE-REQUEST-DETAIL",
      )
      .map((state) => [state.id, state]),
  );
  const loading = detailStates.get("STATE-DETAIL-LOADING-READY");
  if (!loading || !loading.visible_result_ko.includes("로딩")) {
    errors.push("R2 상세 로딩 상태가 필요합니다.");
  } else {
    const reloadDescription = `${loading.trigger_ko} ${loading.interaction_ko}`;
    if (!reloadDescription.includes("새로고침")) {
      errors.push("R2 상세 새로고침 재조회 요구가 필요합니다.");
    }
  }

  const unauthenticated = detailStates.get("STATE-DETAIL-UNAUTHENTICATED");
  if (
    !unauthenticated?.contract_refs?.includes(
      "ERROR:http.unauthenticated@R1",
    )
  ) {
    errors.push(
      "R2 상세 401 상태에 계약 참조가 필요합니다: ERROR:http.unauthenticated@R1",
    );
  }

  const failed = detailStates.get("STATE-DETAIL-FAILED");
  for (const ref of [
    "ERROR:http.resource_not_found@R1",
    "ERROR:purchase_request.persistence_unavailable@R1",
  ]) {
    if (!failed?.contract_refs?.includes(ref)) {
      errors.push(`R2 상세 오류 상태에 계약 참조가 필요합니다: ${ref}`);
    }
  }

  const hasKeyboardDetailRecovery =
    spec.accessibility_contract?.requirements_ko?.some(
      (requirement) =>
        requirement.includes("목록·상세 이동과 재시도") &&
        requirement.includes("키보드"),
    );
  const hasAccessibleLoadingFeedback =
    loading?.accessibility_ko?.includes("status");
  if (!hasKeyboardDetailRecovery || !hasAccessibleLoadingFeedback) {
    errors.push(
      "R2 상세 키보드·접근성 요구에는 키보드 재시도와 status 로딩 피드백이 필요합니다.",
    );
  }
}

async function validateWireframeLocators(spec, root, errors) {
  const expectedPath = spec.baseline?.wireframe_ref?.path;
  if (!expectedPath) return;
  let wireframe;
  try {
    const path = resolve(root, expectedPath);
    const rel = relative(root, path);
    if (
      isAbsolute(expectedPath) ||
      expectedPath.split(/[\\/]+/).includes("..") ||
      rel === ".." ||
      rel.startsWith(`..${sep}`)
    ) {
      throw new Error("와이어프레임 경로가 프로젝트 밖을 가리킵니다.");
    }
    wireframe = (await readFile(path, "utf8")).split(/\r?\n/);
  } catch (error) {
    errors.push(`와이어프레임 기준 파일을 읽을 수 없습니다: ${error.message}`);
    return;
  }

  for (const [index, comparison] of (
    spec.wireframe_comparison ?? []
  ).entries()) {
    const match = /^(.*):([0-9]+(?:,[0-9]+)*)$/.exec(
      comparison.wireframe_locator ?? "",
    );
    if (!match) {
      errors.push(`/wireframe_comparison/${index}: 경로:행 형식이 아닙니다.`);
      continue;
    }
    const [, path, rawLines] = match;
    if (path !== expectedPath) {
      errors.push(`/wireframe_comparison/${index}: 기준 와이어프레임 경로와 다릅니다.`);
    }
    for (const line of rawLines.split(",").map(Number)) {
      if (line < 1 || line > wireframe.length) {
        errors.push(`/wireframe_comparison/${index}: 존재하지 않는 행 ${line}`);
      }
    }
  }
}

export async function validateScreenSpec(
  spec,
  { artifactPath, root: suppliedRoot } = {},
) {
  const errors = [];
  if (!validateSchema(spec)) {
    errors.push(...validateSchema.errors.map(formatSchemaError));
    return errors;
  }
  if (!artifactPath && !suppliedRoot) {
    return ["고정 기준선과 와이어프레임을 검증하려면 파일 경로가 필요합니다."];
  }

  let root;
  try {
    root = suppliedRoot ?? (await findProjectRoot(artifactPath));
    const [solution, bundle, architecture, workPlan] = await Promise.all([
      loadProjectJson(root, spec.baseline.solution_ref.path, "목표 동작 설계"),
      loadProjectJson(root, spec.baseline.contract_bundle_ref.path, "실행 계약 묶음"),
      loadProjectJson(
        root,
        spec.baseline.implementation_architecture_ref.path,
        "구현 아키텍처",
      ),
      loadProjectJson(root, spec.baseline.delivery_work_ref.path, "전달 작업 그래프"),
    ]);

    validatePinnedReference(
      spec.baseline.solution_ref,
      solution.value,
      [
        ["solution_id", "id"],
        ["solution_revision", "revision"],
      ],
      "목표 동작 설계",
      errors,
    );
    validatePinnedReference(
      spec.baseline.contract_bundle_ref,
      bundle.value,
      [
        ["bundle_id", "bundle_id"],
        ["bundle_revision", "bundle_revision"],
      ],
      "실행 계약 묶음",
      errors,
    );
    validatePinnedReference(
      spec.baseline.implementation_architecture_ref,
      architecture.value,
      [
        ["architecture_id", "architecture_id"],
        ["architecture_revision", "architecture_revision"],
      ],
      "구현 아키텍처",
      errors,
    );
    validatePinnedReference(
      spec.baseline.delivery_work_ref,
      workPlan.value,
      [
        ["plan_id", "plan_id"],
        ["plan_revision", "plan_revision"],
      ],
      "전달 작업 그래프",
      errors,
    );

    const solutionDeliveryUnit = solution.value?.flowRef
      ? `${solution.value.flowRef.id}@R${solution.value.flowRef.revision}`
      : null;
    if (
      spec.delivery_unit_ref !== solutionDeliveryUnit ||
      spec.delivery_unit_ref !== bundle.value.delivery_unit_ref ||
      spec.delivery_unit_ref !== architecture.value.delivery_unit_ref ||
      spec.delivery_unit_ref !== workPlan.value.delivery_unit_ref
    ) {
      errors.push("전달 단위가 고정한 상위 산출물과 다릅니다.");
    }

    const effectiveContracts = await resolveEffectiveContracts(
      root,
      bundle.value,
      { bundlePath: bundle.path },
    );
    errors.push(
      ...effectiveContracts.errors.map((error) => `실행 계약 묶음 상속: ${error}`),
    );
    const contractIds = activeContractIds([
      ...effectiveContracts.contracts.values(),
    ]);

    validateUniqueIds(spec, errors);
    validateReferences(spec, solution.value, contractIds, errors);
    validateWorkEvidence(spec, workPlan.value, errors);
    validateReview(spec, errors);
    validateDu001StateCoverage(spec, errors);
    validateDu001R2DetailCoverage(spec, errors);
    await validateWireframeLocators(spec, root, errors);
  } catch (error) {
    errors.push(error.message);
  }
  return errors;
}

export async function validateScreenSpecRepository(root = defaultRoot) {
  const deliveryUnitsRoot = resolve(root, "delivery-units");
  const files = [];
  const errors = [];
  for (const entry of await readdir(deliveryUnitsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const directory = resolve(deliveryUnitsRoot, entry.name, "screen-spec");
    try {
      for (const file of await readdir(directory, { withFileTypes: true })) {
        if (file.isFile() && file.name.endsWith(".json")) {
          files.push(resolve(directory, file.name));
        }
      }
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }

  for (const file of files.sort()) {
    try {
      const spec = JSON.parse(await readFile(file, "utf8"));
      const fileErrors = await validateScreenSpec(spec, {
        artifactPath: file,
        root,
      });
      errors.push(
        ...fileErrors.map((error) => `${relative(root, file)}: ${error}`),
      );
    } catch (error) {
      errors.push(`${relative(root, file)}: ${error.message}`);
    }
  }
  return { files, errors };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await validateScreenSpecRepository(defaultRoot);
  if (result.errors.length) {
    for (const error of result.errors) console.error(`- ${error}`);
    process.exitCode = 1;
  } else {
    console.log(`화면 명세 ${result.files.length}개 검증 완료`);
  }
}
