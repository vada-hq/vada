import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parseFrontMatter } from "./validate-screens.mjs";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));

/**
 * API 하나가 어디까지 왔는지를 저장소 사실에서 계산한다. 진행 상태를 JSON에
 * 적어 두지 않는 이유는 report-status.mjs와 같다. 적어 두면 손으로 고쳐야 하고,
 * 손으로 고치는 것은 반드시 잊는다. 작업 중은 GitHub PR이 소유한다.
 *
 * 계약이 두 세대로 갈려 있다. 옛 세대(DU-001)는 contracts/openapi.json에
 * 오퍼레이션으로, 지금 세대는 contracts/bundles/에 API 계약으로 적는다.
 * 둘 다 읽는다. 옛 세대를 빼면 설계가 끝난 행사 API 5건이 화면에서 사라진다.
 */
const LEGACY_OPENAPI = "contracts/openapi.json";
const BUNDLE_DIRECTORY = "contracts/bundles";
const API_SOURCE_DIRECTORY = "apps/api/src/vada_api";
const DEFAULT_HTML_OUTPUT = ".artifacts/api-board.html";

const HTTP_METHODS = new Set(["get", "post", "put", "patch", "delete"]);

export const STATES = {
  served: "구현",
  pending: "미착수",
  planned: "계획",
  superseded: "대체됨",
};

/**
 * 구현 여부의 근거는 서버 소스가 적은 식별자다. 경로 모양을 맞춰 보지 않는다.
 * report-status.mjs가 그러다 거짓 성공을 냈다.
 *
 * 지금 세대는 계약 ID로 본다. 리비전까지 구별하기 때문이다. 옛 세대는 계약 ID가
 * 없어 operationId로 본다. 둘 다 우연히 겹치지 않는 식별자다.
 */
export function servedContractIds(sources) {
  return new Set(
    sources.flatMap((source) =>
      [...source.matchAll(/"(API:[a-z0-9_.]+@R\d+)"/g)].map((match) => match[1]),
    ),
  );
}

export function servedOperationIds(sources) {
  return new Set(
    sources.flatMap((source) =>
      [...source.matchAll(/operation_id="([A-Za-z0-9_]+)"/g)].map((match) => match[1]),
    ),
  );
}

/** 다른 계약이 supersedes로 가리킨 계약 ID. 그것들은 이제 만들 대상이 아니다. */
export function supersededIds(contracts) {
  return new Set(
    contracts.map((contract) => contract.supersedes).filter((id) => typeof id === "string"),
  );
}

/**
 * 서버에 있으면 무조건 구현이다. proposed인데 이미 구현됐다면 그것은 절차 문제이지
 * 현황판이 감출 일이 아니다. 있는 것을 없다고 적지 않는다.
 */
export function stateOf(row, { servedContracts, servedOperations, superseded }) {
  if (row.contractId && superseded.has(row.contractId)) return STATES.superseded;

  const served = row.contractId
    ? servedContracts.has(row.contractId)
    : servedOperations.has(row.operationId);
  if (served) return STATES.served;

  return row.status === "proposed" ? STATES.planned : STATES.pending;
}

export function rowsFromBundle(bundle, origin) {
  const rows = [];
  for (const contract of bundle.contracts ?? []) {
    const id = contract.id ?? "";
    if (!id.startsWith("API:")) continue;
    const spec = contract.specification ?? {};
    rows.push({
      origin,
      generation: "bundle",
      contractId: id,
      // 계약 키만 쓴다. `API:` 접두사는 모든 행에 똑같이 붙어 정보가 아니다.
      label: id.slice("API:".length),
      operationId: spec.operation_id ?? "",
      method: (spec.method ?? "").toUpperCase(),
      path: spec.path ?? "",
      permission: (spec.authorization_ref ?? "").replace(/^AUTH:/, ""),
      status: contract.status,
      unit: bundle.delivery_unit_ref ?? "",
    });
  }
  return rows;
}

