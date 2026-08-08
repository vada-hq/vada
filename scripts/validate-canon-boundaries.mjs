import { readFile, readdir, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));

/**
 * 살아 있는 근거와 역사의 경계를 검사한다.
 *
 * "product-specs/는 역사"라고 뭉뚱그려 적어 둔 적이 있다. 그 안의 flows/에
 * 승인된 흐름 정본이 있는데도 아무도 열어보지 않았다. 유저 플로우 검증을
 * 처음부터 만들 뻔했다.
 *
 * 문서에 정확히 적어 두는 것으로는 안 된다. 이미 그렇게 하다 틀렸다.
 * 여기가 그 경계의 단일 원본이고, 문서는 이것을 가리키기만 한다.
 */
export const LIVE_SUBTREES = [
  "product-specs/solutions",
  "product-specs/flows",
  "product-specs/domains",
];

export const HISTORY_SUBTREES = [
  "product-specs/reviews",
  "product-specs/migrations",
  "product-specs/evidence",
  "delivery-units",
];

/**
 * 저장소 안의 파일을 가리키는 근거만 본다.
 *
 * `standard`는 외부 규격 URL이고 `user_statement`는 대화 기록이다. 둘 다
 * 저장소에 파일로 존재하지 않는 것이 정상이라 경계 검사의 대상이 아니다.
 * 파일을 가리키는 것은 `document`와 `observation`이다.
 */
const FILE_SOURCE_TYPES = new Set(["document", "observation"]);

/**
 * 관찰은 그때 본 것을 가리킨다. 출처가 과거 산출물인 것이 자연스럽다 — 근거는
 * 시점에 묶인 기록이기 때문이다. 지금의 근거로 삼는 `document`가 역사를
 * 가리키면 그건 다르다. 그건 살아 있어야 할 것이 역사에 묻힌 것이다.
 */
const CURRENT_SOURCE_TYPES = new Set(["document"]);

/** 계약 번들이 근거로 삼는 저장소 경로. 검증기가 실행 중에 읽는 기능 필드다. */
export function referencedPaths(bundle) {
  const paths = [];
  if (typeof bundle.solution_ref?.path === "string") {
    paths.push({ path: bundle.solution_ref.path, current: true });
  }
  for (const source of bundle.sources ?? []) {
    if (typeof source.locator !== "string") continue;
    if (!FILE_SOURCE_TYPES.has(source.type)) continue;
    // locator는 `경로#내용해시` 꼴이다. 해시는 내용을 고정할 뿐 위치가 아니다.
    paths.push({
      path: source.locator.split("#")[0],
      current: CURRENT_SOURCE_TYPES.has(source.type),
    });
  }
  return paths;
}

export function classify(path) {
  const normalized = path.replaceAll("\\", "/");
  if (HISTORY_SUBTREES.some((subtree) => normalized.startsWith(`${subtree}/`))) {
    return "history";
  }
  if (LIVE_SUBTREES.some((subtree) => normalized.startsWith(`${subtree}/`))) {
    return "live";
  }
  return "other";
}

async function readBundles(root) {
  const directory = resolve(root, "contracts/bundles");
  const bundles = [];
  for (const name of (await readdir(directory)).sort()) {
    for (const file of (await readdir(resolve(directory, name))).sort()) {
      if (!file.endsWith(".json")) continue;
      bundles.push({
        label: `contracts/bundles/${name}/${file}`,
        document: JSON.parse(await readFile(resolve(directory, name, file), "utf8")),
      });
    }
  }
  return bundles;
}

export async function validateCanonBoundaries(root = repositoryRoot) {
  const errors = [];
  const checked = [];

  for (const subtree of [...LIVE_SUBTREES, ...HISTORY_SUBTREES]) {
    try {
      const info = await stat(resolve(root, subtree));
      if (!info.isDirectory()) errors.push(`${subtree}: 디렉터리가 아닙니다.`);
    } catch {
      // 선언한 갈래가 사라지면 이 표가 낡은 것이다. 조용히 넘어가지 않는다.
      errors.push(`${subtree}: 선언된 갈래가 저장소에 없습니다. 이 목록을 고치세요.`);
    }
  }

  for (const { label, document } of await readBundles(root)) {
    for (const { path, current } of referencedPaths(document)) {
      const kind = classify(path);
      checked.push(`${label} → ${path} (${kind}${current ? "" : ", 관찰"})`);

      if (kind === "history" && current) {
        errors.push(
          `${label}: 역사로 선언된 곳을 참조합니다: ${path}. ` +
            "살아 있는 근거라면 LIVE_SUBTREES로 옮겨 선언하세요.",
        );
        continue;
      }
      try {
        await stat(resolve(root, path));
      } catch {
        errors.push(`${label}: 참조한 근거가 없습니다: ${path}`);
      }
    }
  }

  return { errors, checked };
}

const invokedDirectly =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  const { errors, checked } = await validateCanonBoundaries();
  for (const line of checked) console.log(line);
  for (const error of errors) console.error(`ERROR ${error}`);
  if (errors.length) process.exit(1);
  console.log(`정본 경계 검증 완료 — 참조 ${checked.length}건`);
}
