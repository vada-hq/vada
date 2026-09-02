import { describe, expect, it } from 'vitest'
import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { ALL_SCREENS } from '../spec/screens'
import { OUTSIDE_SPEC, isOutsideSpec, navigationsOf } from './outside-spec'

// **명세 밖의 화면이 조용히 존재하지 못하게 한다.**
//
// 명세 있는 화면은 이동을 전수로 잰다(`navigation-arrival.test.ts`). 명세 없는 화면은
// 그 그물 밖이라 사람의 기억이 유일한 검사가 되고, 실제로 틀렸다 — 로그인 뒤 제자리로
// 돌아오는데 로그인은 됐으므로 아무 오류도 안 났다.
//
// 그래서 여기서 셋을 잰다.
// 1. 명세 없이 그린 화면은 **빠짐없이** 목록에 있다.
// 2. 목록에 오른 화면은 정말로 명세가 없다 — 생기면 옮기라고 붉어진다.
// 3. 가는 곳은 실재하는 화면이다 — 명세 있는 화면이 검증기에서 받는 것과 같은 검사다.

const specIds = new Set(ALL_SCREENS.map((screen) => screen.screenId))
const plain = (name: string) => name.replace(/-/g, '').toUpperCase()
const specPlain = new Set([...specIds].map(plain))

/** 손으로 그린 화면 파일. 이름에서 화면 id를 되찾는다. */
function drawnScreens(): string[] {
  const here = fileURLToPath(new URL('.', import.meta.url))
  return readdirSync(here)
    .filter((name) => name.endsWith('Screen.tsx'))
    .map((name) => name.slice(0, -'Screen.tsx'.length).toUpperCase())
}

describe('명세 밖의 화면', () => {
  // **이것이 이 파일의 요점이다.** 새로 손으로 그린 화면이 목록에 안 오르면 여기서 멈춘다.
  it('명세 없이 그린 화면은 전부 목록에 있다', () => {
    const unlisted = drawnScreens().filter(
      (name) => !specPlain.has(name) && !OUTSIDE_SPEC.some((one) => plain(one.screenId) === name),
    )
    expect(unlisted).toEqual([])
  })

  // 목록에 있는데 명세가 생겼으면 옮길 때다. 둘 다 있으면 어느 쪽이 참인지 알 수 없다.
  it('목록에 오른 화면은 명세가 없다', () => {
    expect(OUTSIDE_SPEC.filter((one) => specIds.has(one.screenId)).map((one) => one.screenId)).toEqual([])
  })

  // 명세 있는 화면은 검증기가 이것을 본다. 밖에 있다고 안 볼 이유가 없다.
  it('가는 곳은 실재하는 화면이다', () => {
    const missing = OUTSIDE_SPEC.flatMap((one) =>
      one.navigations
        .filter((go) => !specIds.has(go.to) && !isOutsideSpec(go.to))
        .map((go) => `${one.screenId} → ${go.to}`),
    )
    expect(missing).toEqual([])
  })

  // 왜 명세가 없는지 안 적으면 '그냥 안 적었다'와 구분되지 않는다.
  it('왜 명세가 없는지 적혀 있다', () => {
    for (const one of OUTSIDE_SPEC) expect(one.why.trim().length).toBeGreaterThan(10)
  })

  it('목록에 없는 화면을 물으면 던진다', () => {
    expect(() => navigationsOf('ONB-01')).toThrow()
  })

  // 이 수를 소리 내어 적는다. 늘면 그것이 눈에 보여야 한다.
  it('세어 둔다 — 몇이 그물 밖인가', () => {
    // eslint-disable-next-line no-console
    console.log(
      `\n  화면 ${specIds.size + OUTSIDE_SPEC.length}개 중 명세 밖 ${OUTSIDE_SPEC.length}개` +
        `${OUTSIDE_SPEC.map((one) => ` (${one.screenId})`).join('')}\n` +
        `  → 그림이 생기면 명세로 옮겨 가고 이 수가 준다\n`,
    )
    expect(OUTSIDE_SPEC.length).toBeLessThanOrEqual(specIds.size)
  })
})
