import { and, eq, inArray, sql } from 'drizzle-orm'
import { alias, type PgDatabase, type PgQueryResultHKT } from 'drizzle-orm/pg-core'
import { REPORT_SECTIONS, type EventRecord, type EventReportResponse, type EventReportView, type PublishEventReportRequest, type RecordsResponse,
  type SaveEventReportRequest } from '@vada/contracts'
import { eventReports, users } from '../db/schema.js'
import { eventSummaries, eventSummary } from '../events/events.js'
import { requireCompletedEvent } from '../events/lock.js'
import { ApiError } from '../http/errors.js'
import { factsByEvent } from './facts.js'

type Db = PgDatabase<PgQueryResultHKT>
export type ReportDatabase = Pick<Db, 'select' | 'insert' | 'update' | 'transaction'>
type Reader = Pick<Db, 'select'>
export interface ReportScope { organizationId: string; userId: string }
const creators = alias(users, 'report_creators')
const updaters = alias(users, 'report_updaters')
const publishers = alias(users, 'report_publishers')

async function reportOf(db: Reader, organizationId: string, eventId: string): Promise<EventReportView | null> {
  const [row] = await db.select({ report: eventReports, creatorName: creators.name, updaterName: updaters.name, publisherName: publishers.name })
    .from(eventReports)
    .innerJoin(creators, eq(creators.id, eventReports.createdBy))
    .innerJoin(updaters, eq(updaters.id, eventReports.updatedBy))
    .leftJoin(publishers, eq(publishers.id, eventReports.publishedBy))
    .where(and(eq(eventReports.organizationId, organizationId), eq(eventReports.eventId, eventId)))
  if (!row) return null
  const { report } = row
  return { status: report.status, operations: report.operations, wentWell: report.wentWell, shortfalls: report.shortfalls,
    improvements: report.improvements, handover: report.handover, version: report.version,
    created: { by: { id: report.createdBy, name: row.creatorName }, at: report.createdAt.toISOString() },
    updated: { by: { id: report.updatedBy, name: row.updaterName }, at: report.updatedAt.toISOString() },
    published: report.publishedAt && report.publishedBy
      ? { by: { id: report.publishedBy, name: row.publisherName ?? '' }, at: report.publishedAt.toISOString() } : null }
}

type Transaction = Parameters<Parameters<ReportDatabase['transaction']>[0]>[0]
// 보고서 행을 잠근다. 잠금 순서는 행사(requireCompletedEvent) → 보고서다.
async function lockReport(tx: Transaction, scope: ReportScope, eventId: string) {
  const [row] = await tx.select().from(eventReports)
    .where(and(eq(eventReports.organizationId, scope.organizationId), eq(eventReports.eventId, eventId))).for('update')
  return row ?? null
}

// 응답 하나로 행사·보고서·수치를 준다. 바꾸는 요청도 같은 모양으로 돌려준다. 발행했으면 고정한 수치다.
export async function reportResponse(db: Reader, organizationId: string, eventId: string): Promise<EventReportResponse> {
  const event = await eventSummary(db, organizationId, eventId)
  const report = await reportOf(db, organizationId, eventId)
  if (report?.published) {
    const [frozen] = await db.select({ facts: eventReports.facts }).from(eventReports)
      .where(and(eq(eventReports.organizationId, organizationId), eq(eventReports.eventId, eventId)))
    if (frozen?.facts) return { event, report, facts: frozen.facts, factsAt: report.published.at }
  }
  const now = new Date()
  return { event, report, facts: (await factsByEvent(db, organizationId, [event], now)).get(eventId)!, factsAt: now.toISOString() }
}

