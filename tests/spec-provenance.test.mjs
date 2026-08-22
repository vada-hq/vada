import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { classifySpecProvenance } from "../packages/contracts/src/spec-provenance.mjs";
import { collectFieldPrecedents } from "../packages/contracts/src/spec-precedent.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

async function load(screenId, file) {
  const dir = join(repoRoot, "specs", "figma", "vada-wireframe", "screens", screenId);
  return JSON.parse(await readFile(join(dir, file), "utf8"));
}

// 읽기 전용 확인 화면이 값만 나열하면 사람이 볼 것이 요소 × 속성만큼이다.
// 무엇이 기계에서 나왔고 무엇이 추정인지 갈라야 확인할 것이 줄어든다.
test("디자인에서 유도된 값과 사람이 채운 값을 가른다", async () => {
  const screen = await load("ONB-01", "screen.json");
  const design = await load("ONB-01", "figma.design.json");

  const { byNodeId, counts } = classifySpecProvenance({ screen, design });
  const school = byNodeId.get("7:39");

  // 라벨·필수 여부는 디자인이 말한다(라벨 끝의 * 가 필수를 뜻한다).
  assert.equal(school.label, "design");
  assert.equal(school.required, "design");
  // fieldKey와 카탈로그 key는 디자인에 없다.
  assert.equal(school.fieldKey, "authored");
  assert.equal(school.optionsSource, "authored");

  assert.ok(counts.design > 0 && counts.authored > 0);
  assert.equal(counts.design + counts.precedent + counts.authored, counts.total);
});

// 같은 스코프의 다른 화면이 이미 답한 것은 사람이 다시 정한 것이 아니다.
test("선례가 답한 값은 authored가 아니라 precedent로 센다", async () => {
  const screen = await load("INV-01", "screen.json");
  const design = await load("INV-01", "figma.design.json");
  const precedents = collectFieldPrecedents([await load("ONB-01", "screen.json")]);

  const withoutPrecedent = classifySpecProvenance({ screen, design });
  const withPrecedent = classifySpecProvenance({ screen, design, precedents });

  const school = withPrecedent.byNodeId.get("14:41");
  assert.equal(school.fieldKey, "precedent");
  assert.equal(school.optionsSource, "precedent");

  assert.equal(withoutPrecedent.byNodeId.get("14:41").fieldKey, "authored");
  assert.ok(withPrecedent.counts.authored < withoutPrecedent.counts.authored);
});

// 디자인에서 뽑히지 않는 요소(등록 노드가 초안에 없는 것)는 전부 authored다.
test("초안이 찾지 못한 요소의 값은 전부 authored다", async () => {
  const screen = await load("HOME-01K", "screen.json");
  const design = await load("HOME-01K", "figma.design.json");

  const { byNodeId } = classifySpecProvenance({ screen, design });
  // 16:88은 브리핑 카드 — 자식이 넷이라 섹션 모양이 아니어서 초안이 못 찾는다.
  const briefing = byNodeId.get("16:88");

  assert.ok(briefing);
  for (const source of Object.values(briefing)) {
    assert.equal(source, "authored");
  }
});
