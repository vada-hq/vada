import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";

import {
  applyRuntimeOperation,
  initializeExecutionRuntime,
  publishNewFileAtomically,
} from "./record-execution-runtime.mjs";

test("초기 런타임 게시 중 목적 파일이 생기면 기존 파일을 덮어쓰지 않는다", async () => {
  const directory = await mkdtemp(resolve(tmpdir(), "vada-runtime-publish-"));
  const destination = resolve(directory, "R7.json");
  try {
    const results = await Promise.allSettled([
      publishNewFileAtomically(destination, "first\n"),
      publishNewFileAtomically(destination, "second\n"),
    ]);

    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    const rejected = results.find((result) => result.status === "rejected");
    assert.match(rejected?.reason?.message ?? "", /이미 존재합니다/);
    assert.match(await readFile(destination, "utf8"), /^(first|second)\n$/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("승인 실행 계획의 커밋 작업만 자동 ID와 한 시각으로 초기화한다", () => {
  const plan = {
    execution_plan_id: "EP-DU-001",
    execution_plan_revision: 7,
    execution_plan_status: "approved",
    delivery_unit_id: "DU-001",
    orchestration: { coordinator_executor_ref: "EXEC:coordinator" },
    work_allocations: [
      {
        work_item_ref: "WORK:first@R1",
        disposition: "committed",
        primary_executor_ref: "EXEC:first-worker",
      },
      {
        work_item_ref: "WORK:second@R1",
        disposition: "committed",
        primary_executor_ref: "EXEC:second-worker",
      },
      {
        work_item_ref: "WORK:later@R1",
        disposition: "forecast",
        primary_executor_ref: null,
      },
    ],
  };

  const initialized = initializeExecutionRuntime(plan, {
    planPath: "delivery-units/DU-001/execution-plan/R7.json",
    now: "2026-08-05T07:00:00Z",
  });

  assert.equal(initialized.runtime_id, "RUN-DU-001-EP-R7");
  assert.equal(initialized.runtime_revision, 1);
  assert.equal(initialized.updated_at, "2026-08-05T07:00:00Z");
  assert.equal(initialized.sources[0].id, "SRC-RUN-001");
  assert.deepEqual(
    initialized.work_runs.map(({ work_item_ref, executor_ref, status }) => ({
      work_item_ref,
      executor_ref,
      status,
    })),
    [
      {
        work_item_ref: "WORK:first@R1",
        executor_ref: "EXEC:first-worker",
        status: "not_started",
      },
      {
        work_item_ref: "WORK:second@R1",
        executor_ref: "EXEC:second-worker",
        status: "not_started",
      },
    ],
  );
  assert.deepEqual(
    initialized.work_runs.map((run) => run.transition_log[0].id),
    ["TR-001", "TR-002"],
  );
  assert.ok(initialized.work_runs.every((run) => run.transition_log[0].occurred_at === "2026-08-05T07:00:00Z"));
});

function runtime() {
  return {
    runtime_revision: 2,
    runtime_status: "active",
    updated_at: "2026-08-04T00:00:00Z",
    sources: [
      {
        id: "SRC-RUN-001",
        type: "approved_artifact",
        captured_at: "2026-08-04T00:00:00Z",
        locator: "test/plan",
        content_ko: "승인 계획입니다.",
      },
    ],
    work_runs: [
      {
        work_item_ref: "WORK:test@R1",
        executor_ref: "EXEC:worker",
        status: "not_started",
        started_at: null,
        completed_at: null,
        transition_log: [
          {
            id: "TR-001",
            from: null,
            to: "not_started",
            occurred_at: "2026-08-04T00:00:00Z",
            actor_ref: "EXEC:coordinator",
            source_ref: "SRC-RUN-001",
            note_ko: "초기화했습니다.",
          },
        ],
        blockers: [],
        evidence_instances: [],
      },
    ],
  };
}

test("한 시각으로 근거와 전이를 원자적으로 기록하고 ID를 자동 발급한다", () => {
  const updated = applyRuntimeOperation(
    runtime(),
    {
      source: {
        type: "user_statement",
        locator: "conversation:test",
        content_ko: "착수를 승인했습니다.",
      },
      transition: {
        work_item_ref: "WORK:test@R1",
        to: "in_progress",
        actor_ref: "EXEC:coordinator",
        note_ko: "작업을 시작합니다.",
      },
    },
    { now: "2026-08-04T01:00:00Z" },
  );

  assert.equal(updated.runtime_revision, 3);
  assert.equal(updated.updated_at, "2026-08-04T01:00:00Z");
  assert.deepEqual(updated.sources.at(-1), {
    id: "SRC-RUN-002",
    type: "user_statement",
    captured_at: "2026-08-04T01:00:00Z",
    locator: "conversation:test",
    content_ko: "착수를 승인했습니다.",
  });
  assert.deepEqual(updated.work_runs[0].transition_log.at(-1), {
    id: "TR-002",
    from: "not_started",
    to: "in_progress",
    occurred_at: "2026-08-04T01:00:00Z",
    actor_ref: "EXEC:coordinator",
    source_ref: "SRC-RUN-002",
    note_ko: "작업을 시작합니다.",
  });
  assert.equal(updated.work_runs[0].started_at, "2026-08-04T01:00:00Z");
});

test("호출자가 ID나 시각을 주입하면 거부한다", () => {
  assert.throws(
    () =>
      applyRuntimeOperation(
        runtime(),
        {
          source: {
            id: "SRC-RUN-999",
            type: "code_evidence",
            captured_at: "2020-01-01T00:00:00Z",
            locator: "git:deadbeef",
            content_ko: "조작된 기록입니다.",
          },
        },
        { now: "2026-08-04T01:00:00Z" },
      ),
    /자동 생성 필드/,
  );
});

test("검증 완료 증거와 done 전이를 같은 갱신에 기록한다", () => {
  const current = runtime();
  current.work_runs[0].status = "review";
  current.work_runs[0].started_at = "2026-08-04T00:10:00Z";
  current.work_runs[0].transition_log.push(
    {
      id: "TR-002",
      from: "not_started",
      to: "in_progress",
      occurred_at: "2026-08-04T00:10:00Z",
      actor_ref: "EXEC:worker",
      source_ref: "SRC-RUN-001",
      note_ko: "착수했습니다.",
    },
    {
      id: "TR-003",
      from: "in_progress",
      to: "review",
      occurred_at: "2026-08-04T00:20:00Z",
      actor_ref: "EXEC:worker",
      source_ref: "SRC-RUN-001",
      note_ko: "검토를 요청했습니다.",
    },
  );

  const updated = applyRuntimeOperation(
    current,
    {
      source: {
        type: "review_record",
        locator: "review:test",
        content_ko: "독립 검증을 통과했습니다.",
      },
      evidence: [
        {
          requirement_ref: "EVID-001",
          kind: "automated_test",
          locator: "ci:test",
          verification_status: "verified",
          verified_by: "EXEC:verifier",
          verification_note_ko: "테스트 통과를 확인했습니다.",
        },
      ],
      transition: {
        work_item_ref: "WORK:test@R1",
        to: "done",
        actor_ref: "EXEC:verifier",
        note_ko: "완료 증거를 승인했습니다.",
      },
    },
    { now: "2026-08-04T01:00:00Z" },
  );

  assert.equal(updated.work_runs[0].status, "done");
  assert.equal(updated.work_runs[0].completed_at, "2026-08-04T01:00:00Z");
  assert.equal(updated.work_runs[0].evidence_instances[0].id, "PROOF-001");
  assert.equal(updated.work_runs[0].evidence_instances[0].captured_at, "2026-08-04T01:00:00Z");
  assert.equal(updated.work_runs[0].evidence_instances[0].verified_at, "2026-08-04T01:00:00Z");
});

test("증거 대상 작업과 상태 전이 대상 작업이 다르면 거부한다", () => {
  assert.throws(
    () =>
      applyRuntimeOperation(
        runtime(),
        {
          source: {
            type: "review_record",
            locator: "review:test",
            content_ko: "서로 다른 작업을 한 번에 갱신하려는 입력입니다.",
          },
          work_item_ref: "WORK:other@R1",
          evidence: [
            {
              requirement_ref: "EVID-001",
              kind: "automated_test",
              locator: "ci:test",
              verification_status: "submitted",
            },
          ],
          transition: {
            work_item_ref: "WORK:test@R1",
            to: "in_progress",
            actor_ref: "EXEC:coordinator",
            note_ko: "작업을 시작합니다.",
          },
        },
        { now: "2026-08-04T01:00:00Z" },
      ),
    /같아야 합니다/,
  );
});

test("미검증 증거에 검증자나 검증 설명을 미리 넣으면 거부한다", () => {
  assert.throws(
    () =>
      applyRuntimeOperation(
        runtime(),
        {
          source: {
            type: "code_evidence",
            locator: "git:test",
            content_ko: "검증 전 증거입니다.",
          },
          work_item_ref: "WORK:test@R1",
          evidence: [
            {
              requirement_ref: "EVID-001",
              kind: "automated_test",
              locator: "ci:test",
              verification_status: "submitted",
              verified_by: "EXEC:verifier",
            },
          ],
        },
        { now: "2026-08-04T01:00:00Z" },
      ),
    /미검증 증거/,
  );
});
