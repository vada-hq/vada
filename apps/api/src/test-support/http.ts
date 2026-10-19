import type { SessionReader } from '../auth/require-session.js'

export const ORIGIN = 'http://127.0.0.1:5180'

// 시험용 세션: 요청 머리 x-test-user가 로그인한 계정이다. 없으면 로그인하지 않은 요청이다.
export const testSession: SessionReader = headers => {
  const userId = headers.get('x-test-user')
  return Promise.resolve(userId ? { user: { id: userId } } : null)
}

type App = { request: (input: string, init?: RequestInit) => Response | Promise<Response> }
// 공통 가드를 지나는 요청(같은 출처, JSON)을 보낸다. userId를 빼면 로그인하지 않은 요청이다.
export function caller(app: App) {
  const as = (userId?: string): Record<string, string> => (userId ? { 'x-test-user': userId } : {})
  return {
    get: (path: string, userId?: string) => app.request(path, { headers: as(userId) }),
    post: (path: string, body: unknown, userId?: string) =>
      app.request(path, {
        method: 'POST',
        body: JSON.stringify(body),
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
