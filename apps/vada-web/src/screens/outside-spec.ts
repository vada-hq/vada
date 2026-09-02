/**
 * **명세 없이 손으로 그린 화면.**
 *
 * 화면 여든넷은 그림에서 명세가 나오고 명세에서 검사가 나온다 — 단추마다 `action`이
 * 붙어 있고(백쉰아홉 개 전부), 검증기가 그 이동 대상이 실재하는지 보고, 생성된 검사가
 * **이동마다 눌러서 도착하는지**까지 잰다(`navigation-arrival.test.ts`). 그 화면들에서는
 * 사람이 이동을 기억할 필요가 없다.
 *
 * 여기 있는 화면은 그 그물 **밖**이다. 그림이 없으니 명세가 없고, 명세가 없으니 검사도
 * 저절로 생기지 않는다. **그러면 사람의 기억이 유일한 검사가 된다.**
 *
 * ## 왜 이 파일이 생겼나
 *
 * 실제로 틀렸다(2026-09-02). 로그인 화면이 '로그인 뒤 보고 있던 곳으로 돌아온다'로
 * 짜여 있었는데, 로그인 화면에서 누르면 **보고 있던 곳이 로그인 화면**이라 구글을
 * 다녀온 사람이 제자리로 왔다. 로그인은 실제로 됐으므로 아무 오류도 안 났다 — 사람은
 * 실패한 줄 알고 다시 눌렀다.
 *
 * 그것이 조용했던 까닭은 **명세 밖이라는 사실을 주석에만 적어 두었기** 때문이다.
 * 이 저장소는 밖에 있는 것을 늘 코드가 들게 했다 — 안 만들기로 한 그림은
 * `not-screens.json`이, 아직 가짜인 출처는 `served.ts`가, 그림과 다르게 그린 것은
 * `deviations.ts`가 든다. 화면만 그 자리가 비어 있었다.
 *
 * ## 무엇을 적나
 *
 * **명세가 대신 못 하는 것을 적는다.** 지금은 이동뿐이다 — 명세가 있었다면
 * `action.targetScreenId`가 들고 있었을 것.
 *
 * 여기 적은 것을 **그 화면의 검사가 읽는다**(`SignInScreen.test.tsx`). 기억이 아니라
 * 적힌 것에서 검사가 나오게 하려는 것이고, 그것이 명세 있는 화면과 같은 모양이다.
 *
 * **목록은 짧아야 한다.** 그림이 생기면 그 화면은 명세로 옮겨 가고 여기서 빠진다.
 */
export interface OutsideSpecScreen {
  screenId: string
  /** 왜 명세가 없는가. 지어낸 예외가 아니라는 것을 여기서 말한다. */
  why: string
  /** 이 화면이 사람을 어디로 보내는가. 명세가 있었다면 `action`이 들었을 것. */
  navigations: ReadonlyArray<{ when: string; to: string }>
}

export const OUTSIDE_SPEC: readonly OutsideSpecScreen[] = [
  // **비어 있다.** 로그인 화면이 여기 유일하게 올라 있었고, 그림을 그려 명세로 옮겼다
  // (2026-09-02). 등록부가 스스로 닫힌 셈이다 — "명세가 생겼으니 빼라"고 검사가 멈췄다.
  //
  // 다시 채워질 자리이긴 하다. 그림 없는 화면이 또 생기면 여기 오르고, 그때도 같은 검사가
  // 그 화면을 붙잡는다. 비어 있는 동안은 **명세만 보면 만든다가 문자 그대로 참이다.**
]

/** 이 화면은 명세 밖인가. */
export function isOutsideSpec(screenId: string): boolean {
  return OUTSIDE_SPEC.some((screen) => screen.screenId === screenId)
}

/** 이 화면이 가는 곳들. 검사가 이것을 읽어 진짜로 그리 가는지 본다. */
export function navigationsOf(screenId: string): ReadonlyArray<{ when: string; to: string }> {
  const found = OUTSIDE_SPEC.find((screen) => screen.screenId === screenId)
  if (found === undefined) {
    throw new Error(`'${screenId}'는 명세 밖 화면 목록에 없습니다.`)
  }
  return found.navigations
}
