import { and, desc, eq, ne, sql } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import {
  attendanceQrs,
  departments,
  documents,
  events,
  meetings,
  members,
  students,
  surveyApplications,
  surveys,
  tasks,
} from '../db/schema.ts'

// 행사 개요(EVT-02)와 후속 정리 개요(EVT-02D)가 **함께 세는 것.**
//
// 두 화면이 같은 사실을 서로 다르게 세면 같은 행사가 갈피마다 다른 수를 갖는다 —
// '확인 필요 참가자'가 개요에서는 여섯이고 마무리에서는 넷이 되는 식이다. 그래서
// 세는 규칙을 여기 한 곳에 둔다. 말과 색을 붙이는 일은 각자의 화면 파일이 한다.
//
// **표에 없는 것은 여기서도 만들지 않는다.** 이 파일이 하는 일은 표를 세는 것뿐이다.

/** 이 행사에 딸린, 두 화면이 함께 보는 사실들. */
export interface EventFacts {
  id: string
  title: string
  status: string
  startAt: Date | null
  place: string | null
  capacityType: string
  capacityCount: number | null
  hostDepartment: string | null
  hostMember: string | null
  createdAt: Date
  updatedAt: Date
}

/**
 * 이 학생회의 그 행사.
 *
 * **없으면 null이다** — 404로 되돌릴지 빈 목록으로 답할지는 자리마다 다르고,
 * 그것은 계약이 정한다(개요의 목록 둘에는 404가 없다).
 */
export async function eventFacts(
  db: Db,
  orgId: string,
  eventId: string,
): Promise<EventFacts | null> {
  const rows = await db
    .select({
      id: events.id,
      title: events.title,
      status: events.status,
      startAt: events.startAt,
      place: events.place,
      capacityType: events.capacityType,
      capacityCount: events.capacityCount,
      hostDepartment: departments.name,
      hostMember: members.name,
      createdAt: events.createdAt,
      updatedAt: events.updatedAt,
    })
    .from(events)
    // 이어 붙인 표도 자기 학생회를 확인한다 — 이음매마다 울타리를 다시 세운다.
    .leftJoin(
      departments,
      and(eq(events.hostDepartmentId, departments.id), eq(departments.orgId, orgId)),
    )
    .leftJoin(members, and(eq(events.hostMemberId, members.id), eq(members.orgId, orgId)))
    .where(and(eq(events.orgId, orgId), eq(events.id, eventId)))
    .limit(1)
  return rows[0] ?? null
}

export interface SurveyFacts {
  id: string
  active: boolean
  replacedById: string | null
  opensAt: Date | null
  closesAt: Date | null
  applyMethod: string
}

/**
 * 지금 이 행사의 설문.
 *
 * **가장 최근 것이다.** 교체하면 옛 설문이 남은 채 새 것이 생기므로(옛 링크가 새
 * 설문으로 갈 수 있어야 한다) 한 행사에 여러 줄이 있을 수 있다.
 *
 * **없으면 null이다.** 던지지 않는 까닭은 이것을 읽는 자리가 둘로 갈리기 때문이다 —
 * 설문 화면(EVT-05B)은 설문이 없으면 열릴 까닭이 없어 404가 맞고, 개요는 설문을
 * 아직 안 만들었다는 것 자체를 그려야 한다.
 */
export async function currentSurvey(
  db: Db,
  orgId: string,
  eventId: string,
): Promise<SurveyFacts | null> {
  const rows = await db
    .select({
      id: surveys.id,
      active: surveys.active,
      replacedById: surveys.replacedById,
      opensAt: surveys.opensAt,
      closesAt: surveys.closesAt,
      applyMethod: surveys.applyMethod,
    })
    .from(surveys)
    .where(and(eq(surveys.orgId, orgId), eq(surveys.eventId, eventId)))
    .orderBy(desc(surveys.createdAt), desc(surveys.id))
    .limit(1)
  return rows[0] ?? null
}

export interface Applicants {
  total: number
  paid: number
  unpaid: number
  unknown: number
  /** 학생 명단과 어긋나 사람이 봐야 하는 신청. 아래 `needsCheck`를 보라. */
  needsCheck: number
}

const NO_APPLICANTS: Applicants = { total: 0, paid: 0, unpaid: 0, unknown: 0, needsCheck: 0 }

/**
 * 낸 신청을 센다.
 *
 * **지금의 설문에 낸 것만 센다.** 교체된 설문의 응답은 보관되지만 새 설문에 다시
 * 내야 하므로(`event.surveyReplaceImpact`가 그렇게 말한다) 지금의 모집 현황이 아니다.
 */
