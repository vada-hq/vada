import type { Context, Hono } from 'hono'
import openapi from '../../../specs/figma/vada-wireframe/openapi.json' with { type: 'json' }

// 자리를 계약이 만든다.
//
// **216자리를 손으로 쓰지 않는다.** 자리마다 method·path·응답 모양을 다시 적으면
// 그것은 명세를 두 번 적는 일이고, 두 벌은 갈린다 — 이 저장소가 줄곧 피해 온 것이다.
// 여기서 하는 일은 계약이 말한 자리에 **답을 놓는 것**뿐이다.
//
// 그래서 새 자리를 여는 값이 '답 하나'다. 남은 210자리가 되풀이 작업이 되는 것이
// 이 층의 목적이다.

interface Operation {
  operationId: string
  'x-authorize': { area: string; object?: string }
}

const BY_ID = new Map<string, { method: string; path: string; operation: Operation }>()
for (const [path, item] of Object.entries(openapi.paths as Record<string, Record<string, unknown>>)) {
  for (const [method, operation] of Object.entries(item)) {
    BY_ID.set((operation as Operation).operationId, {
      method,
      path,
      operation: operation as Operation,
    })
  }
}

export class NotFound extends Error {}
export class Blocked extends Error {}
/**
 * 같은 사실이 이미 있다.
 *
 * **돌려주는 것은 없다.** 이미 있는 것을 함께 주면 그것이 남의 것을 여는 열쇠가
 * 된다 — 공유 QR과 남의 학번으로 그 사람의 영수증을 받아 갔다(2026-08-31 교차검토).
 */
export class AlreadyExists extends Error {}

/** 답을 내는 자리. 계약이 정한 모양을 돌려주면 된다. */
export type Handler<D> = (c: Context, deps: D) => Promise<unknown>

/**
 * 계약이 든 자리에 답을 붙인다.
 *
 * 계약에 없는 이름을 붙이면 **여기서 멈춘다** — 오타 하나가 조용히 안 열리는 자리가
 * 되는 대신 시작할 때 드러난다.
 */
const ATTACHED = new Set<string>()

/** 답이 붙은 자리들. **찔러 보지 않고 센다** — 실제 404와 안 만든 자리는 구분되지 않는다. */
export function answeredOperationIds(): string[] {
  return [...ATTACHED]
}

export function attach<D>(app: Hono, deps: D, handlers: Record<string, Handler<D>>): void {
  for (const [operationId, handler] of Object.entries(handlers)) {
    const at = BY_ID.get(operationId)
    if (at === undefined) {
      throw new Error(`계약에 '${operationId}'라는 자리가 없습니다.`)
    }
    // 계약의 `{eventId}`를 Hono가 아는 `:eventId`로. 뜻이 같은 두 표기다.
    ATTACHED.add(operationId)
    const honoPath = at.path.replace(/\{([^}]+)\}/g, ':$1')
    app.on(at.method.toUpperCase(), honoPath, async (c) => {
      try {
        return c.json((await handler(c, deps)) as never, 200)
      } catch (error) {
        // **없는 것을 빈 값으로 대신하지 않는다.** 조용한 대체를 하지 않는 것이
        // 이 저장소의 규칙이고 서버도 같은 규칙을 따른다.
        if (error instanceof NotFound) {
          return c.json({ message: error.message }, 404)
        }
        if (error instanceof Blocked) {
          return c.json({ message: error.message }, 422)
        }
        if (error instanceof AlreadyExists) {
          return c.json({ message: error.message }, 409)
        }
        throw error
      }
    })
  }
}

/** 그 자리가 계약의 어디인가. 검사가 견줄 때 쓴다. */
export function routeOf(operationId: string) {
  return BY_ID.get(operationId)
}

/** 계약이 든 모든 자리의 이름. 얼마나 남았는지 세는 데 쓴다. */
export function allOperationIds(): string[] {
  return [...BY_ID.keys()]
}
