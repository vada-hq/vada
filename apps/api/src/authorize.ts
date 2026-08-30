import type { MiddlewareHandler } from 'hono'
import openapi from '../../../specs/figma/vada-wireframe/openapi.json' with { type: 'json' }
import { can, type Lookups, type Viewer } from './permissions.ts'

// 자리마다 매단 권한을 **실제로 강제한다.**
//
// 명세가 216자리에 저마다 권한 영역을 달았다. 그런데 매달아 놓기만 하면 아무것도
// 막지 않는다 — 계약에는 적혀 있는데 서버는 그냥 답하는 상태다.
//
// **자리마다 손으로 부르지 않는다.** 216번 부르면 그중 몇은 잊고, 잊은 자리는
// 조용히 열린다 — 그것이 이 일 전체가 막으려던 것이다. 그래서 미들웨어가 계약을
// 읽어 전부를 본다. 계약은 카탈로그에서 나오므로 새 자리를 열면 자동으로 걸린다.

interface Authorize {
  area: string
  object?: string
}

/** 계약이 든 자리 하나. 경로는 `{eventId}` 같은 자리를 품은 **틀**이다. */
interface Route {
  method: string
  segments: string[]
  authorize: Authorize
  operation: Operation
}

/** 계약이 그 자리에 대해 적은 것 전부. 멱등 키를 보려면 parameters가 필요하다. */
export interface Operation {
  operationId: string
  parameters?: Array<{ name: string; in: string }>
}

const ROUTES: Route[] = []
for (const [path, item] of Object.entries(openapi.paths as Record<string, Record<string, unknown>>)) {
  for (const [method, operation] of Object.entries(item)) {
    const authorize = (operation as { 'x-authorize'?: Authorize })['x-authorize']
    if (authorize === undefined) continue
    ROUTES.push({
      method: method.toUpperCase(),
      segments: path.split('/'),
      authorize,
      operation: operation as Operation,
    })
  }
}

/**
 * 실제 주소를 계약의 틀에 맞춘다.
 *
 * **Hono의 라우팅에 기대지 않는다.** `*`에 건 미들웨어에서 `c.req.routePath`는
 * `'*'`를 돌려준다 — 그 값으로 계약을 찾으면 **전부 '계약에 없는 자리'가 되어 막힌다.**
 * 실제로 그렇게 다섯이 막혔다. 계약이 든 틀로 직접 맞추면 미들웨어를 어디에 걸든 같다.
 *
 * 글자로 적힌 자리가 인자 자리를 이긴다 — `/api/ops/meetings/drafts`와
 * `/api/ops/meetings/{meetingId}`가 함께 있을 때 앞의 것이 답이다.
 */
export function matchRoute(
  method: string,
  path: string,
): { authorize: Authorize; params: Record<string, string>; operation: Operation } | undefined {
  const parts = path.split('/')
  const upper = method.toUpperCase()
  let best: { route: Route; params: Record<string, string>; literals: number } | undefined

  for (const route of ROUTES) {
    if (route.method !== upper || route.segments.length !== parts.length) continue
    const params: Record<string, string> = {}
    let literals = 0
    let ok = true
    for (const [at, segment] of route.segments.entries()) {
      const actual = parts[at]!
      if (segment.startsWith('{') && segment.endsWith('}')) {
        if (actual === '') { ok = false; break }
        params[segment.slice(1, -1)] = decodeURIComponent(actual)
      } else if (segment === actual) {
        literals += 1
      } else {
        ok = false
        break
      }
    }
    if (ok && (best === undefined || literals > best.literals)) {
      best = { route, params, literals }
    }
  }
  return best === undefined
    ? undefined
    : { authorize: best.route.authorize, params: best.params, operation: best.route.operation }
}

export interface AuthorizeDeps {
  viewer(): Viewer | null
  lookups: Lookups
}

/**
 * 이 요청이 그 자리를 열 수 있는가.
 *
 * `routePath`는 Hono가 아는 **틀**(`/api/ops/events/{eventId}/start`)이지 실제
 * 주소가 아니다. 틀이라야 계약과 맞출 수 있다.
 */
export function authorizeMiddleware(deps: AuthorizeDeps): MiddlewareHandler {
  return async (c, next) => {
    const matched = matchRoute(c.req.method, c.req.path)
    // **계약에 없는 자리는 막는다.** 명세 밖의 자리가 열려 있으면, 그 자리는
    // 아무 검사도 받지 않은 채 도는 코드다.
    if (matched === undefined) {
      return c.json({ message: '이 자리는 명세에 없습니다' }, 403)
    }
    const { authorize, params } = matched

    // 조건이 대상을 요구하면 그 값은 이미 요청에 있다 — 어느 것인지만 계약이 말한다.
    const object =
      authorize.object === undefined
        ? null
        : (params[authorize.object] ?? c.req.query(authorize.object) ?? null)

    const viewer = deps.viewer()
    if (!(await can(viewer, authorize.area, object, deps.lookups))) {
      return viewer === null
        ? c.json({ message: '로그인이 필요합니다' }, 401)
        : c.json({ message: '이 자리를 열 권한이 없습니다' }, 403)
    }
    await next()
  }
}
