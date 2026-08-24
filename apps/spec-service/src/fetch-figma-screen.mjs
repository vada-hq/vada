// Figma REST API로 화면 하나의 산출물을 내려받는다 — 플러그인을 열지 않고.
//
//   node apps/spec-service/src/fetch-figma-screen.mjs <wireframeKey> <screenId>
//   node apps/spec-service/src/fetch-figma-screen.mjs <wireframeKey> <screenId> --node 20:4058
//
// 왜 이것이 되는가. 플러그인은 `exportAsync({ format: "JSON_REST_V1" })`로 원본을
// 뽑는데, Figma 문서가 말하기를 그것은 "REST API가 주는 것과 같은 JSON"이다.
// 실측으로 확인했다(2026-08-24, EVT-00A): 노드 212개, 속성 차이 0건, 값 차이 0건,
// 직렬화 길이까지 187187로 같다. 자산 SVG도 바이트까지 같았다.
//
// 다른 것은 reference.png 하나다 — 크기(2588×1492)·색 깊이·색 형식은 같고 압축만
// 다르다. 인코더가 다른 것이지 그림이 다른 것이 아니다.
//
// **`geometry=paths`를 붙이면 안 된다.** 벡터 경로가 더 붙어 원본이 1.8배가 되고,
// 그것은 플러그인이 저장해 온 것과 다른 물건이다.
//
// 자산의 단위는 여기서 정한다(collectAssetNodes). 플러그인 안에서 정하던 때는
// 규칙을 고치려면 사람이 Figma를 열어 다시 저장해야 했다. 이제 원본을 먼저 받고
// 무엇이 자산인지는 로컬에서 정하므로, 규칙을 고치면 바로 다시 뽑는다.
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { collectAssetNodes } from "../../../packages/contracts/src/figma-design.mjs";
import {
  conflictsWithScreenFolder,
  knownNodeIdOf,
  screenFolderConflictMessage
} from "../../../packages/contracts/src/screen-folder-identity.mjs";
import { frameNameIsScreen } from "../../../packages/contracts/src/screen-naming.mjs";
import { generateFigmaDesignFile } from "./generate-figma-design.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const API = "https://api.figma.com/v1";

// 플러그인과 같은 배율. 자산도 화면도 2배로 뽑는다(figma-plugin/src/figma-raw.mjs).
const REFERENCE_PNG_SCALE = 2;
const ASSET_PNG_SCALE = 2;

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function readJsonOrNull(filePath) {
  try {
    return await readJson(filePath);
  } catch {
    return null;
  }
}

/**
 * 토큰은 저장소에 두지 않는다. `.env`의 FIGMA_TOKEN이거나 환경변수다.
 * 값은 어디에도 찍지 않는다 — 로그에 한 번 남으면 되돌릴 수 없다.
 */
export async function readFigmaToken(root = repoRoot) {
  if (process.env.FIGMA_TOKEN) {
    return process.env.FIGMA_TOKEN.trim();
  }
  let text;
  try {
    text = await readFile(join(root, ".env"), "utf8");
  } catch {
    throw new Error(
      "Figma 토큰이 없습니다. 저장소 루트에 .env를 만들고 FIGMA_TOKEN=<개인 액세스 토큰> 한 줄을 넣으세요(.env는 git에서 제외됩니다)."
    );
  }
  const line = text
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith("FIGMA_TOKEN="));
  const token = line?.slice("FIGMA_TOKEN=".length).trim();
  if (!token) {
    throw new Error(".env에 FIGMA_TOKEN=<개인 액세스 토큰> 줄이 필요합니다.");
  }
  return token;
}

async function figmaGet(path, token) {
  const response = await fetch(`${API}${path}`, {
    headers: { "X-Figma-Token": token }
  });
  if (response.status === 429) {
    const wait = response.headers.get("retry-after") ?? "?";
    throw new Error(
      `Figma가 요청 한도로 막았습니다(429). ${wait}초 뒤에 다시 시도하세요. 한도는 파일이 속한 플랜이 정합니다 — 토큰 주인의 좌석이 아닙니다.`
    );
  }
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    throw new Error(`Figma 요청 실패 ${response.status}: ${detail}`);
  }
  return response.json();
}

