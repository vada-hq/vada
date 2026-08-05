import { readFile, rename, unlink, writeFile } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";

import {
  canonicalSha256,
  validateExecutionRuntime,
} from "./validate-execution-runtime.mjs";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));

function assertObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label}은 객체여야 합니다.`);
}

function assertOnlyKeys(value, allowed, label) {
  assertObject(value, label);
  const unknown = Object.keys(value).filter((key) => !allowed.has(key));
  if (unknown.length) throw new Error(`${label}에 자동 생성 필드 또는 알 수 없는 필드를 넣을 수 없습니다: ${unknown.join(", ")}`);
}

function requireText(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label}은 비어 있지 않은 문자열이어야 합니다.`);
}

function nextId(prefix, ids) {
  const pattern = new RegExp(`^${prefix}-(\\d+)$`);
  const max = ids.reduce((current, id) => {
    const match = pattern.exec(id);
    return match ? Math.max(current, Number(match[1])) : current;
  }, 0);
  return `${prefix}-${String(max + 1).padStart(3, "0")}`;
}

function allTransitionIds(runtime) {
  return runtime.work_runs.flatMap((run) => run.transition_log.map((transition) => transition.id));
}

function allProofIds(runtime) {
  return runtime.work_runs.flatMap((run) => run.evidence_instances.map((evidence) => evidence.id));
}

function operationWorkRef(operation) {
  return operation.transition?.work_item_ref ?? operation.work_item_ref ?? null;
}

export function initializeExecutionRuntime(
  executionPlan,
  { planPath, now = new Date().toISOString() } = {},
) {
  assertObject(executionPlan, "실행 계획");
  requireText(planPath, "실행 계획 경로");
  if (executionPlan.execution_plan_status !== "approved") {
    throw new Error("승인된 실행 계획만 런타임으로 초기화할 수 있습니다.");
  }
  if (!Number.isInteger(executionPlan.execution_plan_revision)) {
    throw new Error("실행 계획 리비전이 올바르지 않습니다.");
  }
  if (Number.isNaN(Date.parse(now))) throw new Error("자동 기록 시각이 올바르지 않습니다.");

  const committed = (executionPlan.work_allocations ?? []).filter(
    (allocation) => allocation.disposition === "committed",
  );
  if (committed.length === 0) throw new Error("초기화할 커밋 작업이 없습니다.");
  for (const allocation of committed) {
    requireText(allocation.work_item_ref, "커밋 작업");
    requireText(allocation.primary_executor_ref, `${allocation.work_item_ref} 주 실행자`);
  }
  const coordinatorRef = executionPlan.orchestration?.coordinator_executor_ref;
  requireText(coordinatorRef, "실행 총괄");

  const sourceId = "SRC-RUN-001";
  const planRevision = executionPlan.execution_plan_revision;
  return {
    schema_version: "0.1.0",
    runtime_id: `RUN-${executionPlan.delivery_unit_id}-EP-R${planRevision}`,
    runtime_revision: 1,
    runtime_status: "active",
    updated_at: now,
    delivery_unit_id: executionPlan.delivery_unit_id,
    execution_plan_ref: {
      path: planPath.replaceAll("\\", "/"),
      execution_plan_id: executionPlan.execution_plan_id,
      execution_plan_revision: planRevision,
      canonical_sha256: canonicalSha256(executionPlan),
    },
    sources: [
      {
        id: sourceId,
        type: "approved_artifact",
        captured_at: now,
        locator: `${planPath.replaceAll("\\", "/")}#${executionPlan.execution_plan_id}@R${planRevision}`,
        content_ko: `승인된 실행 계획 R${planRevision}의 커밋 작업을 실행 추적 대상으로 등록했습니다.`,
      },
    ],
    work_runs: committed.map((allocation, index) => ({
      work_item_ref: allocation.work_item_ref,
      executor_ref: allocation.primary_executor_ref,
      status: "not_started",
      started_at: null,
      completed_at: null,
      transition_log: [
        {
          id: `TR-${String(index + 1).padStart(3, "0")}`,
          from: null,
          to: "not_started",
          occurred_at: now,
          actor_ref: coordinatorRef,
          source_ref: sourceId,
          note_ko: `승인된 R${planRevision}에서 ${allocation.work_item_ref} 작업을 실행 추적 대상으로 등록했습니다.`,
        },
      ],
      blockers: [],
      evidence_instances: [],
    })),
  };
}

