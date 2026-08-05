import { readFile, readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { buildExecutionEvidenceLedger } from "./execution-evidence-ledger.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function runtimeOrder(runtime) {
  const planRevision = runtime.execution_plan_ref?.execution_plan_revision ?? 0;
  return [planRevision, runtime.runtime_revision ?? 0];
}

function isLaterRuntime(candidate, current) {
  if (!current) return true;
  const [candidatePlan, candidateRuntime] = runtimeOrder(candidate.runtime);
  const [currentPlan, currentRuntime] = runtimeOrder(current.runtime);
  return (
    candidatePlan > currentPlan ||
    (candidatePlan === currentPlan && candidateRuntime > currentRuntime)
  );
}

function workPlanReference(workPlan) {
  if (!workPlan?.plan_id || !Number.isInteger(workPlan?.plan_revision))
    return null;
  return `${workPlan.plan_id}@R${workPlan.plan_revision}`;
}

function compareWorkPlans(left, right) {
  return (
    String(left?.plan_id ?? "").localeCompare(String(right?.plan_id ?? "")) ||
    (left?.plan_revision ?? 0) - (right?.plan_revision ?? 0)
  );
}

function collectLatestRuns(runtimes, knownWorkIds, errors) {
  const latestByWork = new Map();
  const seenRuntimeOrders = new Set();
  const allowedStatuses = new Set([
    "not_started",
    "in_progress",
    "review",
    "done",
    "paused",
  ]);
  for (const runtime of runtimes ?? []) {
    for (const run of runtime.work_runs ?? []) {
      if (!knownWorkIds.has(run.work_item_ref)) {
        errors.push(
          `런타임이 존재하지 않는 작업을 참조합니다: ${run.work_item_ref}`,
        );
        continue;
      }
      if (!allowedStatuses.has(run.status)) {
        errors.push(
          `${run.work_item_ref}: 알 수 없는 실행 상태 ${run.status}입니다.`,
        );
        continue;
      }
      const [planRevision, runtimeRevision] = runtimeOrder(runtime);
      const orderKey = `${run.work_item_ref}|${planRevision}|${runtimeRevision}`;
      if (seenRuntimeOrders.has(orderKey)) {
        errors.push(
          `${run.work_item_ref}: 같은 실행 순서 ${planRevision}/${runtimeRevision}에 상태가 중복됐습니다.`,
        );
        continue;
      }
      seenRuntimeOrders.add(orderKey);
      const candidate = { runtime, run };
      if (isLaterRuntime(candidate, latestByWork.get(run.work_item_ref))) {
        latestByWork.set(run.work_item_ref, candidate);
      }
    }
  }
  return latestByWork;
}

function hasVerifiedCompletionEvidence(work, run) {
  const required = new Set(
    (work.completion_evidence ?? []).map((item) => item.id),
  );
  const verified = new Set(
    (run.evidence_instances ?? [])
      .filter((item) => item.verification_status === "verified")
      .map((item) => item.requirement_ref),
  );
  return required.size > 0 && [...required].every((id) => verified.has(id));
}

