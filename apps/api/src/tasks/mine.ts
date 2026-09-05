import { and, asc, eq, ilike, inArray, or } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import { departments, documents, events, tasks } from '../db/schema.ts'
import {
  dueShort,
  isOverdue,
  NO_DEPARTMENT,
  readTab,
  STATUS,
  statusesOfTab,
  TAB_KEYS,
  type TaskStatus,
} from './labels.ts'

// 내 업무(MY-01).
//
// **갈피 셋은 칸반의 넷을 묶어 본 것이다.** 검토 중인 업무는 아직 안 끝났으므로
// '진행 중'에 든다 — 묶는 규칙을 화면이 들면 같은 업무가 화면마다 다른 갈피에 놓인다.
//
// **거르는 것도 세는 것도 서버가 한다.** 목록을 통째로 보내고 화면이 거르면 갈피에
// 곁들이는 건수와 그 아래 목록이 어긋난다.

/** 이 사람이 처리할 업무. **담당이 나인 것**이 이 화면의 뜻이다. */
function mine(orgId: string, memberId: string) {
  return and(eq(tasks.orgId, orgId), eq(tasks.assigneeMemberId, memberId))
}

export interface MyTask {
  title: string
  department: string
  status: string
  nextAction: string
  context: string
  date: string
  linkedDocument?: string
}

/**
 * 내가 처리할 업무(`my.tasks`).
 *
 * 검색은 **업무 이름으로도 그 업무가 속한 행사 이름으로도** 찾는다 — 카드에 그
 * 둘이 함께 그려지고, 사람은 둘 중 아는 것을 넣는다(명단 조회가 이름과 학번을
 * 함께 보는 것과 같은 까닭이다).
 */
export async function myTasks(
  db: Db,
  orgId: string,
  memberId: string,
  asked: { tab?: string; query?: string },
): Promise<MyTask[]> {
  const statuses = readTab(asked.tab)
  const wanted = (asked.query ?? '').trim()

  const rows = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      status: tasks.status,
      dueDate: tasks.dueDate,
      departmentName: departments.name,
      eventTitle: events.title,
    })
    .from(tasks)
    // **이어 붙인 표도 자기 조직을 확인한다.** id만 이으면 남의 조직의 이름이
    // 내 업무 카드에 그려진다.
    .leftJoin(
      departments,
      and(eq(tasks.departmentId, departments.id), eq(departments.orgId, orgId)),
    )
    .leftJoin(events, and(eq(tasks.eventId, events.id), eq(events.orgId, orgId)))
    .where(
      and(
        mine(orgId, memberId),
        inArray(tasks.status, [...statuses]),
        wanted === ''
          ? undefined
          : or(ilike(tasks.title, `%${wanted}%`), ilike(events.title, `%${wanted}%`)),
      ),
    )
    // 기한이 이른 것이 위로, 기한이 없는 것은 뒤로. '내가 다음에 할 일'을 찾는
    // 화면이므로 급한 것이 먼저다.
    .orderBy(asc(tasks.dueDate), asc(tasks.title))

  const documentTitles = await firstDocumentTitles(
    db,
    orgId,
    rows.map((row) => row.id),
  )

  return rows.map((row) => {
    const status: TaskStatus = row.status
    const linkedDocument = documentTitles.get(row.id)
    return {
      title: row.title,
      department: row.departmentName ?? NO_DEPARTMENT,
      status: STATUS[status].label,
      nextAction: nextAction(status),
      // 행사에 걸린 업무면 그 행사가 맥락이고, 아니면 상시 업무다.
      context: row.eventTitle ?? '상시 업무',
      date: dueShort(row.dueDate),
      // **없으면 오지 않는다** — 카탈로그가 optional로 적었고 `undefined`는 답에서 빠진다.
      ...(linkedDocument === undefined ? {} : { linkedDocument }),
    }
  })
}

/**
 * 다음에 할 일.
 *
 * **단계가 정한다.** 표에 이 문장을 담을 자리가 없고(담으면 업무마다 손으로 적어야
 * 한다) 명세도 어디서 오는지 말하지 않았다 — 그러나 무엇을 해야 하는지는 지금
 * 어느 단계인지가 이미 말하고 있다. 검토 현황의 `nextStepNote`가 같은 길이다.
 */
