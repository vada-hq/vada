import assert from "node:assert/strict";
import test from "node:test";

import { apiPrefixes } from "./check-api-prefix.mjs";

// 로컬에서만 맞으면 아무도 모른다. vite 프록시가 벗겨 주니까 개발 중에는
// 멀쩡하고, 배포된 화면에서만 모든 요청이 404가 된다.
test("웹·vite 프록시·CloudFront가 같은 API 접두사를 말한다", () => {
  const prefixes = apiPrefixes();

  assert.equal(
    prefixes.viteProxy,
    prefixes.web,
    "vite 프록시가 웹이 부르는 접두사와 다릅니다",
  );
  assert.equal(
    prefixes.cloudFront,
    prefixes.web,
    "CloudFront가 벗기는 접두사가 웹이 부르는 접두사와 다릅니다",
  );
});
