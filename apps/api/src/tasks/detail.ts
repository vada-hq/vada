import { and, asc, eq } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import { departments, documents, members, tasks } from '../db/schema.ts'
import {
  dueDay,
  isOverdue,
  NO_DEPARTMENT,
  STATUS,
  UNASSIGNED,
  type TaskStatus,
} from './labels.ts'

// 업무 하나(EVT-TASK-02).
//
// **목록이 아니라 한 건이다.** 어느 업무인지는 화면이 받은 `taskId`가 정하고, 그
// 값은 보드의 카드가 넘겨준다.
//
// 이 화면이 읽는 자리가 넷인데 여기서 짓는 것은 둘이다. 나머지 둘(참고 문서 ·
// 작업 문서)은 `documents` 표를 여러 영역이 함께 쓰므로 따로 짓는다 — 여기서 지으면
// 같은 표를 두 사람이 서로 다른 모양으로 읽게 된다.

const ROW = {
  id: tasks.id,
  code: tasks.code,
  title: tasks.title,
  description: tasks.description,
  completionCriteria: tasks.completionCriteria,
  expectedOutput: tasks.expectedOutput,
  status: tasks.status,
  priority: tasks.priority,
  dueDate: tasks.dueDate,
  departmentName: departments.name,
  assigneeMemberId: tasks.assigneeMemberId,
  assigneeName: members.name,
  submittedAt: tasks.submittedAt,
  officialResult: tasks.officialResult,
  reviewComment: tasks.reviewComment,
}

/**
 * 그 학생회의 그 업무.
 *
 * **울타리를 조회가 든다.** id만으로 집어 오면 주소에 남의 업무 id를 적은 사람이
 * 그 업무의 이름과 담당자를 본다 — 없는 것과 남의 것은 밖에서 같은 답이어야 한다.
 */
async function taskRow(db: Db, orgId: string, taskId: string) {
  const rows = await db
    .select(ROW)
    .from(tasks)
    .leftJoin(
      departments,
      and(eq(tasks.departmentId, departments.id), eq(departments.orgId, orgId)),
    )
    .leftJoin(members, and(eq(tasks.assigneeMemberId, members.id), eq(members.orgId, orgId)))
    .where(and(eq(tasks.orgId, orgId), eq(tasks.id, taskId)))
    .limit(1)
  return rows[0] ?? null
}

/**
 * 우선순위의 색.
 *
 * **값의 목록이 아직 없다** — 표가 글로 담고 있고(`tasks.priority`) 디자인이 펼친
 * 목록을 그리지 않았다. 그래서 그림이 실제로 그린 것 하나만 붉게 두고 나머지는
 * 무채색이다. 목록을 지어내 색을 나눠 주면 그것은 **정하는 일**이 된다.
 */
function priorityTone(priority: string | null): string {
  return priority?.trim() === '높음' ? 'red' : 'gray'
}

export interface TaskDetail {
  code: string
  title: string
  status: string
  statusTone: string
  priority: string
  priorityTone: string
  assignee: string
  department: string
  dueDate: string
  description: string
  completionCriteria: string
  expectedOutput: string
  linkedItems: Array<{ label: string }>
}

/**
 * 업무 상세(`task.detail`).
 *
 * **아직 안 적은 것은 그 사실을 말로 준다.** 빈 글을 주면 화면이 빈 자리를 그리고,
 * 그러면 '아직 아무도 안 적었다'와 '비워 두기로 했다'가 같은 모양이 된다.
 *
 * 기한에는 **늦었다는 사실까지 붙어서** 온다 — 무엇을 지연으로 세는지 화면이
 * 유도할 수 없게 한다는 것이 명세가 이 조각에 적어 둔 말이다.
 */
