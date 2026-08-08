import assert from "node:assert/strict";
import { test } from "node:test";

import {
  STATES,
  collectApiBoard,
  displayWidth,
  formatBoard,
  renderHtml,
  rowsFromBundle,
  rowsFromLegacyOpenApi,
  servedContractIds,
  servedOperationIds,
  stateOf,
  supersededIds,
} from "./report-api.mjs";

const EMPTY = { servedContracts: new Set(), servedOperations: new Set(), superseded: new Set() };

test("번들에서 API 계약만 읽는다", () => {
  const rows = rowsFromBundle(
    {
      delivery_unit_ref: "SCREEN:FIN-REV-01",
      contracts: [
        { id: "DATA:purchase_request.review_view@R1", status: "ratified" },
        { id: "AUTH:purchase_request.review@R1", status: "ratified" },
        { id: "ERROR:http.unauthenticated@R1", status: "ratified" },
        {
          id: "API:purchase_request.get_review@R1",
          status: "ratified",
          specification: {
            method: "get",
            path: "/events/{eventId}/purchase-requests/{requestId}/review",
            operation_id: "getPurchaseRequestReview",
            authorization_ref: "AUTH:purchase_request.review@R1",
          },
        },
      ],
    },
    "CB-FIN-003@R1",
  );

  assert.equal(rows.length, 1);
  assert.deepEqual(
    {
      label: rows[0].label,
      method: rows[0].method,
      permission: rows[0].permission,
      unit: rows[0].unit,
    },
    {
      label: "purchase_request.get_review@R1",
      method: "GET",
      permission: "purchase_request.review@R1",
      unit: "SCREEN:FIN-REV-01",
    },
  );
});

test("옛 세대 OpenAPI에서 HTTP 메서드만 오퍼레이션으로 읽는다", () => {
  const rows = rowsFromLegacyOpenApi(
    {
      paths: {
        "/events": {
          // parameters·summary는 메서드가 아니다. 행으로 세면 안 된다.
          parameters: [{ name: "cursor", in: "query" }],
          summary: "행사 목록",
          get: { operationId: "listEvents", "x-vada-permission": "event.read" },
          post: { operationId: "createEvent", "x-vada-permission": "event.create" },
        },
      },
    },
    "contracts/openapi.json",
  );

  assert.deepEqual(
    rows.map((row) => `${row.method} ${row.path} ${row.label}`),
    ["GET /events listEvents", "POST /events createEvent"],
  );
});

test("옛 세대 행은 계약 ID가 없어 화면과 이을 수 없다", () => {
  const [row] = rowsFromLegacyOpenApi(
    { paths: { "/events": { get: { operationId: "listEvents" } } } },
    "contracts/openapi.json",
  );

  // 빈 화면 칸은 표시 누락이 아니라 사실이다. 옛 세대에는 화면 정본이 참조할
  // API 종류의 계약 자체가 없다.
  assert.equal(row.contractId, null);
});

test("다른 리비전이 가리킨 계약은 대체됨으로 센다", () => {
  const contracts = [
    { id: "API:purchase_request.get_detail@R2", supersedes: "API:purchase_request.get_detail@R1" },
    { id: "DATA:purchase_request.detail_view@R1", supersedes: null },
  ];
  const superseded = supersededIds(contracts);

  assert.deepEqual([...superseded], ["API:purchase_request.get_detail@R1"]);
  assert.equal(
    stateOf(
      { contractId: "API:purchase_request.get_detail@R1", status: "ratified" },
      { ...EMPTY, superseded },
    ),
    STATES.superseded,
  );
});

test("서버 소스가 계약 ID를 적었으면 구현이다", () => {
  const served = servedContractIds([
    'x_vada_contracts = ["API:purchase_request.submit@R1", "AUTH:purchase_request.submit@R1"]',
  ]);

  assert.deepEqual([...served], ["API:purchase_request.submit@R1"]);
  assert.equal(
    stateOf(
      { contractId: "API:purchase_request.submit@R1", status: "ratified" },
      { ...EMPTY, servedContracts: served },
    ),
    STATES.served,
  );
});

