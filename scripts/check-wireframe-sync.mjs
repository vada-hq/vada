import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));

const RECORD = "prototypes/wireframe/.sync.json";
const APP = "prototypes/wireframe/src/app/App.tsx";
const SHARE_ENV = "VADA_WIREFRAME_SHARE";

/**
 * 와이어프레임은 저장소 밖에서 편집된 뒤 공유본으로 반입된다. 저장소 사본이
 * 낡으면 그것을 근거로 만든 제품 화면이 전부 틀린다. 실제로 그런 일이 있었다.
 *
 * 저장소는 자기보다 새 공유본이 어딘가 있는지 스스로 알 수 없다. 그래서 반입
 * 시점의 기준선을 기록해 두고, 공유본 경로가 주어지면 그것과 대조한다.
 * 경로가 없으면 확인하지 못했다고 알린다. 조용히 통과시키지 않는다.
 */
export function sha256(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export function countScreens(source) {
  return [...source.matchAll(/\{ id: "([A-Z][A-Z0-9-]*)", label:/g)].length;
}

export async function checkWireframeSync(root = repositoryRoot, sharePath = null) {
  const errors = [];
  const warnings = [];
  const notes = [];

  let record;
  try {
    record = JSON.parse(await readFile(resolve(root, RECORD), "utf8"));
  } catch (cause) {
    errors.push(`${RECORD}를 읽을 수 없습니다: ${cause.message}`);
    return { errors, warnings, notes };
  }

  for (const key of ["imported_at", "app_tsx_sha256", "screen_count"]) {
    if (record[key] === undefined) errors.push(`${RECORD}: 필수 항목이 없습니다: ${key}`);
  }
  if (errors.length) return { errors, warnings, notes };

  let repoSource;
  try {
    repoSource = await readFile(resolve(root, APP), "utf8");
  } catch (cause) {
    errors.push(`${APP}를 읽을 수 없습니다: ${cause.message}`);
    return { errors, warnings, notes };
  }

  // 화면이 조용히 사라지지 않았는지. 반입 사고와 별개로 편집 사고를 잡는다.
  const screens = countScreens(repoSource);
  if (screens !== record.screen_count) {
    errors.push(
      `화면 수가 기준선과 다릅니다: 기록 ${record.screen_count}개, 실제 ${screens}개. ` +
        `의도한 변경이면 ${RECORD}의 screen_count를 갱신하세요.`,
    );
  }

  // 저장소 전용 변경은 정상이다. 다만 다음 반입 때 덮어써지므로 목록이 있어야 한다.
  const diverged = sha256(repoSource) !== record.app_tsx_sha256;
  const localChanges = record.local_changes ?? [];
  if (diverged && localChanges.length === 0) {
    errors.push(
      `저장소 사본이 기준선에서 갈라졌는데 ${RECORD}의 local_changes가 비어 있습니다. ` +
        `다음 반입 때 조용히 사라집니다. 무엇을 왜 바꿨는지 기록하세요.`,
    );
  }
  if (diverged) {
    notes.push(`저장소 전용 변경 ${localChanges.length}건 — 반입 후 다시 적용해야 합니다.`);
    for (const change of localChanges) {
      notes.push(`  · ${change.commit ?? "?"} ${change.summary ?? ""}`);
    }
  }

  // 본 검사: 우리가 반입한 것보다 새 공유본이 있는가.
  if (!sharePath) {
    warnings.push(
      `공유본과 대조하지 못했습니다. 최신 여부는 확인되지 않았습니다. ` +
        `${SHARE_ENV}=<공유본 폴더>를 설정하고 다시 실행하세요.`,
    );
    notes.push(`기준선: ${record.imported_at} 반입, 화면 ${record.screen_count}개`);
    return { errors, warnings, notes };
  }

  const shareApp = resolve(sharePath, "src/app/App.tsx");
  let shareSource;
  try {
    shareSource = await readFile(shareApp, "utf8");
  } catch (cause) {
    errors.push(`공유본을 읽을 수 없습니다: ${shareApp} (${cause.message})`);
    return { errors, warnings, notes };
  }

  if (sha256(shareSource) !== record.app_tsx_sha256) {
    errors.push(
      `공유본이 기준선과 다릅니다. 반입하지 않은 새 와이어프레임입니다.\n` +
        `  기준선  ${record.imported_at} · 화면 ${record.screen_count}개\n` +
        `  공유본  화면 ${countScreens(shareSource)}개\n` +
        `  이 상태로 화면을 만들면 낡은 기준을 따르게 됩니다. ` +
        `prototypes/wireframe/AGENTS.md의 반입 절차를 실행하세요.`,
    );
    return { errors, warnings, notes };
  }

  notes.push(`공유본과 일치합니다 (${record.imported_at} 반입, 화면 ${record.screen_count}개).`);
  return { errors, warnings, notes };
}

const invokedDirectly =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  const share = process.env[SHARE_ENV]?.trim() || null;
  const { errors, warnings, notes } = await checkWireframeSync(repositoryRoot, share);

  for (const note of notes) console.log(note);
  for (const warning of warnings) console.warn(`WARN ${warning}`);
  for (const error of errors) console.error(`ERROR ${error}`);

  if (errors.length) process.exit(1);
  console.log("와이어프레임 동기화 검사 통과");
}
