import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parseFrontMatter } from "./validate-screens.mjs";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));

/**
 * 진행 상태를 손으로 적어 두지 않는다. 적어 두면 틀어지고, 대화창에만 두면
 * 대화가 끊길 때 사라진다. 저장소 사실에서 그때그때 계산해 찍는다.
 *
 * 분모는 VADA_MVP_SPEC.md §6 "MVP 화면 묶음"이 정한다. 와이어프레임 87개 전부가
 * 아니라 거기 적힌 화면만이 MVP다. 이 목록을 여기 복사하지 않고 읽어 온다.
 */
const MVP_SPEC = "prototypes/wireframe/docs/VADA_MVP_SPEC.md";
const SCREEN_BUNDLE_HEADING = "### MVP 화면 묶음";

/**
 * 묶음 순서는 VADA_MVP_SPEC.md §11 "개발 순서"가 정한다. §11은 화면 ID 없이
 * 주제로만 적혀 있어서 영역과 단계를 잇는 이 표만 여기 둔다. 화면 목록 자체는
 * 언제나 §6에서 읽는다.
 */
const STAGE_BY_AREA = new Map([
  ["온보딩·조직", 1],
  ["홈·내 업무", 1],
  ["행사", 1],
  ["회의", 2],
  ["참가자", 2],
  ["재정", 3],
]);

/** 캘린더·기록 영역은 §11에서 갈린다. 통합 캘린더는 1단계, 완료 기록은 3단계다. */
const STAGE_BY_SCREEN = new Map([
  ["OPS-CAL-01", 1],
  ["REC-01", 3],
]);

const STAGE_TITLES = new Map([
  [1, "1단계 · 행사 운영의 뼈대"],
  [2, "2단계 · 결정과 참가자 연결"],
  [3, "3단계 · 재정과 완료 기록"],
]);

/**
 * §6은 `ORG-03A/C`, `EVT-TASK-01/02`처럼 뒷자리만 바꿔 줄여 쓴다.
 * 앞 ID의 꼬리를 뒷자리 길이만큼 잘라내고 갈아 끼운다.
 */
export function expandScreenIds(cell) {
  const ids = [];
  for (const [, token] of cell.matchAll(/`([A-Z][A-Z0-9\-/]*)`/g)) {
    const [first, ...rest] = token.split("/");
    ids.push(first);
    for (const suffix of rest) {
      ids.push(first.slice(0, first.length - suffix.length) + suffix);
    }
  }
  return ids;
}

/** §6의 표를 영역과 화면 ID로 읽는다. 표를 못 찾으면 null. */
export function parseMvpScreens(spec) {
  const start = spec.indexOf(SCREEN_BUNDLE_HEADING);
  if (start === -1) return null;

  const areas = [];
  for (const line of spec.slice(start).split("\n").slice(1)) {
    if (!line.startsWith("|")) {
      if (areas.length) break;
      continue;
    }
    const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
    if (cells.length < 2) continue;
    if (/^-+$/.test(cells[0].replaceAll(" ", ""))) continue;
    if (cells[0] === "영역") continue;

    const ids = expandScreenIds(cells[1]);
    if (ids.length) areas.push({ area: cells[0], ids });
  }
  return areas.length ? areas : null;
}

/**
 * 어느 계약이 어느 화면을 받치는지는 정본의 `contracts`가 안다. 서버가 그것을
 * 구현했는지는 API 소스가 그 계약 ID를 적었는지로 본다.
 *
 * 경로 모양을 맞춰 보는 방법을 먼저 썼다가 버렸다. 보완 재제출 화면은 서버에
 * 저장할 자리조차 없는데 부모 경로가 우연히 겹쳐 "서버 있음"으로 나왔다.
 * 거짓 성공이다. 계약 ID는 우연히 겹치지 않는다.
 */
export function apiContractRefs(sources) {
  return new Set(
    sources.flatMap((source) =>
      [...source.matchAll(/"(API:[a-z0-9_.]+@R\d+)"/g)].map((match) => match[1]),
    ),
  );
}

/** 정본은 `FIN-REQ-01B`를, §6은 `FIN-REQ-01`을 쓴다. 변형 한 글자는 같게 본다. */
export function matchesScreen(mvpId, wireframeScreen) {
  if (wireframeScreen === mvpId) return true;
  return new RegExp(`^${mvpId}[A-Z]$`).test(wireframeScreen);
}

export function webRoutes(source) {
  return [...source.matchAll(/^\s*path: "([^"]+)",/gm)].map((match) => match[1]);
}

/**
 * 화면 하나는 정본 → 계약 → 서버 → 화면 순으로 자란다.
 * 어느 칸에서 멈춰 있는지가 "얼마나 남았나"의 답이다.
 */
export function stagesOf(canon, { served, routes }) {
  if (!canon) return { canon: false, contract: false, api: false, web: false };

  // ERROR 계약은 어느 화면에나 붙는다. 그 화면의 계약이 생겼는지만 본다.
  const own = canon.contracts.filter((ref) => !ref.startsWith("ERROR:"));
  const api = own.filter((ref) => ref.startsWith("API:"));

  return {
    canon: true,
    contract: own.length > 0,
    // 계약이 하나도 없으면 구현할 것도 없다. 빈 목록을 통과로 세지 않는다.
    api: api.length > 0 && api.every((ref) => served.has(ref)),
    web: Boolean(canon.route) && routes.includes(canon.route),
  };
}