test("옛 세대는 operationId로 구현을 본다", () => {
  const served = servedOperationIds(['@router.get("/events", operation_id="listEvents")']);

  assert.deepEqual([...served], ["listEvents"]);
  assert.equal(
    stateOf(
      { contractId: null, operationId: "listEvents", status: "ratified" },
      { ...EMPTY, servedOperations: served },
    ),
    STATES.served,
  );
});

test("proposed 계약은 계획이다", () => {
  assert.equal(
    stateOf({ contractId: "API:purchase_request.resubmit@R1", status: "proposed" }, EMPTY),
    STATES.planned,
  );
});

test("proposed인데 이미 구현됐으면 감추지 않고 구현으로 적는다", () => {
  // 비준 전에 구현한 것은 절차 문제이지 현황판이 덮을 일이 아니다.
  const servedContracts = new Set(["API:purchase_request.resubmit@R1"]);

  assert.equal(
    stateOf(
      { contractId: "API:purchase_request.resubmit@R1", status: "proposed" },
      { ...EMPTY, servedContracts },
    ),
    STATES.served,
  );
});

test("경로가 이미 있는 API 밑에 있어도 구현으로 세지 않는다", () => {
  // report-status.mjs가 경로 모양으로 판정하다 거짓 성공을 냈다. 보완 재제출은
  // 서버에 저장할 자리조차 없는데 부모 경로가 겹쳐 "서버 있음"으로 나왔다.
  const servedContracts = new Set(["API:purchase_request.get_detail@R2"]);
  const row = {
    contractId: "API:purchase_request.resubmit@R1",
    path: "/events/{eventId}/purchase-requests/{requestId}/revisions",
    status: "ratified",
  };

  assert.equal(stateOf(row, { ...EMPTY, servedContracts }), STATES.pending);
});

test("한글은 두 칸으로 세어 표를 맞춘다", () => {
  assert.equal(displayWidth("미착수"), 6);
  assert.equal(displayWidth("GET"), 3);
  assert.equal(displayWidth("FIN-REQ-01"), 10);
});

test("구현으로 적힌 행은 서버 소스에 그 식별자가 있어야 한다", async () => {
  const board = await collectApiBoard();

  for (const row of board.rows) {
    if (row.state !== STATES.served) continue;
    assert.ok(
      row.contractId || row.operationId,
      `${row.label}: 근거가 될 식별자 없이 구현으로 셌습니다.`,
    );
  }
});

test("저장소에서 계약을 하나도 못 읽으면 통과가 아니라 실패다", async () => {
  const board = await collectApiBoard();

  // 표가 비어 있는데 초록으로 보이는 것이 가장 위험하다.
  assert.ok(board.rows.length > 0, "API 계약을 하나도 읽지 못했습니다.");
  assert.ok(board.groups.size > 0);
});

test("터미널 표의 모든 행이 같은 칸에서 시작한다", async () => {
  const board = await collectApiBoard();
  const lines = formatBoard(board)
    .split("\n")
    .filter((line) => line.startsWith("  ") && !line.startsWith("   "));

  // 글자 수가 아니라 터미널 폭으로 재야 한다. "구현"은 두 글자에 네 칸이고
  // "미착수"는 세 글자에 여섯 칸이라, 글자 수로 재면 맞은 표도 틀렸다고 나온다.
  const columns = new Set(lines.map((line) => displayWidth(line.slice(0, line.indexOf("/")))));
  assert.equal(columns.size, 1, `경로 칸이 줄마다 어긋납니다: ${[...columns].join(", ")}`);
});

test("HTML은 외부 자원을 하나도 부르지 않는다", async () => {
  const board = await collectApiBoard();
  const html = renderHtml(board, { generatedFrom: "테스트" });

  assert.match(html, /<title>VADA API 현황판<\/title>/);
  assert.doesNotMatch(html, /https?:\/\//);
  assert.doesNotMatch(html, /<script/);
});
