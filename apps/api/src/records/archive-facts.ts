import { and, asc, eq, inArray, ne, sql } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import {
  attendanceCheckIns,
  attendanceQrs,
  budgetItems,
  departments,
  documents,
  eventArchives,
  events,
  eventStaffMembers,
  meetingAgendas,
  meetings,
  members,
  payments,
  purchaseRequests,
  surveyApplications,
  surveys,
  tasks,
} from '../db/schema.ts'
import { NotFound } from '../routes.ts'
import { isOverdue, type TaskStatus } from '../tasks/labels.ts'

// 아카이브가 세는 사실들(REC-02 · REC-02A).
//
// **표에 없는 것은 여기서도 만들지 않는다.** 이 파일이 하는 일은 한 행사에 딸린
// 표들을 세어 오는 것뿐이고, 말과 색을 붙이는 일은 `archive-body.ts`가 한다.
//
// **세는 규칙은 완료된 행사 목록(REC-01)과 같다** — 참석은 그 행사의 QR 전부에 찍힌
// 것을, 신청은 그 행사의 설문 전부에 낸 것을 센다(`completed.ts`의 highlights).
// 같은 영역의 두 화면이 '2명 참석 (신청 3명)'을 다른 수로 말하면 안 된다.

/** 아카이브가 읽는 행사의 사실. */
export interface ArchiveEvent {
  id: string
  title: string
  status: string
  purpose: string | null
  audience: string | null
  startAt: Date | null
  endAt: Date | null
  place: string | null
  placeUnset: boolean
  capacity: string | null
  capacityType: string
  capacityCount: number | null
  hostDepartment: string | null
  hostMember: string | null
  createdAt: Date
}

export type ArchiveRow = typeof eventArchives.$inferSelect

/**
 * 이 학생회의 그 행사와, 있으면 그 아카이브 줄.
 *
 * **줄이 없어도 행사가 있으면 답한다.** 아무것도 안 쓴 행사의 아카이브는 **빈 초안**이다 —
 * 명세가 '아직 아무것도 안 쓴 문서도 이것을 읽고 열린다'고 적었고(`record.archiveDraft`),
 * 줄을 만드는 동작은 따로 없다(임시 저장이 처음 만든다).
 *
 * **남의 학생회 행사는 없는 것이다.** 이어 붙인 표도 자기 학생회를 확인한다.
 */
export async function archiveOf(
  db: Db,
  orgId: string,
  eventId: string,
): Promise<{ event: ArchiveEvent; row: ArchiveRow | null }> {
  const found = await db
    .select({
      id: events.id,
      title: events.title,
      status: events.status,
      purpose: events.purpose,
      audience: events.audience,
      startAt: events.startAt,
      endAt: events.endAt,
      place: events.place,
      placeUnset: events.placeUnset,
      capacity: events.capacity,
      capacityType: events.capacityType,
      capacityCount: events.capacityCount,
      hostDepartment: departments.name,
      hostMember: members.name,
      createdAt: events.createdAt,
    })
    .from(events)
    .leftJoin(
      departments,
      and(eq(events.hostDepartmentId, departments.id), eq(departments.orgId, orgId)),
    )
    .leftJoin(members, and(eq(events.hostMemberId, members.id), eq(members.orgId, orgId)))
    .where(and(eq(events.orgId, orgId), eq(events.id, eventId)))
    .limit(1)
  const event = found[0]
  if (event === undefined) throw new NotFound('그 행사를 찾지 못했습니다')

  const rows = await db
    .select()
    .from(eventArchives)
    .where(and(eq(eventArchives.orgId, orgId), eq(eventArchives.eventId, eventId)))
    .limit(1)
  return { event, row: rows[0] ?? null }
}

/** 이 학생회의 그 구성원의 이름. 없으면 null — 지워진 사람의 이름을 지어내지 않는다. */
export async function memberNameOf(
  db: Db,
  orgId: string,
  memberId: string | null,
): Promise<string | null> {
  if (memberId === null) return null
  const rows = await db
    .select({ name: members.name })
    .from(members)
    .where(and(eq(members.orgId, orgId), eq(members.id, memberId)))
    .limit(1)
  return rows[0]?.name ?? null
}

