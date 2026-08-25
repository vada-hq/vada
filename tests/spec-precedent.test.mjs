import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  collectFieldPrecedents,
  findPrecedent
} from "../packages/contracts/src/spec-precedent.mjs";
import { draftScreenElements } from "../packages/contracts/src/screen-draft.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

async function loadScreen(screenId) {
  const dir = join(repoRoot, "specs", "figma", "vada-wireframe", "screens", screenId);
  return JSON.parse(await readFile(join(dir, "screen.json"), "utf8"));
}

async function loadDesign(screenId) {
  const dir = join(repoRoot, "specs", "figma", "vada-wireframe", "screens", screenId);
  return JSON.parse(await readFile(join(dir, "figma.design.json"), "utf8"));
}

test("같은 스코프의 같은 라벨은 fieldKey와 데이터 계약을 확정한다", async () => {
  const { entries } = collectFieldPrecedents([await loadScreen("ONB-01")]);
  const { confirmed } = findPrecedent(
    { entries },
    { label: "단과대학", stateScopeKey: "onboardingDraft" }
  );

  assert.equal(confirmed.fieldKey, "college");
  assert.deepEqual(confirmed.contract.optionsSource, {
    key: "education.colleges",
    params: { schoolId: { fieldKey: "school" } }
  });
  assert.deepEqual(confirmed.contract.resetOnChangeOf, ["school"]);
  assert.deepEqual(confirmed.screenIds, ["ONB-01"]);
});

// 반례가 실제로 있다. 라벨만 보고 물려주면 ORG-01에 school을 꽂는다.
test("다른 스코프의 같은 라벨은 확정하지 않고 후보로만 보고한다", async () => {
  const precedents = collectFieldPrecedents([await loadScreen("ONB-01")]);
  const { confirmed, candidates } = findPrecedent(precedents, {
    label: "학교",
    stateScopeKey: "orgCreationDraft"
  });

  assert.equal(confirmed, null);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].fieldKey, "school");
  assert.equal(candidates[0].stateScopeKey, "onboardingDraft");
});

test("스코프를 모르면 확정이 없고 후보만 나온다", async () => {
  const precedents = collectFieldPrecedents([await loadScreen("ONB-01")]);
  const { confirmed, candidates } = findPrecedent(precedents, { label: "학교" });

  assert.equal(confirmed, null);
  assert.equal(candidates.length, 1);
});

// 물려줄 것과 말 것의 경계: 같은 fieldKey면 같은 데이터이므로 데이터 계약은
// 같아야 하지만, 문구와 활성 여부는 화면마다 다르고 이미 디자인에서 유도된다.
test("화면마다 다른 속성은 계약에 넣지 않는다", async () => {
  const { entries } = collectFieldPrecedents([await loadScreen("ONB-01")]);
  const entry = entries.find((candidate) => candidate.fieldKey === "college");

  for (const key of ["placeholder", "disabledPlaceholder", "required", "initiallyDisabled", "searchable", "presentation", "label"]) {
    assert.equal(key in entry.contract, false, `${key}는 화면 고유인데 계약에 들어갔다`);
  }
  assert.equal(entry.contract.valueType, "string");
});

test("같은 스코프에서 한 라벨이 두 fieldKey를 가리키면 확정 대신 모순으로 보고한다", () => {
  const screens = [
    {
      screenId: "A",
      stateScopeKey: "draft",
      elements: [{ spec: { type: "input", fieldKey: "one", label: "이름", valueType: "string" } }]
    },
    {
      screenId: "B",
      stateScopeKey: "draft",
      elements: [{ spec: { type: "input", fieldKey: "two", label: "이름", valueType: "string" } }]
    }
  ];
  const precedents = collectFieldPrecedents(screens);

  assert.equal(precedents.conflicts.length, 1);
  assert.match(precedents.conflicts[0], /이름/u);
  const { confirmed } = findPrecedent(precedents, { label: "이름", stateScopeKey: "draft" });
  assert.equal(confirmed, null);
});

