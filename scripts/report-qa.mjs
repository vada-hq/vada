import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parseFrontMatter } from "./validate-screens.mjs";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));

/**
 * 사람이 브라우저에서 무엇을 봐야 하는지를 화면 정본에서 뽑아 찍는다.
 *
 * `just check`는 명령 하나로 끝나는데 "사람이 브라우저에서 확인"에는 목록이
 * 없었다. 그래서 화면이 정본의 절반만 구현됐는데도 테스트가 전부 통과했다.
 * 자동 테스트는 만든 것만 검사한다. 안 만든 것은 목록이 있어야 보인다.
 *
 * 체크리스트를 따로 쓰지 않는다. 쓰면 정본이 넷이 되고 반드시 틀어진다.
 * 정본이 이미 답을 갖고 있으므로 읽어서 형태만 바꾼다.
 */
const SCREEN_QA = "prototypes/wireframe/docs/VADA_SCREEN_QA.md";
const COMMON_HEADING = "## 공통 합격 기준";

/**
 * 정본의 어느 절이 무엇을 뜻하는지. 절 이름은 정본이 정하고 여기서는 그것을
 * 확인 항목의 종류로만 옮긴다.
 */
const SECTIONS = [
  { heading: "화면 구조", title: "있어야 하는 것", hint: "정본이 요구한 요소가 실제로 보이는가" },
  { heading: "상태", title: "상태별로 확인할 것", hint: "각 상태를 만들어 보고 문구와 복구 경로를 본다" },
  {
    heading: "와이어프레임과 다르게 하는 것",
    title: "없어야 하는 것",
    hint: "와이어프레임에는 있지만 이번 범위에서 뺀 것. 안 보이는 게 맞다",
  },
  { heading: "구현하며 정한 것", title: "구현하며 정한 것", hint: "이 판정대로 보이는지 확인한다" },
  {
    heading: "열린 질문",
    title: "아직 못 하는 것 (알고 있는 한계)",
    hint: "확인하면 틀린 것으로 보인다. 버그가 아니라 아직 답이 없는 것이다",
  },
];

/** `## 이름` 부터 다음 `## ` 직전까지. 제목에 덧말이 붙어도 앞부분으로 찾는다. */
export function sectionBody(markdown, heading) {
  const lines = markdown.split("\n");
  const start = lines.findIndex(
    (line) => line.startsWith("## ") && line.slice(3).trim().startsWith(heading),
  );
  if (start === -1) return null;

  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => line.startsWith("## "));
  return (end === -1 ? rest : rest.slice(0, end)).join("\n");
}

/**
 * 굵게 시작하는 줄의 그 굵은 말이 확인 항목이다. 정본은 요소도 상태도 판정도
 * 전부 `**이름** — 설명` 꼴로 적는다. 표와 인용은 근거이지 항목이 아니다.
 */
export function checkItems(body) {
  const items = [];
  for (const line of body.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("|") || trimmed.startsWith(">")) continue;

    const match = /^(?:-\s+)?\*\*(.+?)\*\*(.*)$/.exec(trimmed);
    if (!match) continue;

    const [, label, tail] = match;
    const note = tail.replace(/^\s*[—-]\s*/, "").trim();
    items.push({ label: label.trim(), note });
  }
  return items;
}

/** 오류 계약이 곧 만들어 봐야 할 실패 상태다. 화면이 그것을 다 다뤄야 한다. */
export function errorContracts(contracts) {
  return contracts
    .filter((reference) => reference.startsWith("ERROR:"))
    .map((reference) => reference.slice("ERROR:".length));
}

async function findCanon(root, screenId) {
  const directory = resolve(root, "screens");
  const wanted = screenId.replaceAll("-", "").toUpperCase();

  for (const name of await readdir(directory)) {
    if (!name.endsWith(".md") || name === "README.md") continue;
    const markdown = await readFile(resolve(directory, name), "utf8");
    const front = parseFrontMatter(markdown);
    if (!front) continue;

    const candidates = [front.id, front.wireframe_screen]
      .filter((value) => typeof value === "string")
      .map((value) => value.replaceAll("-", "").toUpperCase());
    // 정본은 FIN-REQ-01B를, 사람은 FIN-REQ-01을 부른다. 변형 한 글자를 허용한다.
    if (candidates.some((value) => value === wanted || value === `${wanted}B`)) {
      return { file: `screens/${name}`, front, markdown };
    }
  }
  return null;
}

export async function collectQa(screenId, root = repositoryRoot) {
  const canon = await findCanon(root, screenId);
  if (!canon) return null;

  const common = sectionBody(
    await readFile(resolve(root, SCREEN_QA), "utf8"),
    COMMON_HEADING.slice(3),
  );

  const groups = [];
  for (const section of SECTIONS) {
    const body = sectionBody(canon.markdown, section.heading);
    if (body === null) continue;
    const items = checkItems(body);
    if (items.length) groups.push({ ...section, items });
  }

  const flows = await flowsThroughScreen(root, canon.front.contracts ?? []);

  return {
    id: canon.front.id,
    title: canon.front.title,
    route: canon.front.route,
    file: canon.file,
    wireframeScreen: canon.front.wireframe_screen,
    errors: errorContracts(canon.front.contracts ?? []),
    groups,
    commonCriteria: common,
    flows,
    flowRequirements: await flowRequirements(root, flows),
  };
}

