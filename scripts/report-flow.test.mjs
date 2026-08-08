import assert from "node:assert/strict";
import { test } from "node:test";

import {
  collectFlow,
  flowHeading,
  formatFlow,
  listFlows,
  newestRevision,
  screensOnFlow,
} from "./report-flow.mjs";

test("가장 높은 리비전을 지금 것으로 고른다", () => {
  const documents = [
    { id: "FLOW-A", revision: 1 },
    { id: "FLOW-A", revision: 2 },
    { id: "FLOW-B", revision: 5 },
  ];

  assert.equal(newestRevision(documents, "FLOW-A").revision, 2);
  assert.equal(newestRevision(documents, "FLOW-NOPE"), null);
});

test("전달 단위가 그 흐름인 계약을 쓰는 화면을 모은다", () => {
  const bundles = [
    {
      delivery_unit_ref: "FLOW-FIN-001@R2",
      contracts: [{ id: "API:purchase_request.submit@R1" }],
    },
    {
      delivery_unit_ref: "SCREEN:EVT-FIN-01",
      contracts: [{ id: "API:event_budget.get_summary@R1" }],
    },
  ];
  const canons = [
    {
      id: "FINREQ01",
      wireframeScreen: "FIN-REQ-01B",
      route: "/x/new",
      contracts: ["API:purchase_request.submit@R1"],
    },
    {
      id: "ORG04B",
      wireframeScreen: "ORG-04B",
      route: "/organization/roles",
      contracts: ["API:organization.list_member_roles@R1"],
    },
  ];

  assert.deepEqual(screensOnFlow("FLOW-FIN-001", bundles, canons), [
    "FIN-REQ-01B  /x/new",
  ]);
});

test("다른 흐름의 계약을 쓰는 화면을 끌어오지 않는다", () => {
  const bundles = [
    { delivery_unit_ref: "FLOW-OTHER-001@R1", contracts: [{ id: "API:x@R1" }] },
  ];
  const canons = [{ id: "S", contracts: ["API:x@R1"] }];

  assert.deepEqual(screensOnFlow("FLOW-FIN-001", bundles, canons), []);
});

test("없는 흐름은 null이다", async () => {
  assert.equal(await collectFlow("FLOW-NOPE-999"), null);
});

test("흐름 목록을 리비전별로 하나만 준다", async () => {
  const flows = await listFlows();
  const ids = flows.map((flow) => flow.id);

  assert.ok(flows.length > 0, "흐름 정본을 하나도 읽지 못했습니다.");
  assert.equal(new Set(ids).size, ids.length, "같은 흐름이 두 번 나옵니다.");
});

test("승인된 흐름 정본을 읽어 낸다", async () => {
  const report = await collectFlow("FLOW-FIN-001");

  assert.ok(report, "FLOW-FIN-001을 찾지 못했습니다.");
  assert.equal(report.document.status, "approved");
  assert.equal(flowHeading(report.document), "FLOW-FIN-001@R2 · 행사 구매 요청 제출");
});

test("절차가 비어 있으면 통과가 아니다", async () => {
  const report = await collectFlow("FLOW-FIN-001");
  const spec = report.document.spec;

  // 목록이 빈 채로 초록이면 무엇이든 통과한다.
  assert.ok(spec.steps.length > 0, "정상 흐름 단계가 없습니다.");
  assert.ok(spec.branches.length > 0, "실패 분기가 없습니다.");
  assert.ok(spec.completionScenarios.length > 0, "완료 시나리오가 없습니다.");
});

test("정상 흐름과 실패 분기를 따로 찍는다", async () => {
  // 정상만 보면 실패가 어떻게 생겼는지 모른다. 그것이 대부분의 버그가 사는 곳이다.
  const text = formatFlow(await collectFlow("FLOW-FIN-001"));

  assert.match(text, /정상 흐름 \(\d+\)/);
  assert.match(text, /일부러 틀려 보는 것 \(\d+\)/);
  assert.match(text, /끝까지 됐는지 \(\d+\)/);
});

test("흐름이 지나는 화면과 경로를 함께 찍는다", async () => {
  const text = formatFlow(await collectFlow("FLOW-FIN-001"));

  assert.match(text, /지나는 화면/);
  assert.match(text, /FIN-REQ-01B/);
  assert.match(text, /just dev-web-mock/);
});

test("대본 밖을 보라는 차터로 끝난다", async () => {
  // 목록은 이미 예상한 것만 확인한다. 예상 못 한 것은 목록으로 못 찾는다.
  const text = formatFlow(await collectFlow("FLOW-FIN-001"));

  assert.match(text, /대본 없이/);
  assert.match(text, /30분/);
});