export function rowsFromLegacyOpenApi(document, origin) {
  const rows = [];
  for (const [path, item] of Object.entries(document.paths ?? {})) {
    for (const [method, operation] of Object.entries(item)) {
      if (!HTTP_METHODS.has(method)) continue;
      rows.push({
        origin,
        generation: "legacy",
        // 옛 세대에는 API 종류의 계약이 없다. 그래서 화면 정본이 이 API를
        // 참조할 방법도 없고, 화면 칸이 비는 것은 표시 누락이 아니라 사실이다.
        contractId: null,
        label: operation.operationId ?? `${method} ${path}`,
        operationId: operation.operationId ?? "",
        method: method.toUpperCase(),
        path,
        permission: operation["x-vada-permission"] ?? "",
        status: "ratified",
        unit: "",
      });
    }
  }
  return rows;
}

async function readBundles(root) {
  const directory = resolve(root, BUNDLE_DIRECTORY);
  const bundles = [];
  for (const name of (await readdir(directory)).sort()) {
    for (const file of (await readdir(resolve(directory, name))).sort()) {
      if (!file.endsWith(".json")) continue;
      const document = JSON.parse(await readFile(resolve(directory, name, file), "utf8"));
      bundles.push({ origin: `${name}@${file.replace(/\.json$/, "")}`, document });
    }
  }
  return bundles;
}

async function readApiSources(root) {
  const directory = resolve(root, API_SOURCE_DIRECTORY);
  const sources = [];
  for (const entry of await readdir(directory, { recursive: true })) {
    if (!entry.endsWith(".py")) continue;
    sources.push(await readFile(resolve(directory, entry), "utf8"));
  }
  return sources;
}

async function readScreenContracts(root) {
  const directory = resolve(root, "screens");
  const byContract = new Map();
  for (const name of await readdir(directory)) {
    if (!name.endsWith(".md") || name === "README.md") continue;
    const front = parseFrontMatter(await readFile(resolve(directory, name), "utf8"));
    if (!front) continue;
    for (const reference of front.contracts ?? []) {
      if (!byContract.has(reference)) byContract.set(reference, []);
      byContract.get(reference).push(front.wireframe_screen ?? front.id);
    }
  }
  return byContract;
}

export async function collectApiBoard(root = repositoryRoot) {
  const bundles = await readBundles(root);
  const legacy = JSON.parse(await readFile(resolve(root, LEGACY_OPENAPI), "utf8"));
  const sources = await readApiSources(root);
  const screensByContract = await readScreenContracts(root);

  const rows = [
    ...bundles.flatMap(({ origin, document }) => rowsFromBundle(document, origin)),
    ...rowsFromLegacyOpenApi(legacy, LEGACY_OPENAPI),
  ];

  const superseded = supersededIds(
    bundles.flatMap(({ document }) => document.contracts ?? []),
  );
  const context = {
    servedContracts: servedContractIds(sources),
    servedOperations: servedOperationIds(sources),
    superseded,
  };

  for (const row of rows) {
    row.state = stateOf(row, context);
    row.screens = row.contractId ? (screensByContract.get(row.contractId) ?? []) : [];
  }

  const groups = new Map();
  for (const row of rows) {
    if (!groups.has(row.origin)) groups.set(row.origin, []);
    groups.get(row.origin).push(row);
  }

  const counts = Object.fromEntries(
    Object.values(STATES).map((state) => [
      state,
      rows.filter((row) => row.state === state).length,
    ]),
  );

  return { rows, groups, counts };
}

/** 한글은 터미널에서 두 칸을 먹는다. padEnd는 코드 포인트만 세어 표가 어긋난다. */
export function displayWidth(text) {
  let width = 0;
  for (const character of text) {
    const code = character.codePointAt(0);
    const wide =
      (code >= 0x1100 && code <= 0x115f) ||
      (code >= 0x2e80 && code <= 0xa4cf) ||
      (code >= 0xac00 && code <= 0xd7a3) ||
      (code >= 0xf900 && code <= 0xfaff) ||
      (code >= 0xfe30 && code <= 0xfe6f) ||
      (code >= 0xff00 && code <= 0xff60) ||
      (code >= 0xffe0 && code <= 0xffe6);
    width += wide ? 2 : 1;
  }
  return width;
}

