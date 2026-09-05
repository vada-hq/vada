import { and, asc, count, eq, ilike, inArray, isNull, or, sql } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import {
  attendanceCheckIns,
  attendanceQrs,
  budgetItems,
  departments,
  eventArchives,
  events,
  members,
  payments,
  purchaseRequests,
  surveyApplications,
  surveys,
  tasks,
} from '../db/schema.ts'
import { day } from '../time.ts'

// 완료된 행사(REC-01).
//
// **`event.list`와 다른 물건이다** — 저쪽에는 완료된 행사가 오지 않는다고 명세가
// 적었다. 여기는 끝난 것만 모아 놓고 그 기록으로 들어가는 문이다.
//
// **발행된 아카이브의 본문은 여기 오지 않는다.** 발행하는 동작이 명세에 없고
// (`record.archive.requestReview`가 '발행이 아니다'라고 못 박았다) 이 자리는
// 발행이 아니라 **완료된 행사를 세는 자리**다.

export type ArchiveStatus = 'draft' | 'inReview' | 'published'

/**
 * 인수인계 문서가 어디까지 왔는가. **표에 있는 것은 갈래이고 말과 색은 여기서 붙는다.**
 *
 * 문서가 아예 없는 것과 쓰다 만 것은 다른 사실이지만, 화면이 묻는 것은 '발행됐는가'라
 * 둘 다 미발행으로 그린다 — 명세가 딱지를 셋만 그렸다(발행 · 검토 중 · 미발행).
 *
 * 아카이브 화면 둘(REC-02 · REC-02A)도 이 표를 쓴다 — 목록이 '인수인계 문서 미발행'이라
 * 부른 문서를 열었을 때 같은 말이어야 한다.
 */
export const ARCHIVE: Record<ArchiveStatus, { label: string; tone: string }> = {
  draft: { label: '인수인계 문서 미발행', tone: 'gray' },
  inReview: { label: '검토 중', tone: 'blue' },
  published: { label: '발행 완료', tone: 'green' },
}

const NONE = { label: '인수인계 문서 미발행', tone: 'gray' }

export interface CompletedEvent {
  id: string
  statusLabel: string
  archiveStatus: string
  archiveStatusTone: string
  title: string
  date: string
  host: string
  highlights: Array<{ label: string }>
  completedNote: string
  actionLabel?: string
  blockedNote?: string
  targetKind?: string
}

/**
 * 완료 처리된 행사들. 행사명으로 서버가 거른다.
 *
 * **차례는 최근에 열린 것이 먼저다.** 인수인계는 방금 끝난 행사부터 필요하다.
 */
export async function completedEvents(
  db: Db,
  orgId: string,
  asked: { query?: string },
): Promise<CompletedEvent[]> {
  const wanted = (asked.query ?? '').trim()
  const rows = await db
    .select({
      id: events.id,
      title: events.title,
      startAt: events.startAt,
      departmentName: departments.name,
      hostName: members.name,
      archiveStatus: eventArchives.status,
    })
    .from(events)
    .leftJoin(
      departments,
      and(eq(events.hostDepartmentId, departments.id), eq(departments.orgId, orgId)),
    )
    .leftJoin(members, and(eq(events.hostMemberId, members.id), eq(members.orgId, orgId)))
    .leftJoin(
      eventArchives,
      and(eq(eventArchives.eventId, events.id), eq(eventArchives.orgId, orgId)),
    )
    .where(
      and(
        eq(events.orgId, orgId),
        eq(events.status, 'done'),
        wanted === '' ? undefined : ilike(events.title, `%${wanted}%`),
      ),
    )
    // **날짜가 없는 행사는 뒤로.** Postgres는 내림차순에서 빈 값을 앞에 놓는데,
    // 그러면 '일시 미정'인 행사가 가장 최근인 것처럼 목록 맨 위에 선다.
    .orderBy(sql`${events.startAt} desc nulls last`, asc(events.title))

  const marks = await highlightsOf(
    db,
    orgId,
    rows.map((row) => row.id),
  )

  return rows.map((row) => {
    const archive = row.archiveStatus === null ? NONE : ARCHIVE[row.archiveStatus as ArchiveStatus]
    return {
      id: row.id,
      // 이 목록에는 완료된 것만 오지만 무엇이라 부를지는 조직이 정한다.
      statusLabel: '완료',
      archiveStatus: archive.label,
      archiveStatusTone: archive.tone,
      title: row.title,
      date: row.startAt === null ? '일시 미정' : day(row.startAt),
      // 맡은 부서 또는 사람. 둘 다 없으면 그 사실을 말한다.
      host: row.departmentName ?? row.hostName ?? '담당 미정',
      highlights: (marks.get(row.id) ?? []).map((label) => ({ label })),
      // **완료 처리된 때를 담는 열이 없다.** 표에는 지금 어느 단계인지만 있고
      // 언제 그리 됐는지는 아무도 적지 않는다 — 지어내지 않고 그 사실을 말한다.
      completedNote: '완료 처리일 미정',
      // 갈 곳이 있으면 단추, 없으면 그 까닭. **둘 중 하나만 온다.**
      ...(row.archiveStatus === null
        ? { blockedNote: '인수인계 문서가 아직 발행되지 않았습니다' }
        : {
            actionLabel: '상세 보기 →',
            // 발행된 문서는 읽는 화면으로, 아직 아닌 것은 쓰고 검토받는 화면으로.
            targetKind: row.archiveStatus === 'published' ? 'published' : 'draft',
          }),
    }
  })
}

