import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  compareWithSpec,
  draftScreenElements
} from "../packages/contracts/src/screen-draft.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

async function loadDesign(screenId) {
  const dir = join(repoRoot, "specs", "figma", "vada-wireframe", "screens", screenId);
  return JSON.parse(await readFile(join(dir, "figma.design.json"), "utf8"));
}

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

// 대시보드의 섹션은 '제목 헤더 + 닮은 형제 묶음' 정확히 둘로 이루어진다.
// 그 안의 항목은 화면 요소가 아니라 데이터의 되풀이다 — 항목마다 요소를
// 뽑으면 행사 카드와 일정 행이 전부 button이 된다(HOME-01K에서 10건).
//
// ONB-02의 시작 방식 카드도 닮은 형제 둘이지만 각각 별도 버튼이다. 갈리는
// 곳은 부모다: 그쪽 부모(14:93)는 화면 카드 전체라 자식이 6개다.
// 화면 전체에 대한 눈금. 화면별 표는 폼 화면 넷만 보므로 목록 화면이 나빠져도
// 조용하다. 여기서 총합을 래칫으로 잠근다 — 규칙을 손댈 때마다 이 수치를 보고
// 고르라는 뜻이다(2026-08-24: 맞춤 36 → 41, 헛것 41 → 19).
//
// **화면 목록을 손으로 적지 않는다(2026-08-25).** 열한 개를 적어 두었더니 뒤에
// 만든 작업 공간 화면 다섯이 눈금 밖에 있었고, 그동안 그 화면들에서 헛것이
// 28개까지 자랐는데 이 검사는 조용했다. 이제 등록된 화면 전부를 센다 —
// 화면을 하나 더 명세하면 저절로 눈금에 든다.
// 화면마다의 눈금.
//
// **총합 재현율은 회귀 탐지기가 아니었다.** 화면이 늘고 그중 어려운 것이 섞이면
// 저절로 내려가고, 그때마다 사람이 "이번은 괜찮다"고 판단해 내리게 된다 - 실제로
// 2026-08-27 하루에 세 번 내렸다. 그러면 눈금이 아니라 기록이다.
//
// 그래서 **화면마다 잠근다.** 새 화면은 줄을 더하고, 이미 있는 화면은 내려갈 수
// 없다. 추출기를 고쳐 어느 화면이 나아지면 그 줄을 올린다. 총합은 아래에 흐름으로
// 남겨 두되 잠그지는 않는다 - 재는 것이 다르기 때문이다.
//
// 줄을 더할 때 그 수가 낮아도 괜찮다. **낮다는 사실이 기록되는 것**이 이 표의
// 일이고, 그 화면 계급을 추출기가 못 읽는다는 증거가 된다(ORG-00·OPS-00의 허브,
// ORG-03A·ORG-03B의 나란한 되풀이 카드).
const FLOOR = {
  "EVT-00A": { matched: 3, spurious: 0 },
  "EVT-02": { matched: 3, spurious: 0 },
  "EVT-04": { matched: 6, spurious: 3 },
  "EVT-DOC-01": { matched: 2, spurious: 0 },
  "EVT-FIN-01": { matched: 3, spurious: 2 },
  "EVT-MEET-01": { matched: 2, spurious: 0 },
  "EVT-SCHED-01": { matched: 3, spurious: 0 },
  "EVT-TASK-01": { matched: 5, spurious: 2 },
  "EVT-TASK-02": { matched: 4, spurious: 2 },
  "FIN-EVID-01": { matched: 3, spurious: 2 },
  "FIN-PROC-01": { matched: 2, spurious: 0 },
  "FIN-REQ-01": { matched: 18, spurious: 41 },
  "FIN-REQ-02": { matched: 3, spurious: 0 },
  "FIN-REV-01": { matched: 1, spurious: 5 },
  "FIN-SUP-01": { matched: 2, spurious: 4 },
  "HOME-01K": { matched: 7, spurious: 0 },
  "INV-01": { matched: 8, spurious: 0 },
  "MY-01": { matched: 3, spurious: 0 },
  "MY-REQ-01": { matched: 1, spurious: 1 },
  "ONB-01": { matched: 7, spurious: 2 },
  "ONB-02": { matched: 3, spurious: 0 },
  "OPS-00": { matched: 0, spurious: 1 },
  "OPS-MEET-01A": { matched: 2, spurious: 0 },
  "ORG-00": { matched: 0, spurious: 1 },
  "ORG-01": { matched: 8, spurious: 0 },
  "ORG-02": { matched: 2, spurious: 2 },
  "ORG-03A": { matched: 1, spurious: 4 },
  "ORG-03B": { matched: 4, spurious: 6 },
  "ORG-03C": { matched: 2, spurious: 2 },
  // 추출기가 **아무것도 못 뽑은 첫 화면**이다. 표 하나가 화면의 대부분이고
  // 배너·카드·표·각주가 전부 컨테이너 이름만 다른 상자라 걸리는 규칙이 없다.
  "ORG-04": { matched: 0, spurious: 0 },
  "ORG-04B": { matched: 3, spurious: 1 },
  "TASK-01": { matched: 5, spurious: 2 }
};

