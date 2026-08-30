import type { Context } from 'hono'
import { matchRoute } from './authorize.ts'

// 두 번 보내진 것을 한 번으로 만든다.
//
// 계약이 자리마다 `Idempotency-Key`를 요구한다고 적어 두었지만, **적어 두는 것과
// 지키는 것은 다른 일이다.** 지키는 코드가 없으면 그 줄은 말뿐이고, 두 번 눌린
// 요청은 그대로 두 번 실행된다 — 초대가 두 번 되살아나 방금 복사한 링크가 죽는다.
//
// **자리마다 손으로 부르지 않는다.** 어느 자리가 키를 요구하는지는 계약이 알고
// 있으므로 미들웨어가 계약을 읽는다.

export interface Attempt {
  /** 이 키로 이미 답한 것. 없으면 처음이다. */
  answered: unknown
}

export interface Attempts {
  find(scope: string, operationId: string, key: string): Promise<Attempt | null>
  remember(scope: string, operationId: string, key: string, answered: unknown): Promise<void>
}

/** 프로세스 안에만 두는 것. 늘 켜진 계산 하나가 받는 동안은 이것으로 충분하다. */
export function inMemoryAttempts(): Attempts {
  const seen = new Map<string, unknown>()
  const at = (scope: string, operationId: string, key: string) => `${scope}|${operationId}|${key}`
  return {
    async find(scope, operationId, key) {
      const found = seen.get(at(scope, operationId, key))
      return found === undefined ? null : { answered: found }
    },
    async remember(scope, operationId, key, answered) {
      seen.set(at(scope, operationId, key), answered)
    },
  }
}

/**
 * 시도를 담는 칸.
 *
 * **누구의 칸인지가 곧 벽이다.** 안쪽은 학생회가 칸을 가르므로 남의 답이 섞이지
 * 않지만, 밖에서 오는 자리에는 가를 것이 없다 — 같은 링크를 모두가 연다.
 */
export interface Scope {
  /** 담는 칸의 이름. */
  name: string
  /**
   * 밖에서 온 요청인가.
   *
   * **그렇다면 키 자체가 열쇠다.** 담아 둔 답에 영수증이 들어 있고, 키만 맞히면
   * 그 답이 그대로 나온다. 안쪽에서는 세션이 앞을 막지만 여기서는 아무것도 없다.
   */
  fromOutside: boolean
}

/**
 * 밖에서 오는 자리의 키는 **기기가 만든 난수여야 한다.**
 *
 * `${토큰}-${학번}` 같은 키를 만드는 클라이언트가 있으면 그 키는 남이 만들 수 있는
 * 값이고, 그러면 영수증을 남에게 주지 않으려고 세운 벽이 그대로 무너진다
 * (2026-08-31 교차검토가 짚은 것과 같은 구멍이다).
 *
 * 그래서 모양을 좁힌다 — 이 모양은 무엇에서 유도해서 우연히 나오지 않는다.
 */
const UNGUESSABLE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** 이 자리가 멱등 키를 요구하는가. 계약이 답한다. */
export function needsKey(method: string, path: string): string | null {
  const matched = matchRoute(method, path)
  if (matched === undefined) return null
  const operation = matched.operation
  const wants = (operation.parameters ?? []).some(
    (parameter) => parameter.in === 'header' && parameter.name === 'Idempotency-Key',
  )
  return wants ? operation.operationId : null
}

export class Replayed {
  // 매개변수 속성(`constructor(readonly x)`)을 쓰지 않는다 — 그것은 타입을 지우면
  // 사라지지 않는 문법이고, 이 저장소의 다른 앱이 그것을 금하고 있다.
  readonly answered: unknown
  constructor(answered: unknown) {
    this.answered = answered
  }
}

/**
 * 키를 확인한다.
 *
 * 요구하는 자리인데 키가 없으면 **막는다** — 없이 받아 주면 그 자리는 계약과 다르게
 * 도는 것이고, 두 번 눌린 요청을 가릴 방법이 사라진다.
 */
export async function checkKey(
  c: Context,
  scope: Scope,
  attempts: Attempts,
): Promise<Replayed | { key: string; operationId: string } | null> {
  const operationId = needsKey(c.req.method, c.req.path)
  if (operationId === null) return null

  const key = c.req.header('Idempotency-Key')
  if (key === undefined || key.trim() === '') {
    throw new MissingKey('같은 요청이 두 번 오는 것을 가릴 수 없습니다. Idempotency-Key가 필요합니다.')
  }
  if (scope.fromOutside && !UNGUESSABLE.test(key.trim())) {
    throw new MissingKey(
      'Idempotency-Key는 기기가 만든 난수(UUID)여야 합니다. 주소나 입력에서 만들어 낸 값은 남도 만들 수 있습니다.',
    )
  }
  const found = await attempts.find(scope.name, operationId, key)
  return found === null ? { key, operationId } : new Replayed(found.answered)
}

export class MissingKey extends Error {}