export function deriveDeliveryStatus(
  workPlan,
  runtimes = [],
  { satisfiedPrerequisiteRefs = [] } = {},
) {
  const errors = [];
  if (workPlan?.plan_status !== "approved") {
    errors.push("승인된 전달 작업 그래프가 필요합니다.");
  }

  const workItems = workPlan?.work_items ?? [];
  const workById = new Map();
  const importedWorkIds = new Set(
    (workPlan?.imports ?? []).flatMap((item) => item.work_item_ids ?? []),
  );
  for (const work of workItems) {
    if (workById.has(work.id))
      errors.push(`작업 ID가 중복됐습니다: ${work.id}`);
    workById.set(work.id, work);
  }
  for (const work of workItems) {
    for (const dependency of work.blocked_by ?? []) {
      if (!workById.has(dependency) && !importedWorkIds.has(dependency)) {
        errors.push(
          `${work.id}: 존재하지 않는 선행 작업 ${dependency}을 참조합니다.`,
        );
      }
    }
  }

  const completed = new Set(satisfiedPrerequisiteRefs);
  for (const reference of completed) {
    if (!workById.has(reference) && !importedWorkIds.has(reference)) {
      errors.push(`존재하지 않는 충족 선행 작업을 참조합니다: ${reference}`);
    }
  }

  const latestByWork = collectLatestRuns(
    runtimes,
    new Set(workById.keys()),
    errors,
  );

  for (const work of workItems) {
    const latest = latestByWork.get(work.id)?.run;
    if (latest?.status !== "done") continue;
    if (hasVerifiedCompletionEvidence(work, latest)) completed.add(work.id);
    else
      errors.push(`${work.id}: done 상태지만 검증된 완료 증거가 부족합니다.`);
  }

  const items = workItems.map((work) => {
    const latest = latestByWork.get(work.id);
    const missingDependencies = (work.blocked_by ?? []).filter(
      (id) => !completed.has(id),
    );
    let derivedStatus;
    if (completed.has(work.id)) derivedStatus = "done";
    else if (latest?.run.status === "done")
      derivedStatus = "evidence_incomplete";
    else if (["in_progress", "review", "paused"].includes(latest?.run.status)) {
      derivedStatus = latest.run.status;
    } else if (missingDependencies.length === 0) derivedStatus = "ready";
    else derivedStatus = "blocked";

    return {
      work_item_ref: work.id,
      owner_work_plan_ref: workPlanReference(workPlan),
      title_ko: work.title_ko,
      derived_status: derivedStatus,
      missing_dependency_refs: missingDependencies,
      latest_execution_plan_revision:
        latest?.runtime.execution_plan_ref?.execution_plan_revision ?? null,
      latest_runtime_revision: latest?.runtime.runtime_revision ?? null,
    };
  });

  const summary = {};
  for (const item of items) {
    summary[item.derived_status] = (summary[item.derived_status] ?? 0) + 1;
  }
  const planRef = workPlanReference(workPlan);
  return {
    scope_mode: "work_plan",
    delivery_unit_ref: workPlan?.delivery_unit_ref ?? null,
    work_plan_ref: planRef,
    work_plan_refs: planRef ? [planRef] : [],
    summary,
    items,
    errors,
  };
}

