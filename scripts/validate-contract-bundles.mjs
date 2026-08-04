import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, relative, resolve, sep } from "node:path";

import Ajv2020 from "ajv/dist/2020.js";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const schemaPath = resolve(
  repositoryRoot,
  "contracts/schemas/delivery-contract-bundle.schema.json",
);
const bundleSchema = JSON.parse(await readFile(schemaPath, "utf8"));
const deltaBundleSchema = JSON.parse(
  await readFile(
    resolve(repositoryRoot, "contracts/schemas/delivery-contract-bundle-0.2.0.schema.json"),
    "utf8",
  ),
);
const structureAjv = new Ajv2020({
  allErrors: true,
  strict: true,
  allowUnionTypes: true,
});
const validateBundleSchema = structureAjv.compile(bundleSchema);
const validateDeltaBundleSchema = structureAjv.compile(deltaBundleSchema);
const coreKinds = new Set(["DOMAIN", "DATA", "AUTH", "API", "ERROR", "EVENT", "QUALITY"]);

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

function validateBundleStructure(bundle) {
  const validator =
    bundle?.schema_version === "0.1.0"
      ? validateBundleSchema
      : bundle?.schema_version === "0.2.0"
        ? validateDeltaBundleSchema
        : null;
  if (!validator) {
    return [`/schema_version: 지원하지 않는 계약 묶음 스키마 ${bundle?.schema_version ?? "없음"}입니다.`];
  }
  return validator(bundle) ? [] : (validator.errors ?? []).map(formatSchemaError);
}

function uniqueErrors(items, key, label) {
  const errors = [];
  const seen = new Set();
  for (const item of items ?? []) {
    const value = item?.[key];
    if (seen.has(value)) errors.push(`${label}: ${value}가 중복됐습니다.`);
    seen.add(value);
  }
  return errors;
}

function requiredKeys(value, keys, location, errors) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    errors.push(`${location}: 객체여야 합니다.`);
    return false;
  }
  for (const key of keys) {
    if (!(key in value)) errors.push(`${location}: 필수 필드 ${key}가 없습니다.`);
  }
  return true;
}

function contractParts(reference) {
  const match = /^(DOMAIN|DATA|AUTH|API|ERROR|EVENT|QUALITY):(.+)@R([1-9][0-9]*)$/.exec(
    reference ?? "",
  );
  if (!match) return null;
  return { kind: match[1], key: match[2], revision: Number(match[3]) };
}

function contractReference(reference, kind, contracts, location, errors) {
  const contract = contracts.get(reference);
  if (!contract) {
    errors.push(`${location}: 존재하지 않는 계약 ${reference}입니다.`);
    return;
  }
  if (contract.kind !== kind) {
    errors.push(`${location}: ${kind} 계약이어야 하지만 ${contract.kind}입니다.`);
  }
}

function collectExternalSchemaReferences(value, result = new Set()) {
  if (Array.isArray(value)) {
    for (const item of value) collectExternalSchemaReferences(item, result);
  } else if (value && typeof value === "object") {
    if (typeof value.$ref === "string" && !value.$ref.startsWith("#")) {
      result.add(value.$ref);
    }
    for (const child of Object.values(value)) {
      collectExternalSchemaReferences(child, result);
    }
  }
  return result;
}

