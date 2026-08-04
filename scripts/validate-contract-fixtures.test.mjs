import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  validateContractFixtureDocument,
  validateContractFixtureRepository,
} from "./validate-contract-fixtures.mjs";
import { resolveEffectiveContracts } from "./validate-contract-bundles.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const bundlePath = resolve(repositoryRoot, "contracts/bundles/CB-FIN-001/R1.json");
const fixturePath = resolve(repositoryRoot, "contracts/fixtures/CB-FIN-001/R1.json");
const r2BundlePath = resolve(repositoryRoot, "contracts/bundles/CB-FIN-001/R2.json");
const r2FixturePath = resolve(repositoryRoot, "contracts/fixtures/CB-FIN-001/R2.json");

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

test("승인 구매 요청 계약 픽스처 기준선이 유효하다", async () => {
  const result = await validateContractFixtureRepository(repositoryRoot);

  assert.deepEqual(result.errors, []);
});

test("필수 데이터·오류 사례와 여섯 API의 성공 모의를 모두 제공한다", async () => {
  const fixture = await readJson(fixturePath);
  const dataExampleIds = new Set(fixture.data_examples.map((example) => example.id));
  const errorContractRefs = new Set(fixture.error_examples.map((example) => example.contract_ref));
  const successfulApiRefs = fixture.api_mocks
    .filter((example) => example.scenario === "success")
    .map((example) => example.contract_ref);

  for (const requiredId of [
    "incomplete-draft",
    "missing-price-evidence",
    "normal-multi-item-request",
    "submitted-event",
  ]) {
    assert.equal(dataExampleIds.has(requiredId), true, `${requiredId} 예제가 필요합니다.`);
  }
  assert.deepEqual(
    [...errorContractRefs].sort(),
    [
      "ERROR:http.resource_not_found@R1",
      "ERROR:http.unauthenticated@R1",
      "ERROR:purchase_request.action_forbidden@R1",
      "ERROR:purchase_request.persistence_unavailable@R1",
      "ERROR:purchase_request.state_conflict@R1",
      "ERROR:purchase_request.validation_failed@R1",
    ],
  );
  assert.equal(successfulApiRefs.length, 6);
  assert.equal(new Set(successfulApiRefs).size, 6);
});

test("R2 픽스처는 기존 여섯 동작을 보존하고 상세 성공 응답을 record와 display로 제공한다", async () => {
  const [previousFixture, fixture] = await Promise.all([
    readJson(fixturePath),
    readJson(r2FixturePath),
  ]);
  const successfulApiRefs = fixture.api_mocks
    .filter((example) => example.scenario === "success")
    .map((example) => example.contract_ref);
  const record = fixture.data_examples.find(
    (example) => example.id === "submitted-multi-item-record",
  );
  const detail = fixture.data_examples.find(
    (example) => example.id === "purchase-request-detail-view",
  );
  const detailMock = fixture.api_mocks.find(
    (example) => example.id === "get-purchase-request-detail-success",
  );

  assert.equal(fixture.fixture_set_revision, 2);
  assert.equal(fixture.contract_bundle_ref.bundle_revision, 2);
  assert.equal(
    fixture.delivery_work_ref.work_item_id,
    "WORK:purchase-request-contract-fixtures@R2",
  );
  assert.equal(successfulApiRefs.length, 6);
  assert.equal(new Set(successfulApiRefs).size, 6);
  assert.equal(
    successfulApiRefs.includes("API:purchase_request.get_detail@R1"),
    false,
  );
  assert.equal(
    successfulApiRefs.includes("API:purchase_request.get_detail@R2"),
    true,
  );
  assert.deepEqual(detail.value.record, record.value);
  assert.deepEqual(detail.value.display, {
    eventName: "2026 가을 축제",
    requesterName: "김바다",
  });
  assert.deepEqual(detail.expectations, [
    {
      contract_ref: "DATA:purchase_request.detail_view@R1",
      expected_valid: true,
    },
  ]);
  assert.equal(detailMock.response.body_example_ref, detail.id);
  assert.deepEqual(
    fixture.error_examples.map((example) => example.id),
    previousFixture.error_examples.map((example) => example.id),
  );
  assert.deepEqual(
    fixture.api_mocks.map((example) => example.id),
    previousFixture.api_mocks.map((example) => example.id),
  );
  assert.deepEqual(
    previousFixture.data_examples.map((example) => example.id).filter(
      (id) => !fixture.data_examples.some((example) => example.id === id),
    ),
    [],
  );
});

test("R2 상세 성공 예제에서 행사명이나 요청자명이 빠지면 거부한다", async () => {
  const [fixture, bundle] = await Promise.all([
    readJson(r2FixturePath),
    readJson(r2BundlePath),
  ]);
  const effective = await resolveEffectiveContracts(repositoryRoot, bundle, {
    bundlePath: r2BundlePath,
  });

  for (const field of ["eventName", "requesterName"]) {
    const invalidFixture = structuredClone(fixture);
    const detail = invalidFixture.data_examples.find(
      (example) => example.id === "purchase-request-detail-view",
    );
    delete detail.value.display[field];

    const errors = validateContractFixtureDocument(invalidFixture, bundle, {
      effectiveContracts: effective.contracts,
    }).join("\n");

    assert.match(errors, new RegExp(`${field}|required`));
  }
});

test("계약 묶음 해시가 바뀐 픽스처를 거부한다", async () => {
  const [fixture, bundle] = await Promise.all([readJson(fixturePath), readJson(bundlePath)]);
  fixture.contract_bundle_ref.canonical_sha256 = "0".repeat(64);

  assert.match(validateContractFixtureDocument(fixture, bundle).join("\n"), /묶음 해시/);
});

test("픽스처 리비전이 고정 계약 묶음 리비전과 다르면 거부한다", async () => {
  const [fixture, bundle] = await Promise.all([readJson(fixturePath), readJson(bundlePath)]);
  fixture.fixture_set_revision = 2;

  assert.match(validateContractFixtureDocument(fixture, bundle).join("\n"), /픽스처 리비전/);
});

test("API 성공 상태가 승인 계약과 다르면 거부한다", async () => {
  const [fixture, bundle] = await Promise.all([readJson(fixturePath), readJson(bundlePath)]);
  const submitSuccess = fixture.api_mocks.find(
    (example) => example.id === "submit-purchase-request-success",
  );
  submitSuccess.response.status = 202;

  assert.match(validateContractFixtureDocument(fixture, bundle).join("\n"), /성공 상태/);
});

test("Problem Details의 안정 오류 코드가 계약과 다르면 거부한다", async () => {
  const [fixture, bundle] = await Promise.all([readJson(fixturePath), readJson(bundlePath)]);
  const conflict = fixture.error_examples.find(
    (example) => example.contract_ref === "ERROR:purchase_request.state_conflict@R1",
  );
  conflict.body.code = "WRONG_CODE";

  assert.match(validateContractFixtureDocument(fixture, bundle).join("\n"), /오류 코드/);
});