export function deriveActiveDeliveryStatus(workPlans, evidence = {}) {
  const errors = [...(evidence.errors ?? [])];
  const approvedPlans = (workPlans ?? [])
    .filter((plan) => plan?.plan_status === "approved")
    .sort(compareWorkPlans);
  if (approvedPlans.length === 0) {
    errors.push("승인된 전달 작업 그래프가 필요합니다.");
  }

  const allWorkById = new Map();
  const ownerById = new Map();
  const supersededBy = new Map();
  for (const plan of approvedPlans) {
    const ownerRef = workPlanReference(plan);
    for (const work of plan.work_items ?? []) {
      if (allWorkById.has(work.id)) {
        errors.push(
          `작업 ID가 여러 승인 작업 그래프에 중복됐습니다: ${work.id}`,
        );
        continue;
      }
      allWorkById.set(work.id, work);
      ownerById.set(work.id, ownerRef);
      if (work.supersedes) {
        const existing = supersededBy.get(work.supersedes);
        if (existing && existing !== work.id) {
          errors.push(
            `${work.supersedes}: 둘 이상의 작업이 같은 리비전을 대체합니다: ${existing}, ${work.id}`,
          );
        } else {
          supersededBy.set(work.supersedes, work.id);
        }
      }
    }
  }
  for (const [previous, successor] of supersededBy) {
    if (!allWorkById.has(previous)) {
      errors.push(
        `${successor}: 존재하지 않는 작업 리비전을 대체합니다: ${previous}`,
      );
    }
  }

  const activeWork = [...allWorkById.values()]
    .filter((work) => !supersededBy.has(work.id))
    .sort((left, right) => left.id.localeCompare(right.id));
  const activeByKey = new Map();
  for (const work of activeWork) {
    const key =
      work.key ?? work.id.replace(/^WORK:/, "").replace(/@R[1-9][0-9]*$/, "");
    const refs = activeByKey.get(key) ?? [];
    refs.push(work.id);
    activeByKey.set(key, refs);
  }
  for (const [key, refs] of activeByKey) {
    if (refs.length > 1) {
      errors.push(
        `미대체 활성 작업 키 ${key}가 중복됐습니다: ${refs.sort().join(", ")}`,
      );
    }
  }

  const completed = new Set(evidence.completedWorkRefs ?? []);
  for (const reference of completed) {
    if (!allWorkById.has(reference)) {
      errors.push(
        `완료 증거 원장이 존재하지 않는 작업을 참조합니다: ${reference}`,
      );
    }
  }
  const runtimes = (evidence.runtimeContexts ?? []).map(
    (context) => context.runtime,
  );
  const latestByWork = collectLatestRuns(
    runtimes,
    new Set(allWorkById.keys()),
    errors,
  );

  const items = activeWork.map((work) => {
    const latest = latestByWork.get(work.id);
    const dependencies = work.blocked_by ?? [];
    const unknownDependencies = dependencies.filter(
      (id) => !allWorkById.has(id),
    );
    for (const dependency of unknownDependencies) {
      errors.push(
        `${work.id}: 존재하지 않는 선행 작업 ${dependency}을 참조합니다.`,
      );
    }
    const supersededDependencies = dependencies
      .filter((id) => supersededBy.has(id))
      .sort();
    const missingDependencies = dependencies
      .filter((id) => !completed.has(id))
      .sort();
    const unfinished = !completed.has(work.id);
    if (unfinished && supersededDependencies.length > 0) {
      errors.push(
        `definition_review_required: ${work.id}이 대체된 선행 작업을 참조합니다: ${supersededDependencies.join(", ")}. 자동 리비전 치환 없이 작업 정의 검토가 필요합니다.`,
      );
    }

    let derivedStatus;
    if (!unfinished) derivedStatus = "done";
    else if (supersededDependencies.length > 0) {
      derivedStatus = "definition_review_required";
    } else if (latest?.run.status === "done")
      derivedStatus = "evidence_incomplete";
    else if (["in_progress", "review", "paused"].includes(latest?.run.status)) {
      derivedStatus = latest.run.status;
    } else if (missingDependencies.length === 0) derivedStatus = "ready";
    else derivedStatus = "blocked";

    return {
      work_item_ref: work.id,
      owner_work_plan_ref: ownerById.get(work.id) ?? null,
      title_ko: work.title_ko,
      derived_status: derivedStatus,
      missing_dependency_refs: missingDependencies,
      superseded_dependency_refs: supersededDependencies,
      latest_execution_plan_revision:
        latest?.runtime.execution_plan_ref?.execution_plan_revision ?? null,
      latest_runtime_revision: latest?.runtime.runtime_revision ?? null,
    };
  });

  const summary = {};
  for (const item of items) {
    summary[item.derived_status] = (summary[item.derived_status] ?? 0) + 1;
  }
  const deliveryUnitRefs = [
    ...new Set(
      approvedPlans.map((plan) => plan.delivery_unit_ref).filter(Boolean),
    ),
  ].sort();
  if (deliveryUnitRefs.length > 1) {
    errors.push(
      `승인 작업 그래프의 전달 단위 참조가 다릅니다: ${deliveryUnitRefs.join(", ")}`,
    );
  }

  return {
    scope_mode: "active_overlay",
    delivery_unit_ref: deliveryUnitRefs[0] ?? null,
    work_plan_ref: null,
    work_plan_refs: approvedPlans.map(workPlanReference),
    summary,
    items,
    errors: [...new Set(errors)].sort(),
  };
}

function parseArguments(argv) {
  const workPlanIndex = argv.indexOf("--work-plan");
  const workPlanValue = workPlanIndex >= 0 ? argv[workPlanIndex + 1] : null;
  const workPlanMatch = workPlanValue?.match(/^R([1-9][0-9]*)$/);
  if (workPlanIndex >= 0 && !workPlanMatch) {
    throw new Error("--work-plan R2 형식의 작업 그래프 리비전이 필요합니다.");
  }
  const workPlanRevision = workPlanMatch ? Number(workPlanMatch[1]) : null;
  if (argv.includes("--all")) {
    if (workPlanRevision !== null) {
      throw new Error("--all과 --work-plan은 함께 사용할 수 없습니다.");
    }
    return {
      deliveryUnitId: null,
      all: true,
      quiet: argv.includes("--quiet"),
      workPlanRevision: null,
    };
  }
  const duIndex = argv.indexOf("--du");
  const deliveryUnitId = duIndex >= 0 ? argv[duIndex + 1] : null;
  if (!/^DU-[0-9]{3,}$/.test(deliveryUnitId ?? "")) {
    throw new Error("--du DU-001 형식의 전달 단위 ID가 필요합니다.");
  }
  return {
    deliveryUnitId,
    all: false,
    quiet: argv.includes("--quiet"),
    workPlanRevision,
  };
}

