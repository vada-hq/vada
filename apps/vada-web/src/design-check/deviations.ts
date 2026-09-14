import type { Difference } from './dom-comparison'

/**
 * 일부러 design과 다르게 하기로 한 자리.
 *
 * 무엇에 거느냐가 셋이다. 고르는 기준은 하나 — **화면이 늘면 이 줄도 느는가.**
 *
 * - `rule`: 우리 규칙이 정하는 색(RULE_ATTRIBUTE로 표시된 자리). 상태 칩이 몇 개든,
 *   화면이 몇이든 한 줄이다. 늘지 않는다.
 * - `color`: design의 그 색이 나오는 모든 자리. 팔레트 밖 색을 이름 있는 색으로
 *   바꾸는 경우다. 그 색이 어디에 또 쓰였든 한 줄이다. 늘지 않는다.
 * - `place`: 이 화면의 이 글. 와이어프레임이 같은 것을 두 군데에 다르게 그린
 *   일회성 사고에만 쓴다. 규칙이 아니므로 저절로 늘지도 않는다.
 *
 * design·screen 값은 대조 검사가 뱉은 줄을 그대로 옮긴 것이다 — 예외를 적는 말과
 * 검사가 말하는 말이 같다.
 */
interface DeviationBody {
  kind: Difference['kind']
  design: string
  screen: string
  why: string
}

export type Deviation =
  | (DeviationBody & { by: 'rule'; rule: string })
  | (DeviationBody & { by: 'color' })
  | (DeviationBody & { by: 'place'; screenId: string; content: string })

/** 어긋남 하나가 어느 화면 것인지까지 기억한 것. 썩음 판정에 쓴다. */
export type SeenDifference = Difference & { screenId: string }

function covers(deviation: Deviation, difference: Difference, screenId: string): boolean {
  if (
    deviation.kind !== difference.kind ||
    deviation.design !== difference.design ||
    deviation.screen !== difference.screen
  ) {
    return false
  }
  switch (deviation.by) {
    case 'rule':
      return difference.rule === deviation.rule
    case 'color':
      return true
    case 'place':
      return deviation.screenId === screenId && deviation.content === difference.content
  }
}

/** 적어 둔 예외를 덜어낸다. 남는 것이 진짜 어긋남이다. */
export function applyDeviations(
  screenId: string,
  differences: Difference[],
  deviations: Deviation[],
): Difference[] {
  return differences.filter(
    (difference) => !deviations.some((deviation) => covers(deviation, difference, screenId)),
  )
}

/**
 * 어느 화면에서도 쓰이지 않은 예외.
 *
 * 예외 목록은 썩는다 — design이 고쳐져 더는 어긋나지 않는데도 예외가 남아 있으면
 * 그 자리는 아무도 보지 않는 사각이 된다. 쓰이지 않은 예외를 실패로 다루면 목록이
 * 저절로 현재를 가리킨다.
 *
 * 화면 하나가 아니라 **전부**를 모아 판정해야 한다. 규칙에 건 예외는 여러 화면에
 * 걸쳐 쓰이므로, 화면마다 따로 물으면 안 쓰인 화면에서 거짓 경보가 난다.
 */
export function unusedDeviations(seen: SeenDifference[], deviations: Deviation[]): Deviation[] {
  return deviations.filter(
    (deviation) => !seen.some((difference) => covers(deviation, difference, difference.screenId)),
  )
}

/** 실패 메시지로 쓸 표. 어느 글이 어떻게 어긋났는지 한 줄씩 보인다. */
export function report(screenId: string, differences: Difference[]): string {
  const lines = differences.map(
    (d) =>
      `  [${d.kind}] "${d.content}"${d.rule ? ` (규칙 ${d.rule})` : ''}` +
      ` — design ${d.design} / 화면 ${d.screen}`,
  )
  return `${screenId}이(가) design과 ${differences.length}곳 어긋납니다.\n${lines.join('\n')}`
}

function deviationLabel(deviation: Deviation): string {
  switch (deviation.by) {
    case 'rule':
      return `규칙 '${deviation.rule}'`
    case 'color':
      return `design ${deviation.design}인 자리`
    case 'place':
      return `${deviation.screenId}의 "${deviation.content}"`
  }
}

/** 더는 일어나지 않는 예외. 목록에서 지우라는 뜻이다. */
export function staleReport(unused: Deviation[]): string {
  const lines = unused.map(
    (deviation) =>
      `  [${deviation.kind}] ${deviationLabel(deviation)} — 이제 design과 어긋나지 않습니다`,
  )
  return (
    `design/deviations.ts에 쓰이지 않는 예외가 ${unused.length}개 있습니다. 지우세요.\n` +
    lines.join('\n')
  )
}