export async function applicantsOf(
  db: Db,
  orgId: string,
  survey: SurveyFacts | null,
): Promise<Applicants> {
  if (survey === null) return NO_APPLICANTS
  const rows = await db
    .select({
      name: surveyApplications.name,
      payStatus: surveyApplications.payStatus,
      rosterName: students.name,
    })
    .from(surveyApplications)
    // **학생 명단과 대조한다.** 같은 학생회의 명단만 본다 — 학번은 학교마다 겹칠 수 있다.
    .leftJoin(
      students,
      and(
        eq(students.orgId, orgId),
        eq(students.studentNumber, surveyApplications.studentNumber),
      ),
    )
    .where(eq(surveyApplications.surveyId, survey.id))

  const counted = { ...NO_APPLICANTS, total: rows.length }
  for (const row of rows) {
    if (row.payStatus === 'paid') counted.paid += 1
    else if (row.payStatus === 'unpaid') counted.unpaid += 1
    else counted.unknown += 1
    if (needsCheck(row)) counted.needsCheck += 1
  }
  return counted
}

/**
 * 이 신청을 사람이 봐야 하는가.
 *
 * **명세가 그 까닭을 적어 두었다**: '학번·이름 불일치 또는 명단 외 학생'
 * (`event.checklist`의 detail). 그래서 근거는 학생 명단 하나뿐이다.
 *
 * **납부 상태는 여기 들지 않는다.** 표가 '미확인'을 기본으로 두므로(안 냈다는
 * 것과 아직 확인 안 했다는 것은 다른 사실이다) 그것을 섞으면 아무 일도 없는
 * 행사에서 신청자 전원이 '확인 필요'가 된다.
 */
function needsCheck(row: { name: string; rosterName: string | null }): boolean {
  return row.rosterName === null || row.rosterName !== row.name
}

export interface OpenTask {
  id: string
  title: string
  status: string
  dueDate: Date | null
  department: string | null
  assignee: string | null
}

/**
 * 아직 안 끝난 업무. **마감이 이른 것부터, 기한이 없는 것은 뒤로.**
 *
 * 행사 목록·일정이 쓰는 차례와 같다 — 같은 업무가 화면마다 다른 자리에 놓이면
 * 사람이 같은 것을 두 번 찾는다.
 */
export async function openTasksOf(db: Db, orgId: string, eventId: string): Promise<OpenTask[]> {
  const rows = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      status: tasks.status,
      dueDate: tasks.dueDate,
      department: departments.name,
      assignee: members.name,
    })
    .from(tasks)
    .leftJoin(departments, and(eq(tasks.departmentId, departments.id), eq(departments.orgId, orgId)))
    .leftJoin(members, and(eq(tasks.assigneeMemberId, members.id), eq(members.orgId, orgId)))
    .where(and(eq(tasks.orgId, orgId), eq(tasks.eventId, eventId), ne(tasks.status, 'done')))
  return rows.sort((left, right) => orderKey(left).localeCompare(orderKey(right)))
}

function orderKey(row: { dueDate: Date | null; title: string }): string {
  return `${row.dueDate === null ? '9' : '0'}${row.dueDate?.toISOString() ?? ''}${row.title}`
}

/**
 * 아직 정리되지 않은 문서.
 *
 * **표에 '정리됐다'는 열이 없다.** 문서가 아는 사실은 단계뿐이고, 확정된 문서는 더
 * 고칠 것이 없다는 뜻이므로 그것을 정리된 것으로 읽는다 — `documents/labels.ts`의
 * `officialReflection`이 같은 근거로 같은 판단을 이미 하고 있다.
 */
export async function unorganizedDocumentCount(
  db: Db,
  orgId: string,
  eventId: string,
): Promise<number> {
  const rows = await db
    .select({ left: sql<number>`count(*)::int` })
    .from(documents)
    .where(
      and(
        eq(documents.orgId, orgId),
        eq(documents.eventId, eventId),
        ne(documents.status, 'confirmed'),
      ),
    )
  return Number(rows[0]?.left ?? 0)
}

/**
 * 아직 안 쓴 회의록.
 *
 * **취소된 회의와 임시 저장한 회의는 세지 않는다.** 취소된 회의는 열리지 않았으므로
 * 쓸 회의록이 없고, 임시 저장한 회의는 아직 아무에게도 알리지 않은 것이다 —
 * 회의 목록과 행사 일정이 이미 같은 까닭으로 그 둘을 뺀다.
 */
