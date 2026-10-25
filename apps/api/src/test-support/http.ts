import { randomUUID } from 'node:crypto'
import type { SessionReader } from '../auth/require-session.js'

export const ORIGIN = 'http://127.0.0.1:5180'

// 시험용 세션: 요청 머리 x-test-user가 로그인한 계정이다. 없으면 로그인하지 않은 요청이다.
export const testSession: SessionReader = headers => {
  const userId = headers.get('x-test-user')
  return Promise.resolve(userId ? { user: { id: userId } } : null)
}

// 지출 적기(POST .../expenses)는 명령 번호가 필수다. 시험이 번호를 주지 않으면 요청마다 새 번호를 더한다(재전송 시험만 직접 준다).
// 번호 없는 요청을 보내려면 commandId: undefined를 준다(JSON에서 빠진다).
const EXPENSE_CREATE = /\/organizations\/[^/]+\/expenses$/
const withCommandId = (path: string, body: unknown) =>
  EXPENSE_CREATE.test(path) && typeof body === 'object' && body !== null && !('commandId' in body)
    ? { ...body, commandId: randomUUID() }
    : body

type App = { request: (input: string, init?: RequestInit) => Response | Promise<Response> }
// 공통 가드를 지나는 요청(같은 출처, JSON)을 보낸다. userId를 빼면 로그인하지 않은 요청이다.
export function caller(app: App) {
  const as = (userId?: string): Record<string, string> => (userId ? { 'x-test-user': userId } : {})
  return {
    get: (path: string, userId?: string) => app.request(path, { headers: as(userId) }),
    post: (path: string, body: unknown, userId?: string) =>
      app.request(path, {
        method: 'POST',
        body: JSON.stringify(withCommandId(path, body)),
        headers: { 'Content-Type': 'application/json', Origin: ORIGIN, ...as(userId) },
      }),
  }
}

// 거래 밖에서 읽으면 던지는 DB. 거래가 끝난 뒤에 다시 읽다가 응답이 500이 되는 일(이미 만들어진 뒤의 실패)을 잡는 시험에 쓴다.
export function withoutReadsOutsideTransaction<T extends object>(db: T): T {
  return new Proxy(db, {
    get(target, property) {
      if (property === 'select')
        return () => {
          throw new Error('거래 밖에서 읽었다')
        }
      const value: unknown = Reflect.get(target, property, target)
      return typeof value === 'function'
        ? (value as (...args: unknown[]) => unknown).bind(target)
        : value
    },
  })
}
