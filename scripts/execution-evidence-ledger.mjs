import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";

import { normalizeRelativePath } from "./execution-evidence.mjs";
import { validateExecutionPlan } from "./validate-execution-plan.mjs";
import { validateExecutionRuntime } from "./validate-execution-runtime.mjs";

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

function canonicalSha256(value) {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function repositoryPath(root, path) {
  return relative(root, path).split(sep).join("/");
}

async function loadReferencedJson(root, rawPath, label) {
  const normalized = normalizeRelativePath(rawPath, label);
  const path = resolve(root, normalized);
  const rel = relative(root, path);
  if (rel === ".." || rel.startsWith(`..${sep}`)) {
    throw new Error(`${label} 경로가 프로젝트 밖을 가리킵니다.`);
  }
  return {
    path,
    relativePath: repositoryPath(root, path),
    value: JSON.parse(await readFile(path, "utf8")),
  };
}

async function collectRuntimeFiles(root, deliveryUnitId) {
  const base = deliveryUnitId
    ? resolve(root, "delivery-units", deliveryUnitId, "execution-runtime")
    : resolve(root, "delivery-units");
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
      else if (
        entry.isFile() &&
        /^R[1-9][0-9]*\.json$/.test(entry.name) &&
        path.includes(`${sep}execution-runtime${sep}`)
      ) {
        files.push(path);
      }
    }
  }
  await visit(base);
  return files.sort();
}

function deliveryUnitFromPath(path, segment) {
  const pattern = new RegExp(`^delivery-units/([^/]+)/${segment}/`);
  return path.match(pattern)?.[1] ?? null;
}

function referenceErrors(
  runtime,
  executionPlan,
  workPlan,
  { requestedDeliveryUnitId, runtimePath, executionPlanPath, workPlanPath },
) {
  const errors = [];
  const executionRef = runtime.execution_plan_ref ?? {};
  if (
    executionRef.execution_plan_id !== executionPlan.execution_plan_id ||
    executionRef.execution_plan_revision !== executionPlan.execution_plan_revision
  ) {
    errors.push("런타임의 실행 계획 ID 또는 리비전이 고정 참조와 다릅니다.");
  }
  if (executionRef.canonical_sha256 !== canonicalSha256(executionPlan)) {
    errors.push("런타임이 고정한 실행 계획 해시가 실제 승인본과 다릅니다.");
  }
  if (executionPlan.execution_plan_status !== "approved") {
    errors.push("런타임 완료 증거는 승인된 실행 계획에서만 가져올 수 있습니다.");
  }

  const workRef = executionPlan.work_plan_ref ?? {};
  if (
    workRef.plan_id !== workPlan.plan_id ||
    workRef.plan_revision !== workPlan.plan_revision
  ) {
    errors.push("실행 계획의 작업 그래프 ID 또는 리비전이 고정 참조와 다릅니다.");
  }
  if (workRef.canonical_sha256 !== canonicalSha256(workPlan)) {
    errors.push("실행 계획이 고정한 작업 그래프 해시가 실제 승인본과 다릅니다.");
  }
  if (workPlan.plan_status !== "approved") {
    errors.push("완료 증거 원장은 승인된 작업 그래프만 사용할 수 있습니다.");
  }
  if (
    runtime.delivery_unit_id &&
    executionPlan.delivery_unit_id &&
    runtime.delivery_unit_id !== executionPlan.delivery_unit_id
  ) {
    errors.push("런타임과 실행 계획의 전달 단위가 다릅니다.");
  }
  const runtimeUnit = deliveryUnitFromPath(runtimePath, "execution-runtime");
  const executionUnit = deliveryUnitFromPath(executionPlanPath, "execution-plan");
  const workUnit = deliveryUnitFromPath(workPlanPath, "delivery-work");
  const expectedUnit = requestedDeliveryUnitId ?? runtimeUnit;
  for (const [label, unit] of [
    ["런타임 저장 경로", runtimeUnit],
    ["런타임 전달 단위", runtime.delivery_unit_id],
    ["실행 계획 저장 경로", executionUnit],
    ["실행 계획 전달 단위", executionPlan.delivery_unit_id],
    ["작업 그래프 저장 경로", workUnit],
  ]) {
    if (!unit || unit !== expectedUnit) {
      errors.push(`${label}가 요청한 전달 단위 ${expectedUnit}와 다릅니다.`);
    }
  }
  return errors;
}

