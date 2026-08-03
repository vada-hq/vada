import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import Ajv2020 from "ajv/dist/2020.js";

const defaultRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const schemaPath = resolve(defaultRoot, "delivery-units/schemas/execution-plan.schema.json");
const schema = JSON.parse(await readFile(schemaPath, "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true });
ajv.addFormat("date-time", {
  type: "string",
  validate: (value) => !Number.isNaN(Date.parse(value)),
});
ajv.addFormat("date", {
  type: "string",
  validate: (value) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)),
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
      if (edges.has(dependency) && visit(dependency)) return true;
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

function checkSourceRefs(refs, sourceIds, location, errors) {
  for (const ref of refs ?? []) {
    if (!sourceIds.has(ref)) errors.push(`${location}: 존재하지 않는 근거 ${ref}`);
  }
}

function dateValue(value) {
  return typeof value === "string" ? Date.parse(`${value}T00:00:00Z`) : Number.NaN;
}

function validateWindow(window, location, errors) {
  if (!window) return;
  if (dateValue(window.start_date) > dateValue(window.end_date)) {
    errors.push(`${location}: 시작일은 종료일보다 늦을 수 없습니다.`);
  }
}

function validateQuestions(plan, sourceIds, workIds, executorIds, errors) {
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
    checkSourceRefs(
      [
        ...(question.response_design?.source_refs ?? []),
        ...(question.evidence?.source_refs ?? []),
        ...(question.answer_source_ref ? [question.answer_source_ref] : []),
      ],
      sourceIds,
      location,
      errors,
    );
    for (const ref of question.evidence?.work_item_refs ?? []) {
      if (!workIds.has(ref)) errors.push(`${location}: 존재하지 않는 작업 ${ref}`);
    }
    for (const ref of question.evidence?.executor_refs ?? []) {
      if (!executorIds.has(ref)) errors.push(`${location}: 존재하지 않는 실행 주체 ${ref}`);
    }
    if (question.status === "pending" && (question.answer_source_ref !== null || question.normalized_answer !== null)) {
      errors.push(`${location}: 대기 질문에는 답변을 기록할 수 없습니다.`);
    }
    if (question.status === "answered") {
      if (!question.answer_source_ref || !question.normalized_answer) {
        errors.push(`${location}: 답변 근거와 정규화 답변이 필요합니다.`);
      }
      const optionIds = new Set((question.options ?? []).map((option) => option.id));
      for (const selected of question.normalized_answer?.selected_option_ids ?? []) {
        if (!optionIds.has(selected)) errors.push(`${location}: 존재하지 않는 선택지 ${selected}`);
      }
    }
  }
  if (hasCycle(edges)) errors.push("질문 선행관계에 순환이 있습니다.");

  const unresolvedNonApproval = questions.filter(
    (question) => ["pending", "deferred"].includes(question.status) && question.target_path !== "/approval",
  );
  const pending = questions.filter((question) => question.status === "pending");
  if (["review_ready", "approved"].includes(plan.execution_plan_status) && unresolvedNonApproval.length) {
    errors.push(`미해결 실행 계획 질문이 있습니다: ${unresolvedNonApproval.map((question) => question.id).join(", ")}`);
  }
  if (plan.execution_plan_status === "review_ready") {
    if (pending.length !== 1 || pending[0].target_path !== "/approval") {
      errors.push("검토 준비 실행 계획에는 전체 승인 질문만 하나 대기해야 합니다.");
    }
  }
  if (plan.execution_plan_status === "approved") {
    if (pending.length) errors.push("승인 실행 계획에는 대기 질문을 남길 수 없습니다.");
    const approvals = questions.filter(
      (question) =>
        question.status === "answered" &&
        question.target_path === "/approval" &&
        question.answer_source_ref === plan.approval_source_ref &&
        JSON.stringify(question.normalized_answer?.selected_option_ids) === JSON.stringify(["YES"]),
    );
    if (approvals.length !== 1) errors.push("승인 실행 계획에는 명시적 전체 승인 YES가 하나 필요합니다.");
  }
}

function workIdsFromPlan(workPlan) {
  return new Map(
    (workPlan?.work_items ?? [])
      .filter((work) => work?.status === "ratified" && typeof work.id === "string")
      .map((work) => [work.id, work]),
  );
}

function importedWorkIds(workPlan) {
  return new Set((workPlan?.imports ?? []).flatMap((item) => item.work_item_ids ?? []));
}

function validatePolicy(plan, allocations, executors, workById, satisfied, errors) {
  const policy = plan.planning_policy ?? {};
  const finalized = ["review_ready", "approved"].includes(plan.execution_plan_status);
  if (
    finalized &&
    [policy.scope_mode, policy.estimate_mode, policy.estimate_unit, policy.schedule_mode].includes("undetermined")
  ) {
    errors.push("검토 준비 실행 계획에는 확정된 범위·추정·일정 정책이 필요합니다.");
  }
  if (finalized && allocations.some((item) => item.disposition === "unplanned")) {
    errors.push("검토 준비 실행 계획에는 미계획 작업을 남길 수 없습니다.");
  }

  const allocationById = new Map(allocations.map((item) => [item.work_item_ref, item]));
  const unsatisfied = [...workById.keys()].filter((id) => !satisfied.has(id));
  const frontier = new Set(
    unsatisfied.filter((id) => (workById.get(id)?.blocked_by ?? []).every((dependency) => satisfied.has(dependency))),
  );
  const committed = new Set(
    allocations.filter((item) => item.disposition === "committed").map((item) => item.work_item_ref),
  );

  if (finalized && policy.scope_mode === "rolling_wave") {
    const missing = [...frontier].filter((id) => !committed.has(id));
    const extra = [...committed].filter((id) => !frontier.has(id));
    if (missing.length || extra.length) {
      errors.push(
        `rolling-wave 커밋은 현재 의존성 시작점과 같아야 합니다.` +
          `${missing.length ? ` 누락: ${missing.join(", ")}.` : ""}` +
          `${extra.length ? ` 초과: ${extra.join(", ")}.` : ""}`,
      );
    }
  }
  if (finalized && policy.scope_mode === "full_unit") {
    const missing = unsatisfied.filter((id) => !committed.has(id));
    if (missing.length) errors.push(`전체 실행 범위에서 커밋되지 않은 작업: ${missing.join(", ")}`);
  }
  if (finalized && policy.scope_mode === "custom") {
    for (const id of committed) {
      for (const dependency of workById.get(id)?.blocked_by ?? []) {
        if (!satisfied.has(dependency) && allocationById.get(dependency)?.disposition !== "committed") {
          errors.push(`사용자 지정 범위의 ${id}는 미포함 선행 작업 ${dependency}에 막혀 있습니다.`);
        }
      }
    }
  }

  validateWindow(policy.target_window, "/planning_policy/target_window", errors);
  for (const [index, allocation] of allocations.entries()) {
    const location = `/work_allocations/${index}`;
    const work = workById.get(allocation.work_item_ref);
    const primary = executors.get(allocation.primary_executor_ref);
    if (allocation.primary_executor_ref && !primary) {
      errors.push(`${location}: 존재하지 않는 주 실행자 ${allocation.primary_executor_ref}`);
    }
    for (const ref of allocation.collaborator_refs ?? []) {
      if (!executors.has(ref)) errors.push(`${location}: 존재하지 않는 협업 실행자 ${ref}`);
      if (ref === allocation.primary_executor_ref) errors.push(`${location}: 주 실행자를 협업 실행자에 중복할 수 없습니다.`);
    }
    if (allocation.disposition === "committed") {
      if (!primary) errors.push(`${location}: 커밋 작업에는 주 실행자가 필요합니다.`);
      if (primary && !(primary.capabilities ?? []).includes(work?.primary_capability)) {
        errors.push(`${location}: 주 실행자가 작업 주 역량 ${work?.primary_capability}을 보유하지 않습니다.`);
      }
      const hasVerifier = (allocation.collaborator_refs ?? []).some((ref) =>
        (executors.get(ref)?.execution_roles ?? []).includes("verifier"),
      );
      if (!hasVerifier) errors.push(`${location}: 커밋 작업에는 작성자와 분리된 검증자가 필요합니다.`);
    }
    const estimate = allocation.estimate ?? {};
    if (allocation.disposition === "committed" && policy.estimate_mode === "range") {
      if (estimate.status !== "range" || estimate.unit !== policy.estimate_unit) {
        errors.push(`${location}: 커밋 작업에는 정책 단위의 추정 범위가 필요합니다.`);
      }
      if (!(estimate.low > 0) || !(estimate.high >= estimate.low) || !estimate.basis_ko) {
        errors.push(`${location}: 추정 범위·근거가 유효하지 않습니다.`);
      }
    }
    if (allocation.disposition === "committed" && policy.estimate_mode === "none") {
      if (estimate.status !== "not_applicable" || estimate.unit !== "not_applicable") {
        errors.push(`${location}: 추정하지 않는 정책에서는 추정을 적용하지 않음으로 기록해야 합니다.`);
      }
    }
    if (policy.schedule_mode === "none" && allocation.target_window !== null) {
      errors.push(`${location}: 일정 없음 정책에서는 작업 기간을 둘 수 없습니다.`);
    }
    if (allocation.disposition === "committed" && policy.schedule_mode === "target_window") {
      if (!allocation.target_window) errors.push(`${location}: 일정 계획의 커밋 작업에는 목표 기간이 필요합니다.`);
      if (primary?.availability?.status !== "known") {
        errors.push(`${location}: 목표 기간을 사용하려면 실행자 가용성이 확인돼야 합니다.`);
      }
    }
    validateWindow(allocation.target_window, `${location}/target_window`, errors);
  }
}

export async function validateExecutionPlan(plan, { workPlan, artifactPath = null } = {}) {
  const errors = [];
  if (!validateSchema(plan)) errors.push(...(validateSchema.errors ?? []).map(formatSchemaError));

  if (workPlan?.plan_status !== "approved" || !Number.isInteger(workPlan?.plan_revision)) {
    errors.push("승인된 전달 작업 그래프가 필요합니다.");
  }
  if (plan.work_plan_ref?.plan_id !== workPlan?.plan_id || plan.work_plan_ref?.plan_revision !== workPlan?.plan_revision) {
    errors.push("작업 그래프 ID 또는 리비전이 승인본과 다릅니다.");
  }
  if (plan.work_plan_ref?.canonical_sha256 !== canonicalSha256(workPlan)) {
    errors.push("작업 그래프 해시가 승인본과 다릅니다.");
  }
  if (plan.objective_ko !== workPlan?.objective_ko) errors.push("실행 목적이 승인 작업 그래프와 다릅니다.");

  if (artifactPath) {
    const parts = resolve(artifactPath).split(/[\\/]+/);
    const deliveryIndex = parts.lastIndexOf("delivery-units");
    const directoryUnit = deliveryIndex >= 0 ? parts[deliveryIndex + 1] : null;
    if (directoryUnit && directoryUnit !== plan.delivery_unit_id) {
      errors.push("실행 계획의 전달 단위 ID가 저장 경로와 다릅니다.");
    }
  }

  const sources = plan.sources ?? [];
  const sourceIds = new Set(sources.map((source) => source.id));
  for (const duplicate of duplicates(sources.map((source) => source.id))) errors.push(`근거 ID가 중복됐습니다: ${duplicate}`);

  const executors = new Map((plan.executors ?? []).map((executor) => [executor.id, executor]));
  for (const duplicate of duplicates((plan.executors ?? []).map((executor) => executor.id))) {
    errors.push(`실행 주체 ID가 중복됐습니다: ${duplicate}`);
  }
  for (const [index, executor] of (plan.executors ?? []).entries()) {
    checkSourceRefs(executor.source_refs, sourceIds, `/executors/${index}`, errors);
    if (executor.availability?.status === "known") {
      if (!executor.availability.capacity_value || !executor.availability.capacity_unit) {
        errors.push(`/executors/${index}: 확인된 가용성에는 용량 값과 단위가 필요합니다.`);
      }
    } else if (
      executor.availability?.capacity_value !== null ||
      executor.availability?.capacity_unit !== null ||
      executor.availability?.available_from !== null ||
      executor.availability?.available_until !== null
    ) {
      errors.push(`/executors/${index}: 미확인 가용성에는 용량이나 기간을 추정해 넣을 수 없습니다.`);
    }
  }

  const orchestration = plan.orchestration ?? {};
  checkSourceRefs(orchestration.source_refs, sourceIds, "/orchestration", errors);
  const approver = executors.get(orchestration.human_approver_ref);
  if (approver?.kind !== "human" || !(approver?.execution_roles ?? []).includes("accountable_owner")) {
    errors.push("사람 승인자는 accountable_owner 역할의 human 실행 주체여야 합니다.");
  }
  const coordinator = executors.get(orchestration.coordinator_executor_ref);
  if (!(coordinator?.execution_roles ?? []).includes("coordinator")) {
    errors.push("총괄 실행 주체에는 coordinator 역할이 필요합니다.");
  }
  for (const ref of orchestration.verifier_executor_refs ?? []) {
    if (!(executors.get(ref)?.execution_roles ?? []).includes("verifier")) {
      errors.push(`독립 검증 주체 ${ref}에는 verifier 역할이 필요합니다.`);
    }
  }

  checkSourceRefs(plan.planning_policy?.source_refs, sourceIds, "/planning_policy", errors);
  for (const [index, item] of (plan.satisfied_prerequisites ?? []).entries()) {
    checkSourceRefs(item.source_refs, sourceIds, `/satisfied_prerequisites/${index}`, errors);
  }
  const workById = workIdsFromPlan(workPlan);
  const imported = importedWorkIds(workPlan);
  const allKnownWork = new Set([...workById.keys(), ...imported]);
  const satisfied = new Set((plan.satisfied_prerequisites ?? []).map((item) => item.work_item_ref));
  for (const duplicate of duplicates((plan.satisfied_prerequisites ?? []).map((item) => item.work_item_ref))) {
    errors.push(`충족 선행 작업이 중복됐습니다: ${duplicate}`);
  }
  for (const id of satisfied) {
    if (!allKnownWork.has(id)) errors.push(`존재하지 않는 충족 선행 작업 ${id}`);
  }

  const allocations = plan.work_allocations ?? [];
  const allocatedIds = allocations.map((item) => item.work_item_ref);
  for (const duplicate of duplicates(allocatedIds)) errors.push(`작업 배정이 중복됐습니다: ${duplicate}`);
  const missing = [...workById.keys()].filter((id) => !allocatedIds.includes(id));
  if (missing.length) errors.push(`배정되지 않은 작업: ${missing.join(", ")}`);
  const unknown = allocatedIds.filter((id) => !workById.has(id));
  if (unknown.length) errors.push(`현재 작업 그래프에서 배정할 수 없는 작업: ${unknown.join(", ")}`);
  for (const [index, allocation] of allocations.entries()) {
    checkSourceRefs(allocation.source_refs, sourceIds, `/work_allocations/${index}`, errors);
    checkSourceRefs(allocation.estimate?.source_refs, sourceIds, `/work_allocations/${index}/estimate`, errors);
    if (allocation.disposition === "satisfied" && !satisfied.has(allocation.work_item_ref)) {
      errors.push(`/work_allocations/${index}: 충족 증거 없이 작업을 satisfied로 둘 수 없습니다.`);
    }
    if (satisfied.has(allocation.work_item_ref) && allocation.disposition !== "satisfied") {
      errors.push(`/work_allocations/${index}: 충족된 로컬 작업은 satisfied 배정이어야 합니다.`);
    }
  }

  if (["review_ready", "approved"].includes(plan.execution_plan_status)) {
    const importedBlockers = new Set(
      [...workById.values()].flatMap((work) => (work.blocked_by ?? []).filter((dependency) => imported.has(dependency))),
    );
    const unresolved = [...importedBlockers].filter((id) => !satisfied.has(id));
    if (unresolved.length) errors.push(`증거가 없는 외부 선행 작업: ${unresolved.join(", ")}`);
  }

  validatePolicy(plan, allocations, executors, workById, satisfied, errors);
  validateQuestions(plan, sourceIds, allKnownWork, new Set(executors.keys()), errors);
  if (plan.execution_plan_status === "approved") {
    const approvalSource = sources.find((source) => source.id === plan.approval_source_ref);
    if (approvalSource?.type !== "user_statement") errors.push("승인 실행 계획에는 사람의 전체 승인 근거가 필요합니다.");
  }
  return [...new Set(errors)];
}

async function collectExecutionPlanFiles(root) {
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
      else if (entry.isFile() && entry.name.endsWith(".json") && path.includes(`${sep}execution-plan${sep}`)) files.push(path);
    }
  }
  await visit(deliveryRoot);
  return files.sort();
}

export async function validateExecutionPlanRepository(root = defaultRoot) {
  const errors = [];
  const files = await collectExecutionPlanFiles(root);
  for (const path of files) {
    try {
      const plan = JSON.parse(await readFile(path, "utf8"));
      const workPlan = (await loadProjectJson(root, plan.work_plan_ref?.path, "전달 작업 그래프")).value;
      for (const error of await validateExecutionPlan(plan, { workPlan, artifactPath: path })) {
        errors.push(`${relative(root, path)}: ${error}`);
      }
    } catch (error) {
      errors.push(`${relative(root, path)}: ${error.message}`);
    }
  }
  return { errors, warnings: [], files };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await validateExecutionPlanRepository(defaultRoot);
  for (const warning of result.warnings) console.warn(`WARN ${warning}`);
  for (const error of result.errors) console.error(`ERROR ${error}`);
  if (result.errors.length) process.exitCode = 1;
  else console.log(`실행 계획 검증 통과: ${result.files.length}개, 오류 0, 경고 0`);
}
