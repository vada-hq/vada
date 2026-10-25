import { FLOW_USER_HEADER } from './flow-session.js'
import type { ScenarioClock } from './scenario-clock.js'

type App = { request: (input: string, init?: RequestInit) => Response | Promise<Response> }

// HTTP 드라이버: 포트를 열지 않고 앱의 request로 보낸다. 공통 가드(같은 출처, JSON), 계약 검사, 경로의 거래를 모두 지난다.
// 요청마다 시계를 맞춘 뒤 보낸다. log에는 '메서드 경로 상태'가 순서대로 남는다(흐름이 어디까지 갔는지 보려는 것).
export function createDriver({
  app,
  clock,
  origin,
}: {
  app: App
  clock: ScenarioClock
  origin: string
}) {
  const log: string[] = []
  const send = async (userId: string, method: string, path: string, body?: unknown) => {
    await clock.sync()
    const response = await app.request(path, {
      method,
      headers: {
        [FLOW_USER_HEADER]: userId,
        ...(method === 'GET' ? {} : { 'Content-Type': 'application/json', Origin: origin }),
      },
      ...(method === 'GET' ? {} : { body: JSON.stringify(body) }),
    })
    log.push(`${method} ${path} ${response.status}`)
    return response
  }
  return {
    log,
    now: clock.now,
    travelTo: clock.travelTo,
    advanceBy: clock.advanceBy,
    as: (userId: string) => ({
      get: (path: string) => send(userId, 'GET', path),
      post: (path: string, body: unknown) => send(userId, 'POST', path, body),
    }),
  }
}
type FlowDriver = ReturnType<typeof createDriver>
export type FlowCaller = ReturnType<FlowDriver['as']>