function nextAction(status: TaskStatus): string {
  switch (status) {
    case 'planned':
      return '업무를 시작하고 진행 상태를 바꾸기'
    case 'inProgress':
      return '진행 내용을 정리하고 검토를 요청'
    case 'review':
      return '검토 의견을 확인하고 처리 내용을 기록'
    case 'done':
      return '더 할 일이 없습니다'
  }
}

/**
 * 업무에 이어진 문서 이름 하나.
 *
 * 카드가 그리는 것은 **이름 하나**다(개수도 목록도 오지 않는다). `documents` 표를
 * 여러 영역이 함께 쓰므로 여기서는 이름만 집어 온다 — 문서 목록을 주는 자리는 따로다.
 */
async function firstDocumentTitles(
  db: Db,
  orgId: string,
  taskIds: readonly string[],
): Promise<Map<string, string>> {
  if (taskIds.length === 0) return new Map()
  const rows = await db
    .select({ taskId: documents.taskId, title: documents.title })
    .from(documents)
    .where(and(eq(documents.orgId, orgId), inArray(documents.taskId, [...taskIds])))
    .orderBy(asc(documents.title))
  const found = new Map<string, string>()
  for (const row of rows) {
    if (row.taskId === null || found.has(row.taskId)) continue
    found.set(row.taskId, row.title)
  }
  return found
}

export interface MyTaskAlerts {
  delayedCount: number
  todoCount: number
  reviewCount: number
  /** 홈의 '내 담당 업무' 카드가 그리는 한 줄. 완성된 글로 나간다. */
  myWorkNote: string
}

/**
 * 내 업무의 상태별 건수(`my.taskAlerts`).
 *
 * **보드의 건수와 세는 대상이 다르다** — 저기는 학생회의 보드 전체를 세고 여기는
 * 내 것만 센다. 같은 이름의 조각이라도 무엇을 세는지가 다르므로 자리가 갈려 있다.
 */
export async function myTaskAlerts(
  db: Db,
  orgId: string,
  memberId: string,
  now: Date,
): Promise<MyTaskAlerts> {
  const rows = await db
    .select({ status: tasks.status, dueDate: tasks.dueDate })
    .from(tasks)
    .where(mine(orgId, memberId))

  const todo = statusesOfTab('todo')
  const reviewCount = rows.filter((row) => row.status === 'review').length
  // **홈이 그리는 한 줄.** 무엇을 '지금 붙들고 있다'로 볼지가 조직의 규칙이라 서버가
  // 세고 서버가 글을 만든다 — 화면이 두 수를 더하면 그 규칙이 화면에 박힌다.
  //
  // 한동안 이 글이 명세에 '진행 중·검토 필요 4건'으로 박혀 있었다. 업무가 하나도 없는
  // 학생회의 홈이 4건이라고 말했고, 배포된 것을 사람이 보고 물었다(2026-09-06).
  //
  // **묶는 규칙을 다시 적지 않는다.** '검토 중인 업무는 아직 안 끝났으므로 진행 중에
  // 든다'는 것을 `labels.ts`의 갈피 표가 이미 정했다 — 여기서 따로 더하면 같은 업무가
  // 홈과 MY-01에서 다른 수로 세어진다. 갈피의 셈을 그대로 쓴다.
  const holding = statusesOfTab('inProgress')
  const holdingCount = rows.filter((row) => holding.includes(row.status)).length
  return {
    delayedCount: rows.filter((row) => isOverdue(row.dueDate, row.status, now)).length,
    // '해야 할 업무'는 갈피 이름 그대로다 — 갈피와 다른 수를 세면 칩과 갈피가 어긋난다.
    todoCount: rows.filter((row) => todo.includes(row.status)).length,
    reviewCount,
    myWorkNote: `진행 중·검토 필요 ${holdingCount}건`,
  }
}

/**
 * 갈피마다 곁들이는 건수(`my.taskTabCounts`).
 *
 * **인자를 받지 않는다** — 검색어로 좁혀도 갈피의 건수는 내 업무 전체의 것이다.
 * 조각의 이름이 갈피 선택지의 값과 같다(선택지는 명세가, 건수는 데이터가 정한다).
 */
export async function myTaskTabCounts(
  db: Db,
  orgId: string,
  memberId: string,
): Promise<Record<string, number>> {
  const rows = await db
    .select({ status: tasks.status })
    .from(tasks)
    .where(mine(orgId, memberId))

  const counts: Record<string, number> = {}
  for (const tab of TAB_KEYS) {
    const statuses = statusesOfTab(tab)
    counts[tab] = rows.filter((row) => statuses.includes(row.status)).length
  }
  return counts
}
