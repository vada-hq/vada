import type { Context } from 'hono'
import type { AuditSink } from './audit.ts'
import type { Db } from './db/client.ts'
import type { Attempts } from './idempotency.ts'
import type { InviteSettings } from './org/invite.ts'
import { can, type Lookups, type Viewer } from './permissions.ts'
import type { Counter } from './public/rate-limit.ts'
import { NotFound, type Handler } from './routes.ts'

// 답을 놓는 자리가 함께 쓰는 것.
//
// **`app.ts`에서 떼어 냈다.** 자리마다의 답이 한 파일에 모여 있는 동안은 흐름을 하나
// 붙일 때마다 그 파일을 고쳐야 했고, 둘을 나란히 붙이면 같은 자리에서 부딪힌다.
// 이제 답은 `handlers/`의 영역별 파일에 살고, 여기 있는 것은 그 파일들이 **모두**
// 쓰는 것뿐이다 — 여기 무엇을 더할 때는 정말 모두가 쓰는지 먼저 보라.

declare module 'hono' {
  interface ContextVariableMap {
    userId: string | undefined
    orgId: string | undefined
    /**
     * 이 요청이 **누구의 정보를 다뤘는가.** 핸들러가 알려 주고 감사 기록이 남긴다.
     *
     * 기준이 요구하는 것은 '누가 접속했나'만이 아니라 '누구의 것을 다뤘나'다.
     */
    auditSubject: { type: string; id: string } | undefined
    /** 이 요청을 보낸 사람. **요청마다 한 번만 정해진다.** */
    sender: Viewer | null
  }
}

/** 들어오는 길을 여는 층. Better Auth가 그 뒤에 있고 계약은 그것을 모른다. */
export interface SignIn {
  /** 어느 길이 열려 있는가. */
  open: () => { google: boolean; kakao: boolean }
  /** 그 제공자로 가는 주소. 돌아올 자리는 이 층이 붙인다. */
  start: (provider: string) => Promise<{ url: string }>
}

export interface Deps {
  audit: AuditSink
  db: Db
  /**
   * 세션을 읽어 이 요청을 보낸 사람을 알아낸다.
   *
   * 검사는 곧바로 답하고 서버는 표를 읽는다 — 이 자리가 갈리는 곳이다.
   */
  who: (c: Context) => Promise<Viewer | null>
  /** '그 행사의 조직원인가' 같은 것. 저장소가 답한다. */
  lookups: Lookups
  /** 두 번 보내진 것을 가리는 자리. */
  attempts: Attempts
  /** 초대 링크가 어디에 놓이는지와 때. 배포가 정하므로 밖에서 받는다. */
  invite: InviteSettings
  /**
   * 들어오는 길.
   *
   * **돌아올 자리를 서버가 정한다.** 화면이 정하던 동안 로그인 화면이 자기 자신을 돌아올
   * 자리로 넘겼고, 구글을 다녀온 사람이 제자리로 왔다 — 로그인은 실제로 됐으므로 아무
   * 오류도 나지 않았다. 화면이 못 틀리게 이리로 옮겼다.
   */
  signIn: SignIn
  /** 새로 만드는 것의 이름표. 밖에서 받으므로 검사가 정할 수 있다. */
  newId: () => string
  /** 밖에서 열리는 자리를 두드리는 것을 세는 곳. */
  counter: Counter
}

/**
 * 한 영역이 답하는 자리들.
 *
 * 열쇠는 계약의 `operationId`다 — 계약에 없는 이름을 쓰면 `attach`가 시작할 때 멈춘다.
 */
export type Handlers = Record<string, Handler<Deps>>

/** 이 사람이 어느 학생회의 것을 보고 있는가. 구성원이 아니면 여기까지 오지 않는다. */
export function orgOf(c: Context): string {
  const membership = c.get('sender')?.membership
  if (membership === null || membership === undefined) {
    throw new NotFound('학생회를 찾지 못했습니다')
  }
  return membership.orgId
}

/**
 * 화면에 내려보내는 판정. **막는 검사와 같은 함수에서 나온다** — 두 곳에서 나오면
 * 언젠가 갈리고, 갈리는 쪽은 늘 화면이다(단추를 그렸는데 눌리면 막힌다).
 */
export function canDo(
  c: Context,
  deps: Deps,
  area: string,
  object: string | null = null,
): Promise<boolean> {
  return can(c.get('sender'), area, object, deps.lookups)
}
