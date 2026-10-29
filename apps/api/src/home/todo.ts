import {
  HOME_TODO_KINDS,
  HOME_TODO_ROW_LIMIT,
  daysBetween,
  koreanDateOf,
  type HomeCouncilBoard,
  type HomeTodo,
  type HomeTodoRow,
} from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import type { Db } from '../db/types.js'
import type { OpenTask } from '../tasks/open-tasks.js'
import { councilOwnerOf, financeHeadOf, type OpsPeople } from './ops-contacts.js'
import { isCouncilWork } from './ops.js'
import { minutesRowsOf } from './todo-minutes.js'

type Reader = Pick<Db, 'select'>

// 행사 정리 줄: 후속 정리 중인 행사(재정 '행사 정산' 탭과 같은 행사·차례). 정산이 남으면 재정부장이 연락할 사람이다(내가 아니면).
function tidyRowsOf(followUp: HomeCouncilBoard['followUp'], people: OpsPeople, actor: Actor) {
  const finance = financeHeadOf(people)
  const contact = finance?.memberId === actor.memberId ? null : finance
  return followUp.events.map((row): HomeTodoRow => ({
    kind: 'event_tidy',
    event: row.event,
    endedDays: row.endedDays,
    remaining: row.remaining,
    settlementContact: row.remaining.settlement > 0 ? contact : null,
    actions: [],
  }))
}

// 업무 줄: 담당자가 나이거나 다른 회장단인 업무의 지남(오래된 것부터)·오늘 마감. ①이 빼는 업무와 같은 조건(isCouncilWork)이다.
function taskRowsOf(open: OpenTask[], people: OpsPeople, actor: Actor, today: string) {
  const late: HomeTodoRow[] = []
  const due: HomeTodoRow[] = []
  for (const row of open) {
    const { dueDate, assignee } = row.summary
    if (dueDate === null || !isCouncilWork(people, actor, row)) continue
    const days = daysBetween(dueDate, today)
    if (days < 0) continue
    const owner = councilOwnerOf(people, actor, assignee?.id)
    ;(days > 0 ? late : due).push({
      kind: days > 0 ? 'task_late' : 'task_today',
      task: row.summary,
      days,
      owner,
    })
  }
  return [...late, ...due]
}

// ③ 내가 할 일. 차례는 회의록 → 행사 정리 → 업무 지남 → 오늘이고, 확인할 것을 먼저 둔다(c35 '③ 차례와 상한').
export async function todoOf(
  db: Reader,
  actor: Actor,
  now: Date,
  board: { open: OpenTask[]; people: OpsPeople; followUp: HomeCouncilBoard['followUp'] },
): Promise<HomeTodo> {
  const { people } = board
  const rows = [
    ...(await minutesRowsOf(db, actor, people, now)),
    ...tidyRowsOf(board.followUp, people, actor),
    ...taskRowsOf(board.open, people, actor, koreanDateOf(now)),
  ]
  const counts = Object.fromEntries(
    HOME_TODO_KINDS.map(kind => [kind, rows.filter(row => row.kind === kind).length]),
  ) as HomeTodo['counts']
  // 행사 정리는 후속 정리 행사를 상한까지만 읽어 오므로 수는 그 읽기의 전체 수다.
  counts.event_tidy = board.followUp.total
  return {
    rows: rows.slice(0, HOME_TODO_ROW_LIMIT),
    counts,
    total: HOME_TODO_KINDS.reduce((sum, kind) => sum + counts[kind], 0),
    meTint: people.tints.get(actor.memberId) ?? 0,
  }
}