export interface CompletedEventAlert {
  unpublishedNote?: string
}

/**
 * 목록 머리의 알림.
 *
 * **검색으로 목록이 걸러져도 이 수는 걸러지지 않는다** — 명세가 그렇게 적었다.
 * 한 건도 없으면 조각 자체가 오지 않는다.
 */
export async function completedEventAlert(db: Db, orgId: string): Promise<CompletedEventAlert> {
  const rows = await db
    .select({ total: count() })
    .from(events)
    .leftJoin(
      eventArchives,
      and(eq(eventArchives.eventId, events.id), eq(eventArchives.orgId, orgId)),
    )
    .where(
      and(
        eq(events.orgId, orgId),
        eq(events.status, 'done'),
        or(isNull(eventArchives.status), sql`${eventArchives.status} <> 'published'`),
      ),
    )

  const total = rows[0]?.total ?? 0
  return total === 0 ? {} : { unpublishedNote: `인수인계 문서 미발행 ${total}건` }
}

/**
 * 행사마다 눈에 띄어야 하는 것들.
 *
 * **개수가 행사마다 다르다** — 무엇을 앞세울지는 서버가 정하고, 바탕이 되는 사실이
 * 없으면 그 딱지는 오지 않는다. 0명 참석과 '참석을 안 셌다'는 다른 사실이다.
 *
 * 예산 집행률은 **배정 예산이 있을 때만** 나온다. 예산을 넣는 화면이 아직 없어
 * 대개 그 딱지가 오지 않는데, 그것이 참이다.
 */
async function highlightsOf(
  db: Db,
  orgId: string,
  eventIds: readonly string[],
): Promise<Map<string, string[]>> {
  const found = new Map<string, string[]>()
  if (eventIds.length === 0) return found
  const ids = [...eventIds]

  const attended = await db
    .select({ eventId: attendanceQrs.eventId, total: count() })
    .from(attendanceCheckIns)
    .innerJoin(attendanceQrs, eq(attendanceCheckIns.qrId, attendanceQrs.id))
    .where(and(eq(attendanceQrs.orgId, orgId), inArray(attendanceQrs.eventId, ids)))
    .groupBy(attendanceQrs.eventId)

  const applied = await db
    .select({ eventId: surveys.eventId, total: count() })
    .from(surveyApplications)
    .innerJoin(surveys, eq(surveyApplications.surveyId, surveys.id))
    .where(and(eq(surveys.orgId, orgId), inArray(surveys.eventId, ids)))
    .groupBy(surveys.eventId)

  const doneTasks = await db
    .select({ eventId: tasks.eventId, total: count() })
    .from(tasks)
    .where(and(eq(tasks.orgId, orgId), inArray(tasks.eventId, ids), eq(tasks.status, 'done')))
    .groupBy(tasks.eventId)

  const budgets = await db
    .select({
      eventId: budgetItems.eventId,
      total: sql<number>`coalesce(sum(${budgetItems.amount}), 0)::int`,
    })
    .from(budgetItems)
    .where(and(eq(budgetItems.orgId, orgId), inArray(budgetItems.eventId, ids)))
    .groupBy(budgetItems.eventId)

  const spent = await db
    .select({
      eventId: purchaseRequests.eventId,
      total: sql<number>`coalesce(sum(${payments.paidAmount}), 0)::int`,
    })
    .from(payments)
    .innerJoin(purchaseRequests, eq(payments.requestId, purchaseRequests.id))
    .where(and(eq(payments.orgId, orgId), inArray(purchaseRequests.eventId, ids)))
    .groupBy(purchaseRequests.eventId)

  const numberOf = (rows: Array<{ eventId: string | null; total: number }>, id: string) =>
    rows.find((row) => row.eventId === id)?.total ?? 0

  for (const id of ids) {
    const marks: string[] = []
    const checkIns = numberOf(attended, id)
    const applications = numberOf(applied, id)
    if (checkIns > 0 || applications > 0) {
      marks.push(`${checkIns}명 참석 (신청 ${applications}명)`)
    }
    const budget = numberOf(budgets, id)
    if (budget > 0) {
      marks.push(`예산 집행 ${Math.round((numberOf(spent, id) / budget) * 100)}%`)
    }
    const done = numberOf(doneTasks, id)
    if (done > 0) marks.push(`완료 업무 ${done}건`)
    found.set(id, marks)
  }
  return found
}