export function createReportService(db: ReportDatabase) {
  return {
    get: (scope: ReportScope, eventId: string) => reportResponse(db, scope.organizationId, eventId),
    // 완료한 행사, 최근 완료 순. 발행한 보고서는 고정한 수치를, 나머지는 지금 센 수치를 준다.
    async records(scope: ReportScope): Promise<RecordsResponse> {
      const completed = (await eventSummaries(db, scope.organizationId)).filter(event => event.completedAt !== null)
        .sort((a, b) => b.completedAt!.localeCompare(a.completedAt!) || b.id.localeCompare(a.id))
      if (!completed.length) return { records: [] }
      const reports = await db.select({ eventId: eventReports.eventId, status: eventReports.status, publishedAt: eventReports.publishedAt,
        facts: eventReports.facts }).from(eventReports)
        .where(and(eq(eventReports.organizationId, scope.organizationId), inArray(eventReports.eventId, completed.map(event => event.id))))
      const byEvent = new Map(reports.map(row => [row.eventId, row]))
      const live = await factsByEvent(db, scope.organizationId, completed, new Date())
      return { records: completed.map((event): EventRecord => {
        const report = byEvent.get(event.id)
        return { event, report: report ? { status: report.status, publishedAt: report.publishedAt?.toISOString() ?? null } : null,
          facts: report?.status === 'published' && report.facts ? report.facts : live.get(event.id)! }
      }) }
    },
    // 다섯 칸을 한 번에 저장한다. 처음 쓰면(버전 0) 보고서를 만들고, 겹쳐 만들면 버전 충돌이다. 발행한 보고서는 고치지 않는다.
    async save(scope: ReportScope, eventId: string, input: SaveEventReportRequest): Promise<EventReportResponse> {
      return db.transaction(async tx => {
        await requireCompletedEvent(tx, scope.organizationId, eventId)
        const current = await lockReport(tx, scope, eventId)
        if (current?.status === 'published') throw new ApiError('REPORT_PUBLISHED', 409)
        if ((current?.version ?? 0) !== input.version) throw new ApiError('VERSION_CONFLICT', 409)
        const texts = { operations: input.operations, wentWell: input.wentWell, shortfalls: input.shortfalls, improvements: input.improvements,
          handover: input.handover }
        if (current) {
          await tx.update(eventReports).set({ ...texts, version: current.version + 1, updatedBy: scope.userId, updatedAt: sql`now()` })
            .where(and(eq(eventReports.organizationId, scope.organizationId), eq(eventReports.eventId, eventId)))
        } else {
          const inserted = await tx.insert(eventReports).values({ eventId, organizationId: scope.organizationId, ...texts, createdBy: scope.userId,
            updatedBy: scope.userId }).onConflictDoNothing().returning({ eventId: eventReports.eventId })
          if (!inserted.length) throw new ApiError('VERSION_CONFLICT', 409)
        }
        return reportResponse(tx, scope.organizationId, eventId)
      })
    },
    // 발행: 다섯 칸을 다 쓴 작성 중 보고서에 지금 수치와 이름을 고정한다.
    async publish(scope: ReportScope, eventId: string, input: PublishEventReportRequest): Promise<EventReportResponse> {
      return db.transaction(async tx => {
        await requireCompletedEvent(tx, scope.organizationId, eventId)
        const current = await lockReport(tx, scope, eventId)
        if (!current) throw new ApiError('REPORT_INCOMPLETE', 409)
        if (current.status === 'published') throw new ApiError('INVALID_STATE', 409)
        if (current.version !== input.version) throw new ApiError('VERSION_CONFLICT', 409)
        if (REPORT_SECTIONS.some(key => current[key] === null)) throw new ApiError('REPORT_INCOMPLETE', 409)
        const event = await eventSummary(tx, scope.organizationId, eventId)
        const at = new Date()
        const facts = (await factsByEvent(tx, scope.organizationId, [event], at)).get(eventId)!
        await tx.update(eventReports).set({ status: 'published', facts, publishedAt: at, publishedBy: scope.userId, version: current.version + 1 })
          .where(and(eq(eventReports.organizationId, scope.organizationId), eq(eventReports.eventId, eventId)))
        return reportResponse(tx, scope.organizationId, eventId)
      })
    },
    // 발행 취소: 작성 중으로 되돌린다. 글은 두고 고정한 수치는 지운다(다시 발행할 때 다시 센다).
    async unpublish(scope: ReportScope, eventId: string, input: PublishEventReportRequest): Promise<EventReportResponse> {
      return db.transaction(async tx => {
        await requireCompletedEvent(tx, scope.organizationId, eventId)
        const current = await lockReport(tx, scope, eventId)
        if (current?.status !== 'published') throw new ApiError('INVALID_STATE', 409)
        if (current.version !== input.version) throw new ApiError('VERSION_CONFLICT', 409)
        await tx.update(eventReports).set({ status: 'draft', facts: null, publishedAt: null, publishedBy: null, version: current.version + 1 })
          .where(and(eq(eventReports.organizationId, scope.organizationId), eq(eventReports.eventId, eventId)))
        return reportResponse(tx, scope.organizationId, eventId)
      })
    },
  }
}