test("초안 재현율이 떨어지지 않는다(등록된 화면 전부)", async () => {
  const shell = JSON.parse(
    await readFile(
      join(repoRoot, "specs", "figma", "vada-wireframe", "shell.json"),
      "utf8"
    )
  );
  const screensDir = join(repoRoot, "specs", "figma", "vada-wireframe", "screens");
  const screenIds = [];
  for (const dirent of await readdir(screensDir, { withFileTypes: true })) {
    if (!dirent.isDirectory()) {
      continue;
    }
    try {
      await readFile(join(screensDir, dirent.name, "screen.json"), "utf8");
      screenIds.push(dirent.name);
    } catch {
      continue; // 아직 명세되지 않은 화면
    }
  }

  let registered = 0;
  let matched = 0;
  let spurious = 0;
  let topRegistered = 0;
  let topMatched = 0;
  const missing = [];
  const fell = [];
  const worse = [];
  for (const screenId of screenIds) {
    const { design, spec } = await loadScreen(screenId);
    const { elements } = draftScreenElements(design, {
      excludeNodeNames: shell.design?.excludeNodeNames,
      // 갈피 줄은 화면의 요소가 아니다. 그 문구를 셸이 갖고 있다.
      workspaces: shell.workspaces
    });
    // 되풀이되는 항목의 칸도 등록된 요소다(list.itemFields). 명세가 적는 것은
    // 항목 하나의 틀이고 design은 항목 넷을 그리므로, 나머지 셋은 여기서
    // '헛것'으로 잡힌다 — 그것이 사실이다. 추출기는 아직 되풀이를 못 본다.
    const declared = spec.elements.flatMap((element) => [
      element,
      ...(element.spec?.itemFields ?? [])
    ]);
    const rows = compareWithSpec(elements, declared);
    const hit = rows.filter((row) => row.matched && row.typeMatch && row.labelMatch).length;
    registered += declared.length;
    matched += hit;
    spurious += rows.length - declared.length;

    // **최상위만 따로 센다.** 추출기는 중첩 요소를 만들 개념이 아예 없어서
    // (itemFields는 사람이 쓰는 것이다) 중첩은 못 맞힌 것이 아니라 겨룰 수
    // 없는 것이다. 둘을 한 분모에 넣으면 중첩을 쓰는 화면을 명세할 때마다
    // 재현율이 저절로 내려가고, 그것을 추출기가 나빠진 것으로 읽게 된다.
    const topDeclared = spec.elements;
    const topRows = compareWithSpec(elements, topDeclared);
    topRegistered += topDeclared.length;
    topMatched += topRows.filter(
      (row) => row.matched && row.typeMatch && row.labelMatch
    ).length;

    const noise = rows.length - declared.length;
    worse.push(`${screenId} ${hit}/${declared.length}(헛것 ${noise})`);

    // **화면마다 잠근다.** 새 화면이면 줄을 더하라고 말하고, 있던 화면이면
    // 내려갔는지 본다. 총합만 보면 어려운 화면이 하나 들어올 때마다 내려가고
    // 그때마다 사람이 눈금을 내리게 된다.
    const floor = FLOOR[screenId];
    if (floor === undefined) {
      missing.push(`  "${screenId}": { matched: ${hit}, spurious: ${noise} }`);
    } else {
      if (hit < floor.matched) {
        fell.push(`${screenId}: 맞춤 ${floor.matched} → ${hit}`);
      }
      if (noise > floor.spurious) {
        fell.push(`${screenId}: 헛것 ${floor.spurious} → ${noise}`);
      }
    }
  }

  // 눈금의 흐름. **새 줄을 맨 위에 더한다.**
  //
  // 한동안 절대값만 잠갔다. 그랬더니 **등록이 늘 때마다 검사가 저절로 쉬워졌다** -
  // matched >= N은 분모가 커지면 통과하기 쉬워지므로, 재현율이 61.3%에서 54.6%로
  // 떨어지는 동안 검사는 한 번도 울리지 않았다. 검사 이름이 "재현율이 떨어지지
  // 않는다"인데 재현율을 재지 않고 있었다.
  //
  // 재현율은 곧 **사람 개입이 늘고 있는가**다(implementation-methodology.md의 수렴
  // 지표). 떨어진다는 것은 명세의 어휘가 추출기보다 빨리 자란다는 뜻이고, 그것이
  // 사실이더라도 조용히 지나가서는 안 된다.
  //
  // 등록  맞춤  헛것   재현율   헛것/등록   그 사이클
  //  197   106    70    53.8%     35.5%    ORG-00 (허브 - 아래를 보라)
  //  194   106    69    54.6%     35.6%    FIN-EVID-01 (묶음 안 목록 둘)
  //  185   103    67    55.7%     36.2%    FIN-PROC-01 (묶음으로 오는 목록)
  //  182   101    67    55.5%     36.8%    FIN-REV-01 (표 안에서 고치기)
  //  171   100    62    58.5%     36.3%    FIN-SUP-01 (칸이 데이터에서)
  //  162    98    58    60.5%     35.8%    MY-REQ-01
  //  156    97    57    62.2%     36.5%    FIN-REQ-02
  //  124    76    16    61.3%     12.9%    FIN-REQ-01 앞
  //
  // 헛것이 12.9%에서 35.6%로 뛴 것은 FIN-REQ-01 하나에서 39개가 나왔기 때문이다
  // (같은 품목 넷을 네 요소로 뽑는다). 그 뒤로는 비율이 거의 안 움직인다 - **같은
  // 계급이 되풀이될 뿐 새로 나빠지지는 않는다**는 뜻이다.
  //
  // **ORG-00에서 내린 것은 성질이 다르다.** 추출기가 틀린 것이 아니라 **물었다** -
  // "항목 3개가 되풀이됩니다. 항목 수가 명세에 고정이면 summary, 데이터에 달렸으면
  // itemList입니다"라고 정확히 되물었고, 디자인만 보고는 답할 수 없는 것이 맞다.
  // 사람이 답했더니 등록 셋이 전부 '못 맞춘 것'으로 세어졌다.
  //
  // 같은 일이 OPS-00에서도 났다(0/6). **허브 화면이 한 계급이다** - 되풀이되는 카드
  // 셋이 실은 제품이 정한 고정 구조이고, 저마다 다른 화면으로 간다. 이 눈금은
  // '재고 틀린 것'과 '물어서 답 받은 것'을 못 가른다. 그것이 진짜 결함이고
  // BACKLOG에 있다 - 대조기가 '재고 통과한 것'과 '아예 안 본 것'을 못 가르는 것과
  // 같은 계급이다.
  //
  // 재현율은 다르다. 꾸준히 내려간다. 추출기가 모르는 어휘가 계속 생기기 때문이고,
  // **그것을 멈추려면 추출기를 넓히거나 어휘를 줄여야 한다.** 눈금을 내리는 것은
  // 셋째 선택이며, 내릴 때는 위 표에 줄을 더해 왜 내렸는지가 보이게 한다.

  const recall = matched / registered;
  const noise = spurious / registered;
  // 어느 눈금이 울리든 지금 자리가 다 보이게 한다. 하나만 보여주면 옆의 것이
  // 어떻게 움직였는지 모른 채로 눈금을 옮기게 된다 - 실제로 그렇게 놓쳤다.
  const topRecall = topMatched / topRegistered;
  const now =
    `등록 ${registered} 맞춤 ${matched} 헛것 ${spurious} ` +
    `| 재현율 ${(recall * 100).toFixed(1)}% 헛것/등록 ${(noise * 100).toFixed(1)}% ` +
    `| 최상위 ${topMatched}/${topRegistered} = ${(topRecall * 100).toFixed(1)}%`;

  // **화면마다의 눈금이 이 검사의 본체다.** 총합은 흐름을 보는 눈이지 잠금이 아니다.
  assert.equal(
    missing.length,
    0,
    `눈금에 없는 화면이 있습니다. 아래 줄을 FLOOR에 더하세요.\n${missing.join(","+"\n")}\n\n${now}`
  );
  assert.equal(
    fell.length,
    0,
    `이 화면들의 맞춤이 줄거나 헛것이 늘었습니다.\n추출기가 나빠졌거나, 명세가 다른 노드를 등록한 것입니다.\n${fell.join("\n")}\n\n${now}`
  );
});

