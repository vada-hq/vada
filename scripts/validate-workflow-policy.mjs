import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import Ajv2020 from "ajv/dist/2020.js";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const schema = JSON.parse(
  await readFile(resolve(repositoryRoot, ".vada/workflow-policy.schema.json"), "utf8"),
);
const ajv = new Ajv2020({ allErrors: true, strict: true });
ajv.addFormat("date-time", {
  type: "string",
  validate: (value) => !Number.isNaN(Date.parse(value)),
});
const validateSchema = ajv.compile(schema);

const highAssuranceTriggers = new Set([
  "product_policy",
  "authorization",
  "tenant_isolation",
  "financial_atomicity",
  "database_migration",
  "breaking_contract",
  "workflow_governance",
  "external_deployment",
  "destructive_operation",
]);

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

export function validateWorkflowPolicyDocument(policy) {
  const errors = [];
  if (!validateSchema(policy)) {
    errors.push(...(validateSchema.errors ?? []).map(formatSchemaError));
    return errors;
  }

  const people = new Map(policy.people.map((person) => [person.id, person]));
  for (const id of duplicates(policy.people.map((person) => person.id))) {
    errors.push(`사람 ID가 중복됐습니다: ${id}`);
  }
  for (const [responsibility, personId] of Object.entries(policy.responsibility_defaults)) {
    if (!people.has(personId)) {
      errors.push(`${responsibility}: 등록되지 않은 사람 ${personId}을 참조합니다.`);
    }
  }

  const routes = new Map();
  for (const route of policy.risk_routes) {
    if (routes.has(route.trigger)) errors.push(`위험 경로가 중복됐습니다: ${route.trigger}`);
    routes.set(route.trigger, route.assurance_profile);
  }
  for (const trigger of highAssuranceTriggers) {
    if (routes.get(trigger) !== "high_assurance") {
      errors.push(`${trigger} 변경은 high_assurance 보증 등급을 사용해야 합니다.`);
    }
  }

  const mechanical = policy.assurance_profiles.mechanical;
  const standard = policy.assurance_profiles.standard;
  const high = policy.assurance_profiles.high_assurance;
  if (!mechanical.coordinator_review_required || !mechanical.required_checks.includes("scoped")) {
    errors.push("mechanical 변경도 총괄 검토와 범위 검사를 생략할 수 없습니다.");
  }
  if (!standard.separate_verifier_required || !standard.coordinator_review_required) {
    errors.push("standard 변경에는 분리 검증자와 총괄 검토가 필요합니다.");
  }
  if (
    !high.separate_verifier_required ||
    !high.human_approval_required ||
    !high.coordinator_review_required ||
    !high.required_checks.includes("full_integration")
  ) {
    errors.push("high_assurance 변경에는 사람 승인·분리 검증·총괄 검토·전체 통합 검사가 필요합니다.");
  }
  return errors;
}

export async function validateWorkflowPolicyRepository(root = repositoryRoot) {
  const path = resolve(root, ".vada/workflow-policy.json");
  const policy = JSON.parse(await readFile(path, "utf8"));
  return validateWorkflowPolicyDocument(policy);
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const errors = await validateWorkflowPolicyRepository();
  if (errors.length > 0) {
    for (const error of errors) console.error(`ERROR ${error}`);
    process.exitCode = 1;
  } else {
    console.log("워크플로 정책 검증 통과");
  }
}
