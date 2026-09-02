import { findDataSource } from './catalog'
import { getOptionSource } from '../option-sources/catalog'

/**
 * **진짜 서버에서 오는 출처.**
 *
 * 화면 여든넷이 전부 그려지지만 그 값은 대부분 개발용 응답 4,400줄에서 온다 —
 * 명세가 말한 모양대로 만들어 둔 **가짜**다. 그 덕에 서버 없이 화면을 지을 수
 * 있었지만, 가짜는 **검증되지 않은 가정의 창고**이기도 하다: 서버가 실제로 그
 * 모양을 낼 수 있는지 아무도 재 보지 않은 자리가 그만큼 쌓여 있다.
 *
 * ## 왜 목록인가
 *
 * 한 번에 다 켤 수 없다. 계약이 216자리인데 서버가 답하는 것은 그 일부라, 전부
 * 켜면 없는 자리마다 화면이 깨진다. 그렇다고 **켜지지 않은 것을 조용히 가짜로
 * 되돌리면** 그것이 이 저장소가 줄곧 피해 온 조용한 대체다 — 화면은 그려지는데
 * 그 값이 어디서 왔는지 아무도 모른다.
 *
 * 그래서 **어느 것이 진짜인지 코드가 든다.** 여기 있으면 서버에서 오고, 없으면
 * 가짜에서 온다. 둘 다 명시된 상태다.
 *
 * ## 이 목록이 진도표다
 *
 * 흐름 하나를 서버에 붙일 때마다 그 출처들이 여기로 옮겨 오고, `fixtures.ts`의
 * 그 줄이 지워진다. **비어 있으면 배포된 앱에서 진짜인 것은 로그인뿐이다.**
 * 검사가 이 수를 세어 보여 준다.
 */
export const SERVED: readonly string[] = [
  // **셸이 읽는 둘.** 학생회 이름과 보는 사람은 화면의 요소가 아니라 셸의 것이고,
  // 서버가 이미 답한다. 이 둘이 가짜인 동안은 로그인해도 남의 학생회 이름이 보인다.
  'shell.organization',
  'shell.viewer',

  // **조직 보기(ORG-04).** 진짜 서버와 진짜 Postgres로 그려지는 것이 검사로
  // 증명된 첫 화면이다(`end-to-end.server.test.tsx`).
  'org.roleCounts',
  'org.permissionMatrix',

  // 인자를 넘겨 부르는 길이 열린 것을 재는 자리(M3).
  'event.summary',
]

const served = new Set(SERVED)

/** 이 출처는 진짜 서버에서 오는가. */
export function isServed(key: string): boolean {
  return served.has(key)
}

/**
 * 목록에 적힌 이름이 실제로 있는 출처인가.
 *
 * 오타 하나면 그 출처는 영영 가짜로 남는데, **가짜로 남는 것은 조용하다** —
 * 화면이 그대로 그려지므로 아무도 모른다. 검사가 이것을 부른다.
 */
export function unknownServedKeys(): string[] {
  return SERVED.filter((key) => {
    try {
      findDataSource(key)
      return false
    } catch {
      // 선택지 출처는 다른 카탈로그다.
      try {
        getOptionSource(key)
        return false
      } catch {
        return true
      }
    }
  })
}