function pad(text, width) {
  return text + " ".repeat(Math.max(0, width - displayWidth(text)));
}

export function formatBoard(board) {
  const summary = Object.entries(board.counts)
    .filter(([, count]) => count > 0)
    .map(([state, count]) => `${state} ${count}`)
    .join(" · ");

  const lines = [
    `VADA API 현황 — 계약 ${board.rows.length}건 · ${summary}`,
    "계획은 계약 JSON이, 구현 여부는 서버 소스가, 작업 중은 GitHub PR이 안다.",
  ];

  // 칸 너비는 표 전체에서 한 번만 잰다. 묶음마다 따로 재면 줄이 서로 어긋나
  // 위아래로 훑을 수가 없다. 훑는 것이 이 표의 용도다.
  const widths = {
    state: Math.max(...board.rows.map((row) => displayWidth(row.state))),
    method: Math.max(...board.rows.map((row) => row.method.length)),
    screens: Math.max(6, ...board.rows.map((row) => displayWidth(row.screens.join(" ")))),
    label: Math.max(...board.rows.map((row) => row.label.length)),
  };

  // 경로가 맨 뒤다. 가장 길고 길이가 제각각이라, 앞에 두면 짧은 경로 뒤로 빈
  // 칸이 한참 남는다. 맨 뒤면 패딩이 아예 필요 없다.
  for (const [origin, rows] of board.groups) {
    lines.push("", `${origin}${rows[0].unit ? `  (${rows[0].unit})` : ""}`);
    for (const row of rows) {
      lines.push(
        `  ${pad(row.state, widths.state)}  ${pad(row.screens.join(" ") || "—", widths.screens)}  ` +
          `${pad(row.label, widths.label)}  ${pad(row.method, widths.method)} ${row.path}`,
      );
    }
  }

  lines.push(
    "",
    "구현=서버 소스가 그 계약 ID나 operationId를 적었다 · 계획=계약이 proposed다",
    "커밋된 것만 보인다. 지금 손에 든 작업은: gh pr list",
  );
  return lines.join("\n");
}

const STATE_CLASS = {
  [STATES.served]: "served",
  [STATES.pending]: "pending",
  [STATES.planned]: "planned",
  [STATES.superseded]: "superseded",
};