function validateDataSchemas(contracts, allContracts, errors) {
  const dataContracts = contracts.filter((item) => item.kind === "DATA");
  const schemaAjv = new Ajv2020({
    allErrors: true,
    strict: true,
    allowUnionTypes: true,
  });
  const schemaIds = new Map();

  for (const contract of dataContracts) {
    const location = `/contracts/${contracts.indexOf(contract)}/specification`;
    const specification = contract.specification;
    if (!requiredKeys(specification, ["json_schema", "semantic_notes_ko"], location, errors)) {
      continue;
    }
    const schema = specification.json_schema;
    if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
      errors.push(`${location}/json_schema: JSON Schema 객체여야 합니다.`);
      continue;
    }
    if (schema.$schema !== "https://json-schema.org/draft/2020-12/schema") {
      errors.push(`${location}/json_schema: JSON Schema Draft 2020-12여야 합니다.`);
    }
    if (typeof schema.$id !== "string" || schema.$id.length === 0) {
      errors.push(`${location}/json_schema: 안정적인 $id가 필요합니다.`);
      continue;
    }
    if (schemaIds.has(schema.$id)) {
      errors.push(`${location}/json_schema: 중복 $id ${schema.$id}입니다.`);
      continue;
    }
    schemaIds.set(schema.$id, contract.id);
    if (
      !Array.isArray(specification.semantic_notes_ko) ||
      specification.semantic_notes_ko.some((note) => typeof note !== "string" || !note)
    ) {
      errors.push(`${location}/semantic_notes_ko: 설명 문자열 배열이어야 합니다.`);
    }
  }

  for (const contract of allContracts.values()) {
    if (contract.kind !== "DATA") continue;
    const schema = contract.specification?.json_schema;
    if (!schema || typeof schema !== "object" || typeof schema.$id !== "string") continue;
    if (schemaAjv.getSchema(schema.$id)) continue;
    try {
      schemaAjv.addSchema(schema, schema.$id);
    } catch (error) {
      const localIndex = contracts.indexOf(contract);
      const location = localIndex >= 0 ? `/contracts/${localIndex}` : `가져온 계약 ${contract.id}`;
      errors.push(`${location}/specification/json_schema: ${error.message}`);
    }
  }

  const byId = allContracts;
  for (const contract of dataContracts) {
    const location = `/contracts/${contracts.indexOf(contract)}/specification`;
    const specification = contract.specification ?? {};
    const dependencyRefs = specification.schema_contract_refs ?? [];
    if (!Array.isArray(dependencyRefs)) {
      errors.push(`${location}/schema_contract_refs: 배열이어야 합니다.`);
      continue;
    }
    const allowedSchemaIds = new Set();
    dependencyRefs.forEach((reference, index) => {
      contractReference(reference, "DATA", byId, `${location}/schema_contract_refs/${index}`, errors);
      const dependencyId = byId.get(reference)?.specification?.json_schema?.$id;
      if (dependencyId) allowedSchemaIds.add(dependencyId);
    });
    const externalRefs = collectExternalSchemaReferences(specification.json_schema);
    for (const reference of externalRefs) {
      if (!allowedSchemaIds.has(reference)) {
        errors.push(`${location}: 외부 스키마 ${reference}의 DATA 계약 참조가 없습니다.`);
      }
    }
    for (const dependencyId of allowedSchemaIds) {
      if (!externalRefs.has(dependencyId)) {
        errors.push(`${location}: 사용하지 않는 스키마 의존성 ${dependencyId}입니다.`);
      }
    }
    try {
      if (specification.json_schema?.$id) schemaAjv.getSchema(specification.json_schema.$id);
    } catch (error) {
      errors.push(`${location}/json_schema: ${error.message}`);
    }
  }
}

