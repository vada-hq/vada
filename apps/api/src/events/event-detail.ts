import { and, eq } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import { events } from '../db/schema.ts'
import { daysBetween, shortStamp, stamp } from '../time.ts'
import { eventRows, hostLine, orNote, STATUS, type Now } from './event-records.ts'

export interface EventSummary {
  title: string
  schedule: string
  dday: string
  progressPercent: number
  progressLabel: string
}

export async function eventSummary(
  db: Db,
  orgId: string,
  eventId: string,
  clock: Now,
): Promise<EventSummary | null> {
  const rows = await eventRows(db, orgId, and(eq(events.orgId, orgId), eq(events.id, eventId)))
  const row = rows[0]
  if (row === undefined) return null
  const where = orNote(row.place, '장소 미정')
  return {
    title: row.title,
    schedule:
      row.startAt === null
        ? `일시 미정 · ${where}`
        : `행사일 ${row.startAt.getFullYear()}-${String(row.startAt.getMonth() + 1).padStart(2, '0')}-${String(row.startAt.getDate()).padStart(2, '0')} · ${where}`,
    dday: dday(row.startAt, clock.now()),
    progressPercent: 0,
    progressLabel: '업무가 아직 없습니다',
  }
}

export interface EventWorkspace {
  status: string
  statusKey: string
  statusTone: string
  host: string
  startAt: string
  nextSchedule: string
  permissionNote: string
}

export async function eventWorkspace(
  db: Db,
  orgId: string,
  eventId: string,
  viewer: { canManage: boolean },
): Promise<EventWorkspace | null> {
  const rows = await eventRows(db, orgId, and(eq(events.orgId, orgId), eq(events.id, eventId)))
  const row = rows[0]
  if (row === undefined) return null
  return {
    status: STATUS[row.status].label,
    statusKey: row.status,
    statusTone: STATUS[row.status].tone,
    host: `담당 ${hostLine(row)}`,
    startAt: row.startAt === null ? '일시 미정' : shortStamp(row.startAt),
    nextSchedule: '다음 일정이 아직 없습니다',
    permissionNote: viewer.canManage
      ? '이 행사의 정보를 고칠 수 있습니다'
      : '이 행사는 열람만 할 수 있습니다',
  }
}

export interface EventBasics {
  title: string
  startAt: string
  place: string
  audience: string
  fee: string
  capacity: string
  contact: string
  attendeeCount: string
  host: string
}

export async function eventBasics(
  db: Db,
  orgId: string,
  eventId: string,
): Promise<EventBasics | null> {
  const rows = await eventRows(db, orgId, and(eq(events.orgId, orgId), eq(events.id, eventId)))
  const row = rows[0]
  if (row === undefined) return null
  return {
    title: row.title,
    startAt: row.startAt === null ? '일시 미정' : stamp(row.startAt),
    place: orNote(row.place, '장소 미정'),
    audience: orNote(row.audience, '대상 미정'),
    fee: orNote(row.fee, '참가비 미정'),
    capacity: orNote(row.capacity, '정원 미정'),
    contact: orNote(row.contact, '문의처 미정'),
    attendeeCount: '집계 전',
    host: row.hostName ?? '담당 미정',
  }
}

function dday(startAt: Date | null, now: Date): string {
  if (startAt === null) return '일시 미정'
  const days = daysBetween(now, startAt)
  if (days === 0) return 'D-DAY'
  return days > 0 ? `D-${days}` : `D+${-days}`
}
