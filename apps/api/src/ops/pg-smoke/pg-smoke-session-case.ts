import { eq } from 'drizzle-orm'
import { errorCodeOf } from '../../db/error-code.js'
import { sessions } from '../../db/schema.js'
import type { Db } from '../../db/types.js'
import { joinCouncil } from '../../invites/service.js'
import {
  createdCouncil,
  fail,
  googleUser,
  inviteCodeOf,
  pass,
  withConnections,
  type SmokeCase,
  type SmokeContext,
  type SmokeVerdict,
} from './pg-smoke-kit.js'

// 사례 e: 들어오기 거래가 users 행을 잠근 동안 세션 행 넣기 -------------------------------

const ONE_HOUR_MS = 3_600_000

function gate() {
  let release = () => {}
  const released = new Promise<void>(resolve => {
    release = resolve
  })
  return { released, release }
}

async function within<T>(promise: Promise<T>, ms: number) {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<{ timedOut: true }>(resolve => {
    timer = setTimeout(() => resolve({ timedOut: true }), ms)
  })
  try {
    return await Promise.race([
      promise.then(value => ({ timedOut: false as const, value })),
      timeout,
    ])
  } finally {
    clearTimeout(timer)
  }
}

// 세션 행을 넣는다. 실패해도 던지지 않고 값으로 돌려줘, 막혔다가 끝나는 쓰기를 나중에 기다릴 수 있다.
const insertSession = (db: Db, context: SmokeContext, userId: string) =>
  db
    .insert(sessions)
    .values({
      id: 'smoke-e-session',
      userId,
      token: 'smoke-e-token',
      expiresAt: new Date(context.now.getTime() + ONE_HOUR_MS),
    })
    .then(
      () => 'done' as const,
      (error: unknown) => ({ error }),
    )

type Probe = Awaited<ReturnType<typeof insertSession>>

// 들어오기 거래나 세션 쓰기가 잘못 끝났으면 그 판정을, 아니면 undefined를 돌려준다.
function sessionFailure(
  held: PromiseSettledResult<unknown>,
  first: Awaited<ReturnType<typeof within<Probe>>>,
  limitMs: number,
): SmokeVerdict | undefined {
  if (held.status === 'rejected')
    return fail('들어오기 거래가 끝나지 못했다', errorCodeOf(held.reason) || 'ERROR')
  if (first.timedOut)
    return fail(`세션 쓰기가 ${limitMs}ms 안에 끝나지 않았다(잠금이 막는다)`, 'SESSION_BLOCKED')
  if (first.value !== 'done')
    return fail('세션 쓰기가 실패했다', errorCodeOf(first.value.error) || 'ERROR')
  return undefined
}

const E = { host: 'smoke-e-host', guest: 'smoke-e-guest' }

export const sessionDuringJoinCase: SmokeCase = {
  name: '들어오기 거래가 users 행을 잠근 동안 다른 연결이 세션 행 넣기',
  run: context =>
    withConnections(context, async open => {
      const main = open()
      await googleUser(main.db, E.host)
      await googleUser(main.db, E.guest)
      const councilId = await createdCouncil(main.db, context, E.host, '점검 e 학생회')
      const code = await inviteCodeOf(main.db, councilId)
      const [locker, prober] = [open(), open()]
      const locked = gate()
      const release = gate()
      // 들어오기는 linkMember로 users 행을 FOR NO KEY UPDATE로 잠근다. 커밋을 미뤄 그 잠금을 쥐고 있는다.
      const held = locker.db.transaction(async tx => {
        await joinCouncil(tx, E.guest, { code }, context.now)
        locked.release()
        await release.released
      })
      try {
        // 잠금을 쥐기 전에 들어오기가 실패하면 held가 거절되어 여기서 던진다.
        await Promise.race([locked.released, held])
        const startedAt = Date.now()
        const probe = insertSession(prober.db, context, E.guest)
        const first = await within(probe, context.sessionLimitMs)
        const elapsed = Date.now() - startedAt
        // 막혔든 아니든 잠금을 놓아 거래를 끝낸다. 막힌 쓰기도 이때 끝난다.
        release.release()
        const [heldResult] = await Promise.allSettled([held, probe])
        const problem = sessionFailure(heldResult, first, context.sessionLimitMs)
        if (problem) return problem
        const rows = await prober.db
          .select({ id: sessions.id })
          .from(sessions)
          .where(eq(sessions.userId, E.guest))
        return rows.length === 1
          ? pass(`세션 쓰기가 잠금 속에서 ${elapsed}ms에 끝났다`)
          : fail(`세션 행 ${rows.length}개`)
      } finally {
        release.release()
      }
    }),
}
