import assert from "node:assert/strict";
import test from "node:test";

import { pullRequestOwnership } from "./check-pull-request-ownership.mjs";

test("닫는 이슈를 적었으면 통과한다", () => {
  assert.equal(pullRequestOwnership("본문\n\nCloses #78\n").ok, true);
  assert.equal(pullRequestOwnership("Fixes #12").ok, true);
  assert.equal(pullRequestOwnership("resolves #3 입니다").ok, true);
});

// 스스로 시작한 정리 작업에는 닫을 이슈가 없을 수 있다. 그때는 없다고 적는다.
test("닫을 이슈가 없는 이유를 적었으면 통과한다", () => {
  assert.equal(
    pullRequestOwnership("본문\n\n이슈 없음: 오타 하나\n").ok,
    true,
  );
});

test("이유 없이 이슈 없음만 적으면 통과하지 않는다", () => {
  assert.equal(pullRequestOwnership("이슈 없음:").ok, false);
});

// 실제로 이런 본문 다섯 건이 연속으로 머지됐다.
test("둘 다 없으면 거절하고 무엇을 적어야 하는지 말한다", () => {
  const result = pullRequestOwnership("좋은 설명이 잔뜩 있지만 주인이 없다.");

  assert.equal(result.ok, false);
  assert.match(result.message, /Closes #<번호>/);
  assert.match(result.message, /이슈 없음: <이유>/);
});

test("본문이 없어도 죽지 않는다", () => {
  assert.equal(pullRequestOwnership(undefined).ok, false);
  assert.equal(pullRequestOwnership("").ok, false);
});

// `#`이 없는 말은 이슈 참조가 아니다.
test("이슈 번호 없는 close는 세지 않는다", () => {
  assert.equal(pullRequestOwnership("이 창을 close 하세요").ok, false);
});

// 템플릿 안에 보기가 적혀 있다. 주석을 내용으로 읽으면 템플릿을 그대로 둔 PR이
// 통과한다. 처음 만들었을 때 실제로 그렇게 통과했다.
test("주석 안의 보기는 답으로 세지 않는다", () => {
  const untouched = "<!--\n  Closes #<번호>\n  이슈 없음: <이유>\n-->\n\nCloses #\n";

  assert.equal(pullRequestOwnership(untouched).ok, false);
});
