import { Hono, type Context } from 'hono'
import { auditMiddleware } from './audit.ts'
import { authorizeMiddleware } from './authorize.ts'
import { type Deps, type SignIn } from './deps.ts'
import { HANDLERS } from './handlers/index.ts'
import { checkKey, MissingKey, Replayed, type Scope } from './idempotency.ts'
import { guessRateLimit } from './public/rate-limit.ts'
import { hashToken, tokenOfRequest } from './public/tokens.ts'
import { attach } from './routes.ts'

// 서버의 얼개.
//
// **자리와 모양은 명세가 정한다.** `specs/figma/vada-wireframe/`의 카탈로그가
// method·path·인자·조각·값의 종류·권한·실패까지 갖고 있고, `npm run openapi`가 그것을
// OpenAPI로 옮긴다. 여기서 하는 일은 그 자리에 답을 놓는 것뿐이다.
//
// 지나가는 순서가 셋이다. **기록 → 권한 → 답.** 기록이 맨 앞인 까닭은 막힌 요청도
// 남아야 하기 때문이고(오히려 봐야 할 것이 그쪽이다), 권한이 답보다 앞인 까닭은
// 자리마다 손으로 검사하면 잊은 자리가 조용히 열리기 때문이다.

/**
 * 이 요청의 시도를 **어느 칸에** 담는가.
 *
 * 안쪽은 학생회가 칸을 가른다. 밖에서 오는 자리에는 가를 것이 없으므로 **그 링크가
 * 칸이 된다** — 한 설문의 키가 다른 설문의 답을 열지 못하게 하는 최소한이다.
 *
 * **밖에서는 이 미들웨어가 유일한 문지기다.** 오랫동안 여기서 구성원이 아니면
 * 그냥 지나갔는데, 그러면 계약이 `Idempotency-Key`를 요구한다고 적어 둔 두 자리
 * (참석·신청)가 그 요구를 아무도 지키지 않은 채 돌았다.
 *
 * **로그인은 했는데 아직 아무 학생회에도 없는 사람이 있다.** 학생회를 만들려는
 * 사람이 그렇고, 그 자리(`org.create`)가 바로 키를 요구하는 자리다 — 소속으로만
 * 칸을 가르던 동안 이 사람은 칸이 없어 그냥 지나갔고, '조직 만들기'를 두 번 누르면
 * 학생회가 둘 생겼다. 그 사람에게는 **자기 자신이 칸**이다.
 */
function scopeOf(c: Context): Scope | null {
  const sender = c.get('sender')
  if (sender !== null && sender !== undefined) {
    const membership = sender.membership
    return membership === null
      ? { name: `user:${sender.userId}`, fromOutside: false }
      : { name: `org:${membership.orgId}`, fromOutside: false }
  }
  if (!c.req.path.startsWith('/api/public/')) return null
  const token = tokenOfRequest(c)
  if (token === null) return null
  // 세는 자리에 열쇠를 그대로 두지 않는다.
  return { name: `public:${hashToken(token)}`, fromOutside: true }
}

/**
 * 밖에서 부르던 이름을 그대로 둔다.
 *
 * 답을 놓는 자리를 `handlers/`로 옮기면서 `Deps`와 `SignIn`도 `deps.ts`로 갔는데,
 * 그것을 `app.ts`에서 가져오던 자리가 열 곳 넘는다(검사와 `serve.ts`). 이름을
 * 옮기는 일과 자리를 옮기는 일을 한 번에 하면 무엇이 깨졌는지 갈리지 않는다.
 */
export type { Deps, SignIn }

export function createApp(deps: Deps) {
  const app = new Hono()

  // **가장 먼저 돈다.** 막힌 요청도 남아야 하고, 누가 보냈는지는 여기서 한 번
  // 확정해 문맥에 담는다 — 구성원이 아니어도 누구인지는 남는다.
  app.use('*', auditMiddleware(deps.audit, { who: (c) => deps.who(c) }))
  // **열쇠 하나가 벽인 자리는 세션이 벽이 아니다.** 마구 넣어 보는 것을 막지 않으면
  // 그 벽이 벽이 아니다 — 밖에서 열리는 자리가 그렇고, 로그인이 있어도 주소에 실린
  // 값이 곧 열쇠인 자리(초대 코드)가 그렇다. 권한보다 앞에 둔다 — 막을 것은 판정에
  // 닿기 전에 막는다.
  app.use('*', guessRateLimit({ counter: deps.counter, now: () => deps.invite.now().getTime() }))

  app.use('*', authorizeMiddleware({ lookups: deps.lookups }))

  // **두 번 눌린 것을 여기서 가린다.** 계약이 어느 자리에 키가 필요한지 알고 있으므로
  // 자리마다 손으로 부르지 않는다 — 부르면 잊는 자리가 생기고, 잊은 자리는 두 번 돈다.
  app.use('*', async (c, next) => {
    const scope = scopeOf(c)
    if (scope === null) return next()
    let checked
    try {
      checked = await checkKey(c, scope, deps.attempts)
    } catch (error) {
      if (error instanceof MissingKey) return c.json({ message: error.message }, 422)
      throw error
    }
    if (checked instanceof Replayed) {
      // 처음의 답을 그대로 준다. 두 번째가 다른 답을 받으면 두 번 눌린 것이
      // 두 가지 사실이 된다.
      //
      // **밖에서 온 답에는 영수증이 들어 있다.** 처음 답과 같은 조건으로 준다 —
      // 한쪽만 쌓이지 않게 하면 그 답이 어딘가에 남는다.
      if (scope.fromOutside) c.header('Cache-Control', 'no-store')
      return c.json(checked.answered as never, 200)
    }
    await next()
    if (checked !== null && c.res.status === 200) {
      await deps.attempts.remember(
        scope.name,
        checked.operationId,
        checked.key,
        await c.res.clone().json(),
      )
    }
  })

  attach(app, deps, HANDLERS)

  return app
}