function escapeHtml(text) {
  return String(text).replace(
    /[&<>"]/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character],
  );
}

/** 외부 자원을 하나도 참조하지 않는다. 파일 하나만 열면 보여야 한다. */
export function renderHtml(board, { generatedFrom }) {
  const summary = Object.entries(board.counts)
    .map(
      ([state, count]) =>
        `<li class="${STATE_CLASS[state]}"><b>${count}</b><span>${escapeHtml(state)}</span></li>`,
    )
    .join("");

  const sections = [...board.groups]
    .map(([origin, rows]) => {
      const body = rows
        .map(
          (row) => `<tr>
<td><span class="chip ${STATE_CLASS[row.state]}">${escapeHtml(row.state)}</span></td>
<td>${row.screens.length ? escapeHtml(row.screens.join(", ")) : "<i>—</i>"}</td>
<td class="key"><code>${escapeHtml(row.label)}</code></td>
<td class="method">${escapeHtml(row.method)}</td>
<td class="path"><code>${escapeHtml(row.path)}</code></td>
</tr>`,
        )
        .join("\n");
      return `<section>
<h2>${escapeHtml(origin)}${rows[0].unit ? ` <small>${escapeHtml(rows[0].unit)}</small>` : ""}</h2>
<div class="scroll"><table>
<thead><tr><th>상태</th><th>화면</th><th>계약</th><th>메서드</th><th>경로</th></tr></thead>
<tbody>${body}</tbody>
</table></div>
</section>`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>VADA API 현황판</title>
<style>
:root { color-scheme: light dark; --bg:#fff; --fg:#111; --muted:#666; --line:#e4e4e7; --card:#fafafa; }
@media (prefers-color-scheme: dark) {
  :root { --bg:#0c0c0d; --fg:#ededef; --muted:#9a9aa2; --line:#26262a; --card:#151517; }
}
* { box-sizing: border-box; }
body { margin:0; padding:2rem 1.25rem 4rem; background:var(--bg); color:var(--fg);
  font:15px/1.6 ui-sans-serif,-apple-system,"Segoe UI","Pretendard","Malgun Gothic",sans-serif; }
main { max-width: 68rem; margin: 0 auto; }
h1 { font-size:1.4rem; margin:0 0 .25rem; }
.sub { color:var(--muted); font-size:.85rem; margin:0 0 1.5rem; }
ul.summary { display:flex; flex-wrap:wrap; gap:.75rem; list-style:none; padding:0; margin:0 0 2rem; }
ul.summary li { flex:1 1 7rem; padding:.75rem 1rem; border:1px solid var(--line); border-radius:.6rem; background:var(--card); }
ul.summary b { display:block; font-size:1.6rem; line-height:1.2; }
ul.summary span { color:var(--muted); font-size:.8rem; }
section { margin-bottom:2rem; }
h2 { font-size:.95rem; margin:0 0 .5rem; font-weight:600; }
h2 small { color:var(--muted); font-weight:400; }
.scroll { overflow-x:auto; border:1px solid var(--line); border-radius:.6rem; }
table { border-collapse:collapse; width:100%; font-size:.85rem; }
th, td { text-align:left; padding:.5rem .75rem; border-bottom:1px solid var(--line); white-space:nowrap; }
th { color:var(--muted); font-weight:500; font-size:.78rem; }
tbody tr:last-child td { border-bottom:none; }
code { font:.82rem ui-monospace,SFMono-Regular,Menlo,monospace; }
.method { color:var(--muted); }
.key code { color:var(--muted); }
.chip { display:inline-block; padding:.1rem .5rem; border-radius:.3rem; font-size:.78rem; }
.served { color:#0a7c42; } .chip.served { background:#0a7c4222; }
.pending { color:#b45309; } .chip.pending { background:#b4530922; }
.planned { color:#4f46e5; } .chip.planned { background:#4f46e522; }
.superseded { color:var(--muted); } .chip.superseded { background:#8884; }
footer { color:var(--muted); font-size:.8rem; border-top:1px solid var(--line); padding-top:1rem; }
</style>
</head>
<body>
<main>
<h1>VADA API 현황판</h1>
<p class="sub">계약 ${board.rows.length}건 · ${escapeHtml(generatedFrom)}에서 계산했습니다. 손으로 고치지 마십시오.</p>
<ul class="summary">${summary}</ul>
${sections}
<footer>
<p><b>구현</b> 서버 소스가 그 계약 ID나 operationId를 적었습니다. <b>계획</b> 계약이 <code>proposed</code>입니다.
<b>대체됨</b> 다른 리비전이 <code>supersedes</code>로 가리킵니다.</p>
<p>커밋된 것만 보입니다. 지금 손에 든 작업은 <code>gh pr list</code>가 압니다.
현황판을 다시 구우려면 <code>just api --html</code>.</p>
</footer>
</main>
</body>
</html>
`;
}

const invokedDirectly =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  const board = await collectApiBoard();
  const htmlFlag = process.argv.slice(2).find((argument) => argument.startsWith("--html"));

  if (htmlFlag === undefined) {
    console.log(formatBoard(board));
  } else {
    const target = resolve(
      repositoryRoot,
      htmlFlag.includes("=") ? htmlFlag.split("=").slice(1).join("=") : DEFAULT_HTML_OUTPUT,
    );
    await mkdir(dirname(target), { recursive: true });
    await writeFile(
      target,
      renderHtml(board, { generatedFrom: `${BUNDLE_DIRECTORY}/ 와 ${LEGACY_OPENAPI}` }),
      "utf8",
    );
    console.log(target);
  }
}
