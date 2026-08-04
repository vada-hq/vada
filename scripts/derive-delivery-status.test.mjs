import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

import {
  deriveAllDeliveryStatuses,
  deriveDeliveryStatus,
} from "./derive-delivery-status.mjs";

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

test("완료·현재 상태·착수 가능·차단을 작업 그래프와 런타임에서 파생한다", () => {
  const result = deriveDeliveryStatus(workPlan, [
    {
      runtime_revision: 1,
      execution_plan_ref: { execution_plan_revision: 1 },
      work_runs: [run("WORK:test-a@R1", "done"), run("WORK:test-d@R1", "paused")],
    },
  ]);

  assert.deepEqual(result.errors, []);
  assert.deepEqual(
    Object.fromEntries(result.items.map((item) => [item.work_item_ref, item.derived_status])),
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
    result.items.find((item) => item.work_item_ref === "WORK:test-b@R1").derived_status,
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
    result.items.find((item) => item.work_item_ref === "WORK:test-d@R1").derived_status,
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
