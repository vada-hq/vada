import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  deriveActiveDeliveryStatus,
  deriveAllDeliveryStatuses,
  deriveDeliveryStatus,
  deriveDeliveryStatusRepository,
} from "./derive-delivery-status.mjs";
import { buildExecutionEvidenceLedger } from "./execution-evidence-ledger.mjs";
import { canonicalSha256 } from "./validate-execution-plan.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function work(id, blockedBy = []) {
  return {
    id,
    title_ko: id,
    blocked_by: blockedBy,
    completion_evidence: [
      {
        id: `EVID-${id.at(-1)}`,
        kind: "automated_test",
      },
    ],
  };
}

function run(workItemRef, status, evidenceStatus = "verified") {
  return {
    work_item_ref: workItemRef,
    status,
    blockers: [],
    evidence_instances:
      status === "done"
        ? [
            {
              requirement_ref: `EVID-${workItemRef.at(-1)}`,
              verification_status: evidenceStatus,
            },
          ]
        : [],
  };
}

const workPlan = {
  plan_status: "approved",
  delivery_unit_ref: "DU-999",
  work_items: [
    work("WORK:test-a@R1"),
    work("WORK:test-b@R1", ["WORK:test-a@R1"]),
    work("WORK:test-c@R1", ["WORK:test-b@R1"]),
    work("WORK:test-d@R1", ["WORK:test-a@R1"]),
  ],
};

function overlayWork(id, { blockedBy = [], supersedes = null } = {}) {
  const [, keyAndRevision] = id.split(":");
  const key = keyAndRevision.replace(/@R[1-9][0-9]*$/, "");
  const revision = Number(id.match(/@R([1-9][0-9]*)$/)?.[1]);
  return {
    ...work(id, blockedBy),
    key,
    revision,
    status: "ratified",
    supersedes,
  };
}

function overlayPlan(revision, workItems) {
  return {
    plan_id: "WP-TEST",
    plan_revision: revision,
    plan_status: "approved",
    delivery_unit_ref: "DU-999",
    work_items: workItems,
  };
}

function overlayEvidence({
  runtimeContexts = [],
  completedWorkRefs = [],
  errors = [],
} = {}) {
  return {
    runtimeContexts,
    completedWorkRefs: new Set(completedWorkRefs),
    errors,
  };
}

async function copyDu001Artifacts(
  root,
  { workPlanRevisions, executionPlanRevisions, runtimeRevisions },
) {
  const sourceUnit = resolve(repositoryRoot, "delivery-units/DU-001");
  const copiedUnit = resolve(root, "delivery-units/DU-001");
  await Promise.all([
    mkdir(resolve(copiedUnit, "delivery-work"), { recursive: true }),
    mkdir(resolve(copiedUnit, "execution-plan"), { recursive: true }),
    mkdir(resolve(copiedUnit, "execution-runtime"), { recursive: true }),
  ]);
  await Promise.all([
    ...workPlanRevisions.map((revision) =>
      cp(
        resolve(sourceUnit, `delivery-work/R${revision}.json`),
        resolve(copiedUnit, `delivery-work/R${revision}.json`),
      ),
    ),
    ...executionPlanRevisions.map((revision) =>
      cp(
        resolve(sourceUnit, `execution-plan/R${revision}.json`),
        resolve(copiedUnit, `execution-plan/R${revision}.json`),
      ),
    ),
    ...runtimeRevisions.map((revision) =>
      cp(
        resolve(sourceUnit, `execution-runtime/R${revision}.json`),
        resolve(copiedUnit, `execution-runtime/R${revision}.json`),
      ),
    ),
  ]);
  return copiedUnit;
}

test("완료·현재 상태·착수 가능·차단을 작업 그래프와 런타임에서 파생한다", () => {
  const result = deriveDeliveryStatus(workPlan, [
    {
      runtime_revision: 1,
      execution_plan_ref: { execution_plan_revision: 1 },
      work_runs: [
        run("WORK:test-a@R1", "done"),
        run("WORK:test-d@R1", "paused"),
      ],
    },
  ]);

  assert.deepEqual(result.errors, []);
  assert.deepEqual(
    Object.fromEntries(
      result.items.map((item) => [item.work_item_ref, item.derived_status]),
    ),
    {
      "WORK:test-a@R1": "done",
      "WORK:test-b@R1": "ready",
      "WORK:test-c@R1": "blocked",
      "WORK:test-d@R1": "paused",
    },
  );
  assert.deepEqual(
    result.items.find((item) => item.work_item_ref === "WORK:test-c@R1")
      .missing_dependency_refs,
    ["WORK:test-b@R1"],
  );
});