function validateContractSpecifications(contracts, allContracts, errors) {
  const operationIds = new Set();
  const operations = new Set();
  validateDataSchemas(contracts, allContracts, errors);

  contracts.forEach((contract, index) => {
    const location = `/contracts/${index}/specification`;
    const specification = contract.specification;
    if (!specification || typeof specification !== "object" || Array.isArray(specification)) return;

    if (contract.kind === "DOMAIN") {
      requiredKeys(specification, ["invariants"], location, errors);
      if (!Array.isArray(specification.invariants) || specification.invariants.length === 0) {
        errors.push(`${location}: DOMAIN 계약에는 하나 이상의 불변식이 필요합니다.`);
      }
    } else if (contract.kind === "AUTH") {
      requiredKeys(
        specification,
        ["action", "resource_ko", "default_decision", "enforcement", "allow_any"],
        location,
        errors,
      );
      if (specification.default_decision !== "deny") {
        errors.push(`${location}: 권한은 기본 거부여야 합니다.`);
      }
      if (specification.enforcement !== "trusted_server") {
        errors.push(`${location}: 권한은 신뢰 가능한 서버(trusted_server)에서 판정해야 합니다.`);
      }
      if (!Array.isArray(specification.allow_any) || specification.allow_any.length === 0) {
        errors.push(`${location}: 하나 이상의 허용 관계식이 필요합니다.`);
      } else {
        specification.allow_any.forEach((clause, clauseIndex) => {
          if (!Array.isArray(clause?.all_of) || clause.all_of.length === 0) {
            errors.push(`${location}/allow_any/${clauseIndex}: all_of가 비어 있습니다.`);
            return;
          }
          clause.all_of.forEach((predicate, predicateIndex) => {
            const predicateLocation = `${location}/allow_any/${clauseIndex}/all_of/${predicateIndex}`;
            if (typeof predicate?.left_fact !== "string") {
              errors.push(`${predicateLocation}: left_fact가 필요합니다.`);
            }
            if (!["equals", "contains", "intersects", "is_true"].includes(predicate?.operator)) {
              errors.push(`${predicateLocation}: 알 수 없는 연산자입니다.`);
            }
            const rightKeys = predicate?.right && typeof predicate.right === "object"
              ? Object.keys(predicate.right)
              : [];
            if (rightKeys.length !== 1 || !["fact", "literal"].includes(rightKeys[0])) {
              errors.push(`${predicateLocation}: right에는 fact 또는 literal 하나만 필요합니다.`);
            }
          });
        });
      }
    } else if (contract.kind === "ERROR") {
      requiredKeys(
        specification,
        ["code", "http_status", "problem_type_uri", "title_ko", "when_ko", "disclosure_ko", "details_schema_ref"],
        location,
        errors,
      );
      if (!/^[A-Z][A-Z0-9_]*$/.test(specification.code ?? "")) {
        errors.push(`${location}: 오류 코드는 대문자 snake case여야 합니다.`);
      }
      if (!Number.isInteger(specification.http_status) || specification.http_status < 400 || specification.http_status > 599) {
        errors.push(`${location}: HTTP 오류 상태는 4xx 또는 5xx여야 합니다.`);
      }
      if (!/^https?:\/\//.test(specification.problem_type_uri ?? "")) {
        errors.push(`${location}: problem type은 HTTP URI여야 합니다.`);
      }
      contractReference(specification.details_schema_ref, "DATA", allContracts, `${location}/details_schema_ref`, errors);
    } else if (contract.kind === "API") {
      requiredKeys(
        specification,
        ["operation_id", "method", "path", "authorization_ref", "request", "success", "error_refs"],
        location,
        errors,
      );
      if (!specification.operation_id || operationIds.has(specification.operation_id)) {
        errors.push(`${location}: operation_id가 없거나 중복됐습니다.`);
      }
      operationIds.add(specification.operation_id);
      if (!["GET", "POST", "PUT", "PATCH", "DELETE"].includes(specification.method)) {
        errors.push(`${location}: 지원하지 않는 HTTP 메서드입니다.`);
      }
      if (typeof specification.path !== "string" || !specification.path.startsWith("/") || specification.path.includes("?")) {
        errors.push(`${location}: path는 쿼리 문자열 없는 절대 경로여야 합니다.`);
      }
      const signature = `${specification.method} ${specification.path}`;
      if (operations.has(signature)) errors.push(`${location}: API 동작 ${signature}가 중복됐습니다.`);
      operations.add(signature);
      contractReference(specification.authorization_ref, "AUTH", allContracts, `${location}/authorization_ref`, errors);
      if (!requiredKeys(specification.request, ["body_contract_ref", "parameters"], `${location}/request`, errors)) return;
      contractReference(specification.request.body_contract_ref, "DATA", allContracts, `${location}/request/body_contract_ref`, errors);
      if (!Array.isArray(specification.request.parameters)) {
        errors.push(`${location}/request/parameters: 배열이어야 합니다.`);
      }
      if (!requiredKeys(specification.success, ["http_status", "body_contract_ref"], `${location}/success`, errors)) return;
      if (!Number.isInteger(specification.success.http_status) || specification.success.http_status < 200 || specification.success.http_status > 299) {
        errors.push(`${location}/success: 성공 상태는 2xx여야 합니다.`);
      }
      contractReference(specification.success.body_contract_ref, "DATA", allContracts, `${location}/success/body_contract_ref`, errors);
      if (!Array.isArray(specification.error_refs)) {
        errors.push(`${location}/error_refs: 배열이어야 합니다.`);
      } else {
        specification.error_refs.forEach((reference, errorIndex) => {
          contractReference(reference, "ERROR", allContracts, `${location}/error_refs/${errorIndex}`, errors);
        });
      }
    } else if (contract.kind === "EVENT") {
      requiredKeys(
        specification,
        ["event_name", "payload_schema_ref", "emission_condition_ko", "sensitivity"],
        location,
        errors,
      );
      contractReference(specification.payload_schema_ref, "DATA", allContracts, `${location}/payload_schema_ref`, errors);
      if (!["public", "internal", "confidential", "restricted"].includes(specification.sensitivity)) {
        errors.push(`${location}: 알 수 없는 민감도입니다.`);
      }
    } else if (contract.kind === "QUALITY") {
      requiredKeys(specification, ["category", "obligation_ko", "verification_ko"], location, errors);
    }
  });
}