// 이름이 이 화면인 노드를 찾는다. 판정은 screen-naming이 갖는다.
function findFramesNamed(node, screenId, found = []) {
  if (frameNameIsScreen(node?.name, screenId)) {
    found.push({ id: node.id, name: node.name });
    return found; // 화면 안을 더 파지 않는다
  }
  for (const child of node?.children ?? []) {
    findFramesNamed(child, screenId, found);
  }
  return found;
}

async function resolveNodeId({ fileKey, screenId, screenDir, given, token, log }) {
  if (given) {
    return given;
  }
  const raw = await readJsonOrNull(join(screenDir, "figma.raw.json"));
  const screen = await readJsonOrNull(join(screenDir, "screen.json"));
  const known = knownNodeIdOf({ raw, screen });
  if (known) {
    log(`이미 있는 폴더입니다. 같은 노드 ${known}을 다시 받습니다.`);
    return known;
  }

  // 새 화면이다. 파일을 얕게 훑어 이름으로 찾는다.
  //
  // depth=4다. 이 wireframe은 페이지 → 구역(온보딩·홈·운영…) → 화면이라 depth=2로는
  // 구역까지만 오고 화면이 안 보인다. 한 단계 여유를 둔다.
  log(`${screenId}이(가) 처음입니다. 파일에서 이름으로 찾습니다.`);
  const file = await figmaGet(`/files/${fileKey}?depth=4`, token);
  const found = findFramesNamed(file.document, screenId);
  if (found.length === 0) {
    throw new Error(
      `파일에서 이름에 '${screenId}'이(가) 든 프레임을 찾지 못했습니다. --node <노드 id>로 직접 지정하세요(Figma에서 프레임 링크를 복사하면 주소의 node-id가 그것입니다).`
    );
  }
  if (found.length > 1) {
    const list = found.map((frame) => `  ${frame.id}  ${frame.name}`).join("\n");
    throw new Error(
      `이름에 '${screenId}'이(가) 든 프레임이 여럿입니다. --node로 하나를 고르세요.\n${list}`
    );
  }
  log(`찾았습니다: ${found[0].id}  ${found[0].name}`);
  return found[0].id;
}

// 이미지 요청은 묶어서 한 번에 보낸다(Figma 권고). 한도는 요청 수로 센다.
async function fetchImages({ fileKey, ids, format, scale, token }) {
  if (ids.length === 0) {
    return {};
  }
  const query = new URLSearchParams({ ids: ids.join(","), format });
  if (scale) {
    query.set("scale", String(scale));
  }
  const body = await figmaGet(`/images/${fileKey}?${query}`, token);
  if (body.err) {
    throw new Error(`이미지 요청 실패: ${body.err}`);
  }
  return body.images ?? {};
}

async function download(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`이미지를 내려받지 못했습니다(${response.status}).`);
  }
  return Buffer.from(await response.arrayBuffer());
}

