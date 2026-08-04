import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import Ajv2020 from "ajv/dist/2020.js";

import { resolveEffectiveContracts } from "./validate-contract-bundles.mjs";

const defaultRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const schemaPath = resolve(defaultRoot, "delivery-units/schemas/delivery-work-plan.schema.json");
const schema = JSON.parse(await readFile(schemaPath, "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true });
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

function hasCycle(edges) {
  const visiting = new Set();
  const visited = new Set();
  function visit(node) {
    if (visiting.has(node)) return true;
    if (visited.has(node)) return false;
    visiting.add(node);
    for (const dependency of edges.get(node) ?? []) {
      if (visit(dependency)) return true;
    }
    visiting.delete(node);
    visited.add(node);
    return false;
  }
  return [...edges.keys()].some(visit);
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
    if (parent === current) throw new Error(".vada/project.json이 있는 프로젝트 루트를 찾을 수 없습니다.");
    current = parent;
  }
}

async function loadProjectJson(root, rawPath, label) {
  if (typeof rawPath !== "string" || !rawPath || isAbsolute(rawPath)) {
    throw new Error(`${label} 경로는 프로젝트 상대 경로여야 합니다.`);
  }
  const segments = rawPath.split(/[\\/]+/);
  if (segments.includes("..")) throw new Error(`${label} 경로에 상위 이동을 사용할 수 없습니다.`);
  const path = resolve(root, rawPath);
  const rel = relative(root, path);
  if (rel === ".." || rel.startsWith(`..${sep}`)) throw new Error(`${label} 경로가 프로젝트 밖을 가리킵니다.`);
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
  const ratified = [...contracts.values()].filter((item) => item?.status === "ratified");
  const superseded = new Set(ratified.map((item) => item.supersedes).filter(Boolean));
  return new Set(ratified.map((item) => item.id).filter((id) => !superseded.has(id)));
}

async function importedWork(plan, artifactPath, errors) {
  const byId = new Map();
  if (!(plan.imports?.length > 0)) return byId;
  if (!artifactPath) {
    errors.push("외부 작업을 가져온 계획은 파일 경로 검증이 필요합니다.");
    return byId;
  }
  const root = await findProjectRoot(artifactPath);
  for (const [index, item] of plan.imports.entries()) {
    const location = `/imports/${index}`;
    try {
      const { value } = await loadProjectJson(root, item.plan_path, "가져온 작업 계획");
      if (value.plan_status !== "approved" || !Number.isInteger(value.plan_revision)) {
        errors.push(`${location}: 승인된 작업 계획만 가져올 수 있습니다.`);
      }
      if (value.plan_id !== item.plan_id || value.plan_revision !== item.plan_revision) {
        errors.push(`${location}: 가져온 계획 ID 또는 리비전이 다릅니다.`);
      }
      if (canonicalSha256(value) !== item.canonical_sha256) {
        errors.push(`${location}: 가져온 계획 해시가 다릅니다.`);
      }
      const sourceItems = new Map((value.work_items ?? []).map((work) => [work.id, work]));
      for (const workId of item.work_item_ids) {
        const work = sourceItems.get(workId);
        if (!work || work.status !== "ratified") {
          errors.push(`${location}: 확정되지 않은 작업을 가져올 수 없습니다: ${workId}`);
        } else {
          byId.set(workId, work);
        }
      }
    } catch (error) {
      errors.push(`${location}: ${error.message}`);
    }
  }
  return byId;
}

function validateQuestions(plan, sourceIds, workIds, errors) {
  const questions = plan.questions ?? [];
  const byId = new Map(questions.map((question) => [question.id, question]));
  for (const duplicate of duplicates(questions.map((question) => question.id))) {
    errors.push(`질문 ID가 중복됐습니다: ${duplicate}`);
  }
  const edges = new Map();
  for (const [index, question] of questions.entries()) {
    const location = `/questions/${index}`;
    edges.set(question.id, new Set(question.depends_on_question_refs ?? []));
    for (const ref of question.depends_on_question_refs ?? []) {
      if (!byId.has(ref)) errors.push(`${location}: 존재하지 않는 선행 질문 ${ref}`);
    }
    for (const condition of question.activation_conditions ?? []) {
      if (!byId.has(condition.question_ref)) errors.push(`${location}: 존재하지 않는 활성화 질문 ${condition.question_ref}`);
    }
    for (const ref of [
      ...(question.response_design?.source_refs ?? []),
      ...(question.evidence?.source_refs ?? []),
      ...(question.answer_source_ref ? [question.answer_source_ref] : []),
    ]) {
      if (!sourceIds.has(ref)) errors.push(`${location}: 존재하지 않는 근거 ${ref}`);
    }
    for (const ref of question.evidence?.work_item_refs ?? []) {
      if (!workIds.has(ref)) errors.push(`${location}: 존재하지 않는 작업 ${ref}`);
    }
    if (question.status === "pending" && (question.answer_source_ref !== null || question.normalized_answer !== null)) {
      errors.push(`${location}: 대기 질문에는 답변을 기록할 수 없습니다.`);
    }
    if (question.status === "answered") {
      if (!question.answer_source_ref || !question.normalized_answer) errors.push(`${location}: 답변 근거와 정규화 답변이 필요합니다.`);
      const optionIds = new Set((question.options ?? []).map((option) => option.id));
      for (const selected of question.normalized_answer?.selected_option_ids ?? []) {
        if (!optionIds.has(selected)) errors.push(`${location}: 존재하지 않는 선택지 ${selected}`);
      }
    }
  }
  if (hasCycle(edges)) errors.push("질문 선행관계에 순환이 있습니다.");

  const pending = questions.filter((question) => question.status === "pending");
  const blocking = questions.filter(
    (question) => ["pending", "deferred"].includes(question.status) && question.blocks_next_step && question.target_path !== "/approval",
  );
  if (["review_ready", "approved"].includes(plan.plan_status) && blocking.length) {
    errors.push(`미해결 차단 질문이 있습니다: ${blocking.map((question) => question.id).join(", ")}`);
  }
  if (plan.plan_status === "review_ready") {
    if (pending.length !== 1 || pending[0].target_path !== "/approval") {
      errors.push("검토 준비 계획에는 전체 승인 질문만 하나 대기해야 합니다.");
    }
  }
  if (plan.plan_status === "approved") {
    if (pending.length) errors.push("승인 계획에는 대기 질문을 남길 수 없습니다.");
    const approval = questions.filter(
      (question) =>
        question.status === "answered" &&
        question.target_path === "/approval" &&
        question.answer_source_ref === plan.approval_source_ref &&
        JSON.stringify(question.normalized_answer?.selected_option_ids) === JSON.stringify(["YES"]),
    );
    if (approval.length !== 1) errors.push("승인 계획에는 명시적 전체 승인 YES가 하나 필요합니다.");
  }
}

export async function validateDeliveryWorkPlan(
  plan,
  {
    solution,
    bundle,
    architecture,
    artifactPath = null,
    effectiveContracts: suppliedEffectiveContracts = null,
  } = {},
) {
  const errors = [];
  if (!validateSchema(plan)) errors.push(...(validateSchema.errors ?? []).map(formatSchemaError));

  if (solution?.status !== "approved" || !Number.isInteger(solution?.revision)) {
    errors.push("승인된 목표 동작 설계가 필요합니다.");
  }
  if (bundle?.bundle_status !== "approved" || !Number.isInteger(bundle?.bundle_revision)) {
    errors.push("승인된 실행 계약 묶음이 필요합니다.");
  }
  if (architecture?.architecture_status !== "approved" || !Number.isInteger(architecture?.architecture_revision)) {
    errors.push("승인된 구현 아키텍처가 필요합니다.");
  }

  validatePinnedReference(
    plan.solution_ref,
    solution,
    [["solution_id", "id"], ["solution_revision", "revision"]],
    "목표 동작 설계",
    errors,
  );
  validatePinnedReference(
    plan.contract_bundle_ref,
    bundle,
    [["bundle_id", "bundle_id"], ["bundle_revision", "bundle_revision"]],
    "실행 계약 묶음",
    errors,
  );
  validatePinnedReference(
    plan.implementation_architecture_ref,
    architecture,
    [["architecture_id", "architecture_id"], ["architecture_revision", "architecture_revision"]],
    "구현 아키텍처",
    errors,
  );

  const solutionDeliveryUnit = solution?.flowRef ? `${solution.flowRef.id}@R${solution.flowRef.revision}` : null;
  if (
    plan.delivery_unit_ref !== solutionDeliveryUnit ||
    plan.delivery_unit_ref !== bundle?.delivery_unit_ref ||
    plan.delivery_unit_ref !== architecture?.delivery_unit_ref
  ) {
    errors.push("전달 단위가 승인된 상위 산출물과 다릅니다.");
  }
  if (plan.objective_ko !== bundle?.objective_ko || plan.objective_ko !== architecture?.objective_ko) {
    errors.push("목적이 승인된 계약·구현 아키텍처와 정확히 일치하지 않습니다.");
  }
  if (plan.baseline?.mode !== solution?.implementationContext?.mode) {
    errors.push("구현 기준 모드가 승인 설계와 다릅니다.");
  }
  if (["review_ready", "approved"].includes(plan.plan_status) && plan.baseline?.mode === "undetermined") {
    errors.push("검토 준비 작업 그래프에는 확정된 구현 기준 모드가 필요합니다.");
  }
  const architectureBundle = architecture?.contract_bundle_ref;
  for (const field of ["bundle_id", "bundle_revision", "canonical_sha256"]) {
    if (architectureBundle?.[field] !== plan.contract_bundle_ref?.[field]) {
      errors.push("구현 아키텍처의 계약 기준선이 작업 그래프와 다릅니다.");
      break;
    }
  }

  const sources = plan.sources ?? [];
  const sourceIds = new Set(sources.map((source) => source.id));
  for (const duplicate of duplicates(sources.map((source) => source.id))) {
    errors.push(`근거 ID가 중복됐습니다: ${duplicate}`);
  }
  for (const ref of plan.baseline?.source_refs ?? []) {
    if (!sourceIds.has(ref)) errors.push(`/baseline: 존재하지 않는 근거 ${ref}`);
  }
  const observations = plan.baseline?.observations ?? [];
  const observationIds = new Set(observations.map((observation) => observation.id));
  for (const duplicate of duplicates(observations.map((observation) => observation.id))) {
    errors.push(`관찰 ID가 중복됐습니다: ${duplicate}`);
  }
  for (const [index, observation] of observations.entries()) {
    for (const ref of observation.source_refs ?? []) {
      if (!sourceIds.has(ref)) errors.push(`/baseline/observations/${index}: 존재하지 않는 근거 ${ref}`);
    }
  }

  const designIds = new Set((solution?.designElements ?? []).map((item) => item.id));
  let effectiveContracts = suppliedEffectiveContracts ?? new Map(
    (bundle?.contracts ?? []).map((contract) => [contract.id, contract]),
  );
  if (!suppliedEffectiveContracts && artifactPath && bundle?.schema_version === "0.2.0") {
    try {
      const root = await findProjectRoot(artifactPath);
      const bundlePath = resolve(root, plan.contract_bundle_ref.path);
      const resolved = await resolveEffectiveContracts(root, bundle, { bundlePath });
      errors.push(...resolved.errors.map((error) => `실행 계약 계보: ${error}`));
      effectiveContracts = resolved.contracts;
    } catch (error) {
      errors.push(`실행 계약 계보를 확인할 수 없습니다: ${error.message}`);
    }
  }
  const contractIds = activeContractIds(effectiveContracts);
  const gaps = plan.gaps ?? [];
  const gapById = new Map(gaps.map((gap) => [gap.id, gap]));
  for (const duplicate of duplicates(gaps.map((gap) => gap.id))) errors.push(`격차 ID가 중복됐습니다: ${duplicate}`);
  for (const [index, gap] of gaps.entries()) {
    for (const ref of gap.design_refs ?? []) {
      if (!designIds.has(ref)) errors.push(`/gaps/${index}: 존재하지 않는 설계 ${ref}`);
    }
    for (const ref of gap.contract_refs ?? []) {
      if (!contractIds.has(ref)) errors.push(`/gaps/${index}: 존재하지 않는 활성 계약 ${ref}`);
    }
    for (const ref of gap.evidence_refs ?? []) {
      if (!observationIds.has(ref)) errors.push(`/gaps/${index}: 존재하지 않는 기준선 관찰 ${ref}`);
    }
  }

  const imports = await importedWork(plan, artifactPath, errors);
  const localWork = plan.work_items ?? [];
  const localById = new Map(localWork.map((work) => [work.id, work]));
  for (const duplicate of duplicates(localWork.map((work) => work.id))) errors.push(`작업 ID가 중복됐습니다: ${duplicate}`);
  for (const id of imports.keys()) {
    if (localById.has(id)) errors.push(`가져온 작업과 로컬 작업 ID가 겹칩니다: ${id}`);
  }
  const allWork = new Map([...imports, ...localById]);
  const edges = new Map();
  const coveredDesign = new Set();
  const coveredContracts = new Set();
  const coveredGaps = new Set();
  for (const work of imports.values()) {
    for (const ref of work.design_refs ?? []) {
      if (designIds.has(ref)) coveredDesign.add(ref);
    }
    for (const ref of work.contract_refs ?? []) {
      if (contractIds.has(ref)) coveredContracts.add(ref);
    }
    for (const ref of work.gap_refs ?? []) {
      if (gapById.has(ref)) coveredGaps.add(ref);
    }
  }
  const expectedStatus = plan.plan_status === "approved" ? "ratified" : "proposed";
  for (const [index, work] of localWork.entries()) {
    const location = `/work_items/${index}`;
    const expectedId = `WORK:${work.key}@R${work.revision}`;
    if (work.id !== expectedId) errors.push(`${location}: 작업 ID는 ${expectedId}여야 합니다.`);
    if (work.revision === 1 && (work.supersedes !== null || work.change_class !== "initial")) {
      errors.push(`${location}: 최초 작업 리비전은 다른 리비전을 대체할 수 없습니다.`);
    }
    if (work.revision > 1) {
      const previous = allWork.get(work.supersedes);
      if (
        !previous ||
        previous.key !== work.key ||
        previous.revision !== work.revision - 1
      ) {
        errors.push(`${location}: 바로 이전 작업 리비전을 대체해야 합니다.`);
      }
      if (work.change_class === "initial") {
        errors.push(`${location}: 후속 작업 리비전은 initial일 수 없습니다.`);
      }
    }
    if (work.status !== expectedStatus) errors.push(`${location}: ${plan.plan_status} 계획의 작업 상태는 ${expectedStatus}여야 합니다.`);
    if ((work.collaborating_capabilities ?? []).includes(work.primary_capability)) {
      errors.push(`${location}: 주 역량을 협업 역량에 중복할 수 없습니다.`);
    }
    const dependencies = new Set(work.blocked_by ?? []);
    edges.set(work.id, dependencies);
    if (dependencies.has(work.id)) errors.push(`${location}: 작업은 자기 자신을 선행 작업으로 둘 수 없습니다.`);
    for (const ref of dependencies) {
      if (!allWork.has(ref)) errors.push(`${location}: 존재하지 않는 선행 작업 ${ref}`);
    }
    for (const ref of work.gap_refs ?? []) {
      if (!gapById.has(ref)) errors.push(`${location}: 존재하지 않는 격차 ${ref}`);
      coveredGaps.add(ref);
    }
    const workDesign = new Set(work.design_refs ?? []);
    const workContracts = new Set(work.contract_refs ?? []);
    for (const ref of workDesign) {
      if (!designIds.has(ref)) errors.push(`${location}: 존재하지 않는 설계 ${ref}`);
      coveredDesign.add(ref);
    }
    for (const ref of workContracts) {
      if (!contractIds.has(ref)) errors.push(`${location}: 존재하지 않는 활성 계약 ${ref}`);
      coveredContracts.add(ref);
    }
    const provenDesign = new Set();
    const provenContracts = new Set();
    for (const [evidenceIndex, evidence] of (work.completion_evidence ?? []).entries()) {
      for (const ref of evidence.design_refs ?? []) {
        if (!workDesign.has(ref)) errors.push(`${location}/completion_evidence/${evidenceIndex}: 작업 밖 설계를 증명할 수 없습니다: ${ref}`);
        provenDesign.add(ref);
      }
      for (const ref of evidence.contract_refs ?? []) {
        if (!workContracts.has(ref)) errors.push(`${location}/completion_evidence/${evidenceIndex}: 작업 밖 계약을 증명할 수 없습니다: ${ref}`);
        provenContracts.add(ref);
      }
    }
    for (const ref of workDesign) {
      if (!provenDesign.has(ref)) errors.push(`${location}: 완료 증거가 없는 설계 ${ref}`);
    }
    for (const ref of workContracts) {
      if (!provenContracts.has(ref)) errors.push(`${location}: 완료 증거가 없는 계약 ${ref}`);
    }
  }
  if (hasCycle(edges)) errors.push("작업 선행관계에 순환이 있습니다.");
  const missingDesign = [...designIds].filter((id) => !coveredDesign.has(id)).sort();
  if (missingDesign.length) errors.push(`작업이 덮지 않은 설계: ${missingDesign.join(", ")}`);
  const missingContracts = [...contractIds].filter((id) => !coveredContracts.has(id)).sort();
  if (missingContracts.length) errors.push(`작업이 덮지 않은 계약: ${missingContracts.join(", ")}`);
  const missingGaps = [...gapById.keys()].filter((id) => !coveredGaps.has(id)).sort();
  if (missingGaps.length) errors.push(`작업으로 연결되지 않은 격차: ${missingGaps.join(", ")}`);

  if (plan.plan_status === "approved") {
    const approvalSource = sources.find((source) => source.id === plan.approval_source_ref);
    if (approvalSource?.type !== "user_statement") errors.push("승인 작업 그래프에는 사람의 전체 승인 근거가 필요합니다.");
  }
  validateQuestions(plan, sourceIds, new Set(allWork.keys()), errors);
  return [...new Set(errors)];
}

async function collectPlanFiles(root) {
  const deliveryRoot = resolve(root, "delivery-units");
  const files = [];
  async function visit(directory) {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      if (error?.code === "ENOENT") return;
      throw error;
    }
    for (const entry of entries) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile() && entry.name.endsWith(".json") && path.includes(`${sep}delivery-work${sep}`)) files.push(path);
    }
  }
  await visit(deliveryRoot);
  return files.sort();
}

