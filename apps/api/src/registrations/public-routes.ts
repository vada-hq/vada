import { Hono } from 'hono'
import type { PublicRegistrationForm } from '@vada/contracts'
import type { Db } from '../db/types.js'
import { publicFormOf } from './public-form.js'

// 읽기는 한 시점의 모습이다(신청 수와 양식이 같은 순간 것).
const snapshot = { isolationLevel: 'repeatable read', accessMode: 'read only' } as const

// 로그인 없이 쓰는 공개 경로(/api/public/). 학생회 경계는 코드로만 가른다. 속도 제한은 두지 않는다(기능 007 '속도 제한').
// 신청과 내 신청은 조각 3이 같은 모듈에 더한다.
export function createPublicRegistrationRoutes(db: Db, options: { clock?: () => Date } = {}) {
  const clock = options.clock ?? (() => new Date())
  const routes = new Hono()
  routes.get('/public/registration-forms/:code', async c => {
    // 공개 응답은 중간 캐시나 뒤로 가기에 남지 않게 한다: 정원과 상태가 바뀐다.
    c.header('Cache-Control', 'no-store')
    const now = clock()
    const form = await db.transaction(
      async tx => publicFormOf(tx, c.req.param('code'), now),
      snapshot,
    )
    return c.json(form satisfies PublicRegistrationForm)
  })
  return routes
}
