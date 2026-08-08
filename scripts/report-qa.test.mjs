import assert from "node:assert/strict";
import { test } from "node:test";

import { checkItems, collectQa, errorContracts, formatQa, sectionBody } from "./report-qa.mjs";

test("절 제목부터 다음 절 직전까지만 읽는다", () => {
  const markdown = [
    "## 화면 구조",
    "- **머리말** — 제목과 행동",
    "",
    "## 상태",
    "**로딩** — 진행 상태만 알린다",
  ].join("\n");

  assert.match(sectionBody(markdown, "화면 구조"), /머리말/);
  assert.doesNotMatch(sectionBody(markdown, "화면 구조"), /로딩/);
});

test("제목에 덧말이 붙어도 앞부분으로 찾는다", () => {
  // 정본은 `## 상태`로도 `## 상태 (재정부)`로도 적을 수 있다.
  const markdown = "## 상태 (재정부 기준)\n**로딩** — 진행만 알린다\n";

  assert.match(sectionBody(markdown, "상태"), /로딩/);
});

test("없는 절은 빈 문자열이 아니라 null이다", () => {
  // 빈 절과 없는 절은 다르다. 없는 절을 항목 0개로 세면 정본이 절을 빠뜨린
  // 것을 "확인할 것이 없다"로 잘못 읽는다.
  assert.equal(sectionBody("## 상태\n내용\n", "화면 구조"), null);
});

test("굵게 시작하는 줄의 굵은 말이 확인 항목이다", () => {
  const body = [
    "- **상단 행동** — 내 구매 요청과 새 구매 요청",
    "**로딩** — 진행 상태만 알린다",
    "그냥 문장은 항목이 아니다.",
    "문장 가운데의 **굵은 말**은 항목이 아니다.",
  ].join("\n");

  assert.deepEqual(
    checkItems(body).map((item) => item.label),
    ["상단 행동", "로딩"],
  );
});

test("표와 인용은 근거이지 확인 항목이 아니다", () => {
  const body = [
    "| 요소 | **표시한다** | 이유 |",
    "> **인용문** 안의 굵은 말",
    "- **진짜 항목** — 설명",
  ].join("\n");

  assert.deepEqual(
    checkItems(body).map((item) => item.label),
    ["진짜 항목"],
  );
});

test("설명이 없는 항목도 항목으로 센다", () => {
  assert.deepEqual(checkItems("- **사이드바**"), [{ label: "사이드바", note: "" }]);
});

test("오류 계약만 실패 상태로 뽑는다", () => {
  assert.deepEqual(
    errorContracts([
      "API:event_budget.get_summary@R1",
      "ERROR:http.unauthenticated@R1",
      "ERROR:purchase_request.persistence_unavailable@R1",
    ]),
    ["http.unauthenticated@R1", "purchase_request.persistence_unavailable@R1"],
  );
});

test("정본 변형 이름으로도 화면을 찾는다", async () => {
  // 정본은 FIN-REQ-01B를, 사람은 FIN-REQ-01을 부른다.
  const report = await collectQa("FIN-REQ-01");

  assert.ok(report, "FIN-REQ-01 정본을 찾지 못했습니다.");
  assert.equal(report.wireframeScreen, "FIN-REQ-01B");
});

test("없는 화면은 null이다", async () => {
  assert.equal(await collectQa("EVT-NOPE-99"), null);
});

test("정본이 요구한 요소가 하나도 안 나오면 목록이 빈 채로 통과할 수 없다", async () => {
  const report = await collectQa("EVT-FIN-01");

  assert.ok(report);
  const structure = report.groups.find((group) => group.title === "있어야 하는 것");
  assert.ok(structure, "화면 구조를 읽지 못했습니다.");
  assert.ok(structure.items.length > 0, "확인 항목이 비어 있으면 무엇이든 통과합니다.");
});

test("없어야 하는 것을 있어야 하는 것과 따로 찍는다", async () => {
  // MVP가 와이어프레임을 잘라낸 프로젝트다. "안 보이는 게 맞다"를 확인할
  // 방법이 없으면 매번 버그처럼 보인다.
  const report = await collectQa("EVT-FIN-01");
  const titles = report.groups.map((group) => group.title);

  assert.ok(titles.includes("있어야 하는 것"));
  assert.ok(titles.includes("없어야 하는 것"));
});

test("공통 합격 기준을 복사하지 않고 가리킨다", async () => {
  const report = await collectQa("EVT-FIN-01");
  const text = formatQa(report);

  assert.match(text, /VADA_SCREEN_QA\.md/);
  // 표를 그대로 옮겨 오면 두 곳이 되고 반드시 틀어진다.
  assert.doesNotMatch(text, /\| 구분 \| 합격 기준 \|/);
});

test("띄우는 명령과 경로를 함께 찍는다", async () => {
  const text = formatQa(await collectQa("EVT-FIN-01"));

  assert.match(text, /just dev-web-mock/);
  assert.match(text, /\/events\/\$eventId\/finance/);
});

test("정본이 적어 둔 한계를 목록에 함께 찍는다", async () => {
  // 한계를 안 찍으면 사람이 그것을 버그로 다시 보고한다. 실제로 EVT-FIN-01의
  // `보완 중` 표시가 그럴 뻔했다 — 계약이 두 상태를 합쳐 화면이 구분할 수 없다.
  const report = await collectQa("EVT-FIN-01");
  const limits = report.groups.find((group) => group.title.startsWith("아직 못 하는 것"));

  assert.ok(limits, "열린 질문을 읽지 못했습니다.");
  assert.ok(limits.items.length > 0);
  assert.match(limits.hint, /버그가 아니라/);
});

test("이 화면이 놓인 흐름을 알려준다", async () => {
  // 알려주지 않으면 사람이 목록을 끝까지 보고도 흐름 검증이 있는 줄 모른다.
  // 실제로 그랬다. 화면 목록만 보고 "플로우 테스트는 없는 거냐"고 물었다.
  const text = formatQa(await collectQa("EVT-FIN-01"));

  assert.match(text, /이 화면 하나만 본다/);
  assert.match(text, /just flow FLOW-FIN-001/);
});

test("흐름 정본이 없는 화면에는 없다고 말한다", async () => {
  // 빈 칸을 두면 흐름이 있는데 못 찾은 것인지 원래 없는 것인지 모른다.
  const report = await collectQa("ORG-04B");
  if (!report) return;

  assert.match(formatQa(report), /흐름 정본이 아직 없다|just flow /);
});
