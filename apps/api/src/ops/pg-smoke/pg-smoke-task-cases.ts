import { sql } from 'drizzle-orm'
import { TASK_STATUSES, type TaskStatus } from '@vada/contracts'
import { syncRooms } from '../../chat/rooms.js'
import { chatRoom } from '../../db/schema.js'
import type { Db } from '../../db/types.js'
import { assignTask, changeTaskStatus, createTask } from '../../tasks/service.js'
import { removeMember } from '../../team/service.js'
import type { SmokeConnection } from './pg-smoke-connection.js'
import {
  changer,
  createdCouncil,
  fail,
  googleUser,
  inviteCodeOf,
  joined,
  memberIdOf,
  pass,
  unexpectedFailures,
  versionsOf,
  withConnections,
  type SmokeCase,
  type SmokeContext,
} from './pg-smoke-kit.js'

// 업무(기능 004)를 둘러싼 동시 처리 사례 i, j. 서비스 함수를 라우트와 같은 잠금(inCouncilChange)으로 불러 운영과 같은 길을 탄다.

type Who = { userId: string; councilId: string }

const pause = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

async function taskIn(db: Db, context: SmokeContext, who: Who, title: string) {
  const { task } = await changer(
    db,
    context,
    who,
  )('task.manage', (tx, actor) =>
    createTask(
      tx,
      actor,
      { title, body: null, dueDate: null, departmentId: null, assigneeId: null },
      context.now,
    ),
  )
  return task.id
}

// 사례 i: 맡기기와 그 사람 내보내기를 동시에 ----------------------------------------

// 담당자 확인은 소속 줄을 잠그고, 내보내기는 학생회 행 잠금 아래에서 줄을 닫는다. 잠금이 없으면 내보낸 뒤에도 맡기기가 지나가
// 내보낸 사람이 새 담당자가 되거나 그 사람에게 배정 알림이 남는다. 맡기기가 먼저면 업무는 그 사람 것으로 남아도 된다(내보낸 시각보다 앞선다).
const ASSIGN_REMOVE_EXPECTED = new Set(['TASK_ASSIGNEE_INVALID'])
const I = { host: 'smoke-i-host' }
const I_ROUNDS = 6
const ASSIGNERS = 3
const HOLD_MS = 300

// 내보낸 시각(removedAt) 이후에 생긴 것: 그 사람이 담당자가 된 판, 그 사람에게 간 배정 알림
async function leftoverAfter(main: SmokeConnection, guestMember: string, removedAt: string) {
  const [row] = await main.sql.unsafe(
    `SELECT
       (SELECT count(*) FROM record_version
         WHERE data->>'assignee_id' = $1 AND lower(valid) >= $2::timestamptz)::text AS assigned,
       (SELECT count(*) FROM notification
         WHERE recipient_id = $1::uuid AND type = 'assignment' AND notified_at >= $2::timestamptz)::text AS notices`,
    [guestMember, removedAt],
  )
  return row
}

type Run = { open: () => SmokeConnection; main: SmokeConnection; context: SmokeContext }

// 내보내기 거래: 줄을 지운 직후의 DB 시각(removedAt)을 받아 두고 신호를 보낸 뒤, 잠금을 쥔 채 잠시 기다린다.
async function removeHolding(
  db: Db,
  run: Run,
  host: Who,
  target: { guestMember: string; deleted: () => void },
) {
  let removedAt = ''
  await changer(
    db,
    run.context,
    host,
  )('member.manage', async (tx, actor) => {
    await removeMember(tx, actor, target.guestMember)
    await syncRooms(tx, actor)
    const [row] = await tx
      .select({ at: sql<string>`clock_timestamp()::text` })
      .from(chatRoom)
      .limit(1)
    removedAt = row!.at
    target.deleted()
    await pause(HOLD_MS)
  })
  return removedAt
}

