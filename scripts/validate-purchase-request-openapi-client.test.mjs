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

test("R2 상세 성공 응답과 계약 추적을 생성 기준선에 고정한다", async () => {
  const [baseline, generatedTypes] = await Promise.all([
    loadPurchaseRequestOpenApiBaseline(repositoryRoot),
    readFile(
      resolve(repositoryRoot, "packages/api-client/src/generated/types.gen.ts"),
      "utf8",
    ),
  ]);
  const openApi = baseline.openApi;
  const operation =
    openApi.paths["/events/{eventId}/purchase-requests/{requestId}"].get;

  assert.equal(openApi.info.version, "CB-FIN-001-R2");
  assert.equal(
    openApi["x-vada-delivery-work"],
    "WORK:purchase-request-openapi-client-baseline@R2",
  );
  assert.equal(openApi["x-vada-completion-evidence"], "EVID-027");
  assert.deepEqual(
    openApi.components.schemas.PurchaseRequestDetailView.required,
    ["record", "display"],
  );
  assert.deepEqual(
    operation.responses["200"].content["application/json"].schema,
    { $ref: "#/components/schemas/PurchaseRequestDetailView" },
  );
  assert.equal(
    operation["x-vada-contracts"].includes(
      "API:purchase_request.get_detail@R2",
    ),
    true,
  );
  assert.equal(
    operation["x-vada-contracts"].includes(
      "DATA:purchase_request.detail_view@R1",
    ),
    true,
  );
  assert.equal(
    operation["x-vada-contracts"].includes(
      "API:purchase_request.get_detail@R1",
    ),
    false,
  );
  assert.match(
    generatedTypes,
    /export type PurchaseRequestDetailView = \{[\s\S]*record: PurchaseRequestRecord;[\s\S]*display: \{[\s\S]*eventName: string;[\s\S]*requesterName: string;/,
  );
  assert.match(
    generatedTypes,
    /export type GetPurchaseRequestDetailResponses = \{[\s\S]*200: PurchaseRequestDetailView;/,
  );
});

test("R2 상세 operation에 superseded R1 추적이나 응답 타입이 남으면 거부한다", async () => {
  const baseline = await loadPurchaseRequestOpenApiBaseline(repositoryRoot);
  const r1Trace = structuredClone(baseline.openApi);
  const r1TraceOperation =
    r1Trace.paths["/events/{eventId}/purchase-requests/{requestId}"].get;
  r1TraceOperation["x-vada-contracts"] = r1TraceOperation[
    "x-vada-contracts"
  ].map((contractRef) =>
    contractRef === "API:purchase_request.get_detail@R2"
      ? "API:purchase_request.get_detail@R1"
      : contractRef,
  );
  const r1Response = structuredClone(baseline.openApi);
  r1Response.paths[
    "/events/{eventId}/purchase-requests/{requestId}"
  ].get.responses["200"].content["application/json"].schema = {
    $ref: "#/components/schemas/PurchaseRequestRecord",
  };

  for (const invalidOpenApi of [r1Trace, r1Response]) {
    assert.match(
      validatePurchaseRequestOpenApiDocument(invalidOpenApi, baseline).join(
        "\n",
      ),
      /x-vada-contracts|드리프트/,
    );
  }
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
    const repositoryManifest = await readJson(
      resolve(repositoryRoot, "packages/api-client/generated-manifest.json"),
    );
    for (const path of [
      repositoryManifest.input.path,
      "packages/api-client/package.json",
      "packages/api-client/openapi-ts.config.ts",
      "packages/api-client/generated-manifest.json",
      "packages/api-client/src/generated",
      "packages/api-client/src/index.ts",
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

test("생성 진입점에 수동 응답 타입을 추가하면 거부한다", async () => {
  const temporaryRoot = await mkdtemp(
    resolve(tmpdir(), "vada-openapi-client-manual-type-"),
  );
  try {
    const repositoryManifest = await readJson(
      resolve(repositoryRoot, "packages/api-client/generated-manifest.json"),
    );
    for (const path of [
      repositoryManifest.input.path,
      "packages/api-client/package.json",
      "packages/api-client/openapi-ts.config.ts",
      "packages/api-client/generated-manifest.json",
      "packages/api-client/src/generated",
      "packages/api-client/src/index.ts",
    ]) {
      await cp(resolve(repositoryRoot, path), resolve(temporaryRoot, path), {
        recursive: true,
      });
    }
    const entrypointPath = resolve(
      temporaryRoot,
      "packages/api-client/src/index.ts",
    );
    await writeFile(
      entrypointPath,
      `${await readFile(entrypointPath, "utf8")}\nexport type PurchaseRequestDetailView = { record: unknown; display: unknown };\n`,
    );

    assert.match(
      (await validateGeneratedClientRepository(temporaryRoot)).errors.join(
        "\n",
      ),
      /수동 타입|진입점/,
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
