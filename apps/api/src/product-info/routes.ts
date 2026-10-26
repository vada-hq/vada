import { Hono } from 'hono'
import { ProductInfoSchema, type ProductInfoResponse } from '@vada/contracts'
import { authorize } from '../access/authorize.js'
import { requireSession, type SessionEnv, type SessionReader } from '../auth/require-session.js'
import type { Db } from '../db/types.js'
import { ApiError } from '../http/errors.js'
import { createRateLimiter } from '../http/rate-limit.js'
import { json } from '../http/validate.js'
import type { ProductLookup } from './reef.js'
import { createProductInfo } from './service.js'

const root = '/organizations/:councilId/product-info'
// 계정마다 1분에 20번. ReefAPI 키 한도(엔드포인트마다 3초에 30번) 아래에 둔다.
const PRODUCT_INFO_LIMIT = { limit: 20, windowMs: 60_000 }

// 쿠팡 상품 정보 불러오기(DEC-89). 아무것도 바꾸지 않지만 크레딧을 쓰므로 공통 가드(출처 확인)가 걸리는 POST로 둔다.
// 그 학생회 운영진만 부른다(council.view). 못 불러와도 200이다(막지 않는다).
export function createProductInfoRoutes(
  db: Db,
  getSession: SessionReader,
  options: {
    clock?: () => Date
    lookup?: ProductLookup | undefined
    // 전송 후 선조회와 같은 캐시·진행 조회·하루 상한을 쓴다.
    productInfo?: ReturnType<typeof createProductInfo> | undefined
  } = {},
) {
  const clock = options.clock ?? (() => new Date())
  const productInfo = options.productInfo ?? createProductInfo({ lookup: options.lookup, clock })
  const limiter = createRateLimiter(PRODUCT_INFO_LIMIT)
  const routes = new Hono<SessionEnv>()
  routes.post(root, json(ProductInfoSchema), requireSession(getSession), async c => {
    const userId = c.get('userId')
    // 로그인한 사람만 세므로 인증 뒤에 둔다.
    if (!limiter.take(userId, clock())) throw new ApiError('TOO_MANY_REQUESTS')
    await authorize(db, {
      userId,
      councilId: c.req.param('councilId'),
      action: 'council.view',
      now: clock(),
    })
    return c.json((await productInfo(c.req.valid('json').url)) satisfies ProductInfoResponse)
  })
  return routes
}
