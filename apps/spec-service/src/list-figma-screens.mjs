// Figma 파일에 어떤 화면이 있고 그중 무엇이 명세됐는지 한 번에 본다.
//
//   node apps/spec-service/src/list-figma-screens.mjs <wireframeKey>
//   node apps/spec-service/src/list-figma-screens.mjs <wireframeKey> --todo
//
// 다음 화면을 제품 순서로 고르기로 했는데(implementation-methodology.md), 그
// 순서를 보려면 Figma를 열어야 했다. 이제 안 열어도 된다.
import { readFile, readdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { screenIdFromFrameName } from "../../../packages/contracts/src/screen-naming.mjs";
import { readFigmaToken } from "./fetch-figma-screen.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

export async function listFigmaScreens({ wireframeKey, root = repoRoot }) {
  const token = await readFigmaToken(root);
  const wireframeDir = join(root, "specs", "figma", wireframeKey);
  const { fileKey } = JSON.parse(
    await readFile(join(wireframeDir, "figma-file.json"), "utf8")
  );

  // depth=4 — 페이지 → 구역 → 화면. 이름만 필요하므로 깊이 파지 않는다.
  const response = await fetch(`https://api.figma.com/v1/files/${fileKey}?depth=4`, {
    headers: { "X-Figma-Token": token }
  });
  if (!response.ok) {
    throw new Error(`Figma 요청 실패 ${response.status}: ${(await response.text()).slice(0, 200)}`);
  }
  const file = await response.json();
  const { fetched, specified } = await readProgress(wireframeDir);

  const screens = [];
  const visit = (node, section) => {
    const screenId = screenIdFromFrameName(node?.name);
    if (screenId) {
      screens.push({
        screenId,
        nodeId: node.id,
        name: node.name,
        section,
        specified: specified.has(screenId),
        fetched: fetched.has(screenId)
      });
      return; // 화면 안은 파지 않는다
    }
    for (const child of node?.children ?? []) {
      visit(child, section ?? node?.name ?? "");
    }
  };
  for (const page of file.document?.children ?? []) {
    for (const child of page.children ?? []) {
      visit(child, child.name);
    }
  }
  return { fileName: file.name, lastModified: file.lastModified, screens };
}

/**
 * 이 와이어프레임에서 **원본을 받은 화면**과 **명세를 쓴 화면**.
 *
 * 둘은 다른 일이다. 폴더가 있으면 명세된 것으로 세다가, 프레임을 미리 다 받아 둔
 * 날 85개 중 84개가 끝난 것처럼 보였다 — **진도를 재는 눈금이 거짓말을 하면
 * 무엇이 남았는지 아무도 모른다.**
 *
 * Figma를 부르지 않는다. 그래서 검사가 이 셈을 직접 볼 수 있다.
 */
export async function readProgress(wireframeDir) {
  const folders = await readdir(join(wireframeDir, "screens")).catch(() => []);
  const specified = new Set();
  for (const folder of folders) {
    const spec = await readFile(
      join(wireframeDir, "screens", folder, "screen.json"),
      "utf8"
    ).catch(() => null);
    if (spec === null) {
      continue;
    }
    // 폴더 이름이 아니라 명세가 말하는 screenId로 센다 - 둘이 갈린 화면이 있다
    // (TASK-01 폴더의 프레임 이름은 OPS-TASK-01이다).
    try {
      const parsed = JSON.parse(spec);
      specified.add(typeof parsed.screenId === "string" ? parsed.screenId : folder);
    } catch {
      specified.add(folder);
    }
  }
  return { fetched: new Set(folders), specified };
}

async function runCli() {
  const argv = process.argv.slice(2);
  const todoOnly = argv.includes("--todo");
  const wireframeKey = argv.find((value) => !value.startsWith("--"));
  if (!wireframeKey) {
    process.stderr.write("사용법: list-figma-screens.mjs <wireframeKey> [--todo]\n");
    process.exitCode = 1;
    return;
  }

  const { fileName, screens } = await listFigmaScreens({ wireframeKey });
  const done = screens.filter((screen) => screen.specified).length;
  const got = screens.filter((screen) => screen.fetched && !screen.specified).length;
  process.stdout.write(
    `${fileName} — 화면 ${screens.length}개 중 ${done}개 명세됨` +
      (got > 0 ? ` (원본만 받아 둔 것 ${got}개)` : "") +
      "\n"
  );

  let section = null;
  for (const screen of screens) {
    if (todoOnly && screen.specified) {
      continue;
    }
    if (screen.section !== section) {
      section = screen.section;
      process.stdout.write(`\n[${section}]\n`);
    }
    process.stdout.write(
      `  ${screen.specified ? "✔" : screen.fetched ? "·" : " "} ${screen.screenId.padEnd(14)} ${screen.nodeId.padEnd(10)} ${screen.name}\n`
    );
  }
}

const entryUrl = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : undefined;
if (entryUrl === import.meta.url) {
  runCli().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