export function applyRuntimeOperation(runtime, operation, { now = new Date().toISOString() } = {}) {
  assertObject(runtime, "실행 런타임");
  assertOnlyKeys(operation, new Set(["source", "work_item_ref", "transition", "evidence"]), "실행 갱신");
  assertOnlyKeys(operation.source, new Set(["type", "locator", "content_ko"]), "실행 근거");
  requireText(operation.source.type, "실행 근거 유형");
  requireText(operation.source.locator, "실행 근거 위치");
  requireText(operation.source.content_ko, "실행 근거 설명");
  if (Number.isNaN(Date.parse(now))) throw new Error("자동 기록 시각이 올바르지 않습니다.");

  if (operation.transition) {
    assertOnlyKeys(
      operation.transition,
      new Set(["work_item_ref", "to", "actor_ref", "note_ko"]),
      "상태 전이",
    );
    requireText(operation.transition.work_item_ref, "상태 전이 작업");
    requireText(operation.transition.to, "다음 상태");
    requireText(operation.transition.actor_ref, "상태 전이 주체");
    requireText(operation.transition.note_ko, "상태 전이 설명");
  }

  if (operation.work_item_ref !== undefined) requireText(operation.work_item_ref, "증거 대상 작업");
  if (
    operation.work_item_ref !== undefined &&
    operation.transition?.work_item_ref !== undefined &&
    operation.work_item_ref !== operation.transition.work_item_ref
  ) {
    throw new Error("증거 대상 작업과 상태 전이 대상 작업은 같아야 합니다.");
  }
  if (operation.evidence !== undefined && (!Array.isArray(operation.evidence) || operation.evidence.length === 0)) {
    throw new Error("완료 증거는 하나 이상의 배열이어야 합니다.");
  }

  const updated = structuredClone(runtime);
  const sourceId = nextId("SRC-RUN", updated.sources.map((source) => source.id));
  updated.sources.push({
    id: sourceId,
    type: operation.source.type,
    captured_at: now,
    locator: operation.source.locator,
    content_ko: operation.source.content_ko,
  });

  const workRef = operationWorkRef(operation);
  const run = workRef ? updated.work_runs.find((candidate) => candidate.work_item_ref === workRef) : null;
  if ((operation.transition || operation.evidence) && !run) throw new Error(`실행 런타임에 작업이 없습니다: ${workRef}`);

  if (operation.evidence) {
    const proofIds = allProofIds(updated);
    for (const [index, evidence] of operation.evidence.entries()) {
      assertOnlyKeys(
        evidence,
        new Set([
          "requirement_ref",
          "kind",
          "locator",
          "verification_status",
          "verified_by",
          "verification_note_ko",
        ]),
        `완료 증거 ${index + 1}`,
      );
      requireText(evidence.requirement_ref, "완료 증거 요구 ID");
      requireText(evidence.kind, "완료 증거 종류");
      requireText(evidence.locator, "완료 증거 위치");
      requireText(evidence.verification_status, "완료 증거 검증 상태");
      const submitted = evidence.verification_status === "submitted";
      if (submitted && (evidence.verified_by != null || evidence.verification_note_ko != null)) {
        throw new Error("미검증 증거에는 검증자나 검증 설명을 넣을 수 없습니다.");
      }
      if (!submitted) requireText(evidence.verified_by, "완료 증거 검증자");
      if (evidence.verification_note_ko !== null && evidence.verification_note_ko !== undefined) {
        requireText(evidence.verification_note_ko, "완료 증거 검증 설명");
      }
      const proofId = nextId("PROOF", proofIds);
      proofIds.push(proofId);
      run.evidence_instances.push({
        id: proofId,
        requirement_ref: evidence.requirement_ref,
        kind: evidence.kind,
        locator: evidence.locator,
        captured_at: now,
        verification_status: evidence.verification_status,
        verified_by: submitted ? null : evidence.verified_by,
        verified_at: submitted ? null : now,
        verification_note_ko: submitted ? null : (evidence.verification_note_ko ?? null),
      });
    }
  }

  if (operation.transition) {
    const transitionId = nextId("TR", allTransitionIds(updated));
    run.transition_log.push({
      id: transitionId,
      from: run.status,
      to: operation.transition.to,
      occurred_at: now,
      actor_ref: operation.transition.actor_ref,
      source_ref: sourceId,
      note_ko: operation.transition.note_ko,
    });
    run.status = operation.transition.to;
    if (operation.transition.to === "in_progress" && run.started_at === null) run.started_at = now;
    run.completed_at = operation.transition.to === "done" ? now : null;
  }

  updated.runtime_revision += 1;
  updated.updated_at = now;
  updated.runtime_status = updated.work_runs.every((candidate) => candidate.status === "done") ? "completed" : "active";
  return updated;
}

