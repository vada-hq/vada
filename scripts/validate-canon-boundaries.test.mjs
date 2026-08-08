import assert from "node:assert/strict";
import { test } from "node:test";

import {
  HISTORY_SUBTREES,
  LIVE_SUBTREES,
  classify,
  referencedPaths,
  validateCanonBoundaries,
} from "./validate-canon-boundaries.mjs";

test("살아 있는 갈래와 역사를 갈라 본다", () => {
  assert.equal(classify("product-specs/flows/FLOW-FIN-001/R2.json"), "live");
  assert.equal(classify("delivery-units/DU-001/screen-spec/R3.json"), "history");
  assert.equal(classify("screens/EVTFIN01.md"), "other");
});

test("갈래 이름만 겹치는 경로를 잘못 세지 않는다", () => {
  // `product-specs/flows-old/`는 `product-specs/flows`로 시작하지만 다른 곳이다.
  assert.equal(classify("product-specs/flows-old/X.json"), "other");
});

test("외부 규격과 대화 기록은 경계 검사 대상이 아니다", () => {
  const bundle = {
    sources: [
      { type: "standard", locator: "https://www.rfc-editor.org/rfc/rfc9457" },
      { type: "user_statement", locator: "current-thread/approval-2026-08-03" },
      { type: "document", locator: "product-specs/flows/FLOW-FIN-001/R2.json#abc" },
    ],
  };

  assert.deepEqual(
    referencedPaths(bundle).map((entry) => entry.path),
    ["product-specs/flows/FLOW-FIN-001/R2.json"],
  );
});

test("내용 해시를 경로에서 떼어 낸다", () => {
  const bundle = {
    sources: [{ type: "document", locator: "product-specs/domains/DOMAIN-FIN/R1.json#c8d4" }],
  };

  assert.equal(referencedPaths(bundle)[0].path, "product-specs/domains/DOMAIN-FIN/R1.json");
});

test("관찰은 과거 기록을 가리켜도 된다", async () => {
  // 관찰은 그때 본 것이다. 출처가 과거 산출물인 것이 자연스럽다.
  const bundle = {
    sources: [
      { type: "observation", locator: "delivery-units/DU-001/screen-spec/draft.json#GAP" },
    ],
  };

  assert.equal(referencedPaths(bundle)[0].current, false);
});

test("지금의 근거는 역사를 가리킬 수 없다", () => {
  const bundle = {
    solution_ref: { path: "delivery-units/DU-001/solution.json" },
  };
  const [entry] = referencedPaths(bundle);

  assert.equal(entry.current, true);
  assert.equal(classify(entry.path), "history");
});

test("선언한 갈래가 저장소에 실제로 있다", async () => {
  // 목록이 낡으면 검사가 조용히 헐거워진다. 없어진 갈래를 오류로 낸다.
  const { errors } = await validateCanonBoundaries();

  for (const subtree of [...LIVE_SUBTREES, ...HISTORY_SUBTREES]) {
    assert.ok(
      !errors.some((error) => error.startsWith(`${subtree}: 선언된 갈래가`)),
      `${subtree}: 선언했는데 저장소에 없습니다.`,
    );
  }
});

test("저장소가 지금 경계를 지키고 있다", async () => {
  const { errors, checked } = await validateCanonBoundaries();

  assert.ok(checked.length > 0, "참조를 하나도 읽지 못하면 무엇이든 통과합니다.");
  assert.deepEqual(errors, []);
});

test("흐름 정본이 살아 있는 갈래에 있다", async () => {
  // 이 검증기를 만든 이유다. flows/가 역사로 분류되면 다시 놓친다.
  const { checked } = await validateCanonBoundaries();

  assert.ok(
    checked.some((line) => line.includes("product-specs/flows/") && line.includes("(live)")),
    "흐름 정본을 살아 있는 근거로 세지 않습니다.",
  );
});
