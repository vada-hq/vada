import { and, eq, isNull, sql } from 'drizzle-orm'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import { REGISTRATION_RETENTION_DAYS } from '@vada/contracts'
import { registrations } from '../db/schema.js'

type Database = Pick<PgDatabase<PgQueryResultHKT>, 'update'>

// 행사 끝(끝 일시, 없으면 시작 일시)에서 보관 기간이 지난 신청의 개인 칸을 지운다. 취소한 신청은 취소할 때 이미 지웠다.
// formId를 주면 그 참가 신청만 본다. 신청 하나를 다루는 요청이 먼저 불러, 실행기가 늦어도 응답에 나가지 않게 한다.
export async function purgeExpired(db: Database, formId?: string) {
  const rows = await db.update(registrations)
    .set({ tokenHash: null, name: null, studentId: null, phone: null, purgedAt: sql`now()` })
    .where(and(isNull(registrations.purgedAt), formId === undefined ? undefined : eq(registrations.formId, formId),
      sql`${registrations.formId} IN (SELECT f.id FROM registration_forms f
        JOIN events e ON e.organization_id = f.organization_id AND e.id = f.event_id
        WHERE coalesce(e.ends_at, e.starts_at) + make_interval(days => ${REGISTRATION_RETENTION_DAYS}) <= now())`))
    .returning({ id: registrations.id })
  return rows.length
}

type Options = { onFailure?: () => void }
// 서버가 켜질 때와 그 뒤 일정 간격마다 지운다. Render 무료 서버가 잠들면 멈췄다가 깨어나 켜질 때 다시 돈다.
export function createRegistrationPurger(db: Database, { onFailure = () => console.error('REGISTRATION_PURGE_FAILED') }: Options = {}) {
  let running: Promise<void> | null = null
  // 이미 도는 중이면 그 실행을 돌려준다. 오류 원문은 남기지 않는다.
  function run(): Promise<void> {
    running ??= purgeExpired(db).then(() => undefined, () => onFailure()).finally(() => { running = null })
    return running
  }
  return {
    run,
    start(intervalMs = 3_600_000) {
      void run()
      const timer = setInterval(() => { void run() }, intervalMs)
      timer.unref?.()
      return () => clearInterval(timer)
    },
  }
}
