import { and, eq } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import { documents, meetingAgendas, meetings } from '../db/schema.ts'

// 회의에 붙은 자료(OPS-MEET-03A · 05A · 07).
//
// **안건의 사전 자료와 회의록의 관련 자료가 같은 물건이다** — 명세가 그렇게 적었고
// 그래서 자리도 하나다(`meeting.documents`). 회의에 한 번 붙어 오고, 어느 안건의
// 것인지는 그 조각(`agendaId`)이 안다. 화면 셋이 그 조각으로 갈라 그린다.

export interface MeetingDocument {
  documentId: string
  name: string
  agendaId?: string
}

/**
 * 그 학생회에 그 회의가 있는가.
 *
 * **없는 것과 남의 것은 밖에서 같은 답이어야 한다** — 갈려 보이면 남의 회의가
 * 있는지를 주소로 물어볼 수 있게 된다.
 */
async function meetingExists(db: Db, orgId: string, meetingId: string): Promise<boolean> {
  const rows = await db
    .select({ id: meetings.id })
    .from(meetings)
    .where(and(eq(meetings.orgId, orgId), eq(meetings.id, meetingId)))
    .limit(1)
  return rows.length > 0
}

/**
 * 이 회의에 붙은 자료(`meeting.documents`).
 *
 * 차례는 **회의 전체에 붙은 것이 먼저, 그다음이 안건 차례**다. 명세가 차례를
 * 말하지 않는데, 안 정하면 저장소가 주는 대로 그려져 새로고침마다 자리가 바뀐다.
 * 안건의 차례가 곧 회의가 진행되는 차례이고(`meetingAgendas.sortOrder`), 어느
 * 안건의 것도 아닌 자료는 회의 전체의 것이므로 앞에 둔다.
 */
export async function meetingDocuments(
  db: Db,
  orgId: string,
  meetingId: string,
): Promise<MeetingDocument[] | null> {
  if (!(await meetingExists(db, orgId, meetingId))) return null

  const rows = await db
    .select({
      id: documents.id,
      title: documents.title,
      agendaId: documents.agendaId,
      // **이어 붙인 표도 자기 조직을 확인한다.** 안건을 id로만 이으면 남의 조직의
      // 안건 차례가 우리 목록의 차례를 정한다.
      sortOrder: meetingAgendas.sortOrder,
    })
    .from(documents)
    .leftJoin(
      meetingAgendas,
      and(eq(documents.agendaId, meetingAgendas.id), eq(meetingAgendas.orgId, orgId)),
    )
    .where(and(eq(documents.orgId, orgId), eq(documents.meetingId, meetingId)))

  return rows
    .sort(
      (left, right) =>
        (left.sortOrder ?? -1) - (right.sortOrder ?? -1) ||
        left.title.localeCompare(right.title),
    )
    .map((row) => ({
      documentId: row.id,
      // 받아 갈 때 이 조각을 가리킨다 — 표가 든 이름이 곧 파일 이름이다.
      name: row.title,
      // **없으면 오지 않는다**(명세가 optional로 적었다). 빈 글을 주면 '회의 전체에
      // 붙은 자료'와 '안건 이름이 비었다'가 화면에서 같은 모양이 된다.
      ...(row.agendaId === null ? {} : { agendaId: row.agendaId }),
    }))
}