async function readCanons(root) {
  const directory = resolve(root, "screens");
  const files = (await readdir(directory)).filter(
    (name) => name.endsWith(".md") && name !== "README.md",
  );

  const canons = [];
  for (const name of files) {
    const front = parseFrontMatter(await readFile(resolve(directory, name), "utf8"));
    if (!front) continue;
    canons.push({
      file: `screens/${name}`,
      id: front.id,
      title: front.title,
      route: front.route,
      status: front.status,
      wireframeScreen: front.wireframe_screen,
      contracts: front.contracts ?? [],
    });
  }
  return canons;
}

async function readApiSources(root) {
  const directory = resolve(root, "apps/api/src/vada_api");
  const entries = await readdir(directory, { recursive: true });
  const sources = [];
  for (const entry of entries) {
    if (!entry.endsWith("api.py")) continue;
    sources.push(await readFile(resolve(directory, entry), "utf8"));
  }
  return sources;
}

export async function collectStatus(root = repositoryRoot) {
  const spec = await readFile(resolve(root, MVP_SPEC), "utf8");
  const areas = parseMvpScreens(spec);
  if (!areas) {
    throw new Error(`${MVP_SPEC}에서 "${SCREEN_BUNDLE_HEADING}" 표를 찾지 못했습니다.`);
  }

  const canons = await readCanons(root);
  const routes = webRoutes(
    await readFile(resolve(root, "apps/web/src/app/router.tsx"), "utf8"),
  );
  const served = apiContractRefs(await readApiSources(root));

  const claimed = new Set();
  const stages = new Map([...STAGE_TITLES.keys()].map((n) => [n, []]));

  for (const { area, ids } of areas) {
    for (const id of ids) {
      const canon = canons.find(
        (item) => item.wireframeScreen && matchesScreen(id, item.wireframeScreen),
      );
      if (canon) claimed.add(canon.file);

      const stage = STAGE_BY_SCREEN.get(id) ?? STAGE_BY_AREA.get(area);
      if (stage === undefined) {
        throw new Error(`영역 "${area}"의 개발 단계를 모릅니다. §11과 대조하세요.`);
      }
      stages.get(stage).push({
        id,
        area,
        canon,
        stages: stagesOf(canon, { served, routes }),
        done: canon?.status === "done",
      });
    }
  }

  const total = [...stages.values()].reduce((sum, rows) => sum + rows.length, 0);
  const done = [...stages.values()]
    .flat()
    .filter((row) => row.done).length;

  return {
    total,
    done,
    stages,
    // MVP 목록에 없는데 정본을 쓴 화면. 범위를 벗어난 작업이 여기 드러난다.
    outsideMvp: canons.filter((canon) => !claimed.has(canon.file)),
  };
}

const MARK = { yes: "O", no: "." };

function mark(value) {
  return value ? MARK.yes : MARK.no;
}

export function formatStatus(report) {
  const percent = report.total ? Math.round((report.done / report.total) * 100) : 0;
  const lines = [
    `VADA 진행 현황 — MVP 화면 ${report.total}개 중 ${report.done}개 완료 (${percent}%)`,
    `분모는 ${MVP_SPEC} §6, 순서는 §11이 정한다.`,
  ];

  for (const [stage, rows] of report.stages) {
    const finished = rows.filter((row) => row.done).length;
    lines.push("", `${STAGE_TITLES.get(stage)}  —  ${finished} / ${rows.length}`);

    const started = rows.filter((row) => row.canon);
    if (started.length) {
      lines.push("  화면              정본 계약 서버 화면  상태   정본 파일");
      for (const row of started) {
        const s = row.stages;
        lines.push(
          `  ${row.id.padEnd(16)}  ${mark(s.canon)}    ${mark(s.contract)}    ` +
            `${mark(s.api)}    ${mark(s.web)}   ${(row.canon.status ?? "?").padEnd(5)}  ${row.canon.file}`,
        );
      }
    }

    const pending = rows.filter((row) => !row.canon).map((row) => row.id);
    if (pending.length) {
      lines.push(`  착수 전 ${pending.length}개: ${pending.join(" ")}`);
    }
  }

  if (report.outsideMvp.length) {
    lines.push("", `MVP 화면 묶음에 없는데 정본이 있는 화면 ${report.outsideMvp.length}개`);
    for (const canon of report.outsideMvp) {
      lines.push(`  ${(canon.wireframeScreen ?? canon.id).padEnd(16)}  ${canon.status}  ${canon.file}`);
    }
  }

  lines.push(
    "",
    "정본=screens/<ID>.md · 계약=ERROR 아닌 계약 · 서버=그 API 계약이 서버에 구현됨 · 화면=웹 라우터 등록",
    "지금 진행 중인 것은 GitHub Issue와 PR이 소유한다: gh pr list && gh issue list",
  );
  return lines.join("\n");
}

const invokedDirectly =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  console.log(formatStatus(await collectStatus()));
}
