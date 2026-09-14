import { and, eq, ilike, sql } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import { events } from '../db/schema.ts'
import { Blocked } from '../errors.ts'
import { daysBetween, shortStamp, stamp } from '../time.ts'
import {
  eventRows,
  hostLine,
  orNote,
  STATUS,
  type EventRow,
  type Now,
  type Status,
} from './event-records.ts'

export interface EventListRow {
  title: string
  status: string
  statusTone: string
  startAt: string
  place: string
  host: string
  highlights: Array<{ label: string }>
  lastModifiedNote: string
}

export async function eventList(
  db: Db,
  orgId: string,
  filters: { query?: string; status?: string },
  clock: Now,
): Promise<EventListRow[]> {
  const wanted = (filters.query ?? '').trim()
  const wantedStatus = readStatus(filters.status)
  const rows = (
    await eventRows(
      db,
      orgId,
      and(
        eq(events.orgId, orgId),
        sql`${events.status} <> 'done'`,
        wanted === '' ? undefined : ilike(events.title, `%${wanted}%`),
        wantedStatus === undefined ? undefined : eq(events.status, wantedStatus),
      ),
    )
  ).sort((left, right) => order(left).localeCompare(order(right)))
  const now = clock.now()
  return rows.map((row) => ({
    title: row.title,
    status: STATUS[row.status].label,
    statusTone: STATUS[row.status].tone,
    startAt: row.startAt === null ? '일시 미정' : stamp(row.startAt),
    place: orNote(row.place, '장소 미정'),
    host: hostLine(row),
    highlights: missingParts(row).map((label) => ({ label })),
    lastModifiedNote: lastModified(row.updatedAt, now),
  }))
}

function readStatus(value: string | undefined): Status | undefined {
  if (value === undefined || value === '' || value === 'all') return undefined
  if (value in STATUS) return value as Status
  throw new Blocked('그런 진행 단계는 없습니다')
}

function missingParts(row: EventRow): string[] {
  const missing: string[] = []
  if (row.startAt === null) missing.push('일시가 아직 없습니다')
  if (row.place === null || row.place.trim() === '') missing.push('장소가 아직 없습니다')
  if (row.departmentName === null && row.hostName === null) missing.push('담당이 아직 없습니다')
  return missing
}

function lastModified(at: Date, now: Date): string {
  const days = daysBetween(at, now)
  if (days <= 0) return `오늘 ${shortStamp(at).split(' ')[1]} 수정`
  if (days === 1) return '어제 수정'
  return `${days}일 전 수정`
}

function order(row: EventRow): string {
  return `${row.startAt === null ? '9' : '0'}${row.startAt?.toISOString() ?? ''}${row.title}`
}