test("같은 fieldKey가 서로 다른 데이터 계약을 가지면 모순으로 보고한다", () => {
  const screens = [
    {
      screenId: "A",
      stateScopeKey: "draft",
      elements: [
        { spec: { type: "select", fieldKey: "school", label: "학교", optionsSource: { key: "a" } } }
      ]
    },
    {
      screenId: "B",
      stateScopeKey: "draft",
      elements: [
        { spec: { type: "select", fieldKey: "school", label: "학교", optionsSource: { key: "b" } } }
      ]
    }
  ];
  const precedents = collectFieldPrecedents(screens);

  assert.equal(precedents.conflicts.length, 1);
  assert.match(precedents.conflicts[0], /school/u);
});

// 키 순서는 데이터의 차이가 아니다. 정규화하지 않으면 같은 계약을 모순으로 본다.
test("키 순서만 다른 데이터 계약은 모순이 아니다", () => {
  const of = (source) => ({
    screenId: source.id,
    stateScopeKey: "draft",
    elements: [
      {
        spec: {
          type: "select",
          fieldKey: "college",
          label: "단과대학",
          optionsSource: { key: "colleges" },
          enabledWhen: source.condition
        }
      }
    ]
  });
  const precedents = collectFieldPrecedents([
    of({ id: "A", condition: [{ fieldKey: "school", operator: "hasValue" }] }),
    of({ id: "B", condition: [{ operator: "hasValue", fieldKey: "school" }] })
  ]);

  assert.deepEqual(precedents.conflicts, []);
  assert.deepEqual(
    findPrecedent(precedents, { label: "단과대학", stateScopeKey: "draft" }).confirmed.screenIds,
    ["A", "B"]
  );
});

test("선례를 주면 INV-01의 질문이 유도 불가한 것만 남는다", async () => {
  const design = await loadDesign("INV-01");
  const before = draftScreenElements(design).questions;

  const precedents = collectFieldPrecedents([await loadScreen("ONB-01")]);
  const { elements, questions } = draftScreenElements(design, {
    precedents,
    stateScopeKey: "onboardingDraft"
  });

  // 남는 것은 디자인에도 선례에도 없는 것뿐이다: 버튼의 이동 대상, 버튼 묶음
  // 읽기, note 파생 여부.
  assert.ok(
    questions.length < before.length,
    `선례가 질문을 줄이지 못했다: ${before.length} → ${questions.length}`
  );
  for (const question of questions) {
    assert.equal(
      /fieldKey|optionsSource|inputType|memberFieldKeys/u.test(question),
      false,
      `선례로 답할 수 있는 질문이 남았다: ${question}`
    );
  }

  const registered = await loadScreen("INV-01");
  const expected = new Map(
    registered.elements
      .filter((element) => "fieldKey" in element.spec)
      .map((element) => [element.source.nodeId, element.spec])
    );
  for (const element of elements) {
    const actual = expected.get(element.source.nodeId);
    if (!actual) {
      continue;
    }
    assert.equal(element.spec.fieldKey, actual.fieldKey);
    assert.deepEqual(element.spec.optionsSource, actual.optionsSource);
    assert.deepEqual(element.spec.enabledWhen, actual.enabledWhen);
    assert.deepEqual(element.spec.resetOnChangeOf, actual.resetOnChangeOf);
  }
});

test("묶음의 memberFieldKeys는 선례가 정해준 fieldKey로 채운다", async () => {
  const design = await loadDesign("INV-01");
  const precedents = collectFieldPrecedents([await loadScreen("ONB-01")]);
  const { elements } = draftScreenElements(design, {
    precedents,
    stateScopeKey: "onboardingDraft"
  });

  const group = elements.find((element) => element.spec.type === "group");
  assert.deepEqual(group.spec.memberFieldKeys, [
    "school",
    "college",
    "department",
    "currentGrade",
    "studentNumber"
  ]);
});
