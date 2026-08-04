import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import Ajv2020 from "ajv/dist/2020.js";

const defaultRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const schemaV1Path = resolve(
  defaultRoot,
  "delivery-units/schemas/implementation-architecture.schema.json",
);
const schemaV2Path = resolve(
  defaultRoot,
  "delivery-units/schemas/implementation-architecture-0.2.0.schema.json",
);
const schemaV1 = JSON.parse(await readFile(schemaV1Path, "utf8"));
const schemaV2 = JSON.parse(await readFile(schemaV2Path, "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true });
ajv.addFormat("date-time", {
  type: "string",
  validate: (value) => !Number.isNaN(Date.parse(value)),
});
ajv.addSchema(schemaV1);
const schemaValidators = new Map([
  ["0.1.0", ajv.getSchema(schemaV1.$id)],
  ["0.2.0", ajv.compile(schemaV2)],
]);

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

function duplicateValues(values) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts].filter(([, count]) => count > 1).map(([value]) => value);
}

function selectedOptions(question) {
  return new Set(question?.normalized_answer?.selected_option_ids ?? []);
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

async function loadPinnedValue(rawPath, artifactPath, label) {
  if (typeof rawPath !== "string" || !rawPath || isAbsolute(rawPath)) {
    throw new Error(`${label} 경로는 프로젝트 상대 경로여야 합니다.`);
  }
  const segments = rawPath.split(/[\\/]+/);
  if (segments.includes("..")) throw new Error(`${label} 경로에 상위 이동을 사용할 수 없습니다.`);
  const projectRoot = await findProjectRoot(artifactPath);
  const targetPath = resolve(projectRoot, rawPath);
  const rel = relative(projectRoot, targetPath);
  if (rel.startsWith(`..${sep}`) || rel === "..") {
    throw new Error(`${label} 경로가 프로젝트 밖을 가리킵니다.`);
  }
  return {
    path: targetPath,
    value: JSON.parse(await readFile(targetPath, "utf8")),
  };
}

async function loadPinnedContract(reference, artifactPath) {
  return (await loadPinnedValue(reference?.path, artifactPath, "계약 묶음")).value;
}

async function loadPinnedArchitecture(reference, artifactPath) {
  return loadPinnedValue(reference?.path, artifactPath, "기준 아키텍처");
}

async function resolveEffectiveDecisions(architecture, artifactPath, visitedPaths = new Set()) {
  const decisions = new Map();
  if (architecture?.schema_version === "0.2.0" && architecture.base_architecture_ref) {
    const loaded = await loadPinnedArchitecture(architecture.base_architecture_ref, artifactPath);
    if (visitedPaths.has(loaded.path)) throw new Error("기준 아키텍처 참조에 순환이 있습니다.");
    const nextVisited = new Set(visitedPaths).add(loaded.path);
    const inherited = await resolveEffectiveDecisions(loaded.value, loaded.path, nextVisited);
    for (const [id, decision] of inherited) decisions.set(id, decision);
  }
  for (const decision of architecture?.decisions ?? []) decisions.set(decision.id, decision);
  return decisions;
}

function validateQuestions(architecture, sourceById, decisionById, errors) {
  const questions = architecture.questions ?? [];
  const questionById = new Map(questions.map((question) => [question.id, question]));
  for (const duplicate of duplicateValues(questions.map((question) => question.id))) {
    errors.push(`질문 ID가 중복됐습니다: ${duplicate}`);
  }
  const edges = new Map();
  questions.forEach((question, index) => {
    const location = `/questions/${index}`;
    edges.set(question.id, new Set(question.depends_on_question_refs ?? []));
    for (const dependency of question.depends_on_question_refs ?? []) {
      if (!questionById.has(dependency)) errors.push(`${location}: 존재하지 않는 선행 질문 ${dependency}`);
    }
    for (const condition of question.activation_conditions ?? []) {
      if (!questionById.has(condition.question_ref)) {
        errors.push(`${location}: 존재하지 않는 활성화 질문 ${condition.question_ref}`);
      }
    }
    for (const decisionRef of question.evidence?.decision_refs ?? []) {
      if (!decisionById.has(decisionRef)) errors.push(`${location}: 존재하지 않는 결정 ${decisionRef}`);
    }
    for (const sourceRef of [
      ...(question.evidence?.source_refs ?? []),
      ...(question.response_design?.source_refs ?? []),
    ]) {
      if (!sourceById.has(sourceRef)) errors.push(`${location}: 존재하지 않는 근거 ${sourceRef}`);
    }
    if (question.answer_source_ref && !sourceById.has(question.answer_source_ref)) {
      errors.push(`${location}: 존재하지 않는 답변 근거 ${question.answer_source_ref}`);
    }
    if (question.status === "answered") {
      const optionIds = new Set((question.options ?? []).map((option) => option.id));
      for (const option of selectedOptions(question)) {
        if (!optionIds.has(option)) errors.push(`${location}: 존재하지 않는 선택지 ${option}`);
      }
    }
  });
  if (hasCycle(edges)) errors.push("질문 선행관계에 순환이 있습니다.");
}

export async function validateArchitecture(architecture, { artifactPath = null } = {}) {
  const errors = [];
  const validateSchema = schemaValidators.get(architecture?.schema_version);
  if (!validateSchema) {
    errors.push(`/schema_version: 지원하지 않는 구현 아키텍처 스키마 ${architecture?.schema_version ?? "없음"}`);
  } else if (!validateSchema(architecture)) {
    errors.push(...(validateSchema.errors ?? []).map(formatSchemaError));
  }

  const sources = architecture.sources ?? [];
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  for (const duplicate of duplicateValues(sources.map((source) => source.id))) {
    errors.push(`근거 ID가 중복됐습니다: ${duplicate}`);
  }

  if (artifactPath && architecture.contract_bundle_ref) {
    try {
      const contract = await loadPinnedContract(architecture.contract_bundle_ref, artifactPath);
      const reference = architecture.contract_bundle_ref;
      if (contract.bundle_status !== "approved") errors.push("계약 묶음이 승인 상태가 아닙니다.");
      if (!Number.isInteger(contract.bundle_revision) || contract.bundle_revision < 1) {
        errors.push("계약 묶음에 양의 승인 리비전이 없습니다.");
      }
      if (reference.bundle_id !== contract.bundle_id) errors.push("계약 묶음 ID가 고정 참조와 다릅니다.");
      if (reference.bundle_revision !== contract.bundle_revision) {
        errors.push("계약 묶음 리비전이 고정 참조와 다릅니다.");
      }
      if (reference.canonical_sha256 !== canonicalSha256(contract)) {
        errors.push("계약 묶음 해시가 고정 참조와 다릅니다.");
      }
      if (architecture.delivery_unit_ref !== contract.delivery_unit_ref) {
        errors.push("전달 단위가 계약 묶음과 다릅니다.");
      }
      if (architecture.objective_ko !== contract.objective_ko) {
        errors.push("목적이 계약 묶음과 다릅니다.");
      }
    } catch (error) {
      errors.push(`/contract_bundle_ref: ${error.message}`);
    }
  }

  let inheritedDecisionById = new Map();
  if (artifactPath && architecture.schema_version === "0.2.0" && architecture.base_architecture_ref) {
    try {
      const reference = architecture.base_architecture_ref;
      const loaded = await loadPinnedArchitecture(reference, artifactPath);
      const base = loaded.value;
      if (base.architecture_status !== "approved") errors.push("기준 아키텍처가 승인 상태가 아닙니다.");
      if (!Number.isInteger(base.architecture_revision) || base.architecture_revision < 1) {
        errors.push("기준 아키텍처에 양의 승인 리비전이 없습니다.");
      }
      if (reference.architecture_id !== base.architecture_id) {
        errors.push("기준 아키텍처 ID가 고정 참조와 다릅니다.");
      }
      if (reference.architecture_revision !== base.architecture_revision) {
        errors.push("기준 아키텍처 리비전이 고정 참조와 다릅니다.");
      }
      if (reference.canonical_sha256 !== canonicalSha256(base)) {
        errors.push("기준 아키텍처 해시가 고정 참조와 다릅니다.");
      }
      if (architecture.architecture_id !== base.architecture_id) {
        errors.push("증분 아키텍처 ID가 기준 아키텍처와 다릅니다.");
      }
      if (architecture.delivery_unit_ref !== base.delivery_unit_ref) {
        errors.push("증분 아키텍처의 전달 단위가 기준 아키텍처와 다릅니다.");
      }
      if (architecture.objective_ko !== base.objective_ko) {
        errors.push("증분 아키텍처의 목적이 기준 아키텍처와 다릅니다.");
      }
      if (canonicalJson(architecture.decision_scope) !== canonicalJson(base.decision_scope)) {
        errors.push("증분 아키텍처의 적용 범위가 기준 아키텍처와 다릅니다.");
      }
      if (
        architecture.architecture_status === "approved" &&
        architecture.architecture_revision !== base.architecture_revision + 1
      ) {
        errors.push("승인 증분 아키텍처 리비전은 기준 리비전보다 정확히 1 커야 합니다.");
      }
      inheritedDecisionById = await resolveEffectiveDecisions(base, loaded.path, new Set([loaded.path]));
    } catch (error) {
      errors.push(`/base_architecture_ref: ${error.message}`);
    }
  }

  const scope = architecture.decision_scope ?? {};
  const expectedScope = {
    rehearsal: ["non_binding", "undecided"],
    production_candidate: ["candidate", "undecided"],
    production: ["binding", "approved"],
  }[scope.mode];
  if (expectedScope && (scope.binding !== expectedScope[0] || scope.production_stack_status !== expectedScope[1])) {
    errors.push(`${scope.mode} 범위의 binding·production_stack_status 조합이 올바르지 않습니다.`);
  }

  const decisions = architecture.decisions ?? [];
  const decisionById = new Map(inheritedDecisionById);
  for (const decision of decisions) decisionById.set(decision.id, decision);
  for (const duplicate of duplicateValues(decisions.map((decision) => decision.id))) {
    errors.push(`결정 ID가 중복됐습니다: ${duplicate}`);
  }
  if (architecture.schema_version === "0.2.0") {
    decisions.forEach((decision, index) => {
      const inherited = inheritedDecisionById.get(decision.id);
      if (inherited) {
        if (decision.revision !== inherited.revision + 1 || decision.supersedes !== decision.id) {
          errors.push(
            `/decisions/${index}: 기존 결정 변경은 리비전을 1 높이고 같은 결정 ID를 supersedes로 가리켜야 합니다.`,
          );
        }
      } else if (decision.revision !== 1 || decision.supersedes !== null) {
        errors.push(`/decisions/${index}: 새 결정은 리비전 1과 supersedes null로 시작해야 합니다.`);
      }
    });
  }
  const questions = architecture.questions ?? [];
  decisions.forEach((decision, index) => {
    const location = `/decisions/${index}`;
    const optionIds = new Set((decision.options ?? []).map((option) => option.id));
    for (const duplicate of duplicateValues((decision.options ?? []).map((option) => option.id))) {
      errors.push(`${location}: 선택지 ID가 중복됐습니다: ${duplicate}`);
    }
    if (decision.scope !== scope.mode) errors.push(`${location}: 결정 범위가 전체 범위와 다릅니다.`);
    if (decision.scope === "production" && optionIds.size < 2) {
      errors.push(`${location}: 운영 결정은 근거가 있는 대안 두 개 이상이 필요합니다.`);
    }
    if (decision.selected_option_id && !optionIds.has(decision.selected_option_id)) {
      errors.push(`${location}: 선택한 대안이 존재하지 않습니다.`);
    }
    for (const sourceRef of decision.source_refs ?? []) {
      if (!sourceById.has(sourceRef)) errors.push(`${location}: 존재하지 않는 근거 ${sourceRef}`);
    }
    for (const [optionIndex, option] of (decision.options ?? []).entries()) {
      for (const sourceRef of option.source_refs ?? []) {
        if (!sourceById.has(sourceRef)) {
          errors.push(`${location}/options/${optionIndex}: 존재하지 않는 근거 ${sourceRef}`);
        }
      }
    }
    if (decision.scope === "production" && decision.selected_option_id) {
      const target = `/decisions/${index}/selected_option_id`;
      const selections = questions.filter(
        (question) =>
          question.status === "answered" &&
          question.target_path === target &&
          selectedOptions(question).has(decision.selected_option_id),
      );
      if (selections.length !== 1) {
        errors.push(`${location}: 선택한 운영 대안을 뒷받침하는 답변이 정확히 하나 필요합니다.`);
      }
      if (decision.status === "accepted") {
        const approvalSource = sourceById.get(decision.approval_source_ref);
        if (approvalSource?.type !== "user_statement") {
          errors.push(`${location}: 승인된 결정은 사람의 결정 근거가 필요합니다.`);
        }
        if (selections[0]?.answer_source_ref !== decision.approval_source_ref) {
          errors.push(`${location}: 결정 승인 근거와 선택 답변 근거가 다릅니다.`);
        }
      }
    }
  });

  validateQuestions(architecture, sourceById, decisionById, errors);

  if (architecture.architecture_status === "review_ready") {
    const pending = questions.filter((question) => question.status === "pending");
    if (pending.length !== 1 || pending[0].target_path !== "/approval") {
      errors.push("검토 준비 상태에는 전체 승인 질문만 하나 대기할 수 있습니다.");
    }
    for (const [index, decision] of decisions.entries()) {
      if (
        decision.status !== "proposed" ||
        !decision.selected_option_id ||
        !decision.decision_ko ||
        !(decision.consequences_ko?.length > 0)
      ) {
        errors.push(`/decisions/${index}: 검토 준비 결정에는 제안 선택·설명·영향이 모두 필요합니다.`);
      }
    }
  }

  if (architecture.architecture_status === "approved") {
    const approvalSource = sourceById.get(architecture.approval_source_ref);
    if (approvalSource?.type !== "user_statement") {
      errors.push("승인 아키텍처에는 사람의 전체 승인 근거가 필요합니다.");
    }
    if (decisions.some((decision) => decision.status === "proposed")) {
      errors.push("승인 아키텍처에 제안 상태 결정을 남길 수 없습니다.");
    }
    const approvals = questions.filter(
      (question) =>
        question.status === "answered" &&
        question.target_path === "/approval" &&
        selectedOptions(question).has("YES") &&
        question.answer_source_ref === architecture.approval_source_ref,
    );
    if (approvals.length !== 1) errors.push("승인 아키텍처에는 명시적 전체 승인 YES가 하나 필요합니다.");
    if (questions.some((question) => question.blocks_next_step && ["pending", "deferred"].includes(question.status))) {
      errors.push("승인 아키텍처에 미해결 차단 질문을 남길 수 없습니다.");
    }
  }

  return [...new Set(errors)];
}

async function collectArchitectureFiles(root) {
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
      else if (entry.isFile() && entry.name.endsWith(".json") && path.includes(`${sep}implementation-architecture${sep}`)) {
        files.push(path);
      }
    }
  }
  await visit(deliveryRoot);
  return files.sort();
}

export async function validateArchitectureRepository(root = defaultRoot) {
  const errors = [];
  const files = await collectArchitectureFiles(root);
  for (const path of files) {
    try {
      const architecture = JSON.parse(await readFile(path, "utf8"));
      for (const error of await validateArchitecture(architecture, { artifactPath: path })) {
        errors.push(`${relative(root, path)}: ${error}`);
      }
    } catch (error) {
      errors.push(`${relative(root, path)}: ${error.message}`);
    }
  }
  return { errors, warnings: [], files };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await validateArchitectureRepository(defaultRoot);
  for (const warning of result.warnings) console.warn(`WARN ${warning}`);
  for (const error of result.errors) console.error(`ERROR ${error}`);
  if (result.errors.length) process.exitCode = 1;
  else console.log(`구현 아키텍처 검증 통과: ${result.files.length}개, 오류 0, 경고 0`);
}