function projectPath(rawPath, label) {
  if (typeof rawPath !== "string" || !rawPath || isAbsolute(rawPath)) {
    throw new Error(`${label} 경로는 저장소 상대 경로여야 합니다.`);
  }
  const segments = rawPath.split(/[\\/]+/);
  if (segments.includes("..")) throw new Error(`${label} 경로에 상위 이동을 사용할 수 없습니다.`);
  const path = resolve(repositoryRoot, rawPath);
  const rel = relative(repositoryRoot, path);
  if (rel === ".." || rel.startsWith(`..${sep}`)) throw new Error(`${label} 경로가 저장소 밖을 가리킵니다.`);
  return path;
}

async function readOperation(rawPath) {
  let text;
  if (rawPath === "-") {
    process.stdin.setEncoding("utf8");
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    text = chunks.join("");
  } else {
    text = await readFile(projectPath(rawPath, "갱신 입력"), "utf8");
  }
  return JSON.parse(text.replace(/^\uFEFF/, ""));
}

async function validateWithBaselines(runtime, runtimePath) {
  const executionPath = projectPath(runtime.execution_plan_ref.path, "실행 계획");
  const executionPlan = JSON.parse(await readFile(executionPath, "utf8"));
  const workPath = projectPath(executionPlan.work_plan_ref.path, "전달 작업 그래프");
  const workPlan = JSON.parse(await readFile(workPath, "utf8"));
  return validateExecutionRuntime(runtime, { executionPlan, workPlan, artifactPath: runtimePath });
}

async function main() {
  const { values } = parseArgs({
    options: {
      runtime: { type: "string" },
      plan: { type: "string" },
      initialize: { type: "boolean", default: false },
      operation: { type: "string", default: "-" },
      "dry-run": { type: "boolean", default: false },
    },
  });
  if (!values.runtime) throw new Error("--runtime 경로가 필요합니다.");
  const runtimePath = projectPath(values.runtime, "실행 런타임");

  if (values.initialize) {
    if (!values.plan) throw new Error("초기화에는 --plan 경로가 필요합니다.");
    const planPath = projectPath(values.plan, "실행 계획");
    const executionPlan = JSON.parse(await readFile(planPath, "utf8"));
    const workPath = projectPath(executionPlan.work_plan_ref.path, "전달 작업 그래프");
    const workPlan = JSON.parse(await readFile(workPath, "utf8"));
    try {
      await readFile(runtimePath, "utf8");
      throw new Error("초기화할 실행 런타임이 이미 존재합니다.");
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
    const initialized = initializeExecutionRuntime(executionPlan, {
      planPath: values.plan,
    });
    const validation = await validateExecutionRuntime(initialized, {
      executionPlan,
      workPlan,
      artifactPath: runtimePath,
    });
    if (validation.errors.length) {
      throw new Error(`초기 실행 런타임이 유효하지 않습니다:\n${validation.errors.join("\n")}`);
    }
    const rendered = `${JSON.stringify(initialized, null, 2)}\n`;
    if (values["dry-run"]) {
      process.stdout.write(rendered);
      return;
    }
    const temporaryPath = `${runtimePath}.${process.pid}.tmp`;
    try {
      await writeFile(temporaryPath, rendered, { encoding: "utf8", flag: "wx" });
      await rename(temporaryPath, runtimePath);
    } finally {
      await unlink(temporaryPath).catch((error) => {
        if (error?.code !== "ENOENT") throw error;
      });
    }
    console.log("실행 런타임 초기화 완료: revision 1");
    return;
  }

  const runtime = JSON.parse(await readFile(runtimePath, "utf8"));
  const before = await validateWithBaselines(runtime, runtimePath);
  if (before.errors.length) throw new Error(`기존 실행 런타임이 유효하지 않습니다:\n${before.errors.join("\n")}`);

  const operation = await readOperation(values.operation);
  const updated = applyRuntimeOperation(runtime, operation);
  const after = await validateWithBaselines(updated, runtimePath);
  if (after.errors.length) throw new Error(`갱신 결과가 유효하지 않습니다:\n${after.errors.join("\n")}`);

  const rendered = `${JSON.stringify(updated, null, 2)}\n`;
  if (values["dry-run"]) {
    process.stdout.write(rendered);
    return;
  }
  const temporaryPath = `${runtimePath}.${process.pid}.tmp`;
  try {
    await writeFile(temporaryPath, rendered, { encoding: "utf8", flag: "wx" });
    await rename(temporaryPath, runtimePath);
  } finally {
    await unlink(temporaryPath).catch((error) => {
      if (error?.code !== "ENOENT") throw error;
    });
  }
  console.log(`실행 런타임 갱신 완료: revision ${updated.runtime_revision}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