function graphHasCycle(edges) {
  const visited = new Set();
  const visiting = new Set();
  function visit(node) {
    if (visiting.has(node)) return true;
    if (visited.has(node)) return false;
    visiting.add(node);
    for (const next of edges.get(node) ?? []) {
      if (visit(next)) return true;
    }
    visiting.delete(node);
    visited.add(node);
    return false;
  }
  return [...edges.keys()].some(visit);
}

function questionFrontier(questions) {
  const byId = new Map(questions.map((item) => [item.id, item]));
  return questions.filter((question) => {
    if (question.status !== "pending") return false;
    if ((question.depends_on_question_refs ?? []).some((id) => byId.get(id)?.status !== "answered")) {
      return false;
    }
    return (question.activation_conditions ?? []).every((condition) => {
      const answer = byId.get(condition.question_ref)?.normalized_answer?.selected_option_ids ?? [];
      return condition.option_ids.some((option) => answer.includes(option));
    });
  });
}

export function validateContractBundleDocument(bundle, solution, options = {}) {
  const errors = [];
  const structureErrors = validateBundleStructure(bundle);
  if (structureErrors.length > 0) return structureErrors;
  if (solution?.status !== "approved" || !Number.isInteger(solution?.revision) || solution.revision < 1) {
    errors.push("참조한 목표 설계는 승인된 양의 리비전이어야 합니다.");
  }
  if (bundle.solution_ref.solution_id !== solution?.id) errors.push("목표 설계 ID가 고정 참조와 다릅니다.");
  if (bundle.solution_ref.solution_revision !== solution?.revision) errors.push("목표 설계 리비전이 고정 참조와 다릅니다.");
  if (bundle.solution_ref.canonical_sha256 !== canonicalSha256(solution)) {
    errors.push("목표 설계 해시가 고정 참조와 다릅니다.");
  }
  const expectedFlow = `${solution?.flowRef?.id}@R${solution?.flowRef?.revision}`;
  if (bundle.delivery_unit_ref !== expectedFlow) {
    errors.push(`전달 단위는 승인 설계의 ${expectedFlow}여야 합니다.`);
  }
  if (options.flow) {
    if (options.flow.status !== "approved") errors.push("참조한 사용자 흐름은 승인 상태여야 합니다.");
    if (bundle.objective_ko !== options.flow.spec?.outcome?.result) {
      errors.push("계약 목표는 승인된 사용자 흐름의 결과와 정확히 같아야 합니다.");
    }
  }

  const sources = bundle.sources ?? [];
  const contracts = bundle.contracts ?? [];
  const coverage = bundle.design_coverage ?? [];
  const questions = bundle.questions ?? [];
  errors.push(...uniqueErrors(sources, "id", "근거 ID"));
  errors.push(...uniqueErrors(contracts, "id", "계약 ID"));
  errors.push(...uniqueErrors(questions, "id", "질문 ID"));
  const sourceIds = new Set(sources.map((item) => item.id));
  const importedContracts = options.importedContracts ?? new Map();
  const localContracts = new Map(contracts.map((item) => [item.id, item]));
  for (const id of localContracts.keys()) {
    if (importedContracts.has(id)) errors.push(`기준 계약과 로컬 계약 ID가 중복됐습니다: ${id}`);
  }
  const allContracts = new Map([...importedContracts, ...localContracts]);

  contracts.forEach((contract, index) => {
    const location = `/contracts/${index}`;
    const expectedId = `${contract.kind}:${contract.key}@R${contract.revision}`;
    if (contract.id !== expectedId) errors.push(`${location}: 계약 ID는 ${expectedId}여야 합니다.`);
    for (const sourceRef of contract.source_refs) {
      if (!sourceIds.has(sourceRef)) errors.push(`${location}: 존재하지 않는 근거 ${sourceRef}입니다.`);
    }
    if (contract.revision === 1) {
      if (contract.supersedes !== null || contract.change_class !== "initial") {
        errors.push(`${location}: 최초 리비전은 다른 계약을 대체할 수 없습니다.`);
      }
    } else {
      const previous = allContracts.get(contract.supersedes);
      if (!previous || previous.kind !== contract.kind || previous.key !== contract.key || previous.revision !== contract.revision - 1) {
        errors.push(`${location}: 바로 이전의 동일 안정 키 리비전을 대체해야 합니다.`);
      }
      if (contract.change_class === "initial") errors.push(`${location}: 후속 리비전은 initial일 수 없습니다.`);
    }
    const expectedStatus = bundle.bundle_status === "approved" ? "ratified" : "proposed";
    if (contract.status !== expectedStatus) {
      errors.push(`${location}: ${bundle.bundle_status} 묶음의 계약은 ${expectedStatus} 상태여야 합니다.`);
    }
  });

  validateContractSpecifications(contracts, allContracts, errors);

  const designIds = new Set((solution?.designElements ?? []).map((item) => item.id));
  const coverageCounts = new Map();
  const mappedContracts = new Set();
  coverage.forEach((item, index) => {
    const location = `/design_coverage/${index}`;
    coverageCounts.set(item.design_ref, (coverageCounts.get(item.design_ref) ?? 0) + 1);
    if (!designIds.has(item.design_ref)) errors.push(`${location}: 존재하지 않는 설계 ${item.design_ref}입니다.`);
    if (item.disposition === "contracted" && item.contract_refs.length === 0) {
      errors.push(`${location}: 계약화된 설계에는 계약 참조가 필요합니다.`);
    }
    if (item.disposition === "direct_task_input" && item.contract_refs.length > 0) {
      errors.push(`${location}: 직접 작업 입력은 계약을 참조할 수 없습니다.`);
    }
    for (const reference of item.contract_refs) {
      if (!allContracts.has(reference)) errors.push(`${location}: 존재하지 않는 계약 ${reference}입니다.`);
      else mappedContracts.add(reference);
    }
  });
  const missingDesign = [...designIds].filter((id) => !coverageCounts.has(id));
  if (missingDesign.length > 0) errors.push(`계약 귀속에서 누락된 설계: ${missingDesign.join(", ")}`);
  const duplicateDesign = [...coverageCounts].filter(([, count]) => count > 1).map(([id]) => id);
  if (duplicateDesign.length > 0) errors.push(`중복 설계 귀속: ${duplicateDesign.join(", ")}`);
  const unmappedLocal = [...localContracts.keys()].filter((id) => !mappedContracts.has(id));
  if (unmappedLocal.length > 0) errors.push(`설계에 연결되지 않은 로컬 계약: ${unmappedLocal.join(", ")}`);

  const questionById = new Map(questions.map((item) => [item.id, item]));
  const questionEdges = new Map();
  questions.forEach((question, index) => {
    const location = `/questions/${index}`;
    questionEdges.set(question.id, new Set(question.depends_on_question_refs));
    for (const reference of question.depends_on_question_refs) {
      if (!questionById.has(reference)) errors.push(`${location}: 존재하지 않는 질문 ${reference}에 의존합니다.`);
    }
    for (const condition of question.activation_conditions) {
      if (!questionById.has(condition.question_ref)) errors.push(`${location}: 존재하지 않는 활성화 질문입니다.`);
    }
    for (const reference of question.response_design.source_refs) {
      if (!sourceIds.has(reference)) errors.push(`${location}: 존재하지 않는 응답 근거 ${reference}입니다.`);
    }
    for (const reference of question.evidence.solution_design_refs) {
      if (!designIds.has(reference)) errors.push(`${location}: 존재하지 않는 설계 근거 ${reference}입니다.`);
    }
    for (const reference of question.evidence.source_refs) {
      if (!sourceIds.has(reference)) errors.push(`${location}: 존재하지 않는 질문 근거 ${reference}입니다.`);
    }
    if (question.answer_source_ref && !sourceIds.has(question.answer_source_ref)) {
      errors.push(`${location}: 존재하지 않는 답변 근거 ${question.answer_source_ref}입니다.`);
    }
  });
  if (graphHasCycle(questionEdges)) errors.push("질문 의존 관계에 순환이 있습니다.");

  const presentKinds = new Set([...allContracts.values()].map((item) => item.kind));
  if (["review_ready", "approved"].includes(bundle.bundle_status)) {
    const missingKinds = [...coreKinds].filter((kind) => !presentKinds.has(kind));
    if (missingKinds.length > 0) errors.push(`필수 계약 종류가 없습니다: ${missingKinds.join(", ")}`);
    const unresolved = questions.filter(
      (item) => ["pending", "deferred"].includes(item.status) && item.blocks_next_step && item.target_path !== "/approval",
    );
    if (unresolved.length > 0) {
      errors.push(`미해결 차단 계약 질문: ${unresolved.map((item) => item.id).join(", ")}`);
    }
  }
  const frontier = questionFrontier(questions);
  if (bundle.bundle_status === "defining") {
    if (frontier.length === 0) errors.push("정의 중 묶음에는 답할 수 있는 질문이 필요합니다.");
    if (frontier.some((item) => item.target_path === "/approval")) {
      errors.push("정의 중 묶음에는 승인 질문을 노출할 수 없습니다.");
    }
  } else if (bundle.bundle_status === "review_ready") {
    if (frontier.length !== 1 || frontier[0].target_path !== "/approval") {
      errors.push("검토 준비 상태에는 답할 수 있는 승인 질문이 하나만 있어야 합니다.");
    }
  } else if (bundle.bundle_status === "approved") {
    if (frontier.length > 0) errors.push("승인된 묶음에는 답할 수 있는 질문이 남을 수 없습니다.");
    const approvalSource = sources.find((item) => item.id === bundle.approval_source_ref);
    if (approvalSource?.type !== "user_statement") {
      errors.push("승인된 묶음에는 사용자의 명시적 승인 근거가 필요합니다.");
    }
    const approvalQuestions = questions.filter(
      (item) => item.status === "answered" && item.target_path === "/approval" && item.answer_source_ref === bundle.approval_source_ref,
    );
    if (
      approvalQuestions.length !== 1 ||
      JSON.stringify(approvalQuestions[0].normalized_answer?.selected_option_ids) !== JSON.stringify(["YES"])
    ) {
      errors.push("승인된 묶음에는 YES로 정규화된 승인 답변 하나가 필요합니다.");
    }
  }
  return errors;
}

