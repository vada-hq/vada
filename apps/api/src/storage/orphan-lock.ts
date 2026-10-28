import type postgres from 'postgres'

// runPurge의 거래 잠금과 번호가 다르다. 저장소를 기다릴 때 DB 거래·행 잠금은 잡지 않는다.
const OBJECT_PURGE_LOCK_KEY = 70_021_010
// 목록과 삭제가 오래 걸려도 클라이언트의 자동 종료가 실행 중 잠금을 풀지 않게 한다.
const CONNECTION_OPTIONS = { max: 1, idle_timeout: 0, max_lifetime: 0 }
export type ObjectPurgeLock = (work: (signal: AbortSignal) => Promise<void>) => Promise<boolean>

// 요청용 풀과 별개인 전용 클라이언트다. 세션 종료로 잠금을 풀어 해제 질의 실패·끊긴 예약 연결의 재사용을 피한다.
export function createObjectPurgeLock(
  open: (options: postgres.Options<Record<string, never>>) => Pick<postgres.Sql, 'unsafe' | 'end'>,
): ObjectPurgeLock {
  let active = false
  return async work => {
    if (active) return false
    active = true
    try {
      const controller = new AbortController()
      const client = open({
        ...CONNECTION_OPTIONS,
        // postgres.js는 소켓 오류와 종료를 onclose로 알린다. 재연결되어도 이 실행은 재개하지 않는다.
        onclose: () => controller.abort(new Error('STORAGE_LOCK_LOST')),
      })
      try {
        const rows = await client.unsafe<{ locked: boolean }[]>(
          'SELECT pg_try_advisory_lock($1) AS locked',
          [OBJECT_PURGE_LOCK_KEY],
        )
        if (rows[0]?.locked === false) return false
        if (rows[0]?.locked !== true) throw new Error('STORAGE_LOCK_FAILED')
        controller.signal.throwIfAborted()
        await work(controller.signal)
        controller.signal.throwIfAborted()
        return true
      } finally {
        await client.end({ timeout: 0 })
      }
    } finally {
      active = false
    }
  }
}