export async function fetchFigmaScreen({
  wireframeKey,
  screenId,
  nodeId: givenNodeId = null,
  root = repoRoot,
  log = () => {}
}) {
  const token = await readFigmaToken(root);
  const wireframeDir = join(root, "specs", "figma", wireframeKey);
  const { fileKey } = await readJson(join(wireframeDir, "figma-file.json"));
  const screenDir = join(wireframeDir, "screens", screenId);

  const nodeId = await resolveNodeId({
    fileKey,
    screenId,
    screenDir,
    given: givenNodeId,
    token,
    log
  });

  // 폴더 신원 계약. 브리지가 409로 막는 것과 같은 판정을 여기서도 한다.
  const known = knownNodeIdOf({
    raw: await readJsonOrNull(join(screenDir, "figma.raw.json")),
    screen: await readJsonOrNull(join(screenDir, "screen.json"))
  });
  if (conflictsWithScreenFolder(known, nodeId)) {
    throw new Error(screenFolderConflictMessage({ screenId, knownNodeId: known, incomingNodeId: nodeId }));
  }

  const nodes = await figmaGet(
    `/files/${fileKey}/nodes?ids=${encodeURIComponent(nodeId)}`,
    token
  );
  const raw = nodes.nodes?.[nodeId];
  if (!raw?.document) {
    throw new Error(`Figma가 노드 ${nodeId}을 주지 않았습니다. 노드 id를 확인하세요.`);
  }
  log(`원본을 받았습니다: ${raw.document.name}`);

  await mkdir(join(screenDir, "assets"), { recursive: true });
  await writeFile(
    join(screenDir, "figma.raw.json"),
    `${JSON.stringify(raw, null, 2)}\n`,
    "utf8"
  );

  // 자산의 단위는 정규화기와 같은 규칙으로 정한다. 원본이 손에 있으니 여기서 센다.
  const assetNodes = collectAssetNodes(raw.document);
  const svgIds = assetNodes.filter((asset) => asset.format === "svg").map((asset) => asset.node.id);
  const pngIds = assetNodes.filter((asset) => asset.format === "png").map((asset) => asset.node.id);

  const [svgUrls, pngUrls, referenceUrls] = [
    await fetchImages({ fileKey, ids: svgIds, format: "svg", token }),
    await fetchImages({ fileKey, ids: pngIds, format: "png", scale: ASSET_PNG_SCALE, token }),
    await fetchImages({
      fileKey,
      ids: [nodeId],
      format: "png",
      scale: REFERENCE_PNG_SCALE,
      token
    })
  ];

  // 남아 있는 옛 자산을 지운다. 디자인에서 아이콘이 빠졌는데 파일이 남아 있으면
  // 검증기가 '있는데 안 그렸다'를 영영 말하지 못한다.
  const wanted = new Set(
    assetNodes.map((asset) => `${asset.node.id.replace(":", "-")}.${asset.format}`)
  );
  for (const name of await readdir(join(screenDir, "assets")).catch(() => [])) {
    if (!wanted.has(name)) {
      await rm(join(screenDir, "assets", name));
      log(`옛 자산 삭제: ${name}`);
    }
  }

  const failures = [];
  for (const asset of assetNodes) {
    const url = (asset.format === "svg" ? svgUrls : pngUrls)[asset.node.id];
    const fileName = `${asset.node.id.replace(":", "-")}.${asset.format}`;
    if (!url) {
      failures.push(`자산 ${asset.node.id}(${asset.format}): Figma가 주소를 주지 않았습니다.`);
      continue;
    }
    try {
      // 하나가 실패해도 나머지를 버리지 않는다 — 전부 아니면 전무는 진단을 막는다.
      const bytes = await download(url);
      await writeFile(join(screenDir, "assets", fileName), bytes);
    } catch (error) {
      failures.push(`자산 ${asset.node.id}(${asset.format}): ${error.message}`);
    }
  }

  const referenceUrl = referenceUrls[nodeId];
  if (referenceUrl) {
    await writeFile(join(screenDir, "reference.png"), await download(referenceUrl));
  } else {
    failures.push("reference.png: Figma가 주소를 주지 않았습니다.");
  }

  // 원본을 받았으면 정규화까지 한 번에 한다. 브리지로 저장하던 때는 두 과정이
  // 다른 프로세스라 손으로 이어야 했다(HANDOFF의 보류 항목). 여기서는 아니다.
  await generateFigmaDesignFile(join(screenDir, "figma.raw.json"), screenId);

  return { nodeId, assetCount: assetNodes.length, failures };
}

async function runCli() {
  const argv = process.argv.slice(2);
  const flagAt = argv.indexOf("--node");
  const nodeId = flagAt >= 0 ? argv[flagAt + 1] : null;
  // --node가 없으면 flagAt은 -1이다. 그때 0번을 걸러 내지 않도록 갈라 둔다.
  const [wireframeKey, screenId] =
    flagAt < 0
      ? argv
      : argv.filter((value, index) => index !== flagAt && index !== flagAt + 1);

  if (!wireframeKey || !screenId) {
    process.stderr.write(
      "사용법: fetch-figma-screen.mjs <wireframeKey> <screenId> [--node <노드 id>]\n"
    );
    process.exitCode = 1;
    return;
  }

  const log = (message) => process.stderr.write(`${message}\n`);
  const { nodeId: used, assetCount, failures } = await fetchFigmaScreen({
    wireframeKey,
    screenId,
    nodeId,
    log
  });

  process.stdout.write(
    `${screenId}: 노드 ${used} · 자산 ${assetCount}개 · figma.design.json까지 만들었습니다.\n`
  );
  for (const failure of failures) {
    process.stderr.write(`  실패: ${failure}\n`);
  }
  if (failures.length > 0) {
    process.exitCode = 1;
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