function assertProjectRelative(root, path) {
  const absolute = resolve(root, path);
  const relativePath = relative(root, absolute);
  if (relativePath.startsWith(`..${sep}`) || relativePath === ".." || relativePath.startsWith(sep)) {
    throw new Error(`프로젝트 밖 경로는 참조할 수 없습니다: ${path}`);
  }
  return absolute;
}

async function listJsonFiles(directory) {
  const result = [];
  async function visit(current) {
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch (error) {
      if (error.code === "ENOENT") return;
      throw error;
    }
    for (const entry of entries) {
      const path = resolve(current, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile() && entry.name.endsWith(".json")) result.push(path);
    }
  }
  await visit(directory);
  return result.sort();
}

async function loadImportedContracts(root, bundle) {
  const errors = [];
  const contracts = new Map();
  for (const item of bundle.imports ?? []) {
    try {
      const path = assertProjectRelative(root, item.bundle_path);
      const imported = JSON.parse(await readFile(path, "utf8"));
      if (imported.bundle_status !== "approved") errors.push(`${item.contract_id}: 승인되지 않은 묶음에서 가져올 수 없습니다.`);
      if (imported.bundle_id !== item.bundle_id || imported.bundle_revision !== item.bundle_revision) {
        errors.push(`${item.contract_id}: 가져온 묶음 ID 또는 리비전이 다릅니다.`);
      }
      if (canonicalSha256(imported) !== item.canonical_sha256) {
        errors.push(`${item.contract_id}: 가져온 묶음 해시가 다릅니다.`);
      }
      const contract = imported.contracts?.find((candidate) => candidate.id === item.contract_id);
      if (!contract || contract.status !== "ratified") errors.push(`${item.contract_id}: 확정 계약을 찾을 수 없습니다.`);
      else contracts.set(contract.id, contract);
    } catch (error) {
      errors.push(`${item.contract_id}: ${error.message}`);
    }
  }
  return { errors, contracts };
}

