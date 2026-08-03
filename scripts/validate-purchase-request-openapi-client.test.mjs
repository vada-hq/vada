import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  generateClientSnapshot,
  loadPurchaseRequestOpenApiBaseline,
  validateGeneratedClientRepository,
  validatePurchaseRequestOpenApiDocument,
  validatePurchaseRequestOpenApiRepository,
} from "./validate-purchase-request-openapi-client.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

test("승인된 여섯 구매 요청 동작의 OpenAPI와 생성 클라이언트 기준선이 유효하다", async () => {
  const [openApiResult, generatedResult] = await Promise.all([
    validatePurchaseRequestOpenApiRepository(repositoryRoot),
    validateGeneratedClientRepository(repositoryRoot),
  ]);

  assert.deepEqual(openApiResult.errors, []);
  assert.deepEqual(generatedResult.errors, []);
});

test("필수 x-vada 계약·권한·AC 추적 정보가 빠지면 거부한다", async () => {
  const baseline = await loadPurchaseRequestOpenApiBaseline(repositoryRoot);
  const openApi = structuredClone(baseline.openApi);
  const operation =
    openApi.paths["/events/{eventId}/purchase-request-editor"].get;
  delete operation["x-vada-contracts"];
  delete operation["x-vada-permission"];
  delete operation["x-vada-acceptance-criteria"];

  const errors = validatePurchaseRequestOpenApiDocument(openApi, baseline).join(
    "\n",
  );

  assert.match(errors, /x-vada-contracts/);
  assert.match(errors, /x-vada-permission/);
  assert.match(errors, /x-vada-acceptance-criteria/);
});

test("오류 응답이 RFC 9457 Problem Details 미디어 타입을 잃으면 거부한다", async () => {
  const baseline = await loadPurchaseRequestOpenApiBaseline(repositoryRoot);
  const openApi = structuredClone(baseline.openApi);
  const operation = openApi.paths["/events/{eventId}/purchase-requests"].post;
  operation.responses["422"].content["application/json"] =
    operation.responses["422"].content["application/problem+json"];
  delete operation.responses["422"].content["application/problem+json"];

  assert.match(
    validatePurchaseRequestOpenApiDocument(openApi, baseline).join("\n"),
    /application\/problem\+json/,
  );
});

test("커밋된 생성 클라이언트가 달라지면 드리프트로 거부한다", async () => {
  const temporaryRoot = await mkdtemp(
    resolve(tmpdir(), "vada-openapi-client-drift-"),
  );
  try {
    for (const path of [
      "contracts/openapi/CB-FIN-001/R1.json",
      "packages/api-client/package.json",
      "packages/api-client/openapi-ts.config.ts",
      "packages/api-client/generated-manifest.json",
      "packages/api-client/src/generated",
    ]) {
      await cp(resolve(repositoryRoot, path), resolve(temporaryRoot, path), {
        recursive: true,
      });
    }
    const manifest = await readJson(
      resolve(temporaryRoot, "packages/api-client/generated-manifest.json"),
    );
    const generatedPath = resolve(
      temporaryRoot,
      "packages/api-client/src/generated",
      manifest.files[0].path,
    );
    await writeFile(
      generatedPath,
      `${await readFile(generatedPath, "utf8")}\n// drift\n`,
    );

    assert.match(
      (await validateGeneratedClientRepository(temporaryRoot)).errors.join(
        "\n",
      ),
      /드리프트/,
    );
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("같은 OpenAPI 입력의 두 생성 결과와 커밋 산출물이 바이트 단위로 같다", async () => {
  const [first, second, manifest] = await Promise.all([
    generateClientSnapshot(repositoryRoot),
    generateClientSnapshot(repositoryRoot),
    readJson(
      resolve(repositoryRoot, "packages/api-client/generated-manifest.json"),
    ),
  ]);

  assert.deepEqual(first, second);
  assert.deepEqual(first, manifest.files);
});
