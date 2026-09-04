import { orgOf, type Handlers } from '../deps.ts'
import {
  eventDocuments,
  eventDocumentStats,
  eventDocumentStatusCounts,
} from '../documents/event.ts'
import { meetingDocuments } from '../documents/meeting.ts'
import { taskReferenceDocuments, taskWorkDocuments } from '../documents/task.ts'
import { NotFound } from '../routes.ts'

// 문서(EVT-DOC-01 · OPS-MEET-03A/05A/07 · EVT-TASK-02).
//
// **행사 문서·회의 자료·업무 문서가 한 표다**(`documents`). 명세가 그렇게 말한다 —
// 회의 쪽은 '안건의 사전 자료와 회의록의 관련 자료가 같은 물건'이라 적었고, 업무
// 쪽은 참고 문서가 '행사의 공용 원본이라 여러 업무가 같은 것을 본다'고 적었다.
//
// 그래서 영역을 화면 이름이 아니라 표로 갈랐다 — 자리마다 갈라 지으면 같은 표가
// 화면마다 다른 모양으로 읽힌다.
//
// **쓰기가 없다.** 문서를 만들거나 올리는 동작을 명세가 주지 않았고(회의의 '자료
// 첨부'는 고르는 자리가 안 그려졌다고 적혀 있다), 표도 파일을 담지 않는다.

export const documentHandlers: Handlers = {
  // ── 행사 문서(EVT-DOC-01) ──────────────────────────────────────────────
  //
  // **거르개가 고른 값을 서버가 받는다.** 받아온 것을 화면에서 거르지 않는다.
  'event.documents': async (c, d) => {
    const eventId = c.req.query('eventId')!
    c.set('auditSubject', { type: 'event', id: eventId })
    return eventDocuments(d.db, orgOf(c), eventId, { status: c.req.query('status') })
  },

  // 타일과 개수는 **고른 상태를 받지 않는다** — 그 행사의 문서 전체를 센다.
  //
  // **없는 것은 없다고 말한다.** 남의 학생회 행사도 같은 답이다 — 밖에서 그 둘이
  // 갈려 보이면 남의 행사가 있는지를 주소로 물어볼 수 있게 된다.
  'event.documentStats': async (c, d) => {
    const eventId = c.req.query('eventId')!
    c.set('auditSubject', { type: 'event', id: eventId })
    const row = await eventDocumentStats(d.db, orgOf(c), eventId)
    if (row === null) throw new NotFound('그 행사를 찾지 못했습니다')
    return row
  },
  'event.documentStatusCounts': async (c, d) => {
    const eventId = c.req.query('eventId')!
    c.set('auditSubject', { type: 'event', id: eventId })
    const row = await eventDocumentStatusCounts(d.db, orgOf(c), eventId)
    if (row === null) throw new NotFound('그 행사를 찾지 못했습니다')
    return row
  },

  // ── 회의 자료(OPS-MEET-03A · 05A · 07) ─────────────────────────────────
  //
  // 화면 셋이 같은 자리를 부른다. 안건의 사전 자료와 회의록의 관련 자료가 같은
  // 물건이라, 어느 안건의 것인지는 조각(`agendaId`)이 알린다.
  'meeting.documents': async (c, d) => {
    const meetingId = c.req.param('meetingId')!
    c.set('auditSubject', { type: 'meeting', id: meetingId })
    const rows = await meetingDocuments(d.db, orgOf(c), meetingId)
    if (rows === null) throw new NotFound('그 회의를 찾지 못했습니다')
    return rows
  },

  // ── 업무 상세의 문서 둘(EVT-TASK-02) ───────────────────────────────────
  //
  // **계약이 이 둘에 404를 두지 않았다.** 목록인 자리라 빈 목록이 곧 '없다'는
  // 답이고, 남의 학생회 업무를 물어도 같은 빈 목록이다.
  'task.referenceDocuments': async (c, d) => {
    const taskId = c.req.query('taskId')!
    c.set('auditSubject', { type: 'task', id: taskId })
    return taskReferenceDocuments(d.db, orgOf(c), taskId)
  },
  'task.workDocuments': async (c, d) => {
    const taskId = c.req.query('taskId')!
    c.set('auditSubject', { type: 'task', id: taskId })
    return taskWorkDocuments(d.db, orgOf(c), taskId)
  },
}
