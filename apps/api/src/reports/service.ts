import { and, eq, inArray } from 'drizzle-orm'
import { alias, type PgDatabase, type PgQueryResultHKT } from 'drizzle-orm/pg-core'
import type { EventRecord, EventReportResponse, EventReportView, RecordsResponse } from '@vada/contracts'
import { eventReports, users } from '../db/schema.js'
import { eventSummaries, eventSummary } from '../events/events.js'
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
  }
}