export function validateBaseBundleReference(reference, baseBundle) {
  const errors = [];
  if (baseBundle?.bundle_status !== "approved") {
    errors.push("승인되지 않은 기준 묶음은 상속할 수 없습니다.");
  }
  if (
    baseBundle?.bundle_id !== reference?.bundle_id ||
    baseBundle?.bundle_revision !== reference?.bundle_revision
  ) {
    errors.push("기준 묶음 ID 또는 리비전이 고정 참조와 다릅니다.");
  }
  if (baseBundle && canonicalSha256(baseBundle) !== reference?.canonical_sha256) {
    errors.push("기준 묶음 해시가 고정 참조와 다릅니다.");
  }
  const nonRatified = (baseBundle?.contracts ?? []).filter(
    (contract) => contract.status !== "ratified",
  );
  if (nonRatified.length > 0) {
    errors.push(`기준 묶음에 미확정 계약이 있습니다: ${nonRatified.map((item) => item.id).join(", ")}`);
  }
  return errors;
}

function mergeContracts(target, source, label, errors) {
  for (const [id, contract] of source) {
    if (target.has(id)) errors.push(`${label}: 계약 ID가 중복됐습니다: ${id}`);
    else target.set(id, contract);
  }
}

async function loadInheritedContracts(root, bundle, seenPaths = new Set()) {
  if (bundle.schema_version === "0.1.0") return loadImportedContracts(root, bundle);
  const errors = [];
  const contracts = new Map();
  const reference = bundle.base_bundle_ref;
  if (!reference) return { errors: ["0.2.0 묶음에 base_bundle_ref가 없습니다."], contracts };

  try {
    const path = assertProjectRelative(root, reference.bundle_path);
    if (seenPaths.has(path)) {
      return { errors: [`기준 묶음 참조에 순환이 있습니다: ${reference.bundle_path}`], contracts };
    }
    const nextSeenPaths = new Set(seenPaths);
    nextSeenPaths.add(path);
    const baseBundle = JSON.parse(await readFile(path, "utf8"));
    errors.push(
      ...validateBundleStructure(baseBundle).map((error) => `기준 묶음 구조: ${error}`),
    );
    errors.push(...validateBaseBundleReference(reference, baseBundle));

    const inherited = await loadInheritedContracts(root, baseBundle, nextSeenPaths);
    errors.push(...inherited.errors);
    mergeContracts(contracts, inherited.contracts, reference.bundle_path, errors);
    mergeContracts(
      contracts,
      new Map((baseBundle.contracts ?? []).map((contract) => [contract.id, contract])),
      reference.bundle_path,
      errors,
    );
  } catch (error) {
    errors.push(`${reference.bundle_path}: ${error.message}`);
  }
  return { errors, contracts };
}