export async function validateDeliveryWorkPlanRepository(root = defaultRoot) {
  const errors = [];
  const files = await collectPlanFiles(root);
  for (const path of files) {
    try {
      const plan = JSON.parse(await readFile(path, "utf8"));
      const solution = (await loadProjectJson(root, plan.solution_ref?.path, "목표 동작 설계")).value;
      const bundle = (await loadProjectJson(root, plan.contract_bundle_ref?.path, "실행 계약 묶음")).value;
      const architecture = (await loadProjectJson(root, plan.implementation_architecture_ref?.path, "구현 아키텍처")).value;
      for (const error of await validateDeliveryWorkPlan(plan, { solution, bundle, architecture, artifactPath: path })) {
        errors.push(`${relative(root, path)}: ${error}`);
      }
    } catch (error) {
      errors.push(`${relative(root, path)}: ${error.message}`);
    }
  }
  return { errors, warnings: [], files };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await validateDeliveryWorkPlanRepository(defaultRoot);
  for (const warning of result.warnings) console.warn(`WARN ${warning}`);
  for (const error of result.errors) console.error(`ERROR ${error}`);
  if (result.errors.length) process.exitCode = 1;
  else console.log(`전달 작업 그래프 검증 통과: ${result.files.length}개, 오류 0, 경고 0`);
}
