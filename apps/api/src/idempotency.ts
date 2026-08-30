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
  find(orgId: string, operationId: string, key: string): Promise<Attempt | null>
  remember(orgId: string, operationId: string, key: string, answered: unknown): Promise<void>
}

/** 프로세스 안에만 두는 것. 늘 켜진 계산 하나가 받는 동안은 이것으로 충분하다. */
export function inMemoryAttempts(): Attempts {
  const seen = new Map<string, unknown>()
  const at = (orgId: string, operationId: string, key: string) => `${orgId}|${operationId}|${key}`
  return {
    async find(orgId, operationId, key) {
      const found = seen.get(at(orgId, operationId, key))
      return found === undefined ? null : { answered: found }
    },
    async remember(orgId, operationId, key, answered) {
      seen.set(at(orgId, operationId, key), answered)
    },
  }
}

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
  orgId: string,
  attempts: Attempts,
): Promise<Replayed | { key: string; operationId: string } | null> {
  const operationId = needsKey(c.req.method, c.req.path)
  if (operationId === null) return null

  const key = c.req.header('Idempotency-Key')
  if (key === undefined || key.trim() === '') {
    throw new MissingKey('같은 요청이 두 번 오는 것을 가릴 수 없습니다. Idempotency-Key가 필요합니다.')
  }
  const found = await attempts.find(orgId, operationId, key)
  return found === null ? { key, operationId } : new Replayed(found.answered)
}

export class MissingKey extends Error {}