export async function unwrittenMinutesCount(
  db: Db,
  orgId: string,
  eventId: string,
): Promise<number> {
  const rows = await db
    .select({ left: sql<number>`count(*)::int` })
    .from(meetings)
    .where(
      and(
        eq(meetings.orgId, orgId),
        eq(meetings.eventId, eventId),
        ne(meetings.minutesStatus, 'done'),
        sql`${meetings.status} not in ('draft', 'cancelled')`,
      ),
    )
  return Number(rows[0]?.left ?? 0)
}

export interface MeetingMoment {
  title: string
  scheduledAt: Date | null
  owner: string | null
}

/** 이 행사에 걸린 회의의 때. 다음 핵심 일정이 이것을 함께 본다. */
export async function meetingMomentsOf(
  db: Db,
  orgId: string,
  eventId: string,
): Promise<MeetingMoment[]> {
  return db
    .select({
      title: meetings.title,
      scheduledAt: meetings.scheduledAt,
      owner: members.name,
    })
    .from(meetings)
    .leftJoin(members, and(eq(meetings.creatorMemberId, members.id), eq(members.orgId, orgId)))
    .where(
      and(
        eq(meetings.orgId, orgId),
        eq(meetings.eventId, eventId),
        // 임시 저장한 회의는 아직 아무에게도 알리지 않은 것이다.
        ne(meetings.status, 'draft'),
      ),
    )
}

export interface QrFacts {
  active: boolean
  opensAt: Date | null
  closesAt: Date | null
}

/** 이 행사의 참석 확인 QR. 아직 안 만들었으면 null이다. */
export async function attendanceQrOf(
  db: Db,
  orgId: string,
  eventId: string,
): Promise<QrFacts | null> {
  const rows = await db
    .select({
      active: attendanceQrs.active,
      opensAt: attendanceQrs.opensAt,
      closesAt: attendanceQrs.closesAt,
    })
    .from(attendanceQrs)
    .where(and(eq(attendanceQrs.orgId, orgId), eq(attendanceQrs.eventId, eventId)))
    .limit(1)
  return rows[0] ?? null
}

export interface Touched {
  at: Date
  /** 그 줄이 처음 생긴 때. 손댄 때와 같으면 **더해진 것**이고 다르면 고쳐진 것이다. */
  createdAt: Date
  title: string
}

/**
 * 이 행사에 딸린 것들이 마지막으로 손대진 때.
 *
 * **표는 무엇이 바뀌었는지를 모른다.** 아는 것은 어느 줄이 언제 손대졌는가뿐이라,
 * 여기서 만드는 것도 거기까지다 — 무엇이 무엇으로 바뀌었는지를 담는 자리가
 * 명세에 생기는 날 이 함수가 그 표를 읽는다.
 */
export async function touchedOf(db: Db, orgId: string, eventId: string): Promise<Touched[]> {
  const [taskRows, documentRows, meetingRows] = await Promise.all([
    db
      .select({ at: tasks.updatedAt, createdAt: tasks.createdAt, title: tasks.title })
      .from(tasks)
      .where(and(eq(tasks.orgId, orgId), eq(tasks.eventId, eventId))),
    db
      .select({ at: documents.updatedAt, createdAt: documents.createdAt, title: documents.title })
      .from(documents)
      .where(and(eq(documents.orgId, orgId), eq(documents.eventId, eventId))),
    db
      .select({ at: meetings.updatedAt, createdAt: meetings.createdAt, title: meetings.title })
      .from(meetings)
      .where(
        and(
          eq(meetings.orgId, orgId),
          eq(meetings.eventId, eventId),
          ne(meetings.status, 'draft'),
        ),
      ),
  ])
  return [
    ...taskRows.map((row) => ({ ...row, title: label('업무', row) })),
    ...documentRows.map((row) => ({ ...row, title: label('문서', row) })),
    ...meetingRows.map((row) => ({ ...row, title: label('회의', row) })),
  ]
}

/** `업무 추가 · 현수막 반납`. 더해진 것과 고쳐진 것은 **다른 사실이다.** */
function label(kind: string, row: { at: Date; createdAt: Date; title: string }): string {
  return `${kind} ${row.at.getTime() === row.createdAt.getTime() ? '추가' : '수정'} · ${row.title}`
}

/** 이 설문에 낸 신청이 들어온 때. 하루치를 묶어 '신규 신청자 N명'이 된다. */
export async function applicationMomentsOf(
  db: Db,
  survey: SurveyFacts | null,
): Promise<Date[]> {
  if (survey === null) return []
  const rows = await db
    .select({ at: surveyApplications.at })
    .from(surveyApplications)
    .where(eq(surveyApplications.surveyId, survey.id))
  return rows.map((row) => row.at)
}
