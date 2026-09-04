import { and, eq, inArray, isNull } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import { departments, documents, members, tasks } from '../db/schema.ts'
import {
  alertOf,
  departmentTones,
  dueDay,
  isOverdue,
  NO_DEPARTMENT,
  NO_DEPARTMENT_TONE,
  readScope,
  readStatus,
  UNASSIGNED,
  WARNING_TONE,
} from './labels.ts'

// 칸반 보드 둘(TASK-01 · EVT-TASK-01)과 그 위의 건수.
//
// **같은 표를 다르게 거른 것뿐이다.** 상시 업무는 어느 행사에도 안 걸린 업무이고
// 행사 업무는 그 행사에 걸린 업무다 — 카드에 담기는 것이 거의 같으므로 조회도 하나다.
// 다른 것은 **화면이 받는 조각**이다: 상시 카드는 되풀이 주기를 그리고, 행사 카드는
// 업무를 가리키는 값과 딸린 문서 표시를 그린다. 그래서 답의 모양만 둘로 갈린다.
//
// **열마다 따로 조회한다.** 한 번에 다 주고 화면이 가르면 열 머리의 건수가 화면이
// 센 것이 되고, 그러면 '몇 건인가'의 답이 화면마다 갈린다.

const ROW = {
  id: tasks.id,
  title: tasks.title,
  status: tasks.status,
  cycle: tasks.cycle,
  dueDate: tasks.dueDate,
  departmentId: tasks.departmentId,
  departmentName: departments.name,
  assigneeMemberId: tasks.assigneeMemberId,
  assigneeName: members.name,
}

/**
 * 이 학생회의 업무 한 무리.
 *
 * **이어 붙인 표도 자기 조직을 확인한다.** 부서와 담당자를 id로만 이으면 남의
 * 조직의 이름이 우리 카드에 그려진다 — 표가 그것을 막게 되어 있지만 여기도 함께
 * 건다(조직도가 같은 구멍을 겪었다. 벽은 두 겹이 낫다).
 */
async function boardRows(db: Db, orgId: string, where: ReturnType<typeof and>) {
  return db
    .select(ROW)
    .from(tasks)
    .leftJoin(
      departments,
      and(eq(tasks.departmentId, departments.id), eq(departments.orgId, orgId)),
    )
    .leftJoin(members, and(eq(tasks.assigneeMemberId, members.id), eq(members.orgId, orgId)))
    .where(where)
}

type Row = Awaited<ReturnType<typeof boardRows>>[number]

/** 어느 보드인가. 상시 보드는 **행사에 안 걸린 업무**이고, 행사 보드는 그 행사의 업무다. */
function onBoard(orgId: string, eventId: string | null) {
  return and(
    eq(tasks.orgId, orgId),
    eventId === null ? isNull(tasks.eventId) : eq(tasks.eventId, eventId),
  )
}

/**
 * 열 하나를 거르는 조건.
 *
 * **보는 범위도 서버가 거른다.** 받아온 것을 화면이 거르면 열 머리의 건수가 걸러지기
 * 전 수가 되고, 그것을 맞추려고 화면이 다시 세면 세는 규칙이 화면에 박힌다.
 */
function narrowing(
  orgId: string,
  eventId: string | null,
  asked: { scope?: string; status?: string },
  viewerMemberId: string,
) {
  const scope = readScope(asked.scope)
  return and(
    onBoard(orgId, eventId),
    eq(tasks.status, readStatus(asked.status)),
    scope === 'mine' ? eq(tasks.assigneeMemberId, viewerMemberId) : undefined,
  )
}

/**
 * 카드의 차례.
 *
 * **명세도 그림도 차례를 말하지 않는다.** 말하지 않는 것을 지어내는 대신 이 화면이
 * 무엇을 위해 있는지를 따른다: 먼저 봐야 하는 것(담당자 없음)이 위로, 그 다음은
 * 기한이 이른 것, 기한이 없는 것은 뒤로, 같으면 이름순이다. 차례를 안 정하면
 * 저장소가 주는 대로 그려져 새로고침마다 카드가 자리를 바꾼다.
 */
function order(row: Row): string {
  const first = row.assigneeMemberId === null ? '0' : '1'
  const due = row.dueDate === null ? '9' : `0${row.dueDate.toISOString()}`
  return `${first}${due}${row.title}`
}

interface Common {
  title: string
  department: string
  departmentTone: string
  assignee: string
  dueDate: string
  tone: string
  alert?: string
  alertTone?: string
}

function common(row: Row, tones: Map<string, string>, now: Date, dueDate: string): Common {
  const departmentTone =
    row.departmentId === null
      ? NO_DEPARTMENT_TONE
      : (tones.get(row.departmentId) ?? NO_DEPARTMENT_TONE)
  return {
    title: row.title,
    department: row.departmentName ?? NO_DEPARTMENT,
    departmentTone,
    // **없으면 완성된 안내로 온다** — 빈 글을 주면 화면이 빈 자리를 그린다.
    assignee: row.assigneeName ?? UNASSIGNED,
    dueDate,
    // 카드를 두르는 색. 기본은 부서 색이고, 먼저 봐야 하는 것은 경고 색이다.
    tone: row.assigneeMemberId === null ? WARNING_TONE : departmentTone,
    // **주의 표시는 없으면 오지 않는다.** 카탈로그가 optional로 적었고 `undefined`는
    // 답에서 빠진다.
    ...(alertOf(row.dueDate, row.status, now) ?? {}),
  }
}

