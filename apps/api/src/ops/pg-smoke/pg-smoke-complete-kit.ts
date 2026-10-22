import type { Actor } from '../../access/actor.js'
import type { Db } from '../../db/types.js'
import { createRecord } from '../../records/records.js'
import { completeEvent } from '../../settlement/complete.js'
import type { SmokeConnection } from './pg-smoke-connection.js'
import {
  createdCouncil,
  fail,
  googleUser,
  memberIdOf,
  unexpectedFailures,
  type SmokeContext,
} from './pg-smoke-kit.js'
import { outcomeProblem, raceHolding, warmed } from './pg-smoke-money-kit.js'

// 행사 완료와 겹치는 쓰기 사례(pg-smoke-complete-cases.ts)가 같이 쓰는 틀: 학생회 하나, 시작한 행사, 완료를 쥔 채 기다리는 순서 강제.
export const PAIR = 2
const DAY_MS = 86_400_000
const WIDE_PERIOD = { startsOn: '2000-01-01', endsOn: '2099-12-31' }

export type World = { main: SmokeConnection; context: SmokeContext; leader: Actor; finance: Actor }

const actorOf = (memberId: string, councilId: string, finance: boolean): Actor => ({
  memberId,
  councilId,
  cohortId: memberId,
  membershipId: memberId,
  councilRank: finance ? null : 'president',
  departments: finance ? [{ departmentId: memberId, role: 'finance', rank: null }] : [],
})

export async function worldOf(
  main: SmokeConnection,
  context: SmokeContext,
  host: string,
): Promise<World> {
  await googleUser(main.db, host)
  const councilId = await createdCouncil(main.db, context, host, `점검 ${host} 학생회`)
  const memberId = await memberIdOf(main.db, host)
  await main.db.transaction(tx =>
    createRecord(tx, {
      kind: 'fiscal_period',
      councilId,
      actor: memberId,
      values: { name: '점검 기간', ...WIDE_PERIOD },
    }),
  )
  return {
    main,
    context,
    leader: actorOf(memberId, councilId, false),
    finance: actorOf(memberId, councilId, true),
  }
}

// 이미 시작한 행사 하나
export const newEvent = (world: World) =>
  world.main.db.transaction(tx =>
    createRecord(tx, {
      kind: 'event',
      councilId: world.leader.councilId,
      actor: world.leader.memberId,
      values: { name: '점검 행사', startsAt: new Date(world.context.now.getTime() - DAY_MS) },
    }),
  )

export const make = (
  world: World,
  kind:
    | 'request'
    | 'line_item'
    | 'approval'
    | 'expense'
    | 'payment_line'
    | 'evidence'
    | 'registration_form'
    | 'registration',
  values: Record<string, unknown>,
) =>
  world.main.db.transaction(tx =>
    createRecord(tx, {
      kind,
      councilId: world.leader.councilId,
      actor: world.leader.memberId,
      values,
    }),
  )

export const completeAs = (db: Db, world: World, eventId: string, hold?: () => Promise<void>) =>
  db.transaction(async tx => {
    const done = await completeEvent(
      tx,
      world.leader,
      { eventId, now: world.context.now },
      { reason: null },
    )
    await hold?.()
    return done
  })

// 완료가 행사 행을 쥔 채 기다리는 동안 다른 쓰기가 들어온다: 완료가 끝난 값을 읽어 EVENT_COMPLETED여야 하고 아무것도 쓰지 않는다.
export async function completeFirst(
  open: () => SmokeConnection,
  world: World,
  race: { eventId: string; other: (db: Db) => Promise<unknown>; blocked?: string },
) {
  const { eventId, other, blocked = 'EVENT_COMPLETED' } = race
  const [first, second] = (await warmed(open, PAIR)) as [Db, Db]
  const results = await raceHolding(
    hold => completeAs(first, world, eventId, hold),
    [() => other(second)],
  )
  const bad = unexpectedFailures(results, new Set([blocked]))
  if (bad.length > 0) return fail('예상하지 못한 오류로 끝났다', bad[0])
  return outcomeProblem(results, ['ok', blocked])
}

export const count = async (main: SmokeConnection, sql: string, params: unknown[] = []) =>
  Number((await main.sql.unsafe(sql, params as never[]))[0]?.n)
