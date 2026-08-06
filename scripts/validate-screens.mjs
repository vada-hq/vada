import { readFile, readdir, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));

const REQUIRED_KEYS = ["id", "title", "wireframe", "route", "contracts", "status"];
const STATUSES = new Set(["todo", "doing", "done"]);

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
  const directory = resolve(root, "screens");
  const known = await contractIds(root);
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

    if (front.status && !STATUSES.has(front.status)) {
      errors.push(`${where}: status는 todo, doing, done 중 하나여야 합니다.`);
    }

    if (typeof front.wireframe === "string") {
      const [path] = front.wireframe.split(":");
      try {
        await stat(resolve(root, path));
      } catch {
        errors.push(`${where}: 와이어프레임 경로가 없습니다: ${path}`);
      }
    }

    for (const contract of front.contracts ?? []) {
      if (!known.has(contract)) {
        errors.push(`${where}: 계약을 찾을 수 없습니다: ${contract}`);
      }
    }
  }

  return { errors, files };
}

const invokedDirectly =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  const { errors, files } = await validateScreens();
  for (const error of errors) console.error(`ERROR ${error}`);
  if (errors.length) process.exit(1);
  console.log(`화면 정본 ${files.length}개 검증 완료`);
}
