import assert from "node:assert/strict";
import test from "node:test";

import { ranNothing, selfMeasuredSec } from "../scripts/test-output.mjs";

// 게이트가 **검사 실패**와 **검사를 못 돌림**을 가르는 자리다.
//
// 이 판정이 틀리면 둘 중 하나가 난다. 느슨하면 진짜 실패를 흔들림으로 읽어
// 다시 돌리고 넘어가고, 빡빡하면 기계 사정으로 초록 코드가 떨어진다.
// 뒤의 것을 2026-08-31에 실제로 겪었다.

test("워커가 시작하다 죽으면 아무것도 못 돈 것이다", () => {
  // 2026-08-31에 실제로 난 것. **요약 줄이 아예 없다** — 한동안 찾던
  // `Tests  no tests`도 없어서 그대로 '검사 실패'로 지나갔다.
  const output = `
> vada-web@0.0.0 test
> vitest run --exclude '**/*.server.test.tsx'

 RUN  v4.1.10 C:/Users/82108/figma-spec-v2/apps/vada-web

node:events:502
      throw er; // Unhandled 'error' event
      ^

Error: Worker exited unexpectedly
    at ChildProcess.emitUnexpectedExit (file:///.../cli-api.js:3023:33)

Node.js v22.13.1
`;
  assert.equal(ranNothing(output), true);
});

test("파일마다 0개로 죽은 것도 아무것도 못 돈 것이다", () => {
  // 2026-08-23·24에 난 모양. 이쪽은 요약을 찍고 죽는다.
  const output = `
 RUN  v4.1.10

 ❯ |dom| src/components/AppHeader.test.tsx (0 test)
 ❯ |node| src/spec/flows.test.ts (0 test)

 Test Files  14 failed (14)
      Tests  no tests
`;
  assert.equal(ranNothing(output), true);
});

// **여기가 이 판정의 값이다.** 느슨해지면 진짜 실패가 흔들림으로 읽힌다.
test("검사가 돌다가 틀린 것은 흔들림이 아니다", () => {
  const output = `
 Test Files  1 failed | 23 passed (24)
      Tests  1 failed | 740 passed (741)
   Duration  73.79s
`;
  assert.equal(ranNothing(output), false);
});

test("node --test가 돈 것도 돈 것이다", () => {
  const output = `
1..191
# tests 191
# pass 190
# fail 1
# duration_ms 23016.863
`;
  assert.equal(ranNothing(output), false);
});

test("전부 통과한 것도 흔들림이 아니다", () => {
  const output = `
 Test Files  24 passed (24)
      Tests  738 passed (738)
   Duration  73.79s
`;
  assert.equal(ranNothing(output), false);
});

test("스스로 잰 값을 두 모양에서 읽는다", () => {
  assert.equal(selfMeasuredSec("   Duration  73.79s (transform 16s)"), 73.79);
  assert.equal(selfMeasuredSec("# duration_ms 23016.863"), 23.016863);
});

// 못 읽은 것을 0으로 세면 저울이 조용히 헐거워진다.
test("읽지 못하면 0이 아니라 null이다", () => {
  assert.equal(selfMeasuredSec("아무 말도 없다"), null);
});
