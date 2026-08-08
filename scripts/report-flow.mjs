import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parseFrontMatter } from "./validate-screens.mjs";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));

/**
 * 화면 하나로는 표현할 수 없는 검증을 찍는다.
 *
 * 제출 → 검토 → 보완 → 재제출은 화면 넷을 가로지른다. `screens/<ID>.md` 어느
 * 하나도 그것을 소유하지 않아서, `just qa`로는 그 흐름이 끝까지 도는지 볼 수
 * 없다. MVP 성공 기준이 요구하는 것이 정확히 그 흐름인데도 그렇다.
 *
 * 대본을 새로 쓰지 않는다. 흐름 정본에 단계·분기·완료 시나리오가 이미
 * Given-When-Then으로 승인돼 있다. 읽어서 사람이 따라 할 형태로만 바꾼다.
 */
const FLOWS = "product-specs/flows";

export function flowHeading(document) {
  return `${document.id}@R${document.revision} · ${document.title}`;
}

/** 이 흐름이 어느 화면을 지나는가. 계약 묶음의 전달 단위가 그 답을 안다. */
export function screensOnFlow(flowId, bundles, canons) {
  const contracts = new Set();
  for (const bundle of bundles) {
    const unit = bundle.delivery_unit_ref ?? "";
    if (!unit.startsWith(flowId)) continue;
    for (const contract of bundle.contracts ?? []) contracts.add(contract.id);
  }

  return canons
    .filter((canon) => canon.contracts.some((reference) => contracts.has(reference)))
    .map((canon) => `${canon.wireframeScreen ?? canon.id}  ${canon.route ?? ""}`.trim());
}

async function readJsonTree(root, directory) {
  const base = resolve(root, directory);
  const documents = [];
  for (const name of (await readdir(base)).sort()) {
    for (const file of (await readdir(resolve(base, name))).sort()) {
      if (!file.endsWith(".json")) continue;
      documents.push(JSON.parse(await readFile(resolve(base, name, file), "utf8")));
    }
  }
  return documents;
}

async function readCanons(root) {
  const directory = resolve(root, "screens");
  const canons = [];
  for (const name of await readdir(directory)) {
    if (!name.endsWith(".md") || name === "README.md") continue;
    const front = parseFrontMatter(await readFile(resolve(directory, name), "utf8"));
    if (!front) continue;
    canons.push({
      id: front.id,
      route: front.route,
      wireframeScreen: front.wireframe_screen,
      contracts: front.contracts ?? [],
    });
  }
  return canons;
}

/** 가장 높은 리비전이 지금 것이다. 낮은 리비전은 그것이 대체한 과거다. */
export function newestRevision(documents, flowId) {
  const matching = documents.filter((document) => document.id === flowId);
  if (!matching.length) return null;
  return matching.reduce((best, item) => (item.revision > best.revision ? item : best));
}

export async function collectFlow(flowId, root = repositoryRoot) {
  const flows = await readJsonTree(root, FLOWS);
  const document = newestRevision(flows, flowId);
  if (!document) return null;

  return {
    document,
    screens: screensOnFlow(
      document.id,
      await readJsonTree(root, "contracts/bundles"),
      await readCanons(root),
    ),
  };
}

export async function listFlows(root = repositoryRoot) {
  const flows = await readJsonTree(root, FLOWS);
  const newest = new Map();
  for (const flow of flows) {
    const best = newest.get(flow.id);
    if (!best || flow.revision > best.revision) newest.set(flow.id, flow);
  }
  return [...newest.values()];
}

export function formatFlow({ document, screens }) {
  const spec = document.spec;
  const lines = [
    `${flowHeading(document)} — 흐름 확인 절차`,
    `정본 ${FLOWS}/${document.id}/R${document.revision}.json 에서 뽑았습니다.`,
    "",
    "  띄우기 just dev-web-mock",
  ];

  if (screens.length) {
    lines.push("", `지나는 화면 (${screens.length})`);
    for (const screen of screens) lines.push(`  ${screen}`);
  }

  lines.push(
    "",
    "무엇이 끝나야 성공인가",
    `  ${spec.outcome.result}`,
    "",
    `  왜 하는가  ${spec.outcome.trigger}`,
  );

  lines.push("", `시작 전에 갖춰야 할 것 (${spec.preconditions.length})`, "");
  for (const item of spec.preconditions) {
    lines.push(`  [ ] ${item.id}  ${item.text}`);
  }

  lines.push("", `정상 흐름 (${spec.steps.length})`, "  순서대로 하고 화면이 그렇게 답하는지 본다", "");
  spec.steps.forEach((step, index) => {
    lines.push(`  ${index + 1}. [ ] ${step.id}`);
    lines.push(`         한다    ${step.action}`);
    lines.push(`         보인다  ${step.systemResponse}`);
  });

  lines.push(
    "",
    `일부러 틀려 보는 것 (${spec.branches.length})`,
    "  정상 흐름만 보면 실패가 어떻게 생겼는지 모른다",
    "",
  );
  for (const branch of spec.branches) {
    lines.push(`  [ ] ${branch.id}`);
    lines.push(`         만든다  ${branch.condition}`);
    lines.push(`         보인다  ${branch.userVisibleResult}`);
  }

  lines.push("", `끝까지 됐는지 (${spec.completionScenarios.length})`, "");
  for (const scenario of spec.completionScenarios) {
    lines.push(`  [ ] ${scenario.id}  ${scenario.name}`);
    for (const given of scenario.given) lines.push(`         주어진 것  ${given}`);
    for (const when of scenario.when) lines.push(`         한다       ${when}`);
    for (const then of scenario.then) lines.push(`         그러면     ${then}`);
  }

  lines.push(
    "",
    "마지막으로 30분, 대본 없이",
    "  위 목록은 우리가 이미 예상한 것만 확인한다. 예상 못 한 것은 목록으로",
    "  못 찾는다. 시간을 정해 두고 이 흐름을 아무렇게나 써 보라.",
    "",
    "  · 값을 이상하게 넣어 본다 — 아주 크게, 비워서, 붙여넣기로, 한글 IME로",
    "  · 중간에 뒤로 가고 새로고침하고 두 탭에서 같은 것을 동시에 해 본다",
    "  · 화면이 사실이 아닌 것을 말하는 곳을 찾는다",
    "",
    "  찾은 것은 화면 정본이나 흐름 정본에 적는다. 다음 사람이 그것을 목록으로 받는다.",
  );
  return lines.join("\n");
}

const invokedDirectly =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  const [flowId] = process.argv.slice(2);
  if (!flowId) {
    console.error("흐름 ID가 필요합니다. 지금 있는 흐름:");
    for (const flow of await listFlows()) {
      console.error(`  ${flow.id}@R${flow.revision}  ${flow.title}`);
    }
    process.exit(2);
  }

  const report = await collectFlow(flowId);
  if (!report) {
    console.error(`${flowId}: 그런 흐름 정본이 없습니다. ${FLOWS}/ 를 보세요.`);
    process.exit(1);
  }
  console.log(formatFlow(report));
}
