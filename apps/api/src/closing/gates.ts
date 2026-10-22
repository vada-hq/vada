import { koreanDateOf, type ErrorCode } from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import type { Db } from '../db/types.js'
import { nextPeriodOf } from './carryover.js'
import { closingFiguresOf } from './figures.js'
import { isPeriodClosed } from './lock.js'
import type { ClosingPeriod } from './period.js'
import { feePendingOf } from './pending.js'

type Reader = Pick<Db, 'select'>

// 공개와 다시 열기가 되는지의 판단은 이 파일 하나다. 쓰기(publish.ts)는 막는 코드를 던지고, 읽기(queries.ts)는 같은 판단으로 actions를 낸다.
// 순서는 상태(이미 공개) → 기간이 끝났나 → 이전 기간 → 남은 돈 → 행사 완료다.

// 공개를 막는 첫 코드(없으면 null)와 남은 돈. 남은 돈은 결산서 화면과 같은 계산이다.
export async function publishGateOf(
  db: Reader,
  actor: Actor,
  period: ClosingPeriod,
  now: Date,
): Promise<{ blocker: ErrorCode | null; remaining: number }> {
  const stop = (blocker: ErrorCode, remaining = 0) => ({ blocker, remaining })
  if (await isPeriodClosed(db, actor, period.id)) return stop('CLOSING_PUBLISHED')
  if (koreanDateOf(now) <= period.endsOn) return stop('PERIOD_NOT_ENDED')
  if (period.previousPeriodId && !(await isPeriodClosed(db, actor, period.previousPeriodId)))
    return stop('PREVIOUS_PERIOD_OPEN')
  const { numbers } = await closingFiguresOf(db, actor, period)
  if (numbers.remaining < 0) return stop('CLOSING_NEGATIVE', numbers.remaining)
  // 끝 날짜가 이 기간 안이거나 미정인 행사의 입금이 아직 수입에 없다(DEC-68). 뒤 기간 행사의 입금은 선수금이라 막지 않는다.
  if ((await feePendingOf(db, actor, period)).blocking.length > 0)
    return stop('FEE_INCOME_PENDING', numbers.remaining)
  return { blocker: null, remaining: numbers.remaining }
}

// 다시 열기를 막는 첫 코드(없으면 null). 공개 전이거나 다음 기간 결산이 공개됐으면 막힌다.
export async function reopenGateOf(
  db: Reader,
  actor: Actor,
  period: ClosingPeriod,
): Promise<ErrorCode | null> {
  if (!(await isPeriodClosed(db, actor, period.id))) return 'CLOSING_NOT_PUBLISHED'
  const next = await nextPeriodOf(db, actor, period.id)
  if (next && (await isPeriodClosed(db, actor, next.id))) return 'NEXT_PERIOD_CLOSED'
  return null
}
