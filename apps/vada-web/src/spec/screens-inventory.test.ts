import { describe, expect, it } from 'vitest'
import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import notScreensJson from '../../../../specs/figma/vada-wireframe/not-screens.json'
import {
  ALL_SCREENS,
  ALL_SPEC_SCREENS,
  STATE_ONLY_SCREENS,
  VARIANT_SCREENS,
  screenOf,
} from './screens'

// **명세에 있는 화면은 빠짐없이 셈에 든다.**
//
// 오랫동안 화면 목록이 손으로 적은 여든 줄짜리 배열이었다. 명세는 여든넷인데
// **넷이 그 배열에 없었고, 그래서 준수 검사도 디자인 대조도 그 넷을 돌지 않았다** —
// 화면이 안 그려진 것이 아니라 아무도 재지 않은 것이라 어디서도 붉어지지 않았다.
// 오늘 사람이 눈으로 찾았다(EVT-03C · EVT-04C · OPS-MEET-01B · OPS-MEET-01D).
//
// 이제 명세 폴더가 목록이므로 빠뜨릴 자리가 없다. 여기서는 그 사실을 잰다.

const specDir = fileURLToPath(
  new URL('../../../../specs/figma/vada-wireframe/screens/', import.meta.url),
)

/** 명세 폴더에 screen.json을 가진 화면. 이것이 참값이다. */
function foldersWithSpec(): string[] {
  return readdirSync(specDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .filter((entry) => readdirSync(specDir + entry.name).includes('screen.json'))
    .map((entry) => entry.name)
    .sort()
}

const notScreens = (notScreensJson as { frames: Array<{ screenId: string; why: string }> }).frames

describe('명세에 있는 화면은 빠짐없이 센다', () => {
  it('폴더에 있는 것이 전부 목록에 있다', () => {
    expect(ALL_SPEC_SCREENS.map((screen) => screen.screenId)).toEqual(foldersWithSpec())
  })

  // 제 주소를 갖는 것과 원본이 그리는 때를 합치면 전수다. 어느 쪽에도 안 드는 화면이
  // 있으면 그것이 아무 검사에도 안 걸리던 그 자리다.
  it('전부 둘 중 하나로 갈린다', () => {
    expect(ALL_SCREENS.length + STATE_ONLY_SCREENS.length).toBe(ALL_SPEC_SCREENS.length)
    expect(ALL_SCREENS.some((screen) => screen.elements.length === 0)).toBe(false)
  })

  // **요소가 없는데 변형도 아니면 아무것도 그리지 않는 화면이다.** 명세가 그 화면을
  // 만들라고 말하는데 만들 것이 없다 — 어느 쪽이 틀렸는지 사람이 봐야 한다.
  it('그릴 것이 없는 화면은 반드시 다른 화면의 한 때다', () => {
    const orphans = STATE_ONLY_SCREENS.filter((screen) => screen.variantOf === undefined)
    expect(orphans.map((screen) => screen.screenId)).toEqual([])
  })

  // 변형이 가리키는 원본이 없으면 그 그림은 어디에도 안 그려진다.
  it('변형이 가리키는 원본이 실재하고 그릴 것을 갖는다', () => {
    for (const variant of VARIANT_SCREENS) {
      const base = screenOf(variant.variantOf!.screenId)
      // 원본이 아무것도 안 그리면 변형의 그 모습도 나올 자리가 없다.
      expect(base.elements.length).toBeGreaterThan(0)
      // 언제 그 모습이 되는지 안 적으면 원본이 그것을 그릴 조건을 알 수 없다.
      expect(variant.variantOf!.when.trim().length).toBeGreaterThan(0)
    }
  })

  // **변형이라고 제 주소가 없는 것은 아니다.** 열둘 중 여덟은 원본과 다른 것을 그리므로
  // 제 화면이 있다 — `variantOf`로 가르면 그 여덟이 검사에서 빠진다.
  it('요소를 갖는 변형은 제 주소를 갖는다', () => {
    const drawnVariants = VARIANT_SCREENS.filter((screen) => screen.elements.length > 0)
    expect(drawnVariants.length).toBeGreaterThan(0)
    for (const variant of drawnVariants) {
      expect(ALL_SCREENS).toContain(variant)
    }
  })

  // 안 만들기로 적은 그림은 명세를 갖지 않는다. 둘 다 있으면 어느 쪽이 참인지 모른다.
  it('안 만들기로 적은 것은 명세가 없다', () => {
    const both = notScreens.filter((frame) => foldersWithSpec().includes(frame.screenId))
    expect(both.map((frame) => frame.screenId)).toEqual([])
  })

  it('없는 화면을 물으면 던진다', () => {
    expect(() => screenOf('있을 리 없는 화면')).toThrow()
  })

  // 이 수를 소리 내어 적는다. 넷이 빠져 있던 것이 안 보였던 까닭은 세는 자리가 없어서다.
  it('세어 둔다 — 명세 화면이 몇이고 어떻게 갈리는가', () => {
    // eslint-disable-next-line no-console
    console.log(
      `\n  명세 화면 ${ALL_SPEC_SCREENS.length}개 = 제 주소를 갖는 것 ${ALL_SCREENS.length}개 ` +
        `+ 원본이 그리는 때 ${STATE_ONLY_SCREENS.length}개\n` +
        `  그중 다른 화면의 한 때로 적힌 것 ${VARIANT_SCREENS.length}개 — 여덟은 제 것을 그리고 넷은 그리지 않는다\n` +
        `  안 만들기로 적은 그림 ${notScreens.length}개 (명세 없음)\n` +
        `  → Figma 프레임 ${ALL_SPEC_SCREENS.length + notScreens.length}개와 맞는다\n`,
    )
    expect(ALL_SPEC_SCREENS.length).toBeGreaterThan(0)
  })
})
