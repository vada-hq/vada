import { and, eq } from 'drizzle-orm'
import { chatRoom, record } from '../../db/schema.js'
import type { Db } from '../../db/types.js'
import { sendAs } from '../../chat/send.js'
import { createPurchaseRequest } from '../../purchases/service.js'
import { createTask } from '../../tasks/service.js'
import {
  changer,
  fail,
  memberIdOf,
  pass,
  unexpectedFailures,
  versionsOf,
  withConnections,
  type SmokeCase,
  type SmokeContext,
} from './pg-smoke-kit.js'
import {
  moneyScene,
  outcomeProblem,
  raceHolding,
  warmed,
  type MoneyScene,
} from './pg-smoke-money-kit.js'
import type { SmokeConnection } from './pg-smoke-connection.js'

// 사례 s(기능 015): 같은 업무에 공지를 잇는 보내기와, 같은 업무에 요청을 잇는 내기가 겹친다.
// 업무를 잇는 보내기는 학생회 행을 먼저 잠그고(authorizeChange) 요청 내기도 같은 잠금 뒤에 서므로 한 줄로 선다.
// 기대: 공지는 성공하고 요청은 끝난 업무를 이을 수 없어 TASK_INVALID(잠금 없이 옛 상태를 읽으면 요청이 지나가 연결이 둘이 된다),
// 연결은 하나, 업무는 done, 업무의 판은 만듦·끝남 둘이고 열린 판은 하나다.

const TASK_VERSIONS = 2
const LINKS = 1
const RACERS = 2

const noticeRoomOf = async (db: Db, councilId: string) => {
  const [room] = await db
    .select({ id: chatRoom.id })
    .from(chatRoom)
    .innerJoin(record, eq(record.id, chatRoom.id))
    .where(and(eq(record.councilId, councilId), eq(chatRoom.type, 'all_members')))
  if (!room) throw new Error('All room missing')
  return room.id
}

type Run = { main: SmokeConnection; open: () => SmokeConnection; context: SmokeContext }

// 요청한 사람이 맡은 업무를 회장이 만든다.
async function taskOf(run: Run, scene: MoneyScene) {
  const { main, context } = run
  const assigneeId = await memberIdOf(main.db, scene.requester.userId)
  const { task } = await changer(
    main.db,
    context,
    scene.host,
  )('task.manage', (tx, actor) =>
    createTask(
      tx,
      actor,
      {
        title: '공지 업무',
        body: null,
        dueDate: null,
        departmentId: null,
        assigneeId,
        eventId: null,
      },
      context.now,
    ),
  )
  return task.id
}

const requestInput = (taskId: string) => ({
  title: '요청',
  eventId: null,
  requestedBy: null,
  sourceMessageId: null,
  body: null,
  neededBy: null,
  taskId,
  items: [{ name: '마커', quantity: 1, link: null, options: null }],
})

async function race(run: Run, scene: MoneyScene, taskId: string) {
  const { context } = run
  const roomId = await noticeRoomOf(run.main.db, scene.host.councilId)
  const [noticeDb, requestDb] = (await warmed(run.open, RACERS)) as [Db, Db]
  return raceHolding(
    hold =>
      // 라우트가 부르는 sendAs 그대로다: 업무를 잇는 보내기는 학생회 행을 먼저 잠근다.
      noticeDb.transaction(async tx => {
        const request = { ...scene.host, action: 'council.view' as const, now: context.now }
        const input = { roomId, body: '공지', mentions: [], photos: [], notice: true, taskId }
        await sendAs(tx, request, input)
        await hold()
      }),
    [
      () =>
        changer(
          requestDb,
          context,
          scene.requester,
        )('council.view', (tx, actor) =>
          createPurchaseRequest(tx, actor, requestInput(taskId), context.now),
        ),
    ],
  )
}

async function verdictOf(main: SmokeConnection, taskId: string) {
  const versions = await versionsOf(main.sql, taskId)
  const [links] = await main.sql.unsafe(
    'SELECT count(*)::text AS n FROM task_result WHERE task_id = $1',
    [taskId],
  )
  return versions.last.status === 'done' &&
    versions.count === TASK_VERSIONS &&
    versions.open === 1 &&
    Number(links?.n) === LINKS
    ? pass('공지가 먼저 업무를 끝내고 요청은 이을 수 없어 업무가 한 번만 끝남이 됐다')
    : fail(
        `업무 상태 ${String(versions.last.status)}, 판 ${versions.count}개, 열린 판 ${versions.open}개, 연결 ${String(links?.n)}개(done, ${TASK_VERSIONS}개, 1개, ${LINKS}개여야 한다)`,
      )
}

export const noticeAndRequestTogetherCase: SmokeCase = {
  name: '업무를 잇는 공지 보내기와 같은 업무에 요청 내기를 동시에',
  run: context =>
    withConnections(context, async open => {
      const run = { main: open(), open, context }
      const scene = await moneyScene(run.main, context, 'ntc')
      const taskId = await taskOf(run, scene)
      const results = await race(run, scene, taskId)
      const bad = unexpectedFailures(results, new Set(['TASK_INVALID']))
      if (bad.length > 0) return fail('공지나 요청이 예상하지 못한 오류로 끝났다', bad[0])
      const problem = outcomeProblem(results, ['ok', 'TASK_INVALID'])
      return problem ? fail(problem) : verdictOf(run.main, taskId)
    }),
}
