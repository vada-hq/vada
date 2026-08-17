import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  compareWithSpec,
  draftScreenElements
} from "../packages/contracts/src/screen-draft.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

async function loadScreen(screenId) {
  const dir = join(repoRoot, "specs", "figma", "vada-wireframe", "screens", screenId);
  return {
    design: JSON.parse(await readFile(join(dir, "figma.design.json"), "utf8")),
    spec: JSON.parse(await readFile(join(dir, "screen.json"), "utf8"))
  };
}

// 등록된 요소를 초안이 얼마나 재현하는가. 화면이 늘면 여기에 줄을 추가한다.
// 유도 불가는 의도된 미달이며 그 이유가 서로 다르다:
//   ORG-01 note  — 완성된 문자열만 그려져 있어 파생 여부를 알 수 없다
//   ORG-02 select — 버튼 묶음이 '각각 버튼'인지 '하나 고르기'인지 색으로만 갈리는데
//                   그건 이 제품의 디자인 시스템이라 파이프라인이 알 수 없다
//   ORG-02 list   — 조직도 구조는 사례가 하나뿐이라 아직 일반화하지 않는다
const EXPECTED = [
  { screenId: "ONB-01", derivable: 7, notDerivable: 0 },
  { screenId: "ONB-02", derivable: 3, notDerivable: 0 },
  { screenId: "ORG-01", derivable: 8, notDerivable: 1 },
  { screenId: "ORG-02", derivable: 2, notDerivable: 2 }
];

for (const { screenId, derivable, notDerivable } of EXPECTED) {
  test(`${screenId}의 등록 요소를 초안이 재현한다(유도 불가 제외)`, async () => {
    const { design, spec } = await loadScreen(screenId);
    const { elements } = draftScreenElements(design);
    const rows = compareWithSpec(elements, spec.elements).filter(
      (row) => !row.actual.includes("등록되지 않은 요소")
    );

    const derived = rows.filter((row) => row.matched && row.typeMatch && row.labelMatch);
    assert.equal(
      derived.length,
      derivable,
      `재현 실패: ${rows
        .filter((row) => !(row.matched && row.typeMatch && row.labelMatch))
        .map((row) => `${row.actual} ← ${row.draft}`)
        .join(" | ")}`
    );
    assert.equal(
      rows.length - derived.length,
      notDerivable,
      "유도 불가 요소 수가 기대와 다릅니다"
    );
  });
}

test("애매한 버튼 묶음은 추측하지 않고 두 가지 읽기를 질문한다", async () => {
  const { design } = await loadScreen("ORG-02");
  const { questions } = draftScreenElements(design);

  assert.ok(
    questions.some(
      (question) => question.includes("기본 조직, 빈 조직") && question.includes("choiceGroup")
    ),
    "라디오 카드로도 읽힐 수 있음을 알려야 한다"
  );
  assert.ok(
    questions.some((question) => question.includes("텍스트 없는 조작")),
    "항목 내부 조작(… 메뉴)은 화면 요소로 뽑지 않고 질문해야 한다"
  );
});

test("초안은 사람만 아는 값을 추측하지 않고 질문으로 보고한다", async () => {
  const { design } = await loadScreen("ORG-01");
  const { elements, questions } = draftScreenElements(design);

  for (const element of elements) {
    if (element.spec.type === "input" || element.spec.type === "select") {
      assert.equal(element.spec.fieldKey, undefined, "fieldKey는 디자인에 없으므로 비워야 한다");
    }
    if (element.spec.type === "select") {
      assert.equal(
        element.spec.optionsSource,
        undefined,
        "선택지 출처는 디자인에 없으므로 비워야 한다"
      );
    }
    if (element.spec.type === "button") {
      assert.equal(element.spec.action, undefined, "이동 대상은 디자인에 없으므로 비워야 한다");
    }
  }

  const asks = (part) => questions.some((question) => question.includes(part));
  assert.ok(asks("fieldKey"), "fieldKey를 물어야 한다");
  assert.ok(asks("optionsSource.key"), "선택지 출처를 물어야 한다");
  assert.ok(asks("targetScreenId"), "이동 대상을 물어야 한다");
  assert.ok(asks("note 요소"), "note 판정 불가를 알려야 한다");
});

test("비활성 select의 문구는 placeholder가 아니라 disabledPlaceholder다", async () => {
  const { design } = await loadScreen("ORG-01");
  const { elements, questions } = draftScreenElements(design);
  const disabled = elements.find(
    (element) => element.spec.type === "select" && element.spec.initiallyDisabled
  );

  assert.equal(disabled.spec.disabledPlaceholder, "학교를 먼저 선택하세요");
  assert.equal(disabled.spec.placeholder, null, "활성 문구는 디자인에 없다");
  assert.ok(
    questions.some((question) => question.includes("활성 상태 문구가 필요합니다")),
    "활성 문구를 물어야 한다"
  );
});

test("화면 카드 전체는 묶음으로 오인하지 않는다", async () => {
  for (const screenId of ["ONB-01", "ORG-01"]) {
    const { design } = await loadScreen(screenId);
    const groups = draftScreenElements(design).elements.filter(
      (element) => element.spec.type === "group"
    );
    // 카드 전체(버튼을 품는 컨테이너)를 잡으면 화면 제목이 묶음 제목으로 새어 나온다.
    assert.ok(
      groups.every((group) => group.spec.title.length < 20),
      `${screenId}에서 카드 전체를 묶음으로 잡았다: ${groups.map((g) => g.spec.title).join(", ")}`
    );
  }
});
