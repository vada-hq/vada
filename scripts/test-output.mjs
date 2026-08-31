// 검사가 뱉은 글을 읽는 규칙.
//
// `run-tests.mjs`에서 따로 냈다. 그 파일은 부르면 곧바로 검사를 돌리므로 안에 든
// 판정을 검사할 수 없었고, **검사할 수 없는 판정이 게이트의 판정이었다.**
// 2026-08-31에 그 대가를 두 번 치렀다 — 워커가 죽어 아무것도 못 돈 것을 '검사
// 실패'로 읽었고, 색깔이 섞인 출력에서 저울을 못 읽어 초록 코드의 푸시를 막았다.

/** 이스케이프 문자(ESC). 정규식 리터럴에 직접 쓰면 읽기 어려워 이름을 준다. */
const ESC = String.fromCharCode(27)
const COLOUR = new RegExp(`${ESC}\\[[0-9;]*[A-Za-z]`, 'g')

/**
 * 색깔 코드를 걷어낸다.
 *
 * **터미널에 붙어 돌면 vitest가 색을 섞는다.** `Duration  39.87s`가 실제로는
 * `Duration<ESC>[2m  39.87s<ESC>[22m`이고, 그 사이에 낀 이스케이프 때문에 저울이
 * 값을 못 읽었다 — 검사 744개가 전부 통과했는데 푸시가 막혔다(2026-08-31).
 *
 * 파일로 받아 돌리면 색이 없다. 그래서 **내가 돌릴 때는 안 드러나고 사람이 처음
 * 푸시할 때 드러났다** — 재는 자리가 재는 방법에 따라 달라지고 있었다.
 */
function plain(output) {
  return output.replace(COLOUR, '')
}

/**
 * 이 출력은 **검사가 하나도 돌지 못했다**는 뜻인가.
 *
 * 검사가 틀린 것과 검사를 돌리지 못한 것은 다른 일이다. 앞의 것은 코드가 정하고
 * 뒤의 것은 기계가 정한다 — 기계 때문에 초록 코드를 떨어뜨리는 게이트는 늑대가
 * 왔다고 거짓으로 외치는 것이다.
 *
 * **한 가지 글을 찾지 않는다.** 오래 `Tests  no tests`만 찾았는데, 그것은 vitest가
 * *요약까지 찍고* 죽은 모양이다. 워커가 시작하다 죽으면 요약이 아예 없다 —
 * 그래서 그 자리가 그대로 지나갔다(2026-08-31).
 *
 * 그러니 **돌았다는 증거가 있는가**를 본다. 증거는 요약 줄이다: vitest의
 * `Tests  N passed`나 node --test의 `# pass N`. 둘 다 없으면 아무것도 안 돈 것이다.
 *
 * 진짜로 못 도는 상태(설정이 깨졌다든가)는 이 판정으로 걸러지지 않는다 —
 * 다시 돌려도 똑같이 죽으므로 게이트는 그때 실패한다.
 */
export function ranNothing(output) {
  const text = plain(output)
  if (/^\s*Tests\s+no tests/m.test(text)) return true
  const vitest = /^\s*Tests\s+\d+/m.test(text)
  const nodeTest = /^# pass \d+/m.test(text)
  return !vitest && !nodeTest
}

/**
 * 그 앱의 검사가 **스스로 잰** 값(초).
 *
 * vitest는 `Duration  56.61s`, node --test는 `# duration_ms 30393`으로 적는다.
 * 못 읽으면 null이다 — 못 읽은 것을 0으로 세면 저울이 조용히 헐거워진다.
 */
export function selfMeasuredSec(output) {
  const text = plain(output)
  const vitest = text.match(/Duration\s+([\d.]+)s/)
  if (vitest !== null) return Number(vitest[1])
  const node = text.match(/# duration_ms\s+([\d.]+)/)
  if (node !== null) return Number(node[1]) / 1000
  return null
}
