/**
 * PR이 **진행 상태의 주인을 밝혔는가.**
 *
 * 이 저장소는 진행 상태를 파일이 아니라 GitHub Issue와 PR이 소유한다고 정했다.
 * 그런데 그 규칙을 글로만 적었더니 규칙을 만든 PR 다음부터 다섯 건이 연속으로
 * 어겼다. 이 저장소가 규칙을 글로만 적어 실패한 세 번째 경우다.
 *
 * 모든 PR에 이슈가 있어야 한다는 뜻이 아니다. 스스로 시작한 정리 작업에는 닫을
 * 이슈가 없을 수 있다. 요구하는 것은 **둘 중 하나를 명시**하는 것이다 —
 * 어느 이슈를 닫는지, 아니면 왜 닫을 이슈가 없는지.
 */

const CLOSES = /(?:^|\s)(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+#\d+/i;
const NO_ISSUE = /^\s*이슈 없음:\s*\S+/m;

export function pullRequestOwnership(body) {
  // 주석은 쓰는 사람에게 주는 안내이지 답이 아니다. 걷어내지 않으면 템플릿을
  // 그대로 둔 PR이 통과한다 — 템플릿 안에 보기가 적혀 있기 때문이다.
  // 처음 만들었을 때 실제로 그렇게 통과했다.
  const text = (typeof body === "string" ? body : "").replace(
    /<!--[\s\S]*?-->/g,
    "",
  );

  if (CLOSES.test(text)) return { ok: true, reason: "closes" };
  if (NO_ISSUE.test(text)) return { ok: true, reason: "declared" };

  return {
    ok: false,
    reason: "missing",
    message: [
      "PR 본문에 진행 상태의 주인이 없습니다. 둘 중 하나를 적으십시오.",
      "",
      "  Closes #<번호>        이 작업이 닫는 이슈",
      "  이슈 없음: <이유>     닫을 이슈가 없는 이유 (한 줄)",
      "",
      "진행 상태는 파일이 아니라 이슈와 PR이 소유합니다. 손으로 닫으면 잊습니다 —",
      "실제로 이 규칙을 만든 PR 다음부터 다섯 건이 연속으로 어겼습니다.",
    ].join("\n"),
  };
}

const isMain =
  process.argv[1] && process.argv[1].endsWith("check-pull-request-ownership.mjs");
if (isMain) {
  let body = "";
  for await (const chunk of process.stdin) body += chunk;

  const result = pullRequestOwnership(body);
  if (result.ok) {
    console.log(`진행 상태의 주인 확인: ${result.reason}`);
  } else {
    console.error(result.message);
    process.exitCode = 1;
  }
}
