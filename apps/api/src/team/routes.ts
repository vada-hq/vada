import { Hono, type Context } from 'hono'
import { AssignDepartmentSchema, ChangeRankSchema, EmptyRequestSchema, TransferPresidentSchema, type Action, type TeamResponse } from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { authorize, authorizeChange, councilIdOf, recordIdOf } from '../access/authorize.js'
import { requireSession, type SessionEnv, type SessionReader } from '../auth/require-session.js'
import { json } from '../http/validate.js'
import type { Db, Tx } from '../records/records.js'
import { teamOf } from './queries.js'
import { assignDepartment, changeRank, removeFromDepartment, removeMember, transferPresident } from './service.js'

// 운영진: 목록(모든 운영진)과 편성(회장단, 회장 넘기기는 회장). 변경도 목록 전체를 돌려준다.
export function createTeamRoutes(db: Db, getSession: SessionReader, clock: () => Date = () => new Date()) {
  const routes = new Hono<SessionEnv>()
  const auth = requireSession(getSession)
  const root = '/organizations/:councilId'

  // 학생회 행을 잠근 거래 안에서 권한을 다시 보고 바꾼 뒤, 바뀐 목록을 돌려준다.
  async function change(c: Context<SessionEnv>, action: Action, run: (tx: Tx, actor: Actor) => Promise<void>) {
    const councilId = councilIdOf(c.req.param('councilId'))
    const userId = c.get('userId')
    const now = clock()
    const team = await db.transaction(async tx => {
      const actor = await authorizeChange(tx, userId, councilId, action, now)
      await run(tx, actor)
      return teamOf(tx, actor)
    })
    return c.json(team satisfies TeamResponse)
  }

  // 읽기는 한 시점의 모습이다. 권한 확인과 세 조회를 읽기 전용 REPEATABLE READ 거래 하나에서 해서(PostgreSQL은 이 수준에서 거래 전체에 스냅샷 하나를 준다)
  // 조회 사이에 다른 요청이 소속을 바꿔도 목록이 서로 어긋나지 않는다. 바꾸기는 기본 수준(READ COMMITTED)을 쓴다.
  routes.get(`${root}/members`, auth, async c => {
    const councilId = councilIdOf(c.req.param('councilId'))
    const userId = c.get('userId')
    const now = clock()
    const team = await db.transaction(async tx => teamOf(tx, await authorize(tx, userId, councilId, 'council.view', now)),
      { isolationLevel: 'repeatable read', accessMode: 'read only' })
    return c.json(team satisfies TeamResponse)
  })
  routes.post(`${root}/members/:memberId/departments`, json(AssignDepartmentSchema), auth, c => {
    const { departmentId, rank } = c.req.valid('json')
    const memberId = recordIdOf(c.req.param('memberId'))
    return change(c, 'member.manage', (tx, actor) => assignDepartment(tx, actor, memberId, departmentId, rank))
  })
  routes.post(`${root}/members/:memberId/departments/:departmentId/remove`, json(EmptyRequestSchema), auth, c => {
    const memberId = recordIdOf(c.req.param('memberId'))
    const departmentId = recordIdOf(c.req.param('departmentId'))
    return change(c, 'member.manage', (tx, actor) => removeFromDepartment(tx, actor, memberId, departmentId))
  })
  routes.post(`${root}/members/:memberId/rank`, json(ChangeRankSchema), auth, c => {
    const { rank } = c.req.valid('json')
    const memberId = recordIdOf(c.req.param('memberId'))
    return change(c, 'rank.manage', (tx, actor) => changeRank(tx, actor, memberId, rank))
  })
  routes.post(`${root}/president/transfer`, json(TransferPresidentSchema), auth, c => {
    const { memberId } = c.req.valid('json')
    return change(c, 'president.transfer', (tx, actor) => transferPresident(tx, actor, memberId))
  })
  routes.post(`${root}/members/:memberId/remove`, json(EmptyRequestSchema), auth, c => {
    const memberId = recordIdOf(c.req.param('memberId'))
    return change(c, 'member.manage', (tx, actor) => removeMember(tx, actor, memberId))
  })
  return routes
}
