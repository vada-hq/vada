import type { Context } from 'hono'
import { orgOf, type Handlers } from '../deps.ts'
import { NotFound } from '../routes.ts'
import { eventTaskBoard, opsTaskBoard, taskAlerts } from '../tasks/board.ts'
import { taskDetail, taskReviewStatus } from '../tasks/detail.ts'
import { myTaskAlerts, myTaskTabCounts, myTasks } from '../tasks/mine.ts'

// 업무(TASK-01 · EVT-TASK-01 · EVT-TASK-02 · MY-01).
//
// **화면 넷이 한 표를 본다.** 상시 업무와 행사 업무가 같은 `tasks`이고, 다른 것은
// 무엇으로 거르느냐뿐이다 — 그래서 영역을 화면 이름이 아니라 표로 갈랐다.
//
// **쓰기가 없다.** 업무를 더하거나 고치는 동작을 명세가 전부 `pending`으로 적어
// 두었고, 그것은 '아직 안 정했다'는 뜻이다. 지금 지으면 그 모양을 짓는 것이 아니라
// **정하는 일**이 된다.

/** 지금 보는 사람이 이 학생회에서 누구인가. **내 업무와 '내 담당'을 이 값이 가른다.** */
function memberOf(c: Context): string {
  const memberId = c.get('sender')?.membership?.memberId
  if (memberId === undefined) throw new NotFound('이 학생회의 구성원이 아닙니다')
  return memberId
}

export const taskHandlers: Handlers = {
  // ── 상시 업무 보드 (TASK-01) ───────────────────────────────────────────
  //
  // 열 넷이 같은 자리를 status만 바꿔 네 번 부른다.
  'task.board': async (c, d) => {
    const orgId = orgOf(c)
    c.set('auditSubject', { type: 'organization', id: orgId })
    return opsTaskBoard(
      d.db,
      orgId,
      { scope: c.req.query('scope'), status: c.req.query('status') },
      memberOf(c),
      d.invite.now(),
    )
  },
  // **보는 범위를 받지 않는다.** 건수는 보드 전체의 것이다.
  'task.alerts': async (c, d) => {
    const orgId = orgOf(c)
    c.set('auditSubject', { type: 'organization', id: orgId })
    return taskAlerts(d.db, orgId, null, memberOf(c), d.invite.now())
  },

  // ── 행사 업무 보드 (EVT-TASK-01) ───────────────────────────────────────
  //
  // 상시 보드와 같은 표를 보되 **어느 행사인지가 하나 더 붙는다.**
  'event.taskBoard': async (c, d) => {
    const eventId = c.req.query('eventId')!
    c.set('auditSubject', { type: 'event', id: eventId })
    return eventTaskBoard(
      d.db,
      orgOf(c),
      eventId,
      { scope: c.req.query('scope'), status: c.req.query('status') },
      memberOf(c),
      d.invite.now(),
    )
  },
  'event.taskAlerts': async (c, d) => {
    const eventId = c.req.query('eventId')!
    c.set('auditSubject', { type: 'event', id: eventId })
    return taskAlerts(d.db, orgOf(c), eventId, memberOf(c), d.invite.now())
  },

  // ── 업무 상세 (EVT-TASK-02) ────────────────────────────────────────────
  //
  // **없는 것은 없다고 말한다.** 남의 학생회 업무도 같은 답이다 — 밖에서 그 둘이
  // 갈려 보이면 남의 업무가 있는지를 주소로 물어볼 수 있게 된다.
  'task.detail': async (c, d) => {
    const taskId = c.req.query('taskId')!
    c.set('auditSubject', { type: 'task', id: taskId })
    const row = await taskDetail(d.db, orgOf(c), taskId, d.invite.now())
    if (row === null) throw new NotFound('그 업무를 찾지 못했습니다')
    return row
  },
  'task.reviewStatus': async (c, d) => {
    const taskId = c.req.query('taskId')!
    c.set('auditSubject', { type: 'task', id: taskId })
    const row = await taskReviewStatus(d.db, orgOf(c), taskId)
    if (row === null) throw new NotFound('그 업무를 찾지 못했습니다')
    return row
  },

  // ── 내 업무 (MY-01) ────────────────────────────────────────────────────
  'my.tasks': async (c, d) => {
    const orgId = orgOf(c)
    const memberId = memberOf(c)
    // 이 사람 자신이 담당인 업무를 읽는다.
    c.set('auditSubject', { type: 'member', id: memberId })
    return myTasks(
      d.db,
      orgId,
      memberId,
      { tab: c.req.query('tab'), query: c.req.query('query') },
    )
  },
  'my.taskAlerts': async (c, d) => {
    const orgId = orgOf(c)
    const memberId = memberOf(c)
    c.set('auditSubject', { type: 'member', id: memberId })
    return myTaskAlerts(d.db, orgId, memberId, d.invite.now())
  },
  'my.taskTabCounts': async (c, d) => {
    const orgId = orgOf(c)
    const memberId = memberOf(c)
    c.set('auditSubject', { type: 'member', id: memberId })
    return myTaskTabCounts(d.db, orgId, memberId)
  },
}
