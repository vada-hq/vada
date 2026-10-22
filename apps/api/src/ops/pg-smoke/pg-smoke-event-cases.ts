import { sql } from 'drizzle-orm'
import { chatRoom } from '../../db/schema.js'
import type { Actor } from '../../access/actor.js'
import type { Db, Tx } from '../../db/types.js'
import { createEvent, setEventOwner } from '../../events/service.js'
import { changeTaskStatus, createTask, updateTask } from '../../tasks/service.js'
import type { SmokeConnection } from './pg-smoke-connection.js'
import {
  changer,
  createdCouncil,
  fail,
  googleUser,
  inviteCodeOf,
  HOLD_MS,
  joined,
  memberIdOf,
  pass,
  pause,
  unexpectedFailures,
  type Who,
  withConnections,
  type SmokeCase,
  type SmokeContext,
} from './pg-smoke-kit.js'

// 행사(기능 006)를 둘러싼 동시 처리 사례 n. 서비스 함수를 라우트와 같은 잠금(inCouncilChange)으로 불러 운영과 같은 길을 탄다.

// 사례 n: 행사 책임자 바꾸기와 전 책임자의 행사 업무 쓰기를 동시에 ----------------------

// 책임자 바꾸기와 업무 쓰기는 같은 학생회 행 잠금으로 줄을 선다. 쓰는 쪽은 잠금 뒤에 책임자를 다시 읽어 403으로 끝나야 한다.
// 잠금이 없으면 책임자를 바꾼 뒤에도 전 책임자의 쓰기가 지나가 그 사람 이름으로 새 판이 남는다.
const OWNER_CHANGE_EXPECTED = new Set(['FORBIDDEN'])
const N = { host: 'smoke-n-host' }
const N_ROUNDS = 6
const WRITERS = 4

type Run = { open: () => SmokeConnection; main: SmokeConnection; context: SmokeContext }

// 책임자 바꾸기 거래: 바꾼 직후의 DB 시각을 받아 두고 신호를 보낸 뒤, 잠금을 쥔 채 잠시 기다린다.
async function changeOwnerHolding(
  db: Db,
  run: Run,
  target: { host: Who; eventId: string; ownerId: string; changed: () => void },
) {
  let changedAt = ''
  await changer(
    db,
    run.context,
    target.host,
  )('event.set_owner', async (tx, actor) => {
    await setEventOwner(
      tx,
      actor,
      { eventId: target.eventId, now: run.context.now },
      { ownerId: target.ownerId },
    )
    const [row] = await tx
      .select({ at: sql<string>`clock_timestamp()::text` })
      .from(chatRoom)
      .limit(1)
    changedAt = row!.at
    target.changed()
    await pause(HOLD_MS)
  })
  return changedAt
}

// 책임자가 전 책임자인 행사와 그 행사의 업무 하나를 만든다.
async function eventWithTask(run: Run, host: Who, round: number, ownerId: string) {
  const { main, context } = run
  return changer(
    main.db,
    context,
    host,
  )('event.create', async (tx, actor) => {
    const created = await createEvent(
      tx,
      actor,
      { name: `행사 ${round}`, startsAt: null, endsAt: null, place: null, ownerId },
      context.now,
    )
    const { task } = await createTask(
      tx,
      actor,
      {
        title: `업무 ${round}`,
        body: null,
        dueDate: null,
        departmentId: null,
        assigneeId: null,
        eventId: created.id,
      },
      context.now,
    )
    return { eventId: created.id, taskId: task.id }
  })
}

type Write = (tx: Tx, actor: Actor, target: { taskId: string; now: Date }) => Promise<unknown>
const writes: Write[] = [
  (tx, actor, target) =>
    updateTask(tx, actor, target, { title: '고침', body: null, dueDate: null }),
  (tx, actor, target) => changeTaskStatus(tx, actor, target, { status: 'done' }),
]

async function ownerRound(run: Run, round: number, host: Who) {
  const { open, main, context } = run
  const guest = `smoke-n-guest${round}`
  await googleUser(main.db, guest)
  await joined(main.db, context, guest, await inviteCodeOf(main.db, host.councilId))
  const guestMember = await memberIdOf(main.db, guest)
  const hostMember = await memberIdOf(main.db, host.userId)
  const { eventId, taskId } = await eventWithTask(run, host, round, guestMember)
  let changed = () => {}
  const afterChange = new Promise<void>(resolve => {
    changed = resolve
  })
  // 쓰는 쪽 연결은 미리 열어 둔다. 책임자 바꾸기가 잠금을 쥔 뒤에 쓰기가 들어오도록 순서를 강제한다.
  const writerDbs = Array.from({ length: WRITERS }, () => open().db)
  await Promise.all(writerDbs.map(db => db.execute(sql`SELECT 1`)))
  const changing = changeOwnerHolding(open().db, run, {
    host,
    eventId,
    ownerId: hostMember,
    changed,
  })
  // 바꾸기가 실패로 끝나도 쓰는 쪽이 영영 기다리지 않게 한다.
  void changing.then(changed, changed)
  const target = { taskId, now: context.now }
  const guestWho = { userId: guest, councilId: host.councilId }
  const writing = writerDbs.map(async (db, index) => {
    await afterChange
    return changer(
      db,
      context,
      guestWho,
    )('council.view', (tx, actor) => {
      const write = writes[index % writes.length]!
      return write(tx, actor, target)
    })
  })
  const results = await Promise.allSettled([changing, ...writing])
  const bad = unexpectedFailures(results, OWNER_CHANGE_EXPECTED)
  if (bad.length > 0) return fail('책임자 바꾸기나 업무 쓰기가 예상하지 못한 오류로 끝났다', bad[0])
  const change = results[0]
  if (change.status !== 'fulfilled') return fail('책임자 바꾸기가 끝나지 않았다')
  const [left] = await main.sql.unsafe(
    `SELECT count(*)::text AS n FROM record_version
      WHERE record_id = $1 AND changed_by = $2::uuid AND lower(valid) >= $3::timestamptz`,
    [taskId, guestMember, change.value],
  )
  return left?.n === '0'
    ? undefined
    : fail(`${round}번째: 책임자를 바꾼 뒤에 전 책임자가 쓴 판이 있다`)
}

export const ownerChangeAndWriteCase: SmokeCase = {
  name: '행사 책임자 바꾸기와 전 책임자의 행사 업무 쓰기를 동시에',
  run: context =>
    withConnections(context, async open => {
      const main = open()
      await googleUser(main.db, N.host)
      const councilId = await createdCouncil(main.db, context, N.host, '점검 n 학생회')
      for (let round = 0; round < N_ROUNDS; round++) {
        const problem = await ownerRound({ open, main, context }, round, {
          userId: N.host,
          councilId,
        })
        if (problem) return problem
      }
      return pass(`${N_ROUNDS}번 모두 책임자를 바꾼 뒤에 전 책임자가 쓴 업무 판이 없다`)
    }),
}
