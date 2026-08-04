import { readFile, readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

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

function hasVerifiedCompletionEvidence(work, run) {
  const required = new Set((work.completion_evidence ?? []).map((item) => item.id));
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
    if (workById.has(work.id)) errors.push(`작업 ID가 중복됐습니다: ${work.id}`);
    workById.set(work.id, work);
  }
  for (const work of workItems) {
    for (const dependency of work.blocked_by ?? []) {
      if (!workById.has(dependency) && !importedWorkIds.has(dependency)) {
        errors.push(`${work.id}: 존재하지 않는 선행 작업 ${dependency}을 참조합니다.`);
      }
    }
  }

  const completed = new Set(satisfiedPrerequisiteRefs);
  for (const reference of completed) {
    if (!workById.has(reference) && !importedWorkIds.has(reference)) {
      errors.push(`존재하지 않는 충족 선행 작업을 참조합니다: ${reference}`);
    }
  }

  const latestByWork = new Map();
  const seenRuntimeOrders = new Set();
  const allowedStatuses = new Set(["not_started", "in_progress", "review", "done", "paused"]);
  for (const runtime of runtimes) {
    for (const run of runtime.work_runs ?? []) {
      if (!workById.has(run.work_item_ref)) {
        errors.push(`런타임이 존재하지 않는 작업을 참조합니다: ${run.work_item_ref}`);
        continue;
      }
      if (!allowedStatuses.has(run.status)) {
        errors.push(`${run.work_item_ref}: 알 수 없는 실행 상태 ${run.status}입니다.`);
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

  for (const work of workItems) {
    const latest = latestByWork.get(work.id)?.run;
    if (latest?.status !== "done") continue;
    if (hasVerifiedCompletionEvidence(work, latest)) completed.add(work.id);
    else errors.push(`${work.id}: done 상태지만 검증된 완료 증거가 부족합니다.`);
  }

  const items = workItems.map((work) => {
    const latest = latestByWork.get(work.id);
    const missingDependencies = (work.blocked_by ?? []).filter((id) => !completed.has(id));
    let derivedStatus;
    if (completed.has(work.id)) derivedStatus = "done";
    else if (latest?.run.status === "done") derivedStatus = "evidence_incomplete";
    else if (["in_progress", "review", "paused"].includes(latest?.run.status)) {
      derivedStatus = latest.run.status;
    } else if (missingDependencies.length === 0) derivedStatus = "ready";
    else derivedStatus = "blocked";

    return {
      work_item_ref: work.id,
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
  return {
    delivery_unit_ref: workPlan?.delivery_unit_ref ?? null,
    work_plan_ref:
      workPlan?.plan_id && workPlan?.plan_revision
        ? `${workPlan.plan_id}@R${workPlan.plan_revision}`
        : null,
    summary,
    items,
    errors,
  };
}

function parseArguments(argv) {
  if (argv.includes("--all")) {
    return { deliveryUnitId: null, all: true, quiet: argv.includes("--quiet") };
  }
  const duIndex = argv.indexOf("--du");
  const deliveryUnitId = duIndex >= 0 ? argv[duIndex + 1] : null;
  if (!/^DU-[0-9]{3,}$/.test(deliveryUnitId ?? "")) {
    throw new Error("--du DU-001 형식의 전달 단위 ID가 필요합니다.");
  }
  return { deliveryUnitId, all: false, quiet: argv.includes("--quiet") };
}

async function readJsonFiles(directory) {
  const names = (await readdir(directory)).filter((name) => /^R[1-9][0-9]*\.json$/.test(name));
  return Promise.all(
    names.map(async (name) => JSON.parse(await readFile(resolve(directory, name), "utf8"))),
  );
}

export async function deriveDeliveryStatusRepository(
  deliveryUnitId,
  root = repositoryRoot,
) {
  const directory = resolve(root, "delivery-units", deliveryUnitId);
  const workPlans = await readJsonFiles(resolve(directory, "delivery-work"));
  const approvedPlans = workPlans
    .filter((plan) => plan.plan_status === "approved")
    .sort((left, right) => right.plan_revision - left.plan_revision);
  if (approvedPlans.length === 0) {
    const error = new Error(`${deliveryUnitId}: 승인된 전달 작업 그래프가 없습니다.`);
    error.code = "NO_APPROVED_WORK_PLAN";
    throw error;
  }
  let runtimes = [];
  try {
    runtimes = await readJsonFiles(resolve(directory, "execution-runtime"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  let executionPlans = [];
  try {
    executionPlans = await readJsonFiles(resolve(directory, "execution-plan"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const selectedWorkPlan = approvedPlans[0];
  const satisfiedPrerequisiteRefs = [
    ...new Set(
      executionPlans
        .filter(
          (plan) =>
            plan.execution_plan_status === "approved" &&
            plan.work_plan_ref?.plan_id === selectedWorkPlan.plan_id &&
            plan.work_plan_ref?.plan_revision === selectedWorkPlan.plan_revision,
        )
        .flatMap((plan) =>
          (plan.satisfied_prerequisites ?? []).map((item) => item.work_item_ref),
        ),
    ),
  ];
  return deriveDeliveryStatus(selectedWorkPlan, runtimes, {
    satisfiedPrerequisiteRefs,
  });
}

export async function deriveAllDeliveryStatuses(root = repositoryRoot) {
  const entries = await readdir(resolve(root, "delivery-units"), { withFileTypes: true });
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
      errors.push(...result.errors.map((error) => `${deliveryUnitId}: ${error}`));
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

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const { deliveryUnitId, all, quiet } = parseArguments(process.argv.slice(2));
    const result = all
      ? await deriveAllDeliveryStatuses()
      : await deriveDeliveryStatusRepository(deliveryUnitId);
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