/**
 * 이 화면이 어느 흐름 위에 있는가. 계약 묶음의 전달 단위가 그 답을 안다.
 *
 * 이 목록은 화면 하나만 본다. 눌러서 다음 화면으로 넘어가는 것은 여기 없다.
 * 그 절차는 `just flow`가 갖고 있는데, 그것을 여기서 알려주지 않으면 사람이
 * 목록을 끝까지 보고도 흐름 검증이 있는 줄 모른다. 실제로 그랬다.
 */
async function flowsThroughScreen(root, contracts) {
  const references = new Set(contracts);
  const directory = resolve(root, "contracts/bundles");
  const flows = new Set();

  for (const name of await readdir(directory)) {
    for (const file of await readdir(resolve(directory, name))) {
      if (!file.endsWith(".json")) continue;
      const bundle = JSON.parse(await readFile(resolve(directory, name, file), "utf8"));
      const unit = bundle.delivery_unit_ref ?? "";
      if (!unit.startsWith("FLOW-")) continue;
      if ((bundle.contracts ?? []).some((contract) => references.has(contract.id))) {
        flows.add(unit.split("@")[0]);
      }
    }
  }
  return [...flows].sort();
}

/**
 * 흐름 정본이 요구하는데 화면 정본이 다시 적지 않은 것들.
 *
 * 규칙이 계약에만 있는 것이 아니다. "오늘 이전 필요일을 허용하지 않는다"가
 * `FLOW-FIN-001` STEP-02에만 있었고, 계약과 화면 정본만 읽은 구현은 그것을
 * 빠뜨렸다. "각 품목은 카테고리·예산 항목을 가진다"도 흐름 규칙에만 있었고
 * 역시 빠졌다. 둘 다 사람이 브라우저에서 찾았다.
 *
 * 흐름 전체 절차는 `just flow`가 갖는다. 여기서는 **이 화면이 답해야 하는
 * 문장만** 끌어와 확인 목록에 붙인다.
 */
export async function flowRequirements(root, flowIds) {
  const groups = [];

  for (const flowId of flowIds) {
    const directory = resolve(root, "product-specs/flows", flowId);
    let files = [];
    try {
      files = (await readdir(directory)).filter((name) => name.endsWith(".json")).sort();
    } catch {
      continue;
    }
    if (!files.length) continue;

    // 리비전이 여럿이면 가장 나중 것이 살아 있는 정본이다.
    const flow = JSON.parse(
      await readFile(resolve(directory, files[files.length - 1]), "utf8"),
    );
    const spec = flow.spec ?? {};

    groups.push({
      id: `${flow.id}@R${flow.revision}`,
      title: flow.title,
      rules: (spec.rules ?? []).map((rule) => rule.text).filter(Boolean),
      responses: (spec.steps ?? [])
        .map((step) => step.systemResponse)
        .filter(Boolean),
    });
  }

  return groups;
}

export function formatQa(report) {
  const lines = [
    `${report.wireframeScreen ?? report.id} · ${report.title} — 브라우저 확인 항목`,
    `정본 ${report.file} 에서 뽑았습니다. 이 파일을 고치면 목록도 바뀝니다.`,
    "",
    `  경로   ${report.route ?? "(정본에 경로가 없습니다)"}`,
    `  띄우기 just dev-web-mock`,
  ];

  for (const flow of report.flowRequirements ?? []) {
    const items = [...flow.rules, ...flow.responses];
    if (!items.length) continue;
    lines.push(
      "",
      `흐름 정본이 요구하는 것 (${items.length}) — ${flow.id}`,
      "  화면 정본이 다시 적지 않는다. 여기 있는 것이 빠져도 화면 정본만 보면 모른다",
      "",
    );
    for (const item of items) lines.push(`  [ ] ${item}`);
  }

  for (const group of report.groups) {
    lines.push("", `${group.title} (${group.items.length})`, `  ${group.hint}`, "");
    for (const item of group.items) {
      lines.push(`  [ ] ${item.label}`);
      if (item.note) lines.push(`        ${item.note}`);
    }
  }

  if (report.errors.length) {
    lines.push(
      "",
      `실패 상태 (${report.errors.length})`,
      "  계약이 정한 오류다. 각각을 만들어 보고 안내와 복구 경로를 본다.",
      "",
    );
    for (const error of report.errors) lines.push(`  [ ] ${error}`);
  }

  lines.push(
    "",
    "여기까지는 이 화면 하나만 본다. 눌러서 다음 화면으로 넘어가는 절차는 없다.",
  );
  if (report.flows.length) {
    lines.push("이 화면이 놓인 흐름을 끝까지 따라가려면:");
    for (const flow of report.flows) lines.push(`  just flow ${flow}`);
  } else {
    lines.push("이 화면을 지나는 흐름 정본이 아직 없다: product-specs/flows/");
  }

  lines.push(
    "",
    "공통 합격 기준은 화면마다 다시 적지 않는다. 여기서 읽는다:",
    `  ${SCREEN_QA} 의 "${COMMON_HEADING.slice(3)}"`,
    "",
    "틀린 것을 찾으면 화면이 아니라 정본부터 본다. 정본이 맞고 화면이 틀렸으면",
    "화면을 고치고, 정본이 틀렸으면 정본을 고친 뒤 이 목록을 다시 뽑는다.",
  );
  return lines.join("\n");
}

const invokedDirectly =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  const [screenId] = process.argv.slice(2);
  if (!screenId) {
    console.error("화면 ID가 필요합니다. 예: just qa EVT-FIN-01");
    process.exit(2);
  }

  const report = await collectQa(screenId);
  if (!report) {
    console.error(`${screenId}: 그런 화면 정본이 없습니다. just status로 목록을 봅니다.`);
    process.exit(1);
  }
  console.log(formatQa(report));
}
