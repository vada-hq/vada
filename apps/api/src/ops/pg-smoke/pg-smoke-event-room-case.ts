import { CreateEventSchema } from '@vada/contracts'
import { authorize } from '../../access/authorize.js'
import { ensureEventRooms, syncRooms } from '../../chat/rooms.js'
import type { Db } from '../../db/types.js'
import { createEvent } from '../../events/service.js'
import { createRecord } from '../../records/records.js'
import { assignDepartment, removeFromDepartment } from '../../team/service.js'
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
  withConnections,
  type SmokeCase,
  type SmokeContext,
  type Who,
} from './pg-smoke-kit.js'

// 사례(022 조각 8): 행사 만들기, 편성 바꾸기, 방 목록 읽기의 행사 방 채우기가 겹친다(DEC-90).
// 셋 다 학생회 행을 잠근 뒤 행사 방을 맞추므로 한 줄로 선다. 잠금이 없으면 같은 행사에 같은 종류의 방이 둘 생기거나
// 편성 바꾸기가 방금 생긴 행사의 부서방을 보지 못해 참여가 어긋난다.
// 기대: 행사마다 (종류, 부서)의 방이 하나씩이고, 끝난 뒤의 편성대로 손님이 모든 행사의 재정부 방에 들었거나 빠졌다.

const ROUNDS = 4
const ALTERNATE = 2
const HOST = 'smoke-er-host'
const GUEST = 'smoke-er-guest'

type Run = { main: SmokeConnection; open: () => SmokeConnection; context: SmokeContext }
type Scene = { host: Who; guestMember: string; financeId: string }

// 손님을 재정부에 넣었다 뺐다 한다. 팀 라우트처럼 같은 거래에서 방을 맞춘다.
const toggleFinance = (db: Db, run: Run, scene: Scene, assign: boolean) =>
  changer(
    db,
    run.context,
    scene.host,
  )('member.manage', async (tx, actor) => {
    const { guestMember, financeId } = scene
    if (assign)
      await assignDepartment(tx, actor, {
        memberId: guestMember,
        departmentId: financeId,
        rank: null,
      })
    else await removeFromDepartment(tx, actor, guestMember, financeId)
    await syncRooms(tx, actor)
  })

const eventMade = (db: Db, run: Run, scene: Scene, name: string) =>
  changer(
    db,
    run.context,
    scene.host,
  )('council.view', (tx, actor) =>
    createEvent(tx, actor, CreateEventSchema.parse({ name }), run.context.now),
  )

// 방 목록 읽기가 하는 채우기(라우트와 같은 순서: 권한을 본 뒤 거래 밖에서 부른다).
async function roomsFilled(db: Db, run: Run, scene: Scene) {
  const actor = await authorize(db, { ...scene.host, action: 'council.view', now: run.context.now })
  await ensureEventRooms(db, actor)
}

// 같은 행사에 (종류, 부서)가 같은 방이 둘 이상인 개수, 손님이 재정부 방에 든 행사 수, 행사 수
async function roomShape(main: SmokeConnection, scene: Scene) {
  const [row] = await main.sql.unsafe(
    `WITH rooms AS (
       SELECT cr.event_id, cr.type, cr.department_id, cr.id FROM chat_room cr JOIN record r ON r.id = cr.id
        WHERE r.council_id = $1 AND cr.event_id IS NOT NULL)
     SELECT
       (SELECT count(*) FROM (SELECT 1 FROM rooms GROUP BY event_id, type, department_id
          HAVING count(*) > 1) d)::text AS doubled,
       (SELECT count(*) FROM rooms JOIN room_membership rm ON rm.room_id = rooms.id
         WHERE rooms.department_id = $2 AND rm.member_id = $3)::text AS guest_in,
       (SELECT count(*) FROM event e JOIN record r ON r.id = e.id WHERE r.council_id = $1)::text AS events`,
    [scene.host.councilId, scene.financeId, scene.guestMember],
  )
  return row as { doubled: string; guest_in: string; events: string }
}

async function roundOf(run: Run, scene: Scene, round: number) {
  const [left, middle, right] = [run.open(), run.open(), run.open()]
  // 짝수 번은 넣고 홀수 번은 뺀다.
  const assign = round % ALTERNATE === 0
  const results = await Promise.allSettled([
    eventMade(left.db, run, scene, `행사 ${round}`),
    toggleFinance(middle.db, run, scene, assign),
    roomsFilled(right.db, run, scene),
  ])
  const bad = unexpectedFailures(results, new Set())
  if (bad.length > 0) return fail(`${round}번째: 예상하지 못한 오류`, bad[0])
  const shape = await roomShape(run.main, scene)
  if (shape.doubled !== '0') return fail(`${round}번째: 같은 행사에 같은 방이 둘 생겼다`)
  // 처음에 만든 옛 행사 하나와 판마다 행사 하나가 모두 열려 있다.
  const wanted = assign ? shape.events : '0'
  if (shape.guest_in !== wanted)
    return fail(
      `${round}번째: 손님이 든 재정부 행사 방이 ${shape.guest_in}개다(${wanted}개여야 한다)`,
    )
  return undefined
}

export const eventRoomsTogetherCase: SmokeCase = {
  name: '행사 만들기와 편성 바꾸기, 행사 방 채우기를 동시에',
  run: context =>
    withConnections(context, async open => {
      const main = open()
      await googleUser(main.db, HOST)
      await googleUser(main.db, GUEST)
      const councilId = await createdCouncil(main.db, context, HOST, '점검 행사 방 학생회')
      await joined(main.db, context, GUEST, await inviteCodeOf(main.db, councilId))
      const host = { userId: HOST, councilId }
      const [finance] = await main.sql.unsafe(
        `SELECT d.id FROM department d JOIN record r ON r.id = d.id
          WHERE r.council_id = $1 AND d.role = 'finance'`,
        [councilId],
      )
      // 이 기능 전에 만든 행사처럼 방이 없는 행사 하나. 첫 판의 채우기와 편성 바꾸기가 이 행사의 방을 두고 겹친다.
      await main.db.transaction(async tx => {
        const actor = await authorize(tx, { ...host, action: 'council.view', now: context.now })
        await createRecord(tx, {
          kind: 'event',
          councilId,
          actor: actor.memberId,
          values: { name: '옛 행사' },
        })
      })
      const scene = {
        host,
        guestMember: await memberIdOf(main.db, GUEST),
        financeId: (finance as { id: string }).id,
      }
      for (let round = 0; round < ROUNDS; round++) {
        const problem = await roundOf({ main, open, context }, scene, round)
        if (problem) return problem
      }
      return pass(`${ROUNDS}번 모두 행사마다 방이 하나씩이고 참여가 끝난 편성과 같다`)
    }),
}