test("헤더 안의 화면 동작도 뽑는다", async () => {
  // 헤더를 통째로 셸로 제외하면 그 안의 버튼이 원리적으로 보이지 않는다.
  // TASK-01의 '업무 추가'(18:86)가 그렇게 명세에서 빠져 있었다.
  const design = await loadDesign("TASK-01");
  const { elements } = draftScreenElements(design, { excludeNodeNames: ["Sidebar"] });

  const add = elements.find((element) => element.source.nodeId === "18:86");
  assert.ok(add, "헤더의 버튼을 뽑지 못했습니다");
  assert.equal(add.spec.type, "button");
  assert.equal(add.spec.label, "업무 추가");
});

test("카드 안의 한 줄짜리 되풀이는 목록으로 읽지 않는다", async () => {
  // OPS-MEET-01A에서 카드 하나하나가 itemList로 뽑히던 오독. 카드 안의
  // '아이콘+날짜 / 아이콘+장소 / 아이콘+주최자' 줄은 되풀이지만 항목이 아니다.
  const design = await loadDesign("OPS-MEET-01A");
  const { elements } = draftScreenElements(design, { excludeNodeNames: ["Sidebar"] });

  const insideCards = elements.filter(
    (element) => element.spec.type === "itemList" && element.source.nodeId !== "18:437"
  );
  assert.deepEqual(
    insideCards.map((element) => element.source.nodeId),
    [],
    "회의 카드 안을 목록으로 읽었습니다"
  );
});

