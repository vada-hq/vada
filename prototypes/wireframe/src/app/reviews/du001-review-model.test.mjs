import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { REVIEW_CONTEXT, REVIEW_REQUEST, createReviewState, transitionReviewState } from "./du001-review-model.mjs";

test("정상 제출은 작성 화면에서 목록과 상세 확인으로 이어진다", () => {
  const initial = createReviewState("happy-path");
  const submitted = transitionReviewState(initial, "submit");
  const detail = transitionReviewState(submitted, "open-detail");
  const reloaded = transitionReviewState(detail, "refresh-detail");

  assert.equal(initial.view, "editor");
  assert.equal(submitted.view, "list");
  assert.equal(submitted.status, "submitted");
  assert.equal(detail.view, "detail");
  assert.equal(reloaded.status, "reloaded");
});

test("서버 초안 시나리오는 복원 상태로 시작하고 저장 성공을 표시한다", () => {
  const initial = createReviewState("restored-draft");
  const saved = transitionReviewState(initial, "save-draft");

  assert.equal(initial.status, "draft-restored");
  assert.equal(saved.view, "editor");
  assert.equal(saved.status, "draft-saved");
});

test("입력 오류와 서버 장애는 입력 화면을 떠나거나 거짓 성공을 표시하지 않는다", () => {
  const invalid = transitionReviewState(createReviewState("validation-error"), "submit");
  const unavailable = transitionReviewState(createReviewState("server-unavailable"), "save-draft");

  assert.deepEqual({ view: invalid.view, status: invalid.status }, { view: "editor", status: "validation-error" });
  assert.deepEqual(
    { view: unavailable.view, status: unavailable.status },
    { view: "editor", status: "server-unavailable" },
  );
});

test("권한 없는 사용자는 작성·저장·제출 상태로 진입하지 않는다", () => {
  const initial = createReviewState("forbidden");
  const afterSubmit = transitionReviewState(initial, "submit");

  assert.equal(initial.view, "forbidden");
  assert.deepEqual(afterSubmit, initial);
});

test("검토 화면의 예시는 승인 계약 픽스처 R2에서 벗어나지 않는다", async () => {
  const fixturePath = new URL("../../../../../contracts/fixtures/CB-FIN-001/R2.json", import.meta.url);
  const fixtureSet = JSON.parse(await readFile(fixturePath, "utf8"));
  const detail = fixtureSet.data_examples.find(({ id }) => id === "purchase-request-detail-view").value;

  assert.deepEqual(REVIEW_CONTEXT, {
    eventName: detail.display.eventName,
    requesterName: detail.display.requesterName,
    departmentName: "기획부",
  });
  assert.equal(REVIEW_REQUEST.requestId, detail.record.requestId);
  assert.equal(REVIEW_REQUEST.title, detail.record.content.title);
  assert.equal(REVIEW_REQUEST.estimatedTotal, detail.record.estimatedTotal);
  assert.deepEqual(
    REVIEW_REQUEST.items.map(({ name, quantity, unit, estimatedUnitPrice, estimatedAmount }) => ({
      name,
      quantity,
      unit,
      estimatedUnitPrice,
      estimatedAmount,
    })),
    detail.record.content.items.map((item, index) => ({
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      estimatedUnitPrice: item.estimatedUnitPrice,
      estimatedAmount: detail.record.itemResults[index].estimatedAmount,
    })),
  );
});