export async function validateContractBundleRepository(root = repositoryRoot) {
  const errors = [];
  const warnings = [];
  const paths = await listJsonFiles(resolve(root, "contracts/bundles"));
  if (paths.length === 0) return { errors, warnings };
  for (const path of paths) {
    const label = relative(root, path).replaceAll("\\", "/");
    try {
      const bundle = JSON.parse(await readFile(path, "utf8"));
      const solutionPath = assertProjectRelative(root, bundle.solution_ref?.path);
      const solution = JSON.parse(await readFile(solutionPath, "utf8"));
      const flowPath = assertProjectRelative(
        root,
        `product-specs/flows/${solution.flowRef.id}/R${solution.flowRef.revision}.json`,
      );
      const flow = JSON.parse(await readFile(flowPath, "utf8"));
      const imported = await loadInheritedContracts(root, bundle, new Set([path]));
      errors.push(...imported.errors.map((error) => `${label}: ${error}`));
      const documentErrors = validateContractBundleDocument(bundle, solution, {
        flow,
        importedContracts: imported.contracts,
      });
      errors.push(...documentErrors.map((error) => `${label}: ${error}`));
    } catch (error) {
      errors.push(`${label}: ${error.message}`);
    }
  }
  return { errors, warnings };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const { errors, warnings } = await validateContractBundleRepository();
  for (const warning of warnings) console.warn(`WARN ${warning}`);
  if (errors.length > 0) {
    for (const error of errors) console.error(`ERROR ${error}`);
    process.exitCode = 1;
  } else {
    console.log(`실행 계약 묶음 검증 통과: 오류 0, 경고 ${warnings.length}`);
  }
}