export interface OpsTaskCard extends Common {
  cycle: string
}

/**
 * 상시 업무 보드의 열 하나(TASK-01의 `task.board`).
 *
 * 기한은 **되풀이가 상시면 그대로 상시다**(명세가 그렇게 적었다). 지연을 기한에
 * 붙이지 않는 것도 이 화면의 사정이다 — 주의 딱지를 따로 그리고 기한 옆의 말은
 * 그 딱지에서 만든다.
 */
export async function opsTaskBoard(
  db: Db,
  orgId: string,
  asked: { scope?: string; status?: string },
  viewerMemberId: string,
  now: Date,
): Promise<OpsTaskCard[]> {
  const tones = await departmentTones(db, orgId)
  const rows = await boardRows(db, orgId, narrowing(orgId, null, asked, viewerMemberId))

  return rows
    .sort((left, right) => order(left).localeCompare(order(right)))
    .map((row) => {
      const cycle = (row.cycle ?? '').trim()
      return {
        ...common(row, tones, now, cycle === '상시' ? '상시' : dueDay(row.dueDate)),
        cycle: cycle === '' ? '주기 미정' : cycle,
      }
    })
}

export interface EventTaskCard extends Common {
  id: string
  hasDocuments: boolean
}

/**
 * 행사 업무 보드의 열 하나(EVT-TASK-01의 `event.taskBoard`).
 *
 * 상시 보드와 두 자리가 다르다.
 *
 * 1. **업무를 가리키는 값이 온다.** 카드에 그려지지 않지만 눌러서 상세로 갈 때
 *    '어느 업무인지'로 넘어간다 — 제목으로 넘기면 이름이 같은 업무가 둘 생기는
 *    날 조용히 어긋난다.
 * 2. **늦은 기한에는 그 사실이 붙어서 온다**(`2026-07-18 · 지연`). 명세가 그렇게
 *    적었고, 이 카드는 기한 옆에 따로 붙일 자리가 없다.
 */
export async function eventTaskBoard(
  db: Db,
  orgId: string,
  eventId: string,
  asked: { scope?: string; status?: string },
  viewerMemberId: string,
  now: Date,
): Promise<EventTaskCard[]> {
  const tones = await departmentTones(db, orgId)
  const rows = (
    await boardRows(db, orgId, narrowing(orgId, eventId, asked, viewerMemberId))
  ).sort((left, right) => order(left).localeCompare(order(right)))

  const withDocuments = await taskIdsWithDocuments(
    db,
    orgId,
    rows.map((row) => row.id),
  )

  return rows.map((row) => {
    const day = dueDay(row.dueDate)
    return {
      id: row.id,
      ...common(
        row,
        tones,
        now,
        isOverdue(row.dueDate, row.status, now) ? `${day} · 지연` : day,
      ),
      // **참거짓은 참거짓으로 온다.** 없을 때 조각이 안 오면 '없다'와 '서버가 아직
      // 모른다'가 같은 모양이 되고, 화면은 조각이 있는지로 참거짓을 읽게 된다.
      hasDocuments: withDocuments.has(row.id),
    }
  })
}

/**
 * 딸린 문서가 있는 업무들.
 *
 * **문서 자체는 여기서 다루지 않는다.** `documents`는 행사·회의·업무가 함께 쓰는
 * 표이고 그 목록을 주는 자리(`task.referenceDocuments`·`task.workDocuments`)는
 * 따로 짓는다. 여기가 묻는 것은 '있는가' 하나뿐이다.
 */
async function taskIdsWithDocuments(
  db: Db,
  orgId: string,
  taskIds: readonly string[],
): Promise<Set<string>> {
  if (taskIds.length === 0) return new Set()
  const rows = await db
    .select({ taskId: documents.taskId })
    .from(documents)
    .where(and(eq(documents.orgId, orgId), inArray(documents.taskId, [...taskIds])))
  return new Set(rows.map((row) => row.taskId).filter((id): id is string => id !== null))
}

export interface TaskAlerts {
  delayedCount: number
  reviewCount: number
  mineCount: number
  unassignedCount: number
}

/**
 * 보드 위에 나열하는 상태별 건수(`task.alerts` · `event.taskAlerts`).
 *
 * **보는 범위와 무관하게 보드 전체를 센다** — 명세가 그렇게 적었다. 화면이 세면
 * '내 업무'로 좁힌 순간 건수가 함께 줄고, 그러면 '지연 2건'이 사람마다 다른 수가
 * 된다. 세는 대상은 보드마다 다르다: 상시 보드는 상시 업무를, 행사 보드는 그
 * 행사의 업무를 센다.
 */
export async function taskAlerts(
  db: Db,
  orgId: string,
  eventId: string | null,
  viewerMemberId: string,
  now: Date,
): Promise<TaskAlerts> {
  const rows = await db
    .select({
      status: tasks.status,
      dueDate: tasks.dueDate,
      assigneeMemberId: tasks.assigneeMemberId,
    })
    .from(tasks)
    .where(onBoard(orgId, eventId))

  return {
    delayedCount: rows.filter((row) => isOverdue(row.dueDate, row.status, now)).length,
    reviewCount: rows.filter((row) => row.status === 'review').length,
    mineCount: rows.filter((row) => row.assigneeMemberId === viewerMemberId).length,
    unassignedCount: rows.filter((row) => row.assigneeMemberId === null).length,
  }
}
