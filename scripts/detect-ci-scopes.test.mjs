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

// 생성 클라이언트 검증기를 나눠 둔 자리다. 이름이 바뀌었다고 검사에서 빠지면
// 계약 → OpenAPI 변환을 고쳐도 아무도 안 본다.
test("계약 OpenAPI 도구 변경은 웹 검사를 활성화한다", () => {
  assert.deepEqual(detectCiScopes(["scripts/contract-openapi/render.mjs"]), {
    api: false,
    web: true,
    infra: false,
  });
  assert.deepEqual(detectCiScopes(["scripts/validate-vada-openapi.mjs"]), {
    api: false,
    web: true,
    infra: false,
  });
});

// 배포 워크플로는 API를 꾸리고 Terraform을 돌린다. 그런데 그 파일만 고치면
// 두 검사가 전부 건너뛰어졌다 — 머지 전에 아무도 안 보고, 틀린 것은 배포가
// 실패해야 드러났다.
test("배포 워크플로 변경은 모든 제품 검사를 활성화한다", () => {
  assert.deepEqual(detectCiScopes([".github/workflows/deploy.yml"]), {
    api: true,
    web: true,
    infra: true,
  });
});
