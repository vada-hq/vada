import {
  HOME_FEATURED_LIMIT,
  HOME_LIST_LIMIT,
  koreanDateOf,
  koreanOf,
  openRequestsOf,
  type HomeMyRequests,
  type HomeResponse,
} from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import type { Db } from '../db/types.js'
import { openEventsOf } from '../events/queries.js'
import { requestListOf } from '../purchases/queries.js'
import { openTasksOf } from '../tasks/open-tasks.js'
import { councilOf } from './council.js'
import { departmentsOf } from './departments.js'
import { financeOf } from './finance.js'
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

// 모든 홈 종류가 쓰는 칸(DEC-95). 셈은 원래 화면의 도우미를 그대로 부른다(DEC-69).
async function commonOf(db: Reader, actor: Actor, now: Date) {
  const today = koreanDateOf(now)
  const kind = homeKindOf(actor)
  const { mine, myTasks, tasks } = await mineOf(db, actor, now)
  const open = await openTasksOf(db, actor, now)
  const staffed = await staffedEventIdsOf(db, actor)
  const participating = await participatingOf(db, actor, now, { staffed, open })
  const home: HomeResponse = {
    today,
    kind,
    financeView: hasFinanceView(actor),
    asOf: koreanOf(now),
    myTasks,
    featuredEvents: await featuredEventsOf(db, actor, now),
    participating,
    upcoming: await upcomingOf(db, actor, now, { kind, open, mine: tasks, staffed, participating }),
    myRequests: await myRequestsOf(db, actor, today),
    mine,
  }
  return { home, open }
}

// 새 칸은 모든 종류가 받고, 지금 화면의 부분은 계층(levelOf)이 가른 것만 읽는다(기능 010, 조각 10까지).
// 회장단은 모든 부서에서 부장 권한을 물려받아 '내 부서'를 받지 않고 council의 부서별 막힌 곳으로 본다.
export async function homeOf(db: Reader, actor: Actor, now: Date): Promise<HomeResponse> {
  const level = levelOf(actor)
  const { home, open } = await commonOf(db, actor, now)
  if (level.finance) Object.assign(home, await financeOf(db, actor, now, level.council))
  if (level.council) home.council = await councilOf(db, actor, now, open)
  else if (level.departmentIds.length)
    home.departments = await departmentsOf(db, actor, level.departmentIds, open)
  return home
}
