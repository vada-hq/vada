import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  validateScreenSpec,
  validateScreenSpecRepository,
} from "./validate-screen-specs.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const artifactPath = resolve(
  repositoryRoot,
  "delivery-units/DU-001/screen-spec/draft.json",
);

async function actualSpec() {
  return JSON.parse(await readFile(artifactPath, "utf8"));
}

test("저장소의 실제 화면 명세가 유효하다", async () => {
  const result = await validateScreenSpecRepository(repositoryRoot);
  assert.deepEqual(result.errors, []);
  assert.equal(result.files.length, 1);
});

test("고정한 전달 작업 그래프의 해시가 바뀌면 거부한다", async () => {
  const spec = await actualSpec();
  spec.baseline.delivery_work_ref.canonical_sha256 = "0".repeat(64);

  const errors = await validateScreenSpec(spec, { artifactPath });

  assert.ok(errors.some((error) => error.includes("전달 작업 그래프 해시")));
});

test("완료 증거가 요구한 설계 커버리지가 빠지면 거부한다", async () => {
  const spec = await actualSpec();
  spec.coverage.design_refs = spec.coverage.design_refs.slice(1);

  const errors = await validateScreenSpec(spec, { artifactPath });

  assert.ok(errors.some((error) => error.includes("설계 커버리지")));
});

test("상태 ID 중복을 거부한다", async () => {
  const spec = await actualSpec();
  spec.state_matrix.push(structuredClone(spec.state_matrix[0]));

  const errors = await validateScreenSpec(spec, { artifactPath });

  assert.ok(errors.some((error) => error.includes("상태 ID가 중복")));
});

test("인증이 필요한 DU-001 화면에서 401 상태가 빠지면 거부한다", async () => {
  const spec = await actualSpec();
  spec.state_matrix = spec.state_matrix.filter(
    (state) => state.id !== "STATE-DETAIL-UNAUTHENTICATED",
  );

  const errors = await validateScreenSpec(spec, { artifactPath });

  assert.ok(errors.some((error) => error.includes("STATE-DETAIL-UNAUTHENTICATED")));
});

test("승격을 막는 계약 공백에는 대응하는 열린 질문이 필요하다", async () => {
  const spec = await actualSpec();
  spec.review.open_questions = [];

  const errors = await validateScreenSpec(spec, { artifactPath });

  assert.ok(errors.some((error) => error.includes("열린 질문")));
});
