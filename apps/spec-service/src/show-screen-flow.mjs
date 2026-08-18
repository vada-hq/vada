// 화면 간 이동을 명세에서 유도해 사람이 읽을 수 있게 출력한다.
//
//   node apps/spec-service/src/show-screen-flow.mjs <wireframeKey>
//
// 이동 지도를 따로 선언하지 않는다는 것이 요점이다. 여기 나오는 것은 전부
// 화면 JSON의 button.action에서 계산한 결과이므로 명세와 어긋날 수 없다.
import { readFile, readdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { collectScreenFlow } from "../../../packages/contracts/src/screen-flow.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..", "..");

async function loadScreens(wireframeKey) {
  const screensDir = join(repoRoot, "specs", "figma", wireframeKey, "screens");
  const screens = [];

  for (const screenId of await readdir(screensDir)) {
    const file = join(screensDir, screenId, "screen.json");
    try {
      screens.push({ file, spec: JSON.parse(await readFile(file, "utf8")) });
    } catch {
      continue; // 원본만 저장하고 명세는 아직 없는 화면
    }
  }

  return screens;
}

function printSection(title, items, emptyNote) {
  if (items.length === 0) {
    if (emptyNote) {
      console.log(`\n${title}\n  ${emptyNote}`);
    }
    return;
  }
  console.log(`\n${title}`);
  for (const item of items) {
    console.log(`  ${item}`);
  }
}

async function main() {
  const [wireframeKey] = process.argv.slice(2);

  if (!wireframeKey) {
    console.error("사용법: show-screen-flow.mjs <wireframeKey>");
    process.exitCode = 1;
    return;
  }

  const screens = await loadScreens(wireframeKey);
  const flow = collectScreenFlow(screens);
  const known = new Set(flow.screenIds);

  console.log(`## ${wireframeKey} — 화면 이동 (명세에서 유도)`);
  console.log(`화면 ${flow.screenIds.length}개, 이동 ${flow.edges.length}건`);

  console.log("\n이동");
  const width = Math.max(...flow.edges.map((edge) => edge.from.length), 0);
  for (const edge of flow.edges) {
    const mark = known.has(edge.to) ? " " : "!";
    const kind = edge.actionType === "submit" ? "[제출] " : "";
    console.log(
      `  ${mark} ${edge.from.padEnd(width)} → ${edge.to.padEnd(width)}  ${kind}«${edge.label}»`
    );
  }

  printSection(
    "명세가 없는 이동 대상 (위에서 ! 표시)",
    flow.missingTargets,
    null
  );

  // 아래 셋은 결함 판정이 아니라 관측이다. 뒤로 가기가 있으면 첫 화면도
  // 이동 대상이 되어 진입점 후보가 사라지는 것이 정상이다.
  printSection(
    "들어오는 이동이 없는 화면 (진입점 후보)",
    flow.entryCandidates,
    "없음 — 모든 화면에 들어오는 이동이 있다(뒤로 가기 때문일 수 있다). 앱의 진입점은 명세가 아니라 구현이 정한다."
  );
  printSection("나가는 이동이 없는 화면 (막다른 화면)", flow.deadEnds, "없음");

  if (flow.components.length > 1) {
    printSection(
      `서로 이어지지 않는 화면 덩어리 ${flow.components.length}개`,
      flow.components.map((group) => group.join(", ")),
      null
    );
  }
}

await main();
