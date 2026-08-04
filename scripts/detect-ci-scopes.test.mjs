import assert from "node:assert/strict";
import test from "node:test";

import { detectCiScopes } from "./detect-ci-scopes.mjs";

test("실행 기록만 바뀌면 제품과 인프라 검사를 생략한다", () => {
  assert.deepEqual(detectCiScopes(["delivery-units/DU-001/execution-runtime/R2.json"]), {
    api: false,
    web: false,
    infra: false,
  });
});

test("API 변경은 API 검사만 활성화한다", () => {
  assert.deepEqual(detectCiScopes(["apps/api/src/vada_api/main.py"]), {
    api: true,
    web: false,
    infra: false,
  });
});

test("계약 변경은 생성 클라이언트 검증을 위해 웹 검사를 활성화한다", () => {
  assert.deepEqual(detectCiScopes(["contracts/api/example.json"]), {
    api: false,
    web: true,
    infra: false,
  });
});

test("Terraform 변경은 인프라 검사만 활성화한다", () => {
  assert.deepEqual(
    detectCiScopes(["infra/modules/purchase_request_observability/main.tf"]),
    { api: false, web: false, infra: true },
  );
});

test("CI와 통합 명령 변경은 모든 제품 검사를 활성화한다", () => {
  assert.deepEqual(detectCiScopes([".github/workflows/ci.yml", "justfile"]), {
    api: true,
    web: true,
    infra: true,
  });
});
