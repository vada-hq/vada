import assert from "node:assert/strict";
import test from "node:test";

import { onlyNetworkBroke } from "../scripts/test-output.mjs";

// **그물이 끊긴 것과 검사가 틀린 것을 가르는 자리다.**
//
// 느슨하면 진짜 실패를 흔들림으로 읽어 한 번 더 돌리고 넘어가고, 빡빡하면 기계
// 사정으로 초록 코드가 막힌다. 뒤의 것을 2026-08-31에 실제로 겪었다 — 427개가
// 통과했는데 페이지를 못 연 하나 때문에 푸시가 막혔다.

test("페이지를 못 연 것은 검사의 판정이 아니다", () => {
  const output = `
  1) e2e\\attendance.spec.ts:99:1 › EXT-01A: 체크인 시간이 아니어도 같은 자리에서 막힌다

    Error: page.goto: net::ERR_NETWORK_CHANGED at http://localhost:4173/#/EXT-01A

  1 failed
  427 passed (5.1m)
`;
  assert.equal(onlyNetworkBroke(output), true);
});

// **여기가 이 판정의 값이다.** 느슨해지면 진짜 실패가 흔들림으로 읽힌다.
test("단언이 틀린 것은 흔들림이 아니다", () => {
  const output = `
  1) e2e\\messages.spec.ts:121:1 › MSG-02: 분류를 고르지 않으면 막고 그 자리를 짚는다

    Error: expect(locator).toBeVisible() failed

  1 failed
  427 passed (5.1m)
`;
  assert.equal(onlyNetworkBroke(output), false);
});

// 섞여 있으면 실패다. 하나라도 다른 까닭이면 다시 돌려도 소용없다.
test("그물과 단언이 섞이면 실패다", () => {
  const output = `
  1) e2e\\a.spec.ts:1:1 › 하나

    Error: page.goto: net::ERR_NETWORK_CHANGED at http://localhost:4173/

  2) e2e\\b.spec.ts:1:1 › 둘

    Error: expect(locator).toBeVisible() failed

  2 failed
`;
  assert.equal(onlyNetworkBroke(output), false);
});

test("전부 통과한 것은 흔들림이 아니다", () => {
  assert.equal(onlyNetworkBroke("\n  428 passed (4.6m)\n"), false);
});
