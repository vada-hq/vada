import type { Context } from 'hono'

// **보낸 사람의 주소를 누가 말했는가.**
//
// 프록시 뒤에 있으므로 원래 주소는 `x-forwarded-for`가 들고 온다. 그런데 그 헤더는
// **보내는 쪽이 쓰는 글자**다 — 아무나 아무 값이나 적을 수 있다.
//
// 이것이 실제 구멍이었다. 밖에서 열리는 자리의 속도 세기가 이 값으로 사람을 가르는데,
// api가 도는 곳(Render)의 주소가 밖에서도 열려 있어 **Worker를 거치지 않고 곧장
// 두드리면서 매번 다른 주소를 적으면** 셀 때마다 새 칸이 열린다. 22자 난수 토큰을
// 막던 벽이 통째로 없는 것과 같았다.
//
// ## 거친 자리를 증명하게 한다
//
// Worker는 자기가 본 진짜 주소를 `x-forwarded-for`에 적고, **그것을 자기가 적었다는
// 증거**로 `x-vada-edge`에 비밀을 함께 싣는다. api는 그 증거가 맞을 때만 주소를 믿는다.
//
// 증거가 없는 요청은 **한 칸에 모은다.** 주소를 못 믿으니 가를 수 없고, 가를 수 없는
// 것을 가른 척하면 세는 일이 아무것도 막지 못한다. 곧장 두드리는 쪽은 그 한 칸을
// 통째로 쓰게 되므로 마구 넣어 보기가 곧 자기 한도를 태운다.
//
// ## 비밀이 없으면
//
// **오늘처럼 헤더를 그대로 믿는다.** 배포에 값을 넣기 전에 막아 버리면 행사장 전체가
// 한 칸이 되어 줄 서서 찍는 사람들이 다 막힌다 — 고치려다 서비스를 끊는 셈이다.
// 대신 서버가 설 때 그 사실을 소리 내어 말하고(`serve.ts`), 이 파일이 그 상태를
// 숨기지 않는다. 값을 넣는 순간 구멍이 닫힌다.

/** Worker가 '내가 넘겼다'고 적는 자리. */
export const EDGE_HEADER = 'x-vada-edge'

/** 증거가 없는 요청이 함께 쓰는 칸. 가를 수 없는 것을 가른 척하지 않는다. */
export const UNPROVEN = 'unproven'

/** 아무도 주소를 말해 주지 않았을 때. */
export const UNKNOWN = 'unknown'

/** 이 요청이 우리 Worker를 거쳐 왔는가. */
export function throughEdge(c: Context, edgeSecret: string | null | undefined): boolean {
  if (edgeSecret === null || edgeSecret === undefined || edgeSecret === '') return false
  return c.req.header(EDGE_HEADER) === edgeSecret
}

/**
 * 셀 때 쓰는 보낸 사람의 자리.
 *
 * 비밀이 있으면 **증명된 요청의 주소만** 주소로 센다. 없으면 오늘처럼 헤더를 믿는다.
 */
export function addressKey(c: Context, edgeSecret: string | null | undefined): string {
  const proven = edgeSecret !== null && edgeSecret !== undefined && edgeSecret !== ''
  if (proven && !throughEdge(c, edgeSecret)) return UNPROVEN
  return c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? UNKNOWN
}

/**
 * 기록에 남길 주소. **믿을 수 없으면 없다고 적는다.**
 *
 * 3년 남는 기록에 보낸 쪽이 적은 글자를 사실로 적으면, 그 기록으로 '누가 했나'를
 * 찾는 날 엉뚱한 사람을 가리킨다. 지어내지 않는 것과 같은 규칙이다.
 */
export function recordedAddress(c: Context, edgeSecret: string | null | undefined): string | null {
  const proven = edgeSecret !== null && edgeSecret !== undefined && edgeSecret !== ''
  if (proven && !throughEdge(c, edgeSecret)) return null
  return c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? null
}
