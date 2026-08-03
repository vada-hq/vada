import assert from "node:assert/strict";
import test from "node:test";

import { evaluatePreflight } from "./check-execution-preflight.mjs";

function successfulCommands(calls) {
  return ({ command, args }) => {
    calls.push([command, ...args]);
    return { ok: true, detail: `${command} 사용 가능` };
  };
}

test("기본 프로필은 저장소 실행 도구를 모두 확인한다", () => {
  const calls = [];
  const result = evaluatePreflight("base", {
    env: {},
    runCommand: successfulCommands(calls),
  });

  assert.equal(result.ok, true);
  assert.deepEqual(
    calls.map(([command]) => command),
    ["git", "node", "pnpm", "uv"],
  );
});

test("PostgreSQL URL이 있으면 비밀값을 노출하지 않고 통합 검증 준비를 통과한다", () => {
  const calls = [];
  const secret = "postgresql://user:secret@example.invalid/vada";
  const result = evaluatePreflight("postgresql", {
    env: { VADA_TEST_DATABASE_URL: secret },
    runCommand: successfulCommands(calls),
  });

  assert.equal(result.ok, true);
  assert.equal(calls.some(([command]) => command === "docker"), false);
  assert.doesNotMatch(JSON.stringify(result), /user:secret/);
});

test("PostgreSQL URL 문자열만 있고 실제 연결이 안 되면 검사를 실패시킨다", () => {
  const result = evaluatePreflight("postgresql", {
    env: { VADA_TEST_DATABASE_URL: "postgresql://unreachable.invalid/vada" },
    runCommand: ({ command, args }) =>
      command === "uv" && args.includes("python")
        ? { ok: false, detail: "연결 실패" }
        : { ok: true, detail: `${command} 사용 가능` },
  });

  assert.equal(result.ok, false);
  assert.equal(result.checks.at(-1).id, "postgresql-runtime");
});

test("PostgreSQL URL이 없으면 실행 가능한 Docker daemon을 대체 수단으로 확인한다", () => {
  const calls = [];
  const result = evaluatePreflight("postgresql", {
    env: {},
    runCommand: successfulCommands(calls),
  });

  assert.equal(result.ok, true);
  assert.deepEqual(calls.at(-1), ["docker", "info"]);
});

test("PostgreSQL URL과 Docker가 모두 없으면 착수 전 검사를 실패시킨다", () => {
  const result = evaluatePreflight("postgresql", {
    env: {},
    runCommand: ({ command }) =>
      command === "docker"
        ? { ok: false, detail: "Docker daemon을 사용할 수 없습니다." }
        : { ok: true, detail: `${command} 사용 가능` },
  });

  assert.equal(result.ok, false);
  assert.equal(result.checks.at(-1).id, "postgresql-runtime");
  assert.equal(result.checks.at(-1).status, "failed");
});

test("정의되지 않은 프로필을 추정해서 실행하지 않는다", () => {
  assert.throws(
    () => evaluatePreflight("unknown", { env: {}, runCommand: successfulCommands([]) }),
    /지원하지 않는 preflight 프로필/,
  );
});