test("라벨이 없는 컨트롤도 필드로 뽑는다", async () => {
  // EVT-00A의 검색칸(20:4153)은 Label 노드 없이 placeholder만 있다. 라벨 노드를
  // 요구하면 이런 칸은 통째로 보이지 않는다 — 초안에 버튼 4개만 나온 원인이다.
  const design = await loadDesign("EVT-00A");
  const { elements, questions } = draftScreenElements(design);

  const search = elements.find((element) => element.source.nodeId === "20:4153");
  assert.ok(search, "라벨 없는 Text Input을 뽑지 못했습니다");
  assert.equal(search.spec.type, "input");
  // 라벨이 없으니 그려진 문구를 라벨로 두되, 그것이 추정임을 질문으로 알린다.
  assert.equal(search.spec.label, "행사명 검색");
  assert.ok(
    questions.some((question) => question.includes("20:4153") && question.includes("라벨")),
    "라벨을 문구에서 짐작했다는 것을 알리지 않습니다"
  );
});

test("선택지도 문구도 없는 드롭다운은 뽑지 않고 질문한다", async () => {
  // EVT-00A의 20:4166은 빈 프레임이다. MY-01에서도 같은 자리를 명세에서 뺐다.
  // 조용히 빠뜨리는 대신 질문으로 남긴다.
  const design = await loadDesign("EVT-00A");
  const { elements, questions } = draftScreenElements(design);

  assert.equal(
    elements.find((element) => element.source.nodeId === "20:4166"),
    undefined
  );
  assert.ok(questions.some((question) => question.includes("20:4166")));
});

