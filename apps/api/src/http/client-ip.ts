import { isIP } from 'node:net'
import { getConnInfo } from '@hono/node-server/conninfo'
import type { Context } from 'hono'

const UNKNOWN = 'unknown'

// 요청 IP(열람 기록용). 프록시(Render)가 붙이는 X-Forwarded-For의 첫 값을 쓰되 IP 모양일 때만 믿고,
// 아니면 소켓의 상대 주소, 그것도 없으면 'unknown'이다(기록 칸이 NOT NULL이라 비우지 않는다). IP는 45자 이하라 DB CHECK에 맞는다.
// 이 값은 꾸밀 수 있어 접속 추적의 보조 단서일 뿐 인증에 쓰지 않는다.
export function clientIpOf(c: Context): string {
  const forwarded = c.req.header('x-forwarded-for')?.split(',')[0]?.trim()
  if (forwarded && isIP(forwarded)) return forwarded
  try {
    const address = getConnInfo(c).remote.address
    if (address && isIP(address)) return address
  } catch {
    // 시험처럼 소켓이 없는 호출이다.
  }
  return UNKNOWN
}