test("검증되지 않은 완료 표시는 착수 가능 계산에 사용하지 않는다", () => {
  const result = deriveDeliveryStatus(workPlan, [
    {
      runtime_revision: 1,
      execution_plan_ref: { execution_plan_revision: 1 },
      work_runs: [run("WORK:test-a@R1", "done", "submitted")],
    },
  ]);

  assert.match(result.errors.join("\n"), /완료 증거/);
  assert.equal(
    result.items.find((item) => item.work_item_ref === "WORK:test-b@R1")
      .derived_status,
    "blocked",
  );
});

test("같은 작업은 가장 최신 실행 계획의 상태를 사용한다", () => {
  const result = deriveDeliveryStatus(workPlan, [
    {
      runtime_revision: 1,
      execution_plan_ref: { execution_plan_revision: 1 },
      work_runs: [run("WORK:test-d@R1", "not_started")],
    },
    {
      runtime_revision: 1,
      execution_plan_ref: { execution_plan_revision: 2 },
      work_runs: [run("WORK:test-d@R1", "in_progress")],
    },
  ]);

  assert.equal(
    result.items.find((item) => item.work_item_ref === "WORK:test-d@R1")
      .derived_status,
    "in_progress",
  );
});

test("같은 실행 순서에 같은 작업 상태가 두 번 기록되면 모순으로 거부한다", () => {
  const result = deriveDeliveryStatus(workPlan, [
    {
      runtime_revision: 1,
      execution_plan_ref: { execution_plan_revision: 1 },
      work_runs: [run("WORK:test-d@R1", "not_started")],
    },
    {
      runtime_revision: 1,
      execution_plan_ref: { execution_plan_revision: 1 },
      work_runs: [run("WORK:test-d@R1", "in_progress")],
    },
  ]);

  assert.match(result.errors.join("\n"), /같은 실행 순서.*중복/);
});

test("존재하지 않는 선행 작업을 조용히 차단 상태로 취급하지 않는다", () => {
  const plan = structuredClone(workPlan);
  plan.work_items[1].blocked_by = ["WORK:missing@R1"];

  assert.match(
    deriveDeliveryStatus(plan, []).errors.join("\n"),
    /존재하지 않는 선행 작업/,
  );
});

test("가져온 선행 작업은 증거 전에는 차단하고 충족 증거 뒤에는 준비 상태로 계산한다", () => {
  const plan = {
    ...structuredClone(workPlan),
    imports: [
      {
        work_item_ids: ["WORK:external@R1"],
      },
    ],
    work_items: [work("WORK:test-b@R1", ["WORK:external@R1"])],
  };

  const blocked = deriveDeliveryStatus(plan, []);
  assert.deepEqual(blocked.errors, []);
  assert.equal(blocked.items[0].derived_status, "blocked");
  assert.deepEqual(blocked.items[0].missing_dependency_refs, [
    "WORK:external@R1",
  ]);

  const ready = deriveDeliveryStatus(plan, [], {
    satisfiedPrerequisiteRefs: ["WORK:external@R1"],
  });
  assert.deepEqual(ready.errors, []);
  assert.equal(ready.items[0].derived_status, "ready");
});