/** 이 학생회의 그 부서의 이름. 없으면 null. */
export async function departmentNameOf(
  db: Db,
  orgId: string,
  departmentId: string | null,
): Promise<string | null> {
  if (departmentId === null) return null
  const rows = await db
    .select({ name: departments.name })
    .from(departments)
    .where(and(eq(departments.orgId, orgId), eq(departments.id, departmentId)))
    .limit(1)
  return rows[0]?.name ?? null
}

export interface ArchiveFacts {
  /** 그 행사의 설문 전부에 낸 신청. */
  applications: number
  /** 그 행사의 QR 전부에 찍힌 참석. */
  checkIns: number
  /** 지금의 설문(가장 최근 것)이 열리고 닫힌 때. 설문이 없으면 null. */
  survey: { opensAt: Date | null; closesAt: Date | null } | null
  tasks: { total: number; done: number; overdue: number }
  /** 배정된 예산의 합(원)과 실제로 낸 돈의 합(원). */
  budget: number
  spent: number
  /** 임시 저장·취소를 뺀 회의. 결정은 안건의 확정된 결정을 센 것이다. */
  meetings: Array<{ id: string; title: string; at: Date | null; decisions: number }>
  documents: { total: number; categories: string[] }
  /** 낸 구매 요청(초안 제외)과 그중 정산을 끝낸 것. */
  purchase: { requests: number; settled: Array<{ id: string; title: string; at: Date }> }
  payments: Array<{ id: string; vendor: string; paidOn: Date | null; amount: number }>
  /** 행사 운영 조직에 든 사람 수. */
  staff: number
}

