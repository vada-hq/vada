import { and, eq } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import { departments, events, members } from '../db/schema.ts'

export type Status = 'planning' | 'inProgress' | 'wrapUp' | 'done'

export const STATUS: Record<Status, { label: string; tone: string }> = {
  planning: { label: '기획 중', tone: 'blue' },
  inProgress: { label: '진행 중', tone: 'green' },
  wrapUp: { label: '후속 정리 중', tone: 'yellow' },
  done: { label: '완료', tone: 'gray' },
}

export interface Now {
  now: () => Date
}

const ROW = {
  id: events.id,
  title: events.title,
  status: events.status,
  startAt: events.startAt,
  place: events.place,
  audience: events.audience,
  fee: events.fee,
  capacity: events.capacity,
  contact: events.contact,
  updatedAt: events.updatedAt,
  departmentName: departments.name,
  hostName: members.name,
}

export async function eventRows(db: Db, orgId: string, where: ReturnType<typeof and>) {
  return db
    .select(ROW)
    .from(events)
    .leftJoin(
      departments,
      and(eq(events.hostDepartmentId, departments.id), eq(departments.orgId, orgId)),
    )
    .leftJoin(members, and(eq(events.hostMemberId, members.id), eq(members.orgId, orgId)))
    .where(where)
}

export type EventRow = Awaited<ReturnType<typeof eventRows>>[number]

export function hostLine(row: EventRow): string {
  const parts = [row.departmentName, row.hostName].filter((part) => part !== null)
  return parts.length === 0 ? '담당 미정' : parts.join(' · ')
}

export function orNote(value: string | null, note: string): string {
  return value === null || value.trim() === '' ? note : value
}
