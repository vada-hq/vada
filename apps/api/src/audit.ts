import type { Context, MiddlewareHandler } from 'hono'
import type { Viewer } from './permissions.ts'

// 누가 무엇을 언제 만졌는가.
//
// **법이 요구한다** — 개인정보처리시스템 접속 기록을 1년 이상 보관해야 한다.
// 그리고 지난 일은 소급해 기록할 수 없으므로 **첫 줄부터** 남긴다.
//
// 자리마다 손으로 부르지 않는다. 잊을 자리가 있으면 언젠가 잊고, 잊은 자리는
// 조용하다 — 남지 않은 기록은 없는 것과 같다. 그래서 미들웨어가 전부를 본다.
//
// ## 처음 쓴 것에 결함이 넷 있었다 (2026-08-30, 교차검토에서 드러남)
//
// 1. **처리한 정보주체를 늘 null로 남겼다.** 기준이 요구하는 것은 '누가 접속했나'만이
//    아니라 '누구의 정보를 다뤘나'다. 그 자리를 비워 두면 새어 나간 뒤에 누구의
//    것이 새었는지 알 수 없다.
// 2. **next()가 던지면 아무것도 안 남았다.** `await next()` 뒤에 쓰고 있어서, 터진
//    요청은 흔적 없이 사라졌다 — 봐야 할 것이 오히려 그쪽이다.
// 3. **주소에 실린 비밀을 그대로 오래 보관했다.** 공개 자리의 경로에 토큰이 들어
//    있는데(`/api/public/attendance/{checkInToken}/check-in`) 그것을 1년 남기면,
//    감사 기록이 새는 순간 그 토큰으로 남의 결과를 열 수 있다.
// 4. (곁: 표 쪽) 권한 변경 기록이 조직과 함께 지워졌다 — schema.ts를 보라.

export interface AuditEntry {
  at: Date
  orgId: string | null
  userId: string | null
  action: string
  /** 누구의 정보를 다뤘나. 사람이 아닐 수도 있다(행사·회의). */
  subjectType: string | null
  subjectId: string | null
  /** 터졌는가. 터진 요청도 남아야 한다. */
  failed: boolean
  ip: string | null
  userAgent: string | null
}

export interface AuditSink {
  write(entry: AuditEntry): Promise<void>
}

/**
 * 주소에서 **비밀을 지운다.**
 *
 * 공개 자리는 경로에 토큰을 싣는다. 그 값이 곧 열쇠이므로 오래 남기면 안 된다 —
 * 무엇을 했는지는 남기고 무엇으로 했는지는 지운다.
 *
 * 지우는 자리를 목록으로 들지 않는다. 목록은 새 자리가 생길 때 뒤처지고, 뒤처진
 * 목록은 조용하다 — `/api/public/` 아래의 경로 조각은 전부 지운다.
 */
export function maskSecrets(path: string): string {
  if (!path.startsWith('/api/public/')) {
    return path
  }
  const parts = path.split('/')
  // ['', 'api', 'public', <무엇>, <토큰>, <무엇>, <토큰>...] — 넷째부터 한 칸 걸러
  // 토큰이다. 그 자리만 지운다.
  return parts.map((part, at) => (at >= 4 && at % 2 === 0 ? '*' : part)).join('/')
}

export interface AuditContext {
  /** 이 요청이 누구의 정보를 다뤘는가. 핸들러가 알려 준다. */
  subject?: { type: string; id: string }
}

/**
 * 누가 이 요청을 보냈는가. **요청 시작에 한 번 확정한다.**
 *
 * 오랫동안 `c.get('userId')`를 읽었는데 **아무도 그것을 채우지 않았다.** 셸 자리에
 * 있던 미들웨어가 채우고 있었는데 자리를 계약이 만드는 층으로 옮기면서 함께
 * 사라졌고, 그 뒤로 모든 기록이 `userId: null`이었다 — 법이 요구하는 '식별자'가
 * 빈 접속 기록은 기록이 아니다(2026-08-31 교차검토).
 *
 * 핸들러가 채우기를 기다리지 않는다. 막힌 요청은 핸들러에 닿지도 못하는데,
 * **막힌 시도가 오히려 봐야 할 것이다.**
 */
export interface AuditWho {
  /**
   * 세션을 읽어 그 사람을 알아낸다. **비동기다** — 세션은 표에 있다.
   *
   * 이 층이 가장 먼저 도는 까닭에 여기서 한 번 확정하고 문맥에 담는다. 뒤의 층들이
   * 저마다 물으면 값이 요청 안에서 갈릴 수 있고, 세션을 여러 번 읽게 된다.
   */
  who(c: Context): Promise<Viewer | null>
}

export function auditMiddleware(
  sink: AuditSink,
  deps: AuditWho,
  now: () => Date = () => new Date(),
): MiddlewareHandler {
  return async (c, next) => {
    let failed = false
    // 답하기 전에 확정한다 — 핸들러가 무엇을 하든 누가 보냈는지는 그 전에 정해진다.
    const sender = await deps.who(c)
    c.set('sender', sender)
    if (sender !== null) {
      c.set('userId', sender.userId)
      const orgId = sender.membership?.orgId
      if (orgId !== undefined) c.set('orgId', orgId)
    }
    try {
      await next()
    } catch (error) {
      // **터진 것도 남긴다.** 남기고 나서 다시 던진다 — 삼키면 오류가 사라진다.
      failed = true
      await writeOnce(error)
      throw error
    }
    await writeOnce(null)

    async function writeOnce(error: unknown) {
      const subject = c.get('auditSubject')
      await sink.write({
        at: now(),
        orgId: c.get('orgId') ?? null,
        userId: c.get('userId') ?? null,
        // **읽기도 남긴다.** 법이 말하는 것은 '처리'이고 조회도 처리다.
        action: `${c.req.method} ${maskSecrets(c.req.path)} → ${
          error === null ? c.res.status : '터짐'
        }`,
        subjectType: subject?.type ?? null,
        subjectId: subject?.id ?? null,
        // **막힌 것도 실패다.** 터진 것만 실패로 세었더니 401·403·404가 전부
        // '성공'으로 남았다 — 봐야 할 것이 바로 그쪽이다.
        failed: failed || (error === null && c.res.status >= 400),
        // 프록시 뒤에 있으므로 원래 주소는 헤더가 들고 온다. 없으면 없다고 적는다 —
        // 지어내지 않는다.
        ip: c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
        userAgent: c.req.header('user-agent') ?? null,
      })
    }
  }
}