test("저장소의 모든 전달 단위를 자동 발견해 상태를 검증한다", async () => {
  const root = await mkdtemp(join(tmpdir(), "vada-delivery-status-"));
  try {
    const directory = resolve(root, "delivery-units/DU-999/delivery-work");
    await mkdir(directory, { recursive: true });
    await writeFile(
      resolve(directory, "R1.json"),
      JSON.stringify({ ...workPlan, plan_id: "WP-TEST", plan_revision: 1 }),
    );
    const draftDirectory = resolve(root, "delivery-units/DU-998/delivery-work");
    await mkdir(draftDirectory, { recursive: true });
    await writeFile(
      resolve(draftDirectory, "draft.json"),
      JSON.stringify({ ...workPlan, plan_status: "review_ready" }),
    );

    const result = await deriveAllDeliveryStatuses(root);

    assert.deepEqual(result.errors, []);
    assert.equal(result.units.length, 1);
    assert.equal(result.units[0].delivery_unit_id, "DU-999");
    assert.deepEqual(result.skipped, [
      { delivery_unit_id: "DU-998", reason: "승인된 전달 작업 그래프 없음" },
    ]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("스키마와 상태 전이를 통과하지 않은 과거 런타임은 완료 원장에 넣지 않는다", async () => {
  const root = await mkdtemp(join(tmpdir(), "vada-delivery-lineage-"));
  try {
    const unitDirectory = resolve(root, "delivery-units/DU-999");
    await mkdir(resolve(root, ".vada"), { recursive: true });
    await mkdir(resolve(unitDirectory, "delivery-work"), { recursive: true });
    await mkdir(resolve(unitDirectory, "execution-plan"), { recursive: true });
    await mkdir(resolve(unitDirectory, "execution-runtime"), {
      recursive: true,
    });
    await writeFile(
      resolve(root, ".vada/project.json"),
      JSON.stringify({ id: "test" }),
    );

    const r1 = {
      plan_id: "WP-TEST",
      plan_revision: 1,
      plan_status: "approved",
      delivery_unit_ref: "DU-999",
      work_items: [work("WORK:test-root@R1")],
    };
    const r2 = {
      plan_id: "WP-TEST",
      plan_revision: 2,
      plan_status: "approved",
      delivery_unit_ref: "DU-999",
      imports: [
        {
          plan_path: "delivery-units/DU-999/delivery-work/R1.json",
          plan_id: "WP-TEST",
          plan_revision: 1,
          canonical_sha256: canonicalSha256(r1),
          work_item_ids: ["WORK:test-root@R1"],
        },
      ],
      work_items: [
        {
          ...work("WORK:test-root@R2"),
          supersedes: "WORK:test-root@R1",
        },
        work("WORK:test-child@R2", ["WORK:test-root@R1"]),
      ],
    };
    const executionPlan = {
      execution_plan_id: "EP-TEST",
      execution_plan_revision: 1,
      execution_plan_status: "approved",
      delivery_unit_id: "DU-999",
      work_plan_ref: {
        path: "delivery-units/DU-999/delivery-work/R1.json",
        plan_id: "WP-TEST",
        plan_revision: 1,
        canonical_sha256: canonicalSha256(r1),
      },
      executors: [
        {
          id: "EXEC:verifier",
          execution_roles: ["verifier"],
        },
      ],
    };
    const runtime = {
      runtime_id: "RUN-TEST",
      runtime_revision: 1,
      delivery_unit_id: "DU-999",
      execution_plan_ref: {
        path: "delivery-units/DU-999/execution-plan/R1.json",
        execution_plan_id: "EP-TEST",
        execution_plan_revision: 1,
        canonical_sha256: canonicalSha256(executionPlan),
      },
      work_runs: [run("WORK:test-root@R1", "done")],
    };
    runtime.work_runs[0].evidence_instances = [
      {
        id: "PROOF-001",
        requirement_ref: "EVID-1",
        kind: "automated_test",
        verification_status: "verified",
        verified_by: "EXEC:verifier",
        verified_at: "2026-08-04T00:00:00Z",
      },
    ];

    await Promise.all([
      writeFile(
        resolve(unitDirectory, "delivery-work/R1.json"),
        JSON.stringify(r1),
      ),
      writeFile(
        resolve(unitDirectory, "delivery-work/R2.json"),
        JSON.stringify(r2),
      ),
      writeFile(
        resolve(unitDirectory, "execution-plan/R1.json"),
        JSON.stringify(executionPlan),
      ),
      writeFile(
        resolve(unitDirectory, "execution-runtime/R1.json"),
        JSON.stringify(runtime),
      ),
    ]);

    const result = await deriveDeliveryStatusRepository("DU-999", root, {
      workPlanRevision: 2,
    });
    const statuses = Object.fromEntries(
      result.items.map((item) => [item.work_item_ref, item.derived_status]),
    );

    assert.match(result.errors.join("\n"), /필수 필드|상태 전이|committed/);
    assert.equal(statuses["WORK:test-child@R2"], "blocked");
    assert.equal(statuses["WORK:test-root@R2"], "ready");
    assert.equal(
      result.items.some((item) => item.work_item_ref === "WORK:test-root@R1"),
      false,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("실제 DU-001의 승인된 21개 가져오기와 8개 R2 개정 그래프에서도 과거 런타임이 유효하다", async () => {
  const root = await mkdtemp(join(tmpdir(), "vada-du001-promotion-"));
  try {
    await mkdir(resolve(root, ".vada"), { recursive: true });
    await writeFile(
      resolve(root, ".vada/project.json"),
      JSON.stringify({ id: "test" }),
    );
    const copiedUnit = await copyDu001Artifacts(root, {
      workPlanRevisions: [1, 2],
      executionPlanRevisions: [1, 2, 3, 4],
      runtimeRevisions: [1, 2, 3, 4],
    });
    const promotedPath = resolve(
      root,
      "delivery-units/DU-001/delivery-work/R2.json",
    );
    const promoted = JSON.parse(await readFile(promotedPath, "utf8"));

    assert.equal(promoted.plan_revision, 2);
    assert.equal(promoted.plan_status, "approved");
    assert.ok(promoted.approval_source_ref);
    assert.ok(promoted.work_items.every((item) => item.status === "ratified"));

    const result = await deriveDeliveryStatusRepository("DU-001", root, {
      workPlanRevision: 2,
    });
    const ready = result.items
      .filter((item) => item.derived_status === "ready")
      .map((item) => item.work_item_ref)
      .sort();

    assert.deepEqual(result.errors, []);
    assert.equal(promoted.imports[0].work_item_ids.length, 21);
    assert.equal(result.items.length, 8);
    assert.ok(result.items.every((item) => item.work_item_ref.endsWith("@R2")));
    assert.ok(result.items.every((item) => item.derived_status !== "done"));
    assert.deepEqual(ready, [
      "WORK:purchase-request-contract-fixtures@R2",
      "WORK:purchase-request-screen-spec@R2",
    ]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("다른 전달 단위 경로의 런타임은 완료 증거로 가져오지 않는다", async () => {
  const root = await mkdtemp(join(tmpdir(), "vada-cross-du-evidence-"));
  try {
    await mkdir(resolve(root, ".vada"), { recursive: true });
    await writeFile(
      resolve(root, ".vada/project.json"),
      JSON.stringify({ id: "test" }),
    );
    await copyDu001Artifacts(root, {
      workPlanRevisions: [1, 2, 3],
      executionPlanRevisions: [1, 2, 3, 4, 5, 6, 7],
      runtimeRevisions: [1, 2, 3, 4, 5, 6, 7],
    });
    await cp(
      resolve(repositoryRoot, "delivery-units/DU-001"),
      resolve(root, "delivery-units/DU-999"),
      { recursive: true },
    );

    const evidence = await buildExecutionEvidenceLedger(root, {
      deliveryUnitId: "DU-999",
    });

    assert.match(
      evidence.errors.join("\n"),
      /요청한 전달 단위 DU-999와 다릅니다/,
    );
    assert.equal(evidence.runtimeContexts.length, 0);
    assert.equal(evidence.completedWorkRefs.size, 0);
    assert.equal(evidence.byLocator.size, 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("기본 조회는 DU-001의 모든 활성 증분 작업과 소유 작업 그래프를 함께 보여준다", async () => {
  const root = await mkdtemp(join(tmpdir(), "vada-active-overlay-"));
  try {
    await mkdir(resolve(root, ".vada"), { recursive: true });
    await writeFile(
      resolve(root, ".vada/project.json"),
      JSON.stringify({ id: "test" }),
    );
    await copyDu001Artifacts(root, {
      workPlanRevisions: [1, 2, 3],
      executionPlanRevisions: [1, 2, 3, 4, 5, 6, 7],
      runtimeRevisions: [1, 2, 3, 4, 5, 6, 7],
    });

    const result = await deriveDeliveryStatusRepository("DU-001", root);
    const owners = Object.fromEntries(
      result.items.map((item) => [
        item.work_item_ref,
        item.owner_work_plan_ref,
      ]),
    );

    assert.equal(result.items.length, 22);
    assert.equal(result.summary.definition_review_required, 4);
    assert.equal(
      owners["WORK:purchase-request-screen-spec@R2"],
      "WP-FIN-001@R2",
    );
    assert.equal(owners["WORK:purchase-request-editor-ui@R2"], "WP-FIN-001@R3");
    assert.deepEqual(result.work_plan_refs, [
      "WP-FIN-001@R1",
      "WP-FIN-001@R2",
      "WP-FIN-001@R3",
    ]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("활성 오버레이는 대체된 작업을 제외하고 완료 증거를 새 리비전에 승계하지 않는다", () => {
  const r1 = overlayPlan(1, [overlayWork("WORK:root@R1")]);
  const r2 = overlayPlan(2, [
    overlayWork("WORK:root@R2", { supersedes: "WORK:root@R1" }),
  ]);

  const result = deriveActiveDeliveryStatus(
    [r1, r2],
    overlayEvidence({ completedWorkRefs: ["WORK:root@R1"] }),
  );

  assert.equal(
    result.items.some((item) => item.work_item_ref === "WORK:root@R1"),
    false,
  );
  assert.equal(
    result.items.find((item) => item.work_item_ref === "WORK:root@R2")
      ?.derived_status,
    "ready",
  );
});

test("활성 미완료 작업이 대체된 선행 작업을 참조하면 정의 검토 필요 오류를 낸다", () => {
  const r1 = overlayPlan(1, [
    overlayWork("WORK:root@R1"),
    overlayWork("WORK:consumer@R1", { blockedBy: ["WORK:root@R1"] }),
  ]);
  const r2 = overlayPlan(2, [
    overlayWork("WORK:root@R2", { supersedes: "WORK:root@R1" }),
  ]);

  const result = deriveActiveDeliveryStatus(
    [r1, r2],
    overlayEvidence({
      completedWorkRefs: ["WORK:root@R2"],
      runtimeContexts: [
        {
          runtime: {
            runtime_revision: 1,
            execution_plan_ref: { execution_plan_revision: 1 },
            work_runs: [run("WORK:consumer@R1", "in_progress")],
          },
        },
      ],
    }),
  );
  const consumer = result.items.find(
    (item) => item.work_item_ref === "WORK:consumer@R1",
  );

  assert.equal(consumer?.derived_status, "definition_review_required");
  assert.deepEqual(consumer?.missing_dependency_refs, ["WORK:root@R1"]);
  assert.deepEqual(consumer?.superseded_dependency_refs, ["WORK:root@R1"]);
  assert.match(
    result.errors.join("\n"),
    /definition_review_required.*WORK:consumer@R1.*WORK:root@R1/,
  );
});

test("같은 안정 키의 미대체 활성 작업이 둘이면 임의 리비전을 선택하지 않는다", () => {
  const r1 = overlayPlan(1, [overlayWork("WORK:root@R1")]);
  const r2 = overlayPlan(2, [overlayWork("WORK:root@R2")]);

  const result = deriveActiveDeliveryStatus([r1, r2], overlayEvidence());

  assert.match(result.errors.join("\n"), /미대체 활성 작업.*root.*R1.*R2/);
});

test("활성 오버레이 결과는 작업 그래프와 런타임 입력 순서에 무관하다", () => {
  const r1 = overlayPlan(1, [overlayWork("WORK:root@R1")]);
  const r2 = overlayPlan(2, [
    overlayWork("WORK:root@R2", { supersedes: "WORK:root@R1" }),
  ]);
  const r3 = overlayPlan(3, [overlayWork("WORK:child@R1")]);
  const contexts = [
    {
      runtime: {
        runtime_revision: 1,
        execution_plan_ref: { execution_plan_revision: 2 },
        work_runs: [run("WORK:root@R2", "in_progress")],
      },
    },
    {
      runtime: {
        runtime_revision: 1,
        execution_plan_ref: { execution_plan_revision: 3 },
        work_runs: [run("WORK:child@R1", "paused")],
      },
    },
  ];

  const first = deriveActiveDeliveryStatus(
    [r3, r1, r2],
    overlayEvidence({ runtimeContexts: contexts }),
  );
  const second = deriveActiveDeliveryStatus(
    [r2, r3, r1],
    overlayEvidence({ runtimeContexts: [...contexts].reverse() }),
  );

  assert.deepEqual(first, second);
});

test("명시적 R2 조회는 R2 로컬 작업과 해당 계보의 상태만 보여준다", async () => {
  const result = await deriveDeliveryStatusRepository(
    "DU-001",
    repositoryRoot,
    {
      workPlanRevision: 2,
    },
  );
  assert.equal(result.scope_mode, "work_plan");
  assert.equal(result.work_plan_ref, "WP-FIN-001@R2");
  assert.deepEqual(result.work_plan_refs, ["WP-FIN-001@R2"]);
  assert.equal(result.items.length, 8);
  assert.ok(
    result.items.every((item) => item.owner_work_plan_ref === "WP-FIN-001@R2"),
  );
});

test("CLI --work-plan R2는 명시한 역사 작업 그래프만 조회한다", () => {
  const execution = spawnSync(
    process.execPath,
    [
      "scripts/derive-delivery-status.mjs",
      "--du",
      "DU-001",
      "--work-plan",
      "R2",
    ],
    { cwd: repositoryRoot, encoding: "utf8" },
  );

  assert.equal(execution.status, 0, execution.stderr || execution.stdout);
  const result = JSON.parse(execution.stdout);
  assert.equal(result.scope_mode, "work_plan");
  assert.equal(result.work_plan_ref, "WP-FIN-001@R2");
  assert.equal(result.items.length, 8);
});
