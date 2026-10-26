import { Hono, type Context } from 'hono'
import {
  AssignDepartmentSchema,
  ChangeRankSchema,
  CreateDepartmentSchema,
  EmptyRequestSchema,
  MoveDepartmentSchema,
  TransferPresidentSchema,
  UpdateDepartmentSchema,
  type Action,
  type ErrorCode,
  type TeamResponse,
} from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { syncRooms } from '../chat/rooms.js'
import { authorize, councilIdOf, inCouncilChange, recordIdOf } from '../access/authorize.js'
import { requireSession, type SessionEnv, type SessionReader } from '../auth/require-session.js'
import { ApiError } from '../http/errors.js'
import { sqlState } from '../http/on-error.js'
import { json } from '../http/validate.js'
import type { Db, Tx } from '../db/types.js'
import { moveDepartment } from './move.js'
import { teamOf } from './queries.js'
import { retireDepartment } from './retire.js'
import {
  assignDepartment,
  changeRank,
  createDepartment,
  deleteDepartment,
  removeFromDepartment,
  removeMember,
  transferPresident,
  updateDepartment,
} from './service.js'

// 미리 본 뒤 다른 요청이나 다른 기록과 겹쳐 생긴 제약 위반을 같은 오류 코드로 바꾼다. 길마다 낼 수 있는 위반만 넘긴다. 그 밖의 위반은 500이다.
// 만들기와 이름 바꾸기는 부서 이름이 겹치면 23505, 없애기는 다른 기록이 부서를 가리키면 23503이다.
const nameConflicts: Readonly<Record<string, ErrorCode>> = { '23505': 'DEPARTMENT_NAME_TAKEN' }
const removeConflicts: Readonly<Record<string, ErrorCode>> = { '23503': 'DEPARTMENT_IN_USE' }

type Change = (
  c: Context<SessionEnv>,
  action: Action,
  run: (tx: Tx, actor: Actor) => Promise<void>,
  conflicts?: Readonly<Record<string, ErrorCode>>,
) => Promise<Response>

// 길마다 같이 쓰는 것: 길 묶음, 로그인 확인, 바꾸기 도우미.
interface Kit {
  routes: Hono<SessionEnv>
  auth: ReturnType<typeof requireSession>
  change: Change
}

const root = '/organizations/:councilId'

// 학생회 행을 잠근 거래 안에서 권한을 다시 보고 바꾼 뒤, 바뀐 목록을 돌려준다.
const changeOf =
  (db: Db, clock: () => Date): Change =>
  async (c, action, run, conflicts = {}) => {
    try {
      const request = { userId: c.get('userId'), councilId: c.req.param('councilId'), action }
      const team = await inCouncilChange(db, { ...request, now: clock() }, async (tx, actor) => {
        await run(tx, actor)
        // 편성이 바뀐 같은 거래에서 방 참여를 맞춘다(DEC-18). 실패하면 편성도 함께 되돌아간다.
        await syncRooms(tx, actor)
        return teamOf(tx, actor)
      })
      return c.json(team satisfies TeamResponse)
    } catch (error) {
      const code = conflicts[sqlState(error) ?? '']
      if (code) throw new ApiError(code)
      throw error
    }
  }

// 읽기는 한 시점의 모습이다. 권한 확인과 세 조회를 읽기 전용 REPEATABLE READ 거래 하나에서 해서(PostgreSQL은 이 수준에서 거래 전체에 스냅샷 하나를 준다)
// 조회 사이에 다른 요청이 소속을 바꿔도 목록이 서로 어긋나지 않는다. 바꾸기는 기본 수준(READ COMMITTED)을 쓴다.
function teamReadRoute({ routes, auth }: Kit, db: Db, clock: () => Date) {
  routes.get(`${root}/members`, auth, async c => {
    const councilId = councilIdOf(c.req.param('councilId'))
    const request = { userId: c.get('userId'), councilId, action: 'council.view' as const }
    const now = clock()
    const team = await db.transaction(
      async tx => teamOf(tx, await authorize(tx, { ...request, now })),
      {
        isolationLevel: 'repeatable read',
        accessMode: 'read only',
      },
    )
    return c.json(team satisfies TeamResponse)
  })
}

function memberRoutes({ routes, auth, change }: Kit) {
  routes.post(`${root}/members/:memberId/departments`, json(AssignDepartmentSchema), auth, c => {
    const { departmentId, rank } = c.req.valid('json')
    const memberId = recordIdOf(c.req.param('memberId'))
    return change(c, 'member.manage', (tx, actor) =>
      assignDepartment(tx, actor, { memberId, departmentId, rank }),
    )
  })
  routes.post(`${root}/members/:memberId/departments/move`, json(MoveDepartmentSchema), auth, c => {
    const memberId = recordIdOf(c.req.param('memberId'))
    return change(c, 'member.manage', (tx, actor) =>
      moveDepartment(tx, actor, memberId, c.req.valid('json')),
    )
  })
  routes.post(
    `${root}/members/:memberId/departments/:departmentId/remove`,
    json(EmptyRequestSchema),
    auth,
    c => {
      const memberId = recordIdOf(c.req.param('memberId'))
      const departmentId = recordIdOf(c.req.param('departmentId'))
      return change(c, 'member.manage', (tx, actor) =>
        removeFromDepartment(tx, actor, memberId, departmentId),
      )
    },
  )
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
}

function departmentRoutes({ routes, auth, change }: Kit) {
  routes.post(`${root}/departments`, json(CreateDepartmentSchema), auth, c =>
    change(
      c,
      'department.manage',
      (tx, actor) => createDepartment(tx, actor, c.req.valid('json').name),
      nameConflicts,
    ),
  )
  routes.post(`${root}/departments/:departmentId`, json(UpdateDepartmentSchema), auth, c => {
    const departmentId = recordIdOf(c.req.param('departmentId'))
    return change(
      c,
      'department.manage',
      (tx, actor) => updateDepartment(tx, actor, departmentId, c.req.valid('json')),
      nameConflicts,
    )
  })
  routes.post(`${root}/departments/:departmentId/retire`, json(EmptyRequestSchema), auth, c => {
    const departmentId = recordIdOf(c.req.param('departmentId'))
    return change(c, 'department.manage', (tx, actor) => retireDepartment(tx, actor, departmentId))
  })
  routes.post(`${root}/departments/:departmentId/delete`, json(EmptyRequestSchema), auth, c => {
    const departmentId = recordIdOf(c.req.param('departmentId'))
    return change(
      c,
      'department.manage',
      (tx, actor) => deleteDepartment(tx, actor, departmentId),
      removeConflicts,
    )
  })
}

// 운영진: 목록(모든 운영진)과 편성(회장단, 회장 넘기기는 회장), 부서(회장단). 변경도 목록 전체를 돌려준다.
export function createTeamRoutes(
  db: Db,
  getSession: SessionReader,
  clock: () => Date = () => new Date(),
) {
  const kit: Kit = {
    routes: new Hono<SessionEnv>(),
    auth: requireSession(getSession),
    change: changeOf(db, clock),
  }
  teamReadRoute(kit, db, clock)
  memberRoutes(kit)
  departmentRoutes(kit)
  return kit.routes
}