async function assignRound(run: Run, round: number, host: Who) {
  const { open, main, context } = run
  const guest = `smoke-i-guest${round}`
  await googleUser(main.db, guest)
  await joined(main.db, context, guest, await inviteCodeOf(main.db, host.councilId))
  const guestMember = await memberIdOf(main.db, guest)
  const taskId = await taskIn(main.db, context, host, `업무 ${round}`)
  let deleted = () => {}
  const afterDelete = new Promise<void>(resolve => {
    deleted = resolve
  })
  // 맡기는 쪽 연결은 미리 열어 둔다. 내보내기가 줄을 지워 학생회 행 잠금을 쥔 뒤에 맡기기가 들어오도록 순서를 강제한다.
  const assignerDbs = Array.from({ length: ASSIGNERS }, () => open().db)
  await Promise.all(assignerDbs.map(db => db.execute(sql`SELECT 1`)))
  const removing = removeHolding(open().db, run, host, { guestMember, deleted })
  // 내보내기가 실패로 끝나도 맡기는 쪽이 영영 기다리지 않게 한다.
  void removing.then(deleted, deleted)
  const assigning = assignerDbs.map(async db => {
    await afterDelete
    return changer(
      db,
      context,
      host,
    )('task.assign', (tx, actor) =>
      assignTask(tx, actor, { taskId, now: context.now }, { assigneeId: guestMember }),
    )
  })
  const results = await Promise.allSettled([removing, ...assigning])
  const bad = unexpectedFailures(results, ASSIGN_REMOVE_EXPECTED)
  if (bad.length > 0) return fail('맡기기나 내보내기가 예상하지 못한 오류로 끝났다', bad[0])
  const removal = results[0]
  if (removal.status !== 'fulfilled') return fail('내보내기가 끝나지 않았다')
  const left = await leftoverAfter(main, guestMember, removal.value)
  if (left?.assigned !== '0') return fail(`${round}번째: 내보낸 뒤에 담당자가 된 업무가 있다`)
  if (left.notices !== '0') return fail(`${round}번째: 내보낸 뒤의 배정 알림이 남았다`)
  return undefined
}

export const assignAndRemoveCase: SmokeCase = {
  name: '업무 맡기기와 그 사람 내보내기를 동시에',
  run: context =>
    withConnections(context, async open => {
      const main = open()
      await googleUser(main.db, I.host)
      const councilId = await createdCouncil(main.db, context, I.host, '점검 i 학생회')
      for (let round = 0; round < I_ROUNDS; round++) {
        const problem = await assignRound({ open, main, context }, round, {
          userId: I.host,
          councilId,
        })
        if (problem) return problem
      }
      return pass(`${I_ROUNDS}번 모두 내보낸 뒤에 새로 맡은 업무와 배정 알림이 없다`)
    }),
}

// 사례 j: 같은 업무에 상태 바꾸기를 동시에 ---------------------------------------------

const J = { host: 'smoke-j-host' }
const CHANGERS = 9
const MIN_VERSIONS = 2

// 학생회 행 잠금이 쓰기 거래를 줄 세운다. 잠금이 없으면 두 거래가 같은 열린 판을 닫아 판이 둘 열리거나 겹친다.
export const changeStatusTogetherCase: SmokeCase = {
  name: '같은 업무에 상태 바꾸기를 동시에',
  run: context =>
    withConnections(context, async open => {
      const main = open()
      await googleUser(main.db, J.host)
      const councilId = await createdCouncil(main.db, context, J.host, '점검 j 학생회')
      const who = { userId: J.host, councilId }
      const taskId = await taskIn(main.db, context, who, '상태 업무')
      // 연결을 미리 열고 한 신호로 함께 출발시킨다.
      const dbs = Array.from({ length: CHANGERS }, () => open().db)
      await Promise.all(dbs.map(db => db.execute(sql`SELECT 1`)))
      let go = () => {}
      const start = new Promise<void>(resolve => {
        go = resolve
      })
      const running = dbs.map(async (db, index) => {
        const status: TaskStatus = TASK_STATUSES[index % TASK_STATUSES.length]!
        await start
        return changer(
          db,
          context,
          who,
        )('task.status', (tx, actor) =>
          changeTaskStatus(tx, actor, { taskId, now: context.now }, { status }),
        )
      })
      go()
      const results = await Promise.allSettled(running)
      const bad = unexpectedFailures(results, new Set())
      if (bad.length > 0) return fail('상태 바꾸기가 예상하지 못한 오류로 끝났다', bad[0])
      const versions = await versionsOf(main.sql, taskId)
      if (versions.count < MIN_VERSIONS)
        return fail('판이 만들어지지 않았다(시험이 아무것도 보지 못했다)')
      if (versions.open !== 1 || !versions.lastOpen)
        return fail(`열린 판이 ${versions.open}개다(마지막 판만 열려 있어야 한다)`)
      const [overlap] = await main.sql.unsafe(
        `SELECT count(*)::text AS n FROM record_version a JOIN record_version b
           ON a.record_id = b.record_id AND a.version_no < b.version_no AND a.valid && b.valid
          WHERE a.record_id = $1`,
        [taskId],
      )
      if (overlap?.n !== '0') return fail('판의 유효 기간이 겹친다')
      const [current] = await main.sql.unsafe('SELECT status FROM task WHERE id = $1', [taskId])
      return versions.last.status === current?.status
        ? pass(`상태 ${CHANGERS}번을 함께 바꿔도 판이 겹치지 않고 마지막 판이 지금 상태와 같다`)
        : fail('마지막 판의 상태가 지금 상태와 다르다')
    }),
}