test("제목 없는 맨 되풀이 묶음도 목록으로 뽑는다", async () => {
  // EVT-00A의 카드 목록(20:4167)에는 제목이 없다. 제목을 요구하면 목록 자체가
  // 보이지 않는다. 유형은 여전히 추측하지 않고 질문한다.
  const design = await loadDesign("EVT-00A");
  const { elements, questions } = draftScreenElements(design);

  const list = elements.find((element) => element.source.nodeId === "20:4167");
  assert.ok(list, "제목 없는 되풀이 묶음을 뽑지 못했습니다");
  assert.equal(list.spec.type, "itemList");
  assert.ok(
    questions.some((question) => question.includes("20:4167")),
    "항목 수가 명세 고정인지 데이터인지 묻지 않습니다"
  );
  // 묶음 안의 카드는 데이터의 되풀이지 화면 요소가 아니다.
  assert.equal(
    elements.filter((element) => element.source.nodeId.startsWith("20:41")).length >= 1,
    true
  );
  assert.equal(
    elements.find((element) => element.source.nodeId === "20:4168"),
    undefined,
    "목록 안의 카드를 요소로 뽑았습니다"
  );
});

test("섹션 안의 되풀이 항목은 요소로 뽑지 않고 섹션을 뽑는다", async () => {
  const design = await loadDesign("HOME-01K");
  const { elements } = draftScreenElements(design);
  const ids = new Set(elements.map((element) => element.source.nodeId));

  for (const sectionId of ["16:135", "16:206", "16:239", "16:269"]) {
    assert.ok(ids.has(sectionId), `섹션 ${sectionId}을 뽑지 못했다`);
  }
  // 섹션 본문의 항목들 — 되풀이라 요소가 아니다.
  for (const itemId of ["16:140", "16:174", "16:217", "16:224", "16:231", "16:244", "16:257"]) {
    assert.equal(ids.has(itemId), false, `되풀이 항목 ${itemId}을 요소로 뽑았다`);
  }
  // 섹션 헤더의 링크 버튼은 되풀이가 아니므로 그대로 뽑는다.
  for (const buttonId of ["16:210", "16:273"]) {
    assert.ok(ids.has(buttonId), `헤더 버튼 ${buttonId}을 놓쳤다`);
  }
});

test("섹션의 유형은 추측하지 않고 질문한다", async () => {
  const design = await loadDesign("HOME-01K");
  const { questions } = draftScreenElements(design);

  // 항목 수가 명세에 고정인지(summary) 데이터에 달렸는지(itemList)는
  // 디자인이 말해 주지 않는다.
  assert.ok(
    questions.some((question) => /summary/u.test(question) && /itemList/u.test(question)),
    "섹션 유형을 묻지 않았다"
  );
});

// ONB-02가 회귀하지 않는지 — 카드 두 장은 여전히 각각 버튼이다.
test("섹션이 아닌 나란한 카드는 그대로 각각 버튼으로 뽑는다", async () => {
  const design = await loadDesign("ONB-02");
  const { elements } = draftScreenElements(design);
  const ids = new Set(elements.map((element) => element.source.nodeId));

  assert.ok(ids.has("14:111"));
  assert.ok(ids.has("14:125"));
});

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

