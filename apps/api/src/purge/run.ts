import { sql } from 'drizzle-orm'
import type { Db, Tx } from '../db/types.js'
import { purgeAgreements } from '../agreement/service.js'
import { purgeSessions } from '../auth/session-purge.js'
import { purgeReceipts } from '../commands/receipt.js'
import { purgeDuesStudentIds } from '../fee-payments/purge.js'
import { reportBackgroundFailure } from '../http/on-error.js'
import { purgeAccessLogs, purgeRegistrations } from '../registrations/purge.js'

// 두 서버가 겹쳐 돌 때(무중단 배포) 하나만 돌리는 PostgreSQL advisory lock의 번호. 이 일 하나만 쓴다.
const PURGE_LOCK_KEY = 70_007_005
const MINUTES_PER_HOUR = 60
const MS_PER_MINUTE = 60_000
const PURGE_INTERVAL_MS = MINUTES_PER_HOUR * MS_PER_MINUTE

type Lock = (tx: Tx) => Promise<boolean>

// 거래가 끝나면 풀리는 잠금을 시도한다. 이미 다른 실행이 쥐고 있으면 기다리지 않고 false다.
const tryPurgeLock: Lock = async tx => {
  const result = await tx.execute(
    sql`SELECT pg_try_advisory_xact_lock(${PURGE_LOCK_KEY}) AS locked`,
  )
  const rows = Array.isArray(result) ? result : (result as { rows?: unknown[] }).rows
  return (rows?.[0] as { locked?: boolean } | undefined)?.locked === true
}

// 기한이 지난 개인정보와 열람 기록, 만료된 세션과 3개월이 지난 세션의 IP·브라우저 정보, 24시간이 지난 명령 영수증,
// 탈퇴하고 1년이 지난 동의 기록을 지운다(DEC-55, DEC-56, DEC-84). 같은 일을 두 번 해도 같다.
// 잠금을 다른 실행이 쥐고 있으면 건너뛰고 false를 돌려준다.
export async function runPurge(db: Db, now: Date, lock: Lock = tryPurgeLock) {
  return db.transaction(async tx => {
    if (!(await lock(tx))) return false
    await purgeRegistrations(tx, now)
    await purgeDuesStudentIds(tx, now)
    await purgeAccessLogs(tx, now)
    await purgeSessions(tx, now)
    await purgeReceipts(tx, now)
    await purgeAgreements(tx, now)
    return true
  })
}

// 서버 시작 때 한 번, 그 뒤 1시간마다 돈다. 실패는 요청 밖이라 보고만 하고 서버는 멈추지 않는다. 돌려주는 함수로 멈춘다.
export function startPurge(
  db: Db,
  options: { clock?: () => Date; intervalMs?: number; lock?: Lock } = {},
) {
  const clock = options.clock ?? (() => new Date())
  const once = async () => {
    try {
      await runPurge(db, clock(), options.lock)
    } catch (error) {
      reportBackgroundFailure('purge', error)
    }
  }
  void once()
  const timer = setInterval(() => void once(), options.intervalMs ?? PURGE_INTERVAL_MS)
  // 이 타이머만 남아 프로세스를 붙잡지 않는다.
  timer.unref()
  return () => clearInterval(timer)
}
