import { readFileSync } from 'node:fs'
import type { Plugin } from 'vite'

// **실서비스로 나가는 번들에 개발용 응답을 넣지 않는다.**
//
// `fixtures.ts` 4,600줄은 그림이 그린 예시 값을 그대로 옮긴 것이고, 그 쓸모는 하나다:
// 화면을 `reference.png`와 견주려면 그림이 그린 그 값이 화면에도 있어야 한다.
// **검사 도구다.**
//
// 그런데 그것이 실서비스 번들에도 실려 나갔다. 아직 서버에 안 붙은 자리를 읽으면
// 개발용 응답으로 돌아가게 되어 있었기 때문이다 — 개발할 때는 맞았지만 배포된
// 앱에서는 거짓말이다. 2026-09-05에 값을 치렀다: 방금 만든 빈 학생회의 홈에 남의
// 행사와 남의 예산이 그려졌고, 값을 읽는 화면 일흔넷 중 **마흔**이 그 상태였다.
//
// 읽는 자리는 이미 고쳤다(`fromServer`가 `NotBuiltYet`을 던진다). 그래서 실서비스
// 에서는 이 값들이 **읽힐 일이 없다.** 그래도 번들에서 뺀다 — 읽히지 않는 것과
// 실려 있지 않은 것은 다르다. 실려 있으면 언젠가 누군가 다시 읽게 만든다.
//
// **e2e와 검사는 그대로 개발용 응답으로 돈다.** 그림 대조가 거기서 살아야 한다.

/** 이 파일들이 개발용 응답이다. 이름이 아니라 자리로 짚는다. */
const FIXTURES = /\/src\/(data-sources|option-sources)\/fixtures\.ts$/

/**
 * 같은 이름을 같은 갈래로 내보내되 **값은 비운다.**
 *
 * 이름을 손으로 적지 않고 진짜 파일에서 읽는다 — 적어 두면 하나 늘 때마다
 * 이 목록이 틀리고, 틀린 쪽은 조용하다.
 */
function hollow(source: string): string {
  const names: string[] = []
  for (const found of source.matchAll(/^export const (\w+)/gm)) {
    const name = found[1]!
    // 선언이 `= [`로 시작하는지 `= {`로 시작하는지. 갈래가 다르면 부르는 쪽이 터진다.
    const after = source.slice(found.index!, found.index! + 400)
    const opens = /=\s*(\[|\{)/.exec(after)
    names.push(`export const ${name} = ${opens?.[1] === '[' ? '[]' : '{}'}`)
  }
  if (names.length === 0) throw new Error('개발용 응답에서 내보내는 이름을 하나도 못 찾았습니다.')
  return `${names.join('\n')}\n`
}

/**
 * 실서비스 빌드에서만 켠다.
 *
 * - `npm run build` → 켠다(실서비스가 나가는 `dist/`)
 * - `VITE_FIXTURES=1`로 빌드 → 끈다(e2e가 쓰는 `dist-e2e/`)
 * - `npm run dev`·vitest → 끈다(그림 대조와 화면 검사가 값을 쓴다)
 */
export function fixturesOut(shipping: boolean): Plugin {
  return {
    name: 'vada-fixtures-out',
    enforce: 'pre',
    load(id) {
      if (!shipping) return null
      const path = id.split('?')[0]!.replace(/\\/g, '/')
      if (!FIXTURES.test(path)) return null
      return hollow(readFileSync(path, 'utf8'))
    },
  }
}