// 버튼 강조도는 색이 아니라 형태에서 유도한다: 채움 > 테두리 > 없음.
// 이건 일반 시각 관례라 파이프라인이 알아도 되지만, "#155DFC가 주 버튼"은
// 이 제품의 디자인 시스템이라 알면 안 된다.
test("버튼 강조도를 채움·테두리 형태에서 유도한다", async () => {
  const cases = [
    // 주 버튼은 꽉 찬 형태, 보조는 외곽선형, 최소는 텍스트만이다.
    { screenId: "INV-01", expected: ["primary", "quiet"] },
    { screenId: "ORG-01", expected: ["secondary", "primary"] },
    { screenId: "ONB-02", expected: ["secondary", "secondary", "quiet"] },
    // ORG-02의 앞 둘은 선택지 카드다(추출기가 아직 버튼으로 뽑는다).
    { screenId: "ORG-02", expected: ["secondary", "secondary", "secondary", "primary"] }
  ];

  for (const { screenId, expected } of cases) {
    const design = await loadDesign(screenId);
    const emphases = draftScreenElements(design)
      .elements.filter((element) => element.spec.type === "button")
      .map((element) => element.spec.emphasis);

    assert.deepEqual(emphases, expected, `${screenId}의 버튼 강조도`);
  }
});

test("버튼이 하나뿐이어도 형태로 강조도를 유도한다", async () => {
  const { design } = await loadScreen("ONB-01");
  const buttons = draftScreenElements(design).elements.filter(
    (element) => element.spec.type === "button"
  );

  assert.equal(buttons.length, 1);
  assert.equal(buttons[0].spec.emphasis, "primary");
});

// 셸(사이드바·헤더)은 화면의 요소가 아니라 모든 데스크톱 화면이 공유하는 구조다.
// 막지 않으면 화면마다 사이드바 로고와 메뉴 7개가 초안에 섞여 들어온다
// (MY-01 초안의 첫 요소가 실제로 사이드바 로고 'V'였다).
test("셸로 선언된 노드는 초안에서 제외한다", () => {
  const design = {
    root: {
      id: "1:1",
      type: "frame",
      name: "화면",
      children: [
        {
          id: "1:2",
          type: "frame",
          name: "Sidebar",
          children: [
            { id: "1:3", type: "text", name: "홈", text: "홈" },
            { id: "1:4", type: "text", name: "재정", text: "재정" }
          ]
        },
        {
          id: "1:5",
          type: "frame",
          name: "Container",
          children: [
            {
              id: "1:6",
              type: "frame",
              name: "Label",
              children: [
                { id: "1:7", type: "text", name: "이름", text: "이름" },
                { id: "1:8", type: "frame", name: "Text Input - 이름", children: [] }
              ]
            }
          ]
        }
      ]
    }
  };

  const withoutGuard = draftScreenElements(design, {});
  const withGuard = draftScreenElements(design, { excludeNodeNames: ["Sidebar"] });

  assert.ok(
    withGuard.elements.every((element) => element.source.nodeId !== "1:2"),
    "셸 노드가 요소로 남았다"
  );
  assert.ok(withGuard.elements.length < withoutGuard.elements.length + 1);
  assert.ok(withGuard.elements.some((element) => element.source.nodeId === "1:5"));
});

