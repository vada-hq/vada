import { setTimeout } from 'node:timers/promises'
import type { ServerType } from '@hono/node-server'
import type { PendingPush } from './push/pending.js'

const SERVER_CLOSE_LIMIT_MS = 10_000
const PUSH_SHUTDOWN_LIMIT_MS = 5_000
export const DB_SHUTDOWN_TIMEOUT_SECONDS = 5

type Wait = (ms: number, signal?: AbortSignal) => Promise<void>
const wait: Wait = async (ms, signal) => {
  await setTimeout(ms, undefined, { signal })
}
type ShutdownServer = {
  close: (callback: NonNullable<Parameters<ServerType['close']>[0]>) => unknown
  closeIdleConnections?: () => void
}
type ShutdownDeps = {
  stopPurge: () => void
  pending: Pick<PendingPush, 'flush' | 'settle'>
  server: ShutdownServer
  client: { end(options: { timeout: number }): Promise<void> }
  stopErrorReporting: () => Promise<void>
}

async function attempt(run: () => void | Promise<void>) {
  try {
    await run()
  } catch {
    // 한 단계가 실패해도 나머지 자원을 정리한다.
  }
}

async function closeServer(server: ShutdownServer, pause: Wait) {
  const controller = new AbortController()
  try {
    const closed = new Promise<void>(resolve => {
      server.close(() => resolve())
    })
    await attempt(() => server.closeIdleConnections?.())
    await Promise.race([
      closed,
      Promise.resolve().then(() => pause(SERVER_CLOSE_LIMIT_MS, controller.signal)),
    ])
  } catch {
    // 닫기나 기다림이 실패해도 나머지 종료 단계는 이어 간다.
  } finally {
    controller.abort()
  }
}

export async function shutdown(deps: ShutdownDeps, pause: Wait = wait) {
  await attempt(deps.stopPurge)
  await attempt(() => deps.pending.flush())
  await closeServer(deps.server, pause)
  await attempt(() => deps.pending.settle(PUSH_SHUTDOWN_LIMIT_MS))
  // 상한 뒤 남은 송신은 DB를 쓰지 않는다. 만료 기기 삭제만 DB가 닫혀 실패할 수 있다.
  await attempt(() => deps.client.end({ timeout: DB_SHUTDOWN_TIMEOUT_SECONDS }))
  await attempt(deps.stopErrorReporting)
}
