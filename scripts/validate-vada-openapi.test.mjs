import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  componentNameFor,
  loadApprovedSurface,
  tagFor,
} from "./contract-openapi/surface.mjs";
import { buildVadaOpenApi } from "./validate-vada-openapi.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// CB-FIN-001이 손으로 적어 두었던 이름이다. 유도 규칙이 이것을 그대로 재현해야
// 그 대응표를 지울 수 있다. 하나라도 어긋나면 생성되는 타입 이름이 바뀌고,
// 그 타입을 쓰는 화면이 전부 깨진다.
const APPROVED_NAMES = [
  ["DATA:purchase_request.input@R1", "PurchaseRequestInput"],
  ["DATA:purchase_request.draft_content@R1", "PurchaseRequestDraftContent"],
  [
    "DATA:purchase_request.draft_save_command@R1",
    "PurchaseRequestDraftSaveCommand",
  ],
  ["DATA:purchase_request.draft@R1", "PurchaseRequestDraft"],
  ["DATA:purchase_request.editor_state@R1", "PurchaseRequestEditorState"],
  ["DATA:purchase_request.submit_command@R1", "PurchaseRequestSubmitCommand"],
  ["DATA:purchase_request.record@R1", "PurchaseRequestRecord"],
  ["DATA:purchase_request.detail_view@R1", "PurchaseRequestDetailView"],
  ["DATA:purchase_request.own_list@R1", "PurchaseRequestOwnList"],
  ["DATA:http.empty_body@R1", "EmptyBody"],
  ["DATA:http.problem_details@R1", "ProblemDetails"],
];

test("component 이름 유도가 승인된 이름을 그대로 재현한다", () => {
  for (const [contractId, expected] of APPROVED_NAMES) {
    assert.equal(componentNameFor(contractId), expected, contractId);
  }
});

test("HTTP는 도메인이 아니므로 타입 이름에 남기지 않는다", () => {
  assert.equal(componentNameFor("DATA:http.problem_details@R1"), "ProblemDetails");
  assert.equal(componentNameFor("DATA:session.viewer@R1"), "SessionViewer");
});

test("tag는 계약의 도메인에서 나온다", () => {
  assert.equal(tagFor("API:purchase_request.submit@R1"), "Purchase Request");
  assert.equal(tagFor("API:session.get_viewer@R1"), "Session");
});

test("같은 입력에서 같은 문서가 나온다", async () => {
  const [first, second] = await Promise.all([
    buildVadaOpenApi(repositoryRoot),
    buildVadaOpenApi(repositoryRoot),
  ]);

  assert.deepEqual(first, second);
});

// 상속된 계약을 문서에 넣으면 CB-FIN-001의 operation이 묶음 수만큼 중복된다.
test("묶음이 상속한 계약을 다시 싣지 않는다", async () => {
  const surface = await loadApprovedSurface(repositoryRoot);

  assert.equal(
    new Set(surface.apiContractIds).size,
    surface.apiContractIds.length,
  );
});

// 대체된 리비전이 남아 있으면 같은 경로에 두 operation이 생긴다.
test("대체된 계약 리비전은 싣지 않는다", async () => {
  const surface = await loadApprovedSurface(repositoryRoot);

  assert.ok(
    surface.apiContractIds.includes("API:purchase_request.get_detail@R2"),
  );
  assert.ok(
    !surface.apiContractIds.includes("API:purchase_request.get_detail@R1"),
  );
});

test("문서가 가리키는 스키마가 전부 실제로 있다", async () => {
  const document = await buildVadaOpenApi(repositoryRoot);
  const declared = new Set(Object.keys(document.components.schemas));
  const referenced = new Set();

  const walk = (value) => {
    if (Array.isArray(value)) return value.forEach(walk);
    if (value === null || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      if (key === "$ref" && typeof child === "string") {
        const match = child.match(/^#\/components\/schemas\/([^/]+)/);
        if (match) referenced.add(match[1]);
      } else walk(child);
    }
  };
  walk(document.paths);
  walk(document.components.schemas);

  const missing = [...referenced].filter((name) => !declared.has(name));
  assert.deepEqual(missing, [], "문서에 없는 스키마를 가리킵니다");
});

// 승인 증거(EVID-027)가 가리키는 산출물이다. 합친 문서로 덮으면 그 기록이
// 자기가 승인한 것과 다른 것을 가리키게 된다.
test("승인 증거가 가리키는 문서는 건드리지 않는다", async () => {
  const approved = JSON.parse(
    await readFile(
      resolve(repositoryRoot, "contracts/openapi/CB-FIN-001/R2.json"),
      "utf8",
    ),
  );

  assert.equal(approved.info.title, "VADA Purchase Request API");
  assert.equal(approved["x-vada-completion-evidence"], "EVID-027");
});