// 하나 고르기는 **골라진 하나만 배경이 다르다**는 것으로 읽는다.
//
// 이 검사가 지키는 것은 규칙이 맞다는 것보다 **규칙이 넘지 않는 선**이다.
// 행동 짝(주 버튼 + 보조)도 색이 갈리지만, 둘일 때는 '하나만 다르다'가 성립하지
// 않아 걸리지 않는다. 조건을 '나머지와 다른 것이 있으면'으로 느슨하게 바꾸면
// `조직 만들기`가 선택지가 된다.
test("셋 이상이고 하나만 배경이 다르면 하나 고르기로 읽는다", async () => {
  const shell = JSON.parse(
    await readFile(
      join(repoRoot, "specs", "figma", "vada-wireframe", "shell.json"),
      "utf8"
    )
  );
  const draftOf = async (screenId) => {
    const { design } = await loadScreen(screenId);
    return draftScreenElements(design, {
      excludeNodeNames: shell.design?.excludeNodeNames,
      workspaces: shell.workspaces
    });
  };

  // 다섯 중 '전체'만 배경이 gray-800이다.
  const documents = await draftOf("EVT-DOC-01");
  const filter = documents.elements.find(
    (element) => element.source.nodeId === "28:562"
  );
  assert.equal(filter?.spec.type, "select");
  assert.equal(filter?.spec.presentation, "choiceGroup");
  assert.equal(filter?.spec.initialValue, "전체");
  // 선택지 하나하나는 요소가 아니다.
  assert.equal(
    documents.elements.filter((element) => element.spec.type === "button").length,
    0
  );

  // 둘짜리 행동 짝은 건드리지 않는다 — '이전'/'조직 만들기'도 하나만 채워져 있다.
  const org02 = await draftOf("ORG-02");
  const footer = org02.elements.filter((element) =>
    ["14:343", "14:348"].includes(element.source.nodeId)
  );
  assert.equal(footer.length, 2, "행동 짝 둘이 낱개 버튼으로 남아야 합니다");
  assert.ok(
    footer.every((element) => element.spec.type === "button"),
    `행동 짝이 선택지가 됐습니다: ${JSON.stringify(footer)}`
  );

  // 저마다 색이 다른 카드 셋은 고른 것이 아니다(EVT-02의 강조 카드).
  const overview = await draftOf("EVT-02");
  assert.equal(
    overview.elements.find((element) => element.source.nodeId === "20:4818"),
    undefined
  );

  // 표시하는 자리가 바탕만은 아니다. 갈피형은 바탕을 그대로 두고 글자 색만 바꾼다.
  const my01 = await draftOf("MY-01");
  const tabs = my01.elements.find((element) => element.source.nodeId === "16:422");
  assert.equal(tabs?.spec.type, "select");
  assert.equal(tabs?.spec.initialValue, "해야 할 업무");
  assert.equal(
    my01.elements.filter((element) =>
      ["16:423", "16:428", "16:433"].includes(element.source.nodeId)
    ).length,
    0,
    "갈피 하나하나가 버튼으로 남았습니다"
  );
});

// 되풀이 판별이 걸려 있던 세 곳. 셋 다 칸반 보드에서 드러났고 원인이 달랐다.
test("칸반 열 넷이 저마다 목록으로 잡힌다", async () => {
  const shell = JSON.parse(
    await readFile(
      join(repoRoot, "specs", "figma", "vada-wireframe", "shell.json"),
      "utf8"
    )
  );
  const { design } = await loadScreen("EVT-TASK-01");
  const { elements } = draftScreenElements(design, {
    excludeNodeNames: shell.design?.excludeNodeNames,
    workspaces: shell.workspaces
  });
  const listAt = (nodeId) =>
    elements.find((element) => element.source.nodeId === nodeId)?.spec;

  // (1) 카드 이름에 그 카드의 내용이 들어 있다(`Button - 행사장 안전 점검 상세 보기`).
  //     이름을 통째로 견주면 카드 둘이 다른 것이 되어 열이 되풀이로 보이지 않는다.
  // (2) 열의 머리 줄('예정' + 건수)이 되풀이처럼 보여 섹션이 되지 못했다.
  assert.deepEqual(listAt("25:1392"), { type: "itemList", title: "예정" });
  assert.deepEqual(listAt("25:1433"), { type: "itemList", title: "진행 중" });

  // (3) 한 장짜리 열은 Figma가 감싸개를 접어 카드가 곧장 본문이 된다.
  assert.deepEqual(listAt("25:1505"), { type: "itemList", title: "검토 필요" });
  assert.deepEqual(listAt("25:1536"), { type: "itemList", title: "완료" });

  // 보드 전체를 목록 하나로 삼키지 않는다 — 그러면 열 넷이 통째로 사라진다.
  assert.equal(listAt("25:1385"), undefined);

  // 섹션 머리 옆의 조작은 항목이 아니다(EVT-MEET-01의 '전체 회의 보기').
  const meetings = await loadScreen("EVT-MEET-01");
  const drafted = draftScreenElements(meetings.design, {
    excludeNodeNames: shell.design?.excludeNodeNames,
    workspaces: shell.workspaces
  }).elements;
  assert.equal(
    drafted.find((element) => element.source.nodeId === "25:2003"),
    undefined
  );
  assert.equal(
    drafted.find((element) => element.source.nodeId === "25:2009")?.spec.type,
    "button"
  );
});
