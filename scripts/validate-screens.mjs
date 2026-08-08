import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));

const REQUIRED_KEYS = [
  "id",
  "title",
  "wireframe",
  "wireframe_screen",
  "route",
  "contracts",
];

/**
 * 브라우저 검사가 어느 화면을 덮는지 모은다.
 *
 * 규칙은 한 문장이다 — **화면 정본의 id가 `apps/web/e2e/` 안에 적혀 있어야 한다.**
 * spec 하나가 화면 여럿을 지나갈 수 있으므로 파일 이름으로 묶지 않고 내용으로 본다.
 *
 * 왜 필요한가: jsdom에는 레이아웃 엔진이 없어 가려진 요소도 클릭이 되고 나란한
 * 입력칸의 높이가 어긋나도 통과한다. 실제로 화면 테스트 110건이 초록인 채로
 * 사람이 브라우저를 열자마자 결함 넷이 나왔다.
 */
export const BROWSER_TEST_DIRECTORY = "apps/web/e2e";

export async function screensCoveredByBrowserTests(root = repositoryRoot) {
  const directory = resolve(root, BROWSER_TEST_DIRECTORY);
  const covered = new Set();

  let entries = [];
  try {
    entries = await readdir(directory, { recursive: true });
  } catch {
    return covered;
  }

  for (const entry of entries) {
    if (!entry.endsWith(".ts")) continue;
    const source = await readFile(resolve(directory, entry), "utf8");
    for (const match of source.matchAll(/\b([A-Z][A-Z0-9]{3,})\b/g)) {
      covered.add(match[1]);
    }
  }
  return covered;
}

/**
 * 화면은 줄 번호가 아니라 화면 ID로 가리킨다. 와이어프레임 공유본을 반입하면
 * 줄 번호는 전부 어긋나는데 검증은 그대로 통과했다. ID는 움직이지 않는다.
 * 위치가 필요하면 App.tsx에서 그 ID를 찾는다. 여기서 줄을 계산해 두지 않는다.
 */
export function wireframeScreens(source) {
  return new Set(
    [...source.matchAll(/\{ id: "([A-Z][A-Z0-9-]*)", label:/g)].map((match) => match[1]),
  );
}

/**
 * 화면 정본의 프런트매터만 검사한다.
 * 문장의 내용은 사람이 브라우저에서 확인한다.
 */
export function parseFrontMatter(text) {
  if (!text.startsWith("---\n")) return null;
  const end = text.indexOf("\n---\n", 4);
  if (end === -1) return null;

  const body = text.slice(4, end);
  const result = {};
  let listKey = null;

  for (const raw of body.split("\n")) {
    const line = raw.replace(/\s+#.*$/, "").trimEnd();
    if (!line.trim()) continue;

    const item = /^\s+-\s+(.+)$/.exec(line);
    if (item && listKey) {
      result[listKey].push(item[1].trim());
      continue;
    }

    const pair = /^([a-z_]+):\s*(.*)$/.exec(line);
    if (!pair) return null;

    const [, key, value] = pair;
    if (value === "") {
      listKey = key;
      result[key] = [];
    } else {
      listKey = null;
      result[key] = value.trim();
    }
  }

  return result;
}

async function contractIds(root) {
  const ids = new Set();
  const bundles = resolve(root, "contracts/bundles");

  for (const entry of await readdir(bundles, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    for (const file of await readdir(resolve(bundles, entry.name))) {
      if (!file.endsWith(".json")) continue;
      const bundle = JSON.parse(
        await readFile(resolve(bundles, entry.name, file), "utf8"),
      );
      collectIds(bundle, ids);
    }
  }

  return ids;
}

function collectIds(value, ids) {
  if (Array.isArray(value)) {
    for (const item of value) collectIds(item, ids);
    return;
  }
  if (!value || typeof value !== "object") return;
  if (typeof value.id === "string" && /^[A-Z]+:/.test(value.id)) ids.add(value.id);
  for (const nested of Object.values(value)) collectIds(nested, ids);
}

export async function validateScreens(root = repositoryRoot) {
  const errors = [];
  const resolved = [];
  const directory = resolve(root, "screens");
  const known = await contractIds(root);
  const covered = await screensCoveredByBrowserTests(root);
  const files = (await readdir(directory)).filter(
    (name) => name.endsWith(".md") && name !== "README.md",
  );

  if (!files.length) errors.push("screens/에 화면 정본이 없습니다.");

  for (const file of files) {
    const where = `screens/${file}`;
    const front = parseFrontMatter(await readFile(resolve(directory, file), "utf8"));
    if (!front) {
      errors.push(`${where}: 프런트매터를 읽을 수 없습니다.`);
      continue;
    }

    for (const key of REQUIRED_KEYS) {
      if (front[key] === undefined) errors.push(`${where}: 필수 항목이 없습니다: ${key}`);
    }

    if (front.id && `${front.id}.md` !== file) {
      errors.push(`${where}: 파일 이름이 id와 다릅니다: ${front.id}`);
    }

    if (front.status !== undefined) {
      errors.push(
        `${where}: 진행 상태를 정본에 적지 않습니다. ` +
          `GitHub Issue와 PR이 소유합니다. ` +
          `손으로 적은 done이 "3단계 5/6 완료"를 만들었고, 그중 브라우저로 본 것은 0개였습니다.`,
      );
    }

    // 화면이 웹 라우트를 가지면 브라우저에서 한 번은 열어 봐야 한다.
    if (front.id && front.route && !covered.has(front.id)) {
      errors.push(
        `${where}: 브라우저 검사가 없습니다. ` +
          `${BROWSER_TEST_DIRECTORY}/ 안에서 ${front.id}를 다루는 spec을 만드세요. ` +
          `jsdom은 레이아웃도 클릭 가로챔도 보지 못합니다.`,
      );
    }

    if (typeof front.wireframe === "string") {
      if (/:\d+$/.test(front.wireframe)) {
        errors.push(
          `${where}: wireframe에 줄 번호를 쓰지 않습니다. ` +
            `공유본을 반입하면 어긋납니다. wireframe_screen의 화면 ID로 가리키세요.`,
        );
      }

      const path = front.wireframe.replace(/:\d+$/, "");
      let source = null;
      try {
        source = await readFile(resolve(root, path), "utf8");
      } catch {
        errors.push(`${where}: 와이어프레임 경로가 없습니다: ${path}`);
      }

      if (source && typeof front.wireframe_screen === "string") {
        if (!wireframeScreens(source).has(front.wireframe_screen)) {
          errors.push(
            `${where}: 와이어프레임에 그런 화면이 없습니다: ${front.wireframe_screen}`,
          );
        } else {
          resolved.push(`${front.id} → ${front.wireframe_screen}`);
        }
      }
    }

    for (const contract of front.contracts ?? []) {
      if (!known.has(contract)) {
        errors.push(`${where}: 계약을 찾을 수 없습니다: ${contract}`);
      }
    }
  }

  return { errors, files, resolved };
}

const invokedDirectly =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  const { errors, files, resolved } = await validateScreens();
  for (const line of resolved) console.log(line);
  for (const error of errors) console.error(`ERROR ${error}`);
  if (errors.length) process.exit(1);
  console.log(`화면 정본 ${files.length}개 검증 완료`);
}
