/**
 * 승인된 계약 묶음 전부에서 만든 OpenAPI 문서를 쓰고 검증한다.
 *
 * `contracts/openapi/CB-FIN-001/R2.json`은 건드리지 않는다. 그 문서는 승인 증거
 * (EVID-027)가 가리키는 산출물이라, 다른 것으로 덮으면 승인 기록이 자기가 승인한
 * 것과 다른 것을 가리키게 된다. 그것은 그대로 두고 계속 검증한다.
 *
 *   node scripts/validate-vada-openapi.mjs            검증
 *   node scripts/validate-vada-openapi.mjs --write    다시 만든다
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  snapshotFreshGeneration,
  validateGeneratedClient,
  writeGeneratedManifest as writeManifest,
  GENERATED_MANIFEST_PATH,
} from "./contract-openapi/generated-client.mjs";
import { serializeJson } from "./contract-openapi/json.mjs";
import {
  VADA_OPENAPI_PATH,
  loadApprovedSurface,
  renderVadaOpenApi,
} from "./contract-openapi/surface.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export async function buildVadaOpenApi(root = repositoryRoot) {
  return renderVadaOpenApi(await loadApprovedSurface(root));
}

export async function validateVadaOpenApi(root = repositoryRoot) {
  const errors = [];
  try {
    const expected = serializeJson(await buildVadaOpenApi(root));
    let actual;
    try {
      actual = await readFile(resolve(root, VADA_OPENAPI_PATH), "utf8");
    } catch (error) {
      if (error.code === "ENOENT") {
        return {
          errors: [`${VADA_OPENAPI_PATH}: OpenAPI 문서가 없습니다.`],
          warnings: [],
        };
      }
      throw error;
    }
    if (actual !== expected) {
      errors.push(
        `${VADA_OPENAPI_PATH}: 승인 계약에서 다시 만든 결과와 바이트가 다릅니다.`,
      );
    }
  } catch (error) {
    errors.push(error.message);
  }
  return { errors, warnings: [] };
}

export async function writeVadaOpenApi(root = repositoryRoot) {
  const document = await buildVadaOpenApi(root);
  const outputPath = resolve(root, VADA_OPENAPI_PATH);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, serializeJson(document));
}

/**
 * 생성 클라이언트는 이제 이 문서에서 나온다. 그래서 그 결정성 검증도 여기 있다 —
 * 승인 산출물(CB-FIN-001 문서)을 검증하는 쪽에 두면 그 파일이 다시 두 가지 일을
 * 하게 된다.
 */
export async function validateGeneratedClientRepository(root = repositoryRoot) {
  return validateGeneratedClient(root, VADA_OPENAPI_PATH);
}

export async function generateClientSnapshot(root = repositoryRoot) {
  return snapshotFreshGeneration(root);
}

export async function writeGeneratedManifest(root = repositoryRoot) {
  return writeManifest(root, VADA_OPENAPI_PATH);
}

const isMain =
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  if (process.argv.includes("--write")) {
    await writeVadaOpenApi(repositoryRoot);
    console.log(`${VADA_OPENAPI_PATH} 생성 완료`);
  } else if (process.argv.includes("--write-manifest")) {
    await writeGeneratedManifest(repositoryRoot);
    console.log(`${GENERATED_MANIFEST_PATH} 생성 완료`);
  } else {
    const [document, client] = await Promise.all([
      validateVadaOpenApi(repositoryRoot),
      validateGeneratedClientRepository(repositoryRoot),
    ]);
    const errors = [...document.errors, ...client.errors];
    if (errors.length > 0) {
      for (const error of errors) console.error(`ERROR ${error}`);
      process.exitCode = 1;
    } else {
      console.log("VADA OpenAPI 검증 통과: 오류 0");
    }
  }
}