async function readJsonFiles(directory) {
  const names = (await readdir(directory))
    .filter((name) => /^R[1-9][0-9]*\.json$/.test(name))
    .sort(
      (left, right) => Number(left.slice(1, -5)) - Number(right.slice(1, -5)),
    );
  return Promise.all(
    names.map(async (name) =>
      JSON.parse(await readFile(resolve(directory, name), "utf8")),
    ),
  );
}

export async function deriveDeliveryStatusRepository(
  deliveryUnitId,
  root = repositoryRoot,
  { workPlanRevision = null } = {},
) {
  const directory = resolve(root, "delivery-units", deliveryUnitId);
  const workPlans = await readJsonFiles(resolve(directory, "delivery-work"));
  const approvedPlans = workPlans
    .filter((plan) => plan.plan_status === "approved")
    .sort(compareWorkPlans);
  if (approvedPlans.length === 0) {
    const error = new Error(
      `${deliveryUnitId}: 승인된 전달 작업 그래프가 없습니다.`,
    );
    error.code = "NO_APPROVED_WORK_PLAN";
    throw error;
  }
  const evidence = await buildExecutionEvidenceLedger(root, { deliveryUnitId });
  if (workPlanRevision === null) {
    return deriveActiveDeliveryStatus(approvedPlans, evidence);
  }
  const selectedWorkPlan = approvedPlans.find(
    (plan) => plan.plan_revision === workPlanRevision,
  );
  if (!selectedWorkPlan) {
    const error = new Error(
      `${deliveryUnitId}: 승인된 전달 작업 그래프 R${workPlanRevision}가 없습니다.`,
    );
    error.code = "NO_APPROVED_WORK_PLAN";
    throw error;
  }
  const runtimes = evidence.runtimeContexts
    .filter(
      (context) =>
        context.workPlan.plan_id === selectedWorkPlan.plan_id &&
        context.workPlan.plan_revision === selectedWorkPlan.plan_revision,
    )
    .map((context) => context.runtime);
  const imported = new Set(
    (selectedWorkPlan.imports ?? []).flatMap(
      (item) => item.work_item_ids ?? [],
    ),
  );
  const satisfiedPrerequisiteRefs = [...evidence.completedWorkRefs].filter(
    (workId) => imported.has(workId),
  );
  const result = deriveDeliveryStatus(selectedWorkPlan, runtimes, {
    satisfiedPrerequisiteRefs,
  });
  result.errors = [...new Set([...evidence.errors, ...result.errors])];
  return result;
}

export async function deriveAllDeliveryStatuses(root = repositoryRoot) {
  const entries = await readdir(resolve(root, "delivery-units"), {
    withFileTypes: true,
  });
  const deliveryUnitIds = entries
    .filter((entry) => entry.isDirectory() && /^DU-[0-9]{3,}$/.test(entry.name))
    .map((entry) => entry.name)
    .sort();
  const units = [];
  const errors = [];
  const skipped = [];
  for (const deliveryUnitId of deliveryUnitIds) {
    try {
      const result = await deriveDeliveryStatusRepository(deliveryUnitId, root);
      units.push({ delivery_unit_id: deliveryUnitId, ...result });
      errors.push(
        ...result.errors.map((error) => `${deliveryUnitId}: ${error}`),
      );
    } catch (error) {
      if (error.code === "NO_APPROVED_WORK_PLAN" || error.code === "ENOENT") {
        skipped.push({
          delivery_unit_id: deliveryUnitId,
          reason: "승인된 전달 작업 그래프 없음",
        });
      } else {
        errors.push(`${deliveryUnitId}: ${error.message}`);
      }
    }
  }
  return { units, skipped, errors };
}

const isMain =
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const { deliveryUnitId, all, quiet, workPlanRevision } = parseArguments(
      process.argv.slice(2),
    );
    const result = all
      ? await deriveAllDeliveryStatuses()
      : await deriveDeliveryStatusRepository(deliveryUnitId, repositoryRoot, {
          workPlanRevision,
        });
    if (quiet && result.errors.length === 0) {
      const count = all ? result.units.length : 1;
      console.log(`전달 상태 파생 검증 통과: ${count}개 전달 단위`);
    } else {
      console.log(JSON.stringify(result, null, 2));
    }
    if (result.errors.length > 0) process.exitCode = 1;
  } catch (error) {
    console.error(`ERROR ${error.message}`);
    process.exitCode = 1;
  }
}
