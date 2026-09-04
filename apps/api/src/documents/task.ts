import { and, eq } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import { documents, tasks } from '../db/schema.ts'
import { byPhase, eventDocumentRows } from './event.ts'
import {
  type DocumentStatus,
  kindOf,
  lastModifiedNote,
  NO_DESCRIPTION,
  officialReflection,
  STATUS,
} from './labels.ts'

// 업무 상세의 문서 둘(EVT-TASK-02).
//
// **둘이 다른 물건이다.** 참고 문서는 그 업무가 딸린 **행사의 공용 원본**이라
// 여러 업무가 같은 것을 보고, 작업 문서는 **그 업무가 내놓은 것**이다. 명세가
// 그렇게 갈랐고 표도 그 둘을 다른 자리로 가리킨다(`eventId` · `taskId`).
//
// 그래서 참고 문서는 행사 문서 표(EVT-DOC-01)가 읽는 그 줄을 그대로 읽는다 —
// 여기서 따로 조회하면 같은 행사의 같은 문서가 화면마다 다른 목록이 된다.

/**
 * 그 학생회의 그 업무가 딸린 행사.
 *
 * **울타리를 조회가 든다.** 업무 id만으로 집어 오면 주소에 남의 학생회 업무 id를
 * 적은 사람이 그 학생회 행사의 문서 이름을 본다.
 *
 * 업무가 없어도 행사에 안 걸려 있어도 답은 같다 — **따를 공용 원본이 없다**.
 * 계약이 이 자리에 404를 두지 않았으므로 빈 목록이 곧 그 답이다.
 */
async function eventOfTask(db: Db, orgId: string, taskId: string): Promise<string | null> {
  const rows = await db
    .select({ eventId: tasks.eventId })
    .from(tasks)
    .where(and(eq(tasks.orgId, orgId), eq(tasks.id, taskId)))
    .limit(1)
  return rows[0]?.eventId ?? null
}

export interface ReferenceDocument {
  title: string
  description: string
  lastModifiedNote: string
  status: string
  statusTone: string
}

/**
 * 이 업무가 따르는 공식 문서(`task.referenceDocuments`).
 *
 * **업무의 것이 아니다.** 행사의 공용 원본이라 그 행사의 업무들이 같은 목록을
 * 본다 — 그래서 행사 문서 표와 같은 조회를 쓰고 차례도 같다(국면 → 이름).
 */
export async function taskReferenceDocuments(
  db: Db,
  orgId: string,
  taskId: string,
): Promise<ReferenceDocument[]> {
  const eventId = await eventOfTask(db, orgId, taskId)
  if (eventId === null) return []

  const rows = await eventDocumentRows(db, orgId, eventId)
  return rows
    .sort(byPhase)
    .map((row) => {
      const status: DocumentStatus = row.status
      return {
        title: row.title,
        description: row.description ?? NO_DESCRIPTION,
        // **때를 완성된 문구로 준다** — 화면이 날짜에 말을 붙이지 않는다.
        lastModifiedNote: lastModifiedNote(row.updatedAt),
        status: STATUS[status].label,
        statusTone: STATUS[status].tone,
      }
    })
}

export interface WorkDocument {
  title: string
  kind: string
  status: string
  statusTone: string
  officialReflection: string
}

/**
 * 이 업무가 내놓은 파일과 문서(`task.workDocuments`).
 *
 * **표가 든 것은 이름과 상태뿐이다.** 파일인지 문서인지도, 공식 문서에 반영됐는지도
 * 그 둘에서 읽는다(`labels.ts`가 그 규칙을 든다).
 *
 * 차례는 이름순이다 — 명세가 차례를 말하지 않고, 안 정하면 새로고침마다 줄이
 * 자리를 바꾼다.
 */
export async function taskWorkDocuments(
  db: Db,
  orgId: string,
  taskId: string,
): Promise<WorkDocument[]> {
  const rows = await db
    .select({ title: documents.title, status: documents.status })
    .from(documents)
    // 문서가 든 조직으로 거르므로 남의 학생회 업무 id를 적어도 한 줄도 오지 않는다.
    .where(and(eq(documents.orgId, orgId), eq(documents.taskId, taskId)))

  return rows
    .sort((left, right) => left.title.localeCompare(right.title))
    .map((row) => {
      const status: DocumentStatus = row.status
      return {
        title: row.title,
        kind: kindOf(row.title),
        status: STATUS[status].label,
        statusTone: STATUS[status].tone,
        officialReflection: officialReflection(status),
      }
    })
}
