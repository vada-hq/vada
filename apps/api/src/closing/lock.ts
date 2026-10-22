import { and, eq, gte, isNotNull, lte, type SQL } from 'drizzle-orm'
import type { Actor } from '../access/actor.js'
import { accountClosing, fiscalPeriod } from '../db/schema.js'
import type { Db, Tx } from '../db/types.js'
import { ApiError } from '../http/errors.js'

type Reader = Pick<Db, 'select'>

// 결산 공개 잠금(DEC-70)은 합계를 바꾸는 쓰기 경로(지출 적기·취소, 수입 적기·취소, 참가비 수입 만들기·취소)가 모두 이 도우미를 부른다.
// 쓰기는 학생회 행 잠금(inCouncilChange) 뒤에 부르므로 공개·다시 열기와 같은 학생회 안에서 한 줄로 선다.
// 행사 완료 잠금(EVENT_COMPLETED)이 먼저이고, 이 확인은 그 뒤에 둔다.

async function publishedWhere(db: Reader, actor: Actor, where: SQL | undefined) {
  const [row] = await db
    .select({ id: accountClosing.id })
    .from(accountClosing)
    .innerJoin(fiscalPeriod, eq(fiscalPeriod.id, accountClosing.fiscalPeriodId))
    .where(
      and(
        eq(fiscalPeriod.councilId, actor.councilId),
        isNotNull(accountClosing.publishedAt),
        where,
      ),
    )
    .limit(1)
  return !!row
}

// 기간 하나가 공개돼 잠겼는가. 읽기(actions)와 쓰기가 같은 판단이다.
export const isPeriodClosed = (db: Reader, actor: Actor, periodId: string) =>
  publishedWhere(db, actor, eq(fiscalPeriod.id, periodId))

// 한국 날짜가 든 기간이 공개돼 잠겼는가. 그 날이 든 기간이 없으면 잠기지 않았다(기간이 없는 실패는 그것을 고르는 쪽이 낸다).
export const isDayClosed = (db: Reader, actor: Actor, day: string) =>
  publishedWhere(db, actor, and(lte(fiscalPeriod.startsOn, day), gte(fiscalPeriod.endsOn, day)))

export async function assertPeriodOpen(tx: Tx, actor: Actor, periodId: string) {
  if (await isPeriodClosed(tx, actor, periodId)) throw new ApiError('PERIOD_CLOSED')
}

export async function assertDayOpen(tx: Tx, actor: Actor, day: string) {
  if (await isDayClosed(tx, actor, day)) throw new ApiError('PERIOD_CLOSED')
}
