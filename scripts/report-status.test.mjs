import assert from "node:assert/strict";
import { test } from "node:test";

import {
  apiContractRefs,
  collectStatus,
  expandScreenIds,
  formatStatus,
  matchesScreen,
  parseMvpScreens,
  stagesOf,
  webRoutes,
} from "./report-status.mjs";

test("줄여 쓴 화면 ID의 뒷자리를 갈아 끼운다", () => {
  assert.deepEqual(expandScreenIds("`ORG-03A/C`, `ORG-04B`"), [
    "ORG-03A",
    "ORG-03C",
    "ORG-04B",
  ]);
  assert.deepEqual(expandScreenIds("`EVT-TASK-01/02`"), [
    "EVT-TASK-01",
    "EVT-TASK-02",
  ]);
  assert.deepEqual(expandScreenIds("`EXT-02A/B/C`"), [
    "EXT-02A",
    "EXT-02B",
    "EXT-02C",
  ]);
});

test("표가 아닌 문장에서는 화면 ID를 읽지 않는다", () => {
  assert.deepEqual(expandScreenIds("한 행사 운영의 중심. 행사 상태와 운영진 관리"), []);
});

test("§6 표에서 영역과 화면을 읽는다", () => {
  const spec = [
    "### MVP 화면 묶음",
    "",
    "| 영역 | 우선 화면 | 구현 기준 |",
    "|---|---|---|",
    "| 재정 | `FIN-REQ-01/02`, `FIN-REV-01` | 검토 |",
    "",
    "다음 문단",
  ].join("\n");

  assert.deepEqual(parseMvpScreens(spec), [
    { area: "재정", ids: ["FIN-REQ-01", "FIN-REQ-02", "FIN-REV-01"] },
  ]);
});

test("§6 표가 없으면 진행률을 지어내지 않는다", () => {
  assert.equal(parseMvpScreens("# 다른 문서\n\n본문"), null);
});

test("API 소스가 적어 둔 계약 ID를 모은다", () => {
  const source = 'contracts=[\n    "API:purchase_request.submit@R1",\n    "DATA:x@R1",\n]';
  assert.deepEqual([...apiContractRefs([source])], ["API:purchase_request.submit@R1"]);
});

test("정본의 변형 한 글자는 §6의 화면과 같게 본다", () => {
  assert.equal(matchesScreen("FIN-REQ-01", "FIN-REQ-01B"), true);
  assert.equal(matchesScreen("FIN-REV-01", "FIN-REV-01"), true);
  assert.equal(matchesScreen("FIN-REQ-01", "FIN-REQ-02"), false);
  assert.equal(matchesScreen("MY-01", "MY-REQ-01"), false);
});

test("라우터에서 화면 경로를 뽑는다", () => {
  assert.deepEqual(webRoutes('  path: "/events/$eventId",\n  path: "/",\n'), [
    "/events/$eventId",
    "/",
  ]);
});

test("정본이 없는 화면은 어느 칸도 채우지 않는다", () => {
  assert.deepEqual(stagesOf(undefined, { served: new Set(), routes: [] }), {
    canon: false,
    contract: false,
    api: false,
    web: false,
  });
});

test("ERROR 계약만 붙은 정본은 계약도 서버도 없는 것으로 센다", () => {
  const canon = {
    route: "/events/$eventId/purchase-requests/$requestId/revision",
    contracts: ["ERROR:http.unauthenticated@R1"],
  };
  const stages = stagesOf(canon, { served: new Set(), routes: [] });
  assert.deepEqual(stages, { canon: true, contract: false, api: false, web: false });
});

test("계약은 있고 서버가 아직 없으면 서버를 채우지 않는다", () => {
  const canon = {
    route: "/events/$eventId/finance",
    contracts: ["API:event_budget.get_summary@R1"],
  };
  const stages = stagesOf(canon, { served: new Set(), routes: [] });
  assert.equal(stages.contract, true);
  assert.equal(stages.api, false);
});

test("API 계약 하나라도 구현되지 않았으면 서버를 채우지 않는다", () => {
  const canon = {
    route: "/events/$eventId/finance",
    contracts: ["API:a.one@R1", "API:a.two@R1"],
  };
  const stages = stagesOf(canon, { served: new Set(["API:a.one@R1"]), routes: [] });
  assert.equal(stages.api, false);
});

test("계약과 서버와 화면이 모두 있으면 모두 채운다", () => {
  const canon = {
    route: "/events/$eventId/purchase-requests/mine",
    contracts: ["ERROR:http.unauthenticated@R1", "API:purchase_request.list_own@R1"],
  };
  const stages = stagesOf(canon, {
    served: new Set(["API:purchase_request.list_own@R1"]),
    routes: ["/events/$eventId/purchase-requests/mine"],
  });
  assert.deepEqual(stages, { canon: true, contract: true, api: true, web: true });
});

test("계약 없이 서버만 있는 화면은 나올 수 없다", async () => {
  const report = await collectStatus();

  // 경로 모양으로 서버를 찾던 때는 계약이 하나도 없는 화면이 부모 경로가 겹쳐
  // "서버 있음"으로 나왔다. 거짓 성공이다. 이 순서는 뒤집힐 수 없다.
  for (const row of [...report.stages.values()].flat()) {
    if (row.stages.api) {
      assert.ok(row.stages.contract, `${row.id}: 계약 없이 서버가 있다고 셌습니다.`);
    }
  }
});

test("저장소 전체에서 진행 현황을 계산한다", async () => {
  const report = await collectStatus();

  assert.ok(report.total >= 30, `MVP 화면이 ${report.total}개로 너무 적습니다.`);
  assert.ok(report.done <= report.total);

  const ids = [...report.stages.values()].flat().map((row) => row.id);
  assert.equal(new Set(ids).size, ids.length, "같은 화면이 두 단계에 들어갔습니다.");
  assert.ok(ids.includes("FIN-REV-01"));
  assert.ok(ids.includes("ONB-01"));

  // 착수한 화면은 반드시 정본이 있다. 반대는 성립하지 않는다.
  for (const row of [...report.stages.values()].flat()) {
    if (row.done) assert.ok(row.canon, `${row.id}: 정본 없이 완료로 셌습니다.`);
  }
});

test("보고서는 분모의 출처를 함께 적는다", async () => {
  const text = formatStatus(await collectStatus());
  assert.match(text, /VADA_MVP_SPEC\.md §6/);
  assert.match(text, /MVP 화면 \d+개 중 \d+개 완료/);
});