export async function buildExecutionEvidenceLedger(root, { deliveryUnitId = null } = {}) {
  const byLocator = new Map();
  const completedWorkRefs = new Set();
  const latestCompletionByWork = new Map();
  const runtimeContexts = [];
  const errors = [];
  const files = await collectRuntimeFiles(root, deliveryUnitId);
  const runtimeArtifacts = [];

  for (const runtimePath of files) {
    const runtimeRelativePath = repositoryPath(root, runtimePath);
    try {
      runtimeArtifacts.push({
        runtimePath,
        runtimeRelativePath,
        runtime: JSON.parse(await readFile(runtimePath, "utf8")),
      });
    } catch (error) {
      errors.push(`${runtimeRelativePath}: ${error.message}`);
    }
  }
  runtimeArtifacts.sort((left, right) => {
    const leftOrder = [
      left.runtime.execution_plan_ref?.execution_plan_revision ?? 0,
      left.runtime.runtime_revision ?? 0,
    ];
    const rightOrder = [
      right.runtime.execution_plan_ref?.execution_plan_revision ?? 0,
      right.runtime.runtime_revision ?? 0,
    ];
    return (
      leftOrder[0] - rightOrder[0] ||
      leftOrder[1] - rightOrder[1] ||
      left.runtimeRelativePath.localeCompare(right.runtimeRelativePath)
    );
  });

  for (const { runtimePath, runtimeRelativePath, runtime } of runtimeArtifacts) {
    try {
      const executionArtifact = await loadReferencedJson(
        root,
        runtime.execution_plan_ref?.path,
        "실행 계획",
      );
      const workArtifact = await loadReferencedJson(
        root,
        executionArtifact.value.work_plan_ref?.path,
        "전달 작업 그래프",
      );
      const lineageErrors = referenceErrors(
        runtime,
        executionArtifact.value,
        workArtifact.value,
        {
          requestedDeliveryUnitId: deliveryUnitId,
          runtimePath: runtimeRelativePath,
          executionPlanPath: executionArtifact.relativePath,
          workPlanPath: workArtifact.relativePath,
        },
      );
      if (lineageErrors.length) {
        errors.push(...lineageErrors.map((error) => `${runtimeRelativePath}: ${error}`));
        continue;
      }

      const planErrors = await validateExecutionPlan(executionArtifact.value, {
        workPlan: workArtifact.value,
        artifactPath: executionArtifact.path,
        evidenceLedger: byLocator,
      });
      const runtimeResult = await validateExecutionRuntime(runtime, {
        executionPlan: executionArtifact.value,
        workPlan: workArtifact.value,
        artifactPath: runtimePath,
      });
      if (planErrors.length || runtimeResult.errors.length) {
        errors.push(
          ...planErrors.map(
            (error) => `${executionArtifact.relativePath}: ${error}`,
          ),
          ...runtimeResult.errors.map((error) => `${runtimeRelativePath}: ${error}`),
        );
        continue;
      }

      const context = {
        runtimePath,
        runtimeRelativePath,
        runtime,
        executionPlanPath: executionArtifact.path,
        executionPlan: executionArtifact.value,
        workPlanPath: workArtifact.path,
        workPlan: workArtifact.value,
      };
      runtimeContexts.push(context);
      const workById = new Map(
        (workArtifact.value.work_items ?? []).map((work) => [work.id, work]),
      );
      const executors = new Map(
        (executionArtifact.value.executors ?? []).map((executor) => [executor.id, executor]),
      );

      for (const run of runtime.work_runs ?? []) {
        const work = workById.get(run.work_item_ref);
        if (!work) {
          errors.push(
            `${runtimeRelativePath}: 고정 작업 그래프에 없는 실행 작업 ${run.work_item_ref}`,
          );
          continue;
        }
        const requirements = new Map(
          (work.completion_evidence ?? []).map((evidence) => [evidence.id, evidence]),
        );
        const requiredRequirementRefs = [...requirements.keys()];
        const verifiedRequirementRefs = new Set(
          (run.evidence_instances ?? [])
            .filter((evidence) => {
              const requirement = requirements.get(evidence.requirement_ref);
              const verifier = executors.get(evidence.verified_by);
              return (
                evidence.verification_status === "verified" &&
                requirement?.kind === evidence.kind &&
                (verifier?.execution_roles ?? []).includes("verifier") &&
                typeof evidence.verified_at === "string" &&
                evidence.verified_at.length > 0
              );
            })
            .map((evidence) => evidence.requirement_ref),
        );
        const allRequirementsVerified =
          requiredRequirementRefs.length > 0 &&
          requiredRequirementRefs.every((requirement) =>
            verifiedRequirementRefs.has(requirement),
          );

        const previousCompletion = latestCompletionByWork.get(run.work_item_ref);
        const candidateOrder = [
          executionArtifact.value.execution_plan_revision ?? 0,
          runtime.runtime_revision ?? 0,
        ];
        if (
          !previousCompletion ||
          candidateOrder[0] > previousCompletion.order[0] ||
          (candidateOrder[0] === previousCompletion.order[0] &&
            candidateOrder[1] > previousCompletion.order[1])
        ) {
          latestCompletionByWork.set(run.work_item_ref, {
            order: candidateOrder,
            completed: run.status === "done" && allRequirementsVerified,
          });
        }
        for (const evidence of run.evidence_instances ?? []) {
          if (typeof evidence.id !== "string" || !evidence.id) continue;
          const locator = `${runtimeRelativePath}#${evidence.id}`;
          if (byLocator.has(locator)) {
            errors.push(`${runtimeRelativePath}: 완료 증거 locator가 중복됐습니다: ${locator}`);
            continue;
          }
          const requirement = requirements.get(evidence.requirement_ref);
          const verifier = executors.get(evidence.verified_by);
          byLocator.set(locator, {
            work_item_ref: run.work_item_ref,
            requirement_ref: evidence.requirement_ref,
            required_requirement_refs: requiredRequirementRefs,
            verification_status: evidence.verification_status,
            run_status: run.status,
            all_requirements_verified: allRequirementsVerified,
            evidence_kind_matches: requirement?.kind === evidence.kind,
            verifier_valid: (verifier?.execution_roles ?? []).includes("verifier"),
            verification_time_present:
              typeof evidence.verified_at === "string" && evidence.verified_at.length > 0,
            runtime_path: runtimeRelativePath,
            execution_plan_id: executionArtifact.value.execution_plan_id,
            execution_plan_revision: executionArtifact.value.execution_plan_revision,
            work_plan_id: workArtifact.value.plan_id,
            work_plan_revision: workArtifact.value.plan_revision,
            work_plan_path: workArtifact.relativePath,
            work_plan_sha256: canonicalSha256(workArtifact.value),
          });
        }
      }
    } catch (error) {
      errors.push(`${runtimeRelativePath}: ${error.message}`);
    }
  }

  for (const [workId, state] of latestCompletionByWork) {
    if (state.completed) completedWorkRefs.add(workId);
  }

  return { byLocator, completedWorkRefs, runtimeContexts, errors, files };
}