export async function taskDetail(
  db: Db,
  orgId: string,
  taskId: string,
  now: Date,
): Promise<TaskDetail | null> {
  const row = await taskRow(db, orgId, taskId)
  if (row === null) return null

  const status: TaskStatus = row.status
  const day = dueDay(row.dueDate)
  return {
    // 사람이 부르는 번호. **아직 붙지 않았을 수 있다** — 번호를 붙이는 동작이
    // 명세에 아직 없어서(업무를 더하는 자리가 전부 pending이다) 비어 있는 업무가 있다.
    code: row.code ?? '번호 미정',
    title: row.title,
    status: STATUS[status].label,
    statusTone: STATUS[status].tone,
    priority: row.priority ?? '우선순위 미정',
    priorityTone: priorityTone(row.priority),
    assignee: row.assigneeName ?? UNASSIGNED,
    department: row.departmentName ?? NO_DEPARTMENT,
    dueDate: isOverdue(row.dueDate, status, now) ? `${day} · 지연` : day,
    description: row.description ?? '설명이 아직 등록되지 않았습니다.',
    completionCriteria: row.completionCriteria ?? '완료 기준이 아직 등록되지 않았습니다.',
    expectedOutput: row.expectedOutput ?? '아직 정해지지 않았습니다.',
    linkedItems: await linkedItems(db, orgId, taskId),
  }
}

/**
 * 이 업무에 이어진 항목들.
 *
 * **개수가 업무마다 다르다**고만 명세가 적었다. 표에서 업무에 이어진 이름 있는
 * 것은 `documents`뿐이므로 그것을 잇는다 — 없으면 빈 목록이고, 그것은 '못 받았다'가
 * 아니라 **이어진 것이 없다**는 답이다.
 */
async function linkedItems(
  db: Db,
  orgId: string,
  taskId: string,
): Promise<Array<{ label: string }>> {
  const rows = await db
    .select({ title: documents.title })
    .from(documents)
    .where(and(eq(documents.orgId, orgId), eq(documents.taskId, taskId)))
    .orderBy(asc(documents.title))
  return rows.map((row) => ({ label: row.title }))
}

export interface TaskReviewStatus {
  submission: string
  submissionTone: string
  officialResult: string
  officialResultTone: string
  reviewComment: string
  nextStepNote: string
}

/**
 * 검토 현황(`task.reviewStatus`).
 *
 * **낸 것과 공식 판정이 다른 사실이다** — 화면이 딱지 둘을 나란히 그리고, 표도
 * 그 둘을 따로 든다(`submittedAt` · `officialResult`).
 *
 * **없는 것과 아직 안 한 것은 다르다.** 상세를 열 수 있는 업무라면 검토 자리도
 * 있고, 거기 그려질 말은 '미제출'이지 '찾지 못했습니다'가 아니다.
 */
export async function taskReviewStatus(
  db: Db,
  orgId: string,
  taskId: string,
): Promise<TaskReviewStatus | null> {
  const row = await taskRow(db, orgId, taskId)
  if (row === null) return null

  const submitted = row.submittedAt !== null
  const result = row.officialResult?.trim() ?? ''
  const comment = row.reviewComment?.trim() ?? ''

  return {
    submission: submitted ? '제출 완료' : '미제출',
    // 그림이 제출 완료를 파랗게 그렸다(EVT-TASK-02 25:1836이 blue-50/blue-200/blue-700).
    // 아직 안 낸 것은 무채색이다 — 색이 재촉하지 않는다.
    submissionTone: submitted ? 'blue' : 'gray',
    officialResult: result === '' ? '미확정' : result,
    // **색은 확정됐는지만 말한다.** 무엇으로 확정됐는지는 글이 말한다 — 판정의
    // 종류를 명세가 들고 있지 않으므로 색을 그것에 걸면 지어내는 것이 된다.
    officialResultTone: result === '' ? 'gray' : 'green',
    reviewComment: comment === '' ? '검토 의견이 아직 없습니다.' : comment,
    nextStepNote: nextStep(submitted, result !== '', comment !== ''),
  }
}

/**
 * 다음에 무엇을 해야 하는가.
 *
 * **완성된 문구를 서버가 만든다.** 이 문장은 세 가지 사실이 함께 정하는 것이라
 * (냈는가 · 확정됐는가 · 의견이 왔는가) 화면이 조합하면 화면마다 다른 안내가 나온다.
 */
function nextStep(submitted: boolean, decided: boolean, commented: boolean): string {
  if (!submitted) return '결과물을 제출하면 검토가 시작됩니다.'
  if (decided) return '공식 결과가 확정되었습니다.'
  if (commented) return '수정 후 재제출이 필요합니다.'
  return '검토 결과를 기다리는 중입니다.'
}
