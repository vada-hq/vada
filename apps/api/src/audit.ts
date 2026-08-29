import type { MiddlewareHandler } from 'hono'

// 누가 무엇을 언제 만졌는가.
//
// **법이 요구한다** — 개인정보처리시스템 접속 기록을 1년 이상 보관해야 한다.
// 그리고 지난 일은 소급해 기록할 수 없으므로 **첫 줄부터** 남긴다.
//
// 자리마다 손으로 부르지 않는다. 잊을 자리가 있으면 언젠가 잊고, 잊은 자리는
// 조용하다 — 남지 않은 기록은 없는 것과 같다. 그래서 미들웨어가 전부를 본다.

export interface AuditEntry {
  at: Date
  orgId: string | null
  userId: string | null
  action: string
  targetType: string | null
  targetId: string | null
  ip: string | null
  userAgent: string | null
}

export interface AuditSink {
  write(entry: AuditEntry): Promise<void>
}

/**
 * 어디로 쓸지는 밖에서 준다. 시험에서는 배열에 쌓고 서버에서는 표에 넣는다 —
 * **남기는 일이 도는지**를 DB 없이 시험할 수 있어야 하기 때문이다.
 */
export function auditMiddleware(
  sink: AuditSink,
  now: () => Date = () => new Date(),
): MiddlewareHandler {
  return async (c, next) => {
    await next()

    // **읽기도 남긴다.** 법이 말하는 것은 '처리'이고 조회도 처리다. 개인정보를
    // 본 사실이 남지 않으면 새어 나간 뒤에 누가 봤는지 알 수 없다.
    //
    // 실패한 요청도 남긴다 — 막힌 시도가 오히려 봐야 할 것이다.
    await sink.write({
      at: now(),
      orgId: c.get('orgId') ?? null,
      userId: c.get('userId') ?? null,
      action: `${c.req.method} ${c.req.path} → ${c.res.status}`,
      targetType: null,
      targetId: null,
      // 프록시 뒤에 있으므로 원래 주소는 헤더가 들고 온다. 없으면 없다고 적는다 —
      // 지어내지 않는다.
      ip: c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      userAgent: c.req.header('user-agent') ?? null,
    })
  }
}