/** 그 행사의 표들을 센다. `now`는 업무의 지연을 가르는 데만 쓴다. */
export async function archiveFacts(
  db: Db,
  orgId: string,
  eventId: string,
  now: Date,
): Promise<ArchiveFacts> {
  const [applied, attended, taskRows, budgets, spent, meetingRows, documentRows, requestRows, paymentRows, staff] =
    await Promise.all([
      db
        .select({ total: sql<number>`count(*)::int` })
        .from(surveyApplications)
        .innerJoin(surveys, eq(surveyApplications.surveyId, surveys.id))
        .where(and(eq(surveys.orgId, orgId), eq(surveys.eventId, eventId))),
      db
        .select({ total: sql<number>`count(*)::int` })
        .from(attendanceCheckIns)
        .innerJoin(attendanceQrs, eq(attendanceCheckIns.qrId, attendanceQrs.id))
        .where(and(eq(attendanceQrs.orgId, orgId), eq(attendanceQrs.eventId, eventId))),
      db
        .select({ status: tasks.status, dueDate: tasks.dueDate })
        .from(tasks)
        .where(and(eq(tasks.orgId, orgId), eq(tasks.eventId, eventId))),
      db
        .select({ total: sql<number>`coalesce(sum(${budgetItems.amount}), 0)::int` })
        .from(budgetItems)
        .where(and(eq(budgetItems.orgId, orgId), eq(budgetItems.eventId, eventId))),
      db
        .select({ total: sql<number>`coalesce(sum(${payments.paidAmount}), 0)::int` })
        .from(payments)
        .innerJoin(purchaseRequests, eq(payments.requestId, purchaseRequests.id))
        .where(and(eq(payments.orgId, orgId), eq(purchaseRequests.eventId, eventId))),
      db
        .select({
          id: meetings.id,
          title: meetings.title,
          scheduledAt: meetings.scheduledAt,
          startedAt: meetings.startedAt,
        })
        .from(meetings)
        .where(
          and(
            eq(meetings.orgId, orgId),
            eq(meetings.eventId, eventId),
            // 임시 저장한 회의는 아직 아무에게도 알리지 않은 것이고 취소된 회의는 열리지 않았다.
            sql`${meetings.status} not in ('draft', 'cancelled')`,
          ),
        )
        .orderBy(asc(meetings.scheduledAt), asc(meetings.id)),
      db
        .select({ category: documents.category })
        .from(documents)
        .where(and(eq(documents.orgId, orgId), eq(documents.eventId, eventId)))
        .orderBy(asc(documents.createdAt), asc(documents.id)),
      db
        .select({
          id: purchaseRequests.id,
          title: purchaseRequests.title,
          evidenceCompletedAt: purchaseRequests.evidenceCompletedAt,
        })
        .from(purchaseRequests)
        .where(
          and(
            eq(purchaseRequests.orgId, orgId),
            eq(purchaseRequests.eventId, eventId),
            // 아직 안 낸 요청은 근거가 아니다.
            ne(purchaseRequests.stage, 'draft'),
          ),
        )
        .orderBy(asc(purchaseRequests.createdAt), asc(purchaseRequests.id)),
      db
        .select({
          id: payments.id,
          vendor: payments.vendor,
          paidOn: payments.paidOn,
          amount: payments.paidAmount,
        })
        .from(payments)
        .innerJoin(purchaseRequests, eq(payments.requestId, purchaseRequests.id))
        .where(and(eq(payments.orgId, orgId), eq(purchaseRequests.eventId, eventId)))
        .orderBy(asc(payments.paidOn), asc(payments.id)),
      db
        .select({ total: sql<number>`count(*)::int` })
        .from(eventStaffMembers)
        .where(and(eq(eventStaffMembers.orgId, orgId), eq(eventStaffMembers.eventId, eventId))),
    ])

  const decisions = await decisionsOf(
    db,
    orgId,
    meetingRows.map((row) => row.id),
  )

  const categories: string[] = []
  for (const row of documentRows) {
    const category = (row.category ?? '').trim()
    if (category !== '' && !categories.includes(category)) categories.push(category)
  }

  return {
    applications: Number(applied[0]?.total ?? 0),
    checkIns: Number(attended[0]?.total ?? 0),
    survey: await currentSurveyOf(db, orgId, eventId),
    tasks: {
      total: taskRows.length,
      done: taskRows.filter((row) => row.status === 'done').length,
      overdue: taskRows.filter((row) => isOverdue(row.dueDate, row.status as TaskStatus, now))
        .length,
    },
    budget: Number(budgets[0]?.total ?? 0),
    spent: Number(spent[0]?.total ?? 0),
    meetings: meetingRows.map((row) => ({
      id: row.id,
      title: row.title,
      // 실제로 시작한 때가 있으면 그것이 회의의 때다. 없으면 잡아 둔 때다.
      at: row.startedAt ?? row.scheduledAt,
      decisions: decisions.get(row.id) ?? 0,
    })),
    documents: { total: documentRows.length, categories },
    purchase: {
      requests: requestRows.length,
      settled: requestRows
        .filter((row): row is typeof row & { evidenceCompletedAt: Date } => row.evidenceCompletedAt !== null)
        .map((row) => ({ id: row.id, title: row.title, at: row.evidenceCompletedAt })),
    },
    payments: paymentRows,
    staff: Number(staff[0]?.total ?? 0),
  }
}

/** 회의마다 확정된 결정이 몇인가. 결정은 안건마다 한 칸이라 셀 수 있다. */
async function decisionsOf(
  db: Db,
  orgId: string,
  meetingIds: string[],
): Promise<Map<string, number>> {
  const counted = new Map<string, number>()
  if (meetingIds.length === 0) return counted
  const rows = await db
    .select({ meetingId: meetingAgendas.meetingId, decisionText: meetingAgendas.decisionText })
    .from(meetingAgendas)
    .where(and(eq(meetingAgendas.orgId, orgId), inArray(meetingAgendas.meetingId, meetingIds)))
  for (const row of rows) {
    if ((row.decisionText ?? '').trim() === '') continue
    counted.set(row.meetingId, (counted.get(row.meetingId) ?? 0) + 1)
  }
  return counted
}

/** 지금 이 행사의 설문. 교체하면 여러 줄이 남으므로 가장 최근 것이다(`events/counts.ts`와 같은 규칙). */
async function currentSurveyOf(
  db: Db,
  orgId: string,
  eventId: string,
): Promise<{ opensAt: Date | null; closesAt: Date | null } | null> {
  const rows = await db
    .select({ opensAt: surveys.opensAt, closesAt: surveys.closesAt })
    .from(surveys)
    .where(and(eq(surveys.orgId, orgId), eq(surveys.eventId, eventId)))
    .orderBy(sql`${surveys.createdAt} desc`, sql`${surveys.id} desc`)
    .limit(1)
  return rows[0] ?? null
}
