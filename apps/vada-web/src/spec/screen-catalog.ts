import type { ScreenSpec } from './types'
import { asScreenSpec } from './screen-guard'

/**
 * 명세 폴더에 있는 화면 전부. **빌드가 폴더를 걸어 모은다.**
 *
 * 손으로 적으면 빠뜨리고, 빠뜨린 것은 조용하다 — 화면이 안 그려지는 것이 아니라
 * 검사가 그 화면을 안 도는 것이라 아무 데서도 붉어지지 않는다.
 */
const SCREEN_JSON = import.meta.glob<{ default: unknown }>(
  '../../../../specs/figma/vada-wireframe/screens/*/screen.json',
  { eager: true },
)

const BY_ID = new Map<string, ScreenSpec>(
  Object.entries(SCREEN_JSON).map(([path, module]) => {
    // 폴더 이름과 screenId가 갈리면 어느 쪽이 참인지 알 수 없다. 검증기도 보지만
    // 여기서 먼저 멈춘다 — 이 지도가 틀리면 아래 전부가 틀린다.
    const folder = path.split('/').at(-2)
    const spec = asScreenSpec(module.default, folder)
    return [spec.screenId, spec]
  }),
)

/** 그 화면의 명세. **없으면 던진다** — 없는 화면을 조용히 지나가면 빈 것이 그려진다. */
export function screenOf(screenId: string): ScreenSpec {
  const spec = BY_ID.get(screenId)
  if (spec === undefined) {
    throw new Error(`화면 '${screenId}'의 명세가 없습니다.`)
  }
  return spec
}

/**
 * **화면 목록을 손으로 적지 않는다.**
 *
 * 오랫동안 여든 줄짜리 배열이었다. 주석은 "따로 선언하지 않고 이미 등록된 것을 모은다"고
 * 적혀 있었지만 바로 아래가 손으로 적은 배열이었고, **명세 여든넷 중 넷이 그 배열에서 빠진
 * 채 아무 검사에도 안 걸렸다**(EVT-03C · EVT-04C · OPS-MEET-01B · OPS-MEET-01D).
 * 준수 검사도 디자인 대조도 이 배열만 돌기 때문이다.
 *
 * ## 무엇이 제 주소를 갖는가는 명세가 이미 안다
 *
 * 손 목록을 지우면서 물었다 — 여든과 넷을 무엇으로 가르나. `variantOf`가 답이 아니었다:
 * 변형 열둘 중 여덟은 **원본과 다른 것을 그리므로** 제 화면이 있고 그 배열에 들어 있었다.
 *
 * 가르는 것은 **요소를 갖는가**다. 요소가 없으면 그릴 것이 없고, 그 모습은 원본이 데이터에
 * 따라 그린다(목록이 비었을 때, 다른 사람이 볼 때). 이 규칙이 옛 배열 여든을 **한 줄도
 * 틀리지 않고** 다시 만들어 낸다 — 사람이 적어 온 것을 명세가 이미 알고 있었다는 뜻이다.
 */

/** 명세에 있는 화면 전부. 변형까지 센다. */
export const ALL_SPEC_SCREENS: ScreenSpec[] = [...BY_ID.values()].sort((left, right) =>
  left.screenId.localeCompare(right.screenId),
)

/** 다른 화면의 한 때로 적힌 그림. 여덟은 제 것을 그리고 넷은 그리지 않는다. */
export const VARIANT_SCREENS: ScreenSpec[] = ALL_SPEC_SCREENS.filter(
  (screen) => screen.variantOf !== undefined,
)

/**
 * **원본이 데이터로 그리는 때.** 제 주소가 없다.
 *
 * 요소가 없으므로 더할 것이 없다 — 목록이 비었다는 말도, 그때 보이는 단추도 원본 화면의
 * `itemList`가 이미 갖고 있다. 주소를 따로 주면 같은 화면이 둘로 보인다.
 */
export const STATE_ONLY_SCREENS: ScreenSpec[] = ALL_SPEC_SCREENS.filter(
  (screen) => screen.elements.length === 0,
)

/** 제 주소를 갖는 화면. 준수 검사와 디자인 대조가 이것을 돈다. */
export const ALL_SCREENS: ScreenSpec[] = ALL_SPEC_SCREENS.filter(
  (screen) => screen.elements.length > 0,
)

// 화면 하나만 열어 볼 때 넘길 인자.
//
// 상세 화면은 "무엇의 상세인지"를 밖에서 받는다. 검사는 앞 화면을 거치지 않고
// 화면을 바로 그리므로 그 값을 어디선가 얻어야 하는데, 검사가 지어내면 그것은
// 명세에 없는 사실이 된다. 그래서 **명세가 예시 값을 들고 있고**(params[].example)
// 검사는 그것을 읽기만 한다. 구현은 이 값을 쓰지 않는다 — 인자가 없으면
// 조용히 아무거나 보여주는 대신 드러내야 한다.
export function exampleParamsOf(screenId: string): Record<string, string> {
  const screen = ALL_SPEC_SCREENS.find((candidate) => candidate.screenId === screenId)
  return Object.fromEntries(
    (screen?.params ?? [])
      .filter((param) => param.example !== undefined)
      .map((param) => [param.key, param.example as string]),
  )
}
