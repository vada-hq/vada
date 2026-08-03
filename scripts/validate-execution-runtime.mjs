import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import Ajv2020 from "ajv/dist/2020.js";

import { validateExecutionPlan } from "./validate-execution-plan.mjs";

const defaultRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const schemaPath = resolve(defaultRoot, "delivery-units/schemas/execution-runtime.schema.json");
const schema = JSON.parse(await readFile(schemaPath, "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true });
ajv.addFormat("date-time", {
  type: "string",
  validate: (value) => !Number.isNaN(Date.parse(value)),
});
const validateSchema = ajv.compile(schema);

const allowedTransitions = new Map([
  ["not_started", new Set(["in_progress", "paused"])],
  ["in_progress", new Set(["review", "paused"])],
  ["review", new Set(["done", "in_progress", "paused"])],
  ["paused", new Set(["not_started", "in_progress", "review"])],
  ["done", new Set(["in_progress"])],
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

function duplicates(values) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts].filter(([, count]) => count > 1).map(([value]) => value);
}

function formatSchemaError(error) {
  const location = error.instancePath || "/";
  if (error.keyword === "additionalProperties") {
    return `${location}: 허용되지 않는 필드 ${error.params.additionalProperty}`;
  }
  if (error.keyword === "required") return `${location}: 필수 필드 ${error.params.missingProperty}가 없습니다.`;
  return `${location}: ${error.message}`;
}

function parseTime(value) {
  return typeof value === "string" ? Date.parse(value) : Number.NaN;
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

function checkSourceRef(ref, sourceIds, location, errors) {
  if (!sourceIds.has(ref)) errors.push(`${location}: 존재하지 않는 실행 근거 ${ref}`);
}

function validateTransitionLog(run, index, sourceIds, executors, globalIds, errors) {
  const location = `/work_runs/${index}`;
  const transitions = run.transition_log ?? [];
  let previousStatus = null;
  let previousTime = Number.NEGATIVE_INFINITY;
  let firstStartedAt = null;

  for (const [transitionIndex, transition] of transitions.entries()) {
    const transitionLocation = `${location}/transition_log/${transitionIndex}`;
    globalIds.push(transition.id);
    if (transitionIndex === 0) {
      if (transition.from !== null || transition.to !== "not_started") {
        errors.push(`${transitionLocation}: 첫 상태 전이는 null -> not_started여야 합니다.`);
      }
    } else {
      if (transition.from !== previousStatus) errors.push(`${transitionLocation}: 상태 전이 연결이 이전 상태와 다릅니다.`);
      if (!allowedTransitions.get(transition.from)?.has(transition.to)) {
        errors.push(`${transitionLocation}: 허용되지 않은 상태 전이 ${transition.from} -> ${transition.to}`);
      }
    }
    const occurredAt = parseTime(transition.occurred_at);
    if (occurredAt < previousTime) errors.push(`${transitionLocation}: 상태 전이 시각은 과거로 되돌아갈 수 없습니다.`);
    if (transition.to === "in_progress" && firstStartedAt === null) firstStartedAt = transition.occurred_at;
    if (!executors.has(transition.actor_ref)) errors.push(`${transitionLocation}: 존재하지 않는 실행 주체 ${transition.actor_ref}`);
    checkSourceRef(transition.source_ref, sourceIds, transitionLocation, errors);
    if (transition.to === "done" && !(executors.get(transition.actor_ref)?.execution_roles ?? []).includes("verifier")) {
      errors.push(`${transitionLocation}: 완료 전이는 독립 검증자가 기록해야 합니다.`);
    }
    previousStatus = transition.to;
    previousTime = Number.isNaN(occurredAt) ? previousTime : occurredAt;
  }

  if (run.status !== previousStatus) errors.push(`${location}: 현재 상태는 마지막 상태 전이와 같아야 합니다.`);
  if (run.started_at !== firstStartedAt) errors.push(`${location}: 시작 시각은 첫 in_progress 전이와 같아야 합니다.`);
  const expectedCompletedAt = run.status === "done" ? transitions.at(-1)?.occurred_at ?? null : null;
  if (run.completed_at !== expectedCompletedAt) errors.push(`${location}: 완료 시각은 마지막 done 전이와 같아야 합니다.`);
}

function validateEvidence(run, work, index, executors, globalProofIds, errors) {
  const location = `/work_runs/${index}`;
  const requirements = new Map((work?.completion_evidence ?? []).map((item) => [item.id, item]));
  const verified = new Set();
  for (const [evidenceIndex, evidence] of (run.evidence_instances ?? []).entries()) {
    const evidenceLocation = `${location}/evidence_instances/${evidenceIndex}`;
    globalProofIds.push(evidence.id);
    const requirement = requirements.get(evidence.requirement_ref);
    if (!requirement) errors.push(`${evidenceLocation}: 존재하지 않는 완료 증거 요구 ${evidence.requirement_ref}`);
    else if (requirement.kind !== evidence.kind) errors.push(`${evidenceLocation}: 완료 증거 종류가 요구와 다릅니다.`);

    const verifier = executors.get(evidence.verified_by);
    if (evidence.verification_status === "submitted") {
      if (evidence.verified_by !== null || evidence.verified_at !== null || evidence.verification_note_ko !== null) {
        errors.push(`${evidenceLocation}: 제출된 증거에는 검증 결과를 미리 기록할 수 없습니다.`);
      }
    } else {
      if (!(verifier?.execution_roles ?? []).includes("verifier") || evidence.verified_at === null) {
        errors.push(`${evidenceLocation}: 검증·거절은 독립 검증자와 검증 시각이 필요합니다.`);
      }
      if (evidence.verification_status === "rejected" && !evidence.verification_note_ko) {
        errors.push(`${evidenceLocation}: 거절된 증거에는 사유가 필요합니다.`);
      }
      if (evidence.verification_status === "verified") verified.add(evidence.requirement_ref);
    }
  }
  if (run.status === "done" && (verified.size !== requirements.size || [...requirements.keys()].some((id) => !verified.has(id)))) {
    errors.push(`${location}: done 상태에는 모든 완료 증거 요구의 독립 검증이 필요합니다.`);
  }
}

export async function validateExecutionRuntime(runtime, { executionPlan, workPlan, artifactPath = null } = {}) {
  const errors = [];
  if (!validateSchema(runtime)) errors.push(...(validateSchema.errors ?? []).map(formatSchemaError));

  if (executionPlan?.execution_plan_status !== "approved" || !Number.isInteger(executionPlan?.execution_plan_revision)) {
    errors.push("승인된 실행 계획이 필요합니다.");
  }
  if (runtime.execution_plan_ref?.execution_plan_id !== executionPlan?.execution_plan_id || runtime.execution_plan_ref?.execution_plan_revision !== executionPlan?.execution_plan_revision) {
    errors.push("실행 계획 ID 또는 리비전이 승인본과 다릅니다.");
  }
  if (runtime.execution_plan_ref?.canonical_sha256 !== canonicalSha256(executionPlan)) {
    errors.push("실행 계획 해시가 승인본과 다릅니다.");
  }
  if (runtime.delivery_unit_id !== executionPlan?.delivery_unit_id) errors.push("전달 단위 ID가 실행 계획과 다릅니다.");
  if (workPlan?.plan_status !== "approved") errors.push("승인된 전달 작업 그래프가 필요합니다.");

  if (artifactPath) {
    const parts = resolve(artifactPath).split(/[\\/]+/);
    const deliveryIndex = parts.lastIndexOf("delivery-units");
    const directoryUnit = deliveryIndex >= 0 ? parts[deliveryIndex + 1] : null;
    if (directoryUnit && directoryUnit !== runtime.delivery_unit_id) errors.push("실행 런타임의 전달 단위 ID가 저장 경로와 다릅니다.");
  }

  const sources = runtime.sources ?? [];
  const sourceIds = new Set(sources.map((item) => item.id));
  const sourceById = new Map(sources.map((item) => [item.id, item]));
  for (const id of duplicates(sources.map((item) => item.id))) errors.push(`실행 근거 ID가 중복됐습니다: ${id}`);
  const executors = new Map((executionPlan?.executors ?? []).map((item) => [item.id, item]));
  const committed = new Map(
    (executionPlan?.work_allocations ?? [])
      .filter((item) => item.disposition === "committed")
      .map((item) => [item.work_item_ref, item]),
  );
  const workById = new Map((workPlan?.work_items ?? []).filter((item) => item.status === "ratified").map((item) => [item.id, item]));
  const runs = runtime.work_runs ?? [];
  const runRefs = runs.map((item) => item.work_item_ref);
  if (
    runRefs.length !== committed.size ||
    duplicates(runRefs).length ||
    [...committed.keys()].some((id) => !runRefs.includes(id)) ||
    runRefs.some((id) => !committed.has(id))
  ) {
    errors.push("실행 런타임은 committed 작업 전수를 정확히 한 번 추적해야 합니다.");
  }

  const runById = new Map(runs.map((run) => [run.work_item_ref, run]));
  const satisfied = new Set((executionPlan?.satisfied_prerequisites ?? []).map((item) => item.work_item_ref));
  const transitionIds = [];
  const blockerIds = [];
  const proofIds = [];
  let latestTime = Number.NEGATIVE_INFINITY;
  for (const [index, run] of runs.entries()) {
    const location = `/work_runs/${index}`;
    const allocation = committed.get(run.work_item_ref);
    if (run.executor_ref !== allocation?.primary_executor_ref) errors.push(`${location}: 실행자가 승인 배정과 다릅니다.`);
    if (!executors.has(run.executor_ref)) errors.push(`${location}: 존재하지 않는 실행자 ${run.executor_ref}`);
    validateTransitionLog(run, index, sourceIds, executors, transitionIds, errors);
    validateEvidence(run, workById.get(run.work_item_ref), index, executors, proofIds, errors);

    if (executors.get(run.executor_ref)?.kind === "human") {
      for (const transition of run.transition_log ?? []) {
        if (transition.to === "in_progress" && sourceById.get(transition.source_ref)?.type !== "handoff_acknowledgement") {
          errors.push(`${location}: 사람 실행자의 착수에는 실제 인계 확인 근거가 필요합니다.`);
        }
      }
    }

    for (const transition of run.transition_log ?? []) {
      const value = parseTime(transition.occurred_at);
      if (!Number.isNaN(value)) latestTime = Math.max(latestTime, value);
    }
    for (const [blockerIndex, blocker] of (run.blockers ?? []).entries()) {
      const blockerLocation = `${location}/blockers/${blockerIndex}`;
      blockerIds.push(blocker.id);
      checkSourceRef(blocker.source_ref, sourceIds, blockerLocation, errors);
      if (blocker.status === "open" && blocker.resolved_at !== null) errors.push(`${blockerLocation}: 열린 차단 사유에는 해결 시각을 둘 수 없습니다.`);
      if (blocker.status === "resolved" && blocker.resolved_at === null) errors.push(`${blockerLocation}: 해결된 차단 사유에는 해결 시각이 필요합니다.`);
    }

    if (["in_progress", "review", "done"].includes(run.status)) {
      const incomplete = (workById.get(run.work_item_ref)?.blocked_by ?? []).filter(
        (dependency) => !satisfied.has(dependency) && runById.get(dependency)?.status !== "done",
      );
      if (incomplete.length) errors.push(`${location}: 완료되지 않은 선행 작업에 막혀 착수할 수 없습니다: ${incomplete.join(", ")}`);
      if ((run.blockers ?? []).some((blocker) => blocker.status === "open")) {
        errors.push(`${location}: 열린 런타임 차단 사유가 있는 작업은 활성 상태일 수 없습니다.`);
      }
    }
  }

  for (const [label, ids] of [["상태 전이", transitionIds], ["차단 사유", blockerIds], ["증거 인스턴스", proofIds]]) {
    for (const id of duplicates(ids)) errors.push(`${label} ID가 중복됐습니다: ${id}`);
  }
  const expectedRuntimeStatus = runs.length && runs.every((run) => run.status === "done") ? "completed" : "active";
  if (runtime.runtime_status !== expectedRuntimeStatus) errors.push("런타임 전체 상태가 작업 상태와 다릅니다.");
  if (parseTime(runtime.updated_at) < latestTime) errors.push("런타임 갱신 시각은 마지막 상태 전이보다 빠를 수 없습니다.");
  return { errors: [...new Set(errors)], warnings: [] };
}

async function collectRuntimeFiles(root) {
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
      else if (entry.isFile() && entry.name.endsWith(".json") && path.includes(`${sep}execution-runtime${sep}`)) files.push(path);
    }
  }
  await visit(resolve(root, "delivery-units"));
  return files.sort();
}

export async function validateExecutionRuntimeRepository(root = defaultRoot) {
  const errors = [];
  const files = await collectRuntimeFiles(root);
  for (const path of files) {
    try {
      const runtime = JSON.parse(await readFile(path, "utf8"));
      const executionArtifact = await loadProjectJson(root, runtime.execution_plan_ref?.path, "실행 계획");
      const workArtifact = await loadProjectJson(root, executionArtifact.value.work_plan_ref?.path, "전달 작업 그래프");
      const planResult = await validateExecutionPlan(executionArtifact.value, {
        workPlan: workArtifact.value,
        artifactPath: executionArtifact.path,
      });
      for (const error of planResult) errors.push(`${relative(root, executionArtifact.path)}: ${error}`);
      const result = await validateExecutionRuntime(runtime, {
        executionPlan: executionArtifact.value,
        workPlan: workArtifact.value,
        artifactPath: path,
      });
      for (const error of result.errors) errors.push(`${relative(root, path)}: ${error}`);
    } catch (error) {
      errors.push(`${relative(root, path)}: ${error.message}`);
    }
  }
  return { errors, warnings: [], files };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await validateExecutionRuntimeRepository(defaultRoot);
  for (const warning of result.warnings) console.warn(`WARN ${warning}`);
  for (const error of result.errors) console.error(`ERROR ${error}`);
  if (result.errors.length) process.exitCode = 1;
  else console.log(`실행 런타임 검증 통과: ${result.files.length}개, 오류 0, 경고 0`);
}
