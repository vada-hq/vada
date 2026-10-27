import {
  HOME_FEATURED_LIMIT,
  HOME_LIST_LIMIT,
  koreanDateOf,
  koreanOf,
  openRequestsOf,
  type HomeKind,
  type HomeMyRequests,
  type HomeParticipating,
  type HomeResponse,
  type HomeUpcoming,
  type TaskSummary,
} from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { isLeadership } from '../access/permissions.js'
import type { Db } from '../db/types.js'
import { openEventsOf } from '../events/queries.js'
import { requestListOf } from '../purchases/queries.js'
import { openTasksOf, type OpenTask } from '../tasks/open-tasks.js'
import { councilBoardOf } from './council-board.js'
import { departmentsOf } from './departments.js'
import { departmentBoardOf } from './department-board.js'
import { financeOf } from './finance.js'
import { financeBudgetOf } from './finance-budget.js'
import { financeBoardOf } from './finance-board.js'
import { hasFinanceView, homeKindOf, levelOf } from './level.js'
import { mineOf } from './mine.js'
import { participatingOf, staffedEventIdsOf } from './participating.js'
import { upcomingOf } from './upcoming.js'

type Reader = Pick<Db, 'select' | 'selectDistinct'>

// 내 요청: 재정 '내 요청' 목록(requestListOf)에 화면이 걸던 거르기(openRequestsOf)를 그대로 건다. 그래서 별도 읽기와 같은 줄·차례다.
async function myRequestsOf(db: Reader, actor: Actor, today: string): Promise<HomeMyRequests> {
  const listed = await requestListOf(db, actor, { view: 'mine' })
  const requests = openRequestsOf(listed.requests, today)
  return { requests: requests.slice(0, HOME_LIST_LIMIT), total: requests.length }
}

// 학생회 주요 행사: 회장단 행사 카드와 같은 읽기(openEventsOf)에서 끝난 행사를 빼고 앞의 몇 개. 진행 중 → 예정(시작 순) → 날짜 미정이다.
const featuredEventsOf = async (db: Reader, actor: Actor, now: Date) =>
  (await openEventsOf(db, actor, now, { limit: HOME_FEATURED_LIMIT, endedLimit: 0 })).events

const NO_PARTICIPATION: HomeParticipating = { events: [], total: 0 }
const NO_UPCOMING: HomeUpcoming = { items: [], total: 0 }

// 참여 행사와 가까운 일정. 재정부 홈은 두 카드가 없어 읽지 않고 빈 값이다(DEC-95).
async function scheduleOf(
  db: Reader,
  actor: Actor,
  now: Date,
  input: { kind: HomeKind; open: OpenTask[]; mine: TaskSummary[] },
) {
  if (input.kind === 'finance') return { participating: NO_PARTICIPATION, upcoming: NO_UPCOMING }
  const staffed = await staffedEventIdsOf(db, actor)
  const participating = await participatingOf(db, actor, now, { staffed, open: input.open })
  const upcoming = await upcomingOf(db, actor, now, { ...input, staffed, participating })
  return { participating, upcoming }
}

// 모든 홈 종류가 쓰는 칸(DEC-95). 셈은 원래 화면의 도우미를 그대로 부른다(DEC-69).
// 학생회 전체의 열린 업무는 회장단과 부서가 있는 사람만 쓴다(부서 없는 운영진은 내 업무만 본다).
async function commonOf(db: Reader, actor: Actor, now: Date) {
  const today = koreanDateOf(now)
  const kind = homeKindOf(actor)
  const { mine, myTasks, tasks } = await mineOf(db, actor, now)
  const open =
    isLeadership(actor) || actor.departments.length > 0 ? await openTasksOf(db, actor, now) : []
  const home: HomeResponse = {
    today,
    kind,
    financeView: hasFinanceView(actor),
    asOf: koreanOf(now),
    myTasks,
    // 회장단은 재정 보기가 있을 때만 타일을 읽는다. 운영 보기에서는 행사 현황을 본다.
    featuredEvents:
      kind === 'council' && !hasFinanceView(actor) ? [] : await featuredEventsOf(db, actor, now),
    ...(await scheduleOf(db, actor, now, { kind, open, mine: tasks })),
    myRequests: await myRequestsOf(db, actor, today),
    mine,
  }
  return { home, open }
}

// 새 칸은 모든 종류가 받고, 지금 화면의 부분은 계층(levelOf)이 가른 것만 읽는다(기능 010, 조각 10까지).
// 회장단은 새 홈(councilBoard)만 그려 옛 council 칸을 읽지 않고, 모든 부서에서 부장 권한을 물려받아도 '내 부서'를 받지 않는다(기능 027 조각 6).
export async function homeOf(db: Reader, actor: Actor, now: Date): Promise<HomeResponse> {
  const level = levelOf(actor)
  const { home, open } = await commonOf(db, actor, now)
  if (level.finance) Object.assign(home, await financeOf(db, actor, now, level.council))
  if (level.finance || level.council) {
    const budget = await financeBudgetOf(db, actor, now)
    if (level.council) home.financeSummary = budget.summary
    if (home.received)
      home.financeBoard = await financeBoardOf(db, actor, now, {
        pending: home.received,
        budget,
        open,
        settling: home.settling,
      })
  }
  if (level.council) home.councilBoard = await councilBoardOf(db, actor, now, open)
  else if (level.departmentIds.length)
    home.departments = await departmentsOf(db, actor, level.departmentIds, open)
  if (home.kind === 'department')
    home.departmentBoard = await departmentBoardOf(db, actor, now, open)
  return home
}
