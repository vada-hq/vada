import { sql } from 'drizzle-orm'
import type { Tx } from '../db/types.js'

// 로그인 세션의 기한 파기(DEC-55). 같은 일을 두 번 해도 같다.
// better-auth는 만료된 세션을 그 쿠키가 다시 올 때만 지우므로, 다시 오지 않는 줄을 여기서 지운다.
// 만료의 뜻은 better-auth와 같다(만료 시각이 지금보다 앞이면 만료, api/routes/session.mjs).
// IP·브라우저 정보는 세션을 만들 때만 적히고 세션을 늘려도 그대로라, 계속 쓰는 세션은 3개월을 넘겨 들고 있다.
// 그래서 줄과 로그인은 두고 두 값만 비운다. 3개월마다 다시 로그인시키는 것은 사람에게 새 수고라 하지 않는다.
export async function purgeSessions(tx: Tx, now: Date) {
  const at = now.toISOString()
  await tx.execute(sql`DELETE FROM sessions WHERE expires_at < ${at}::timestamptz`)
  await tx.execute(
    sql`UPDATE sessions SET ip_address = NULL, user_agent = NULL
      WHERE created_at <= (${at}::timestamptz - interval '3 months')
        AND (ip_address IS NOT NULL OR user_agent IS NOT NULL)`,
  )
}
