import { and, eq } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import { departments, events, members } from '../db/schema.ts'
import { NotFound } from '../errors.ts'
import { fieldMoment } from '../time.ts'

export interface EventBasicsDraft {
  title: string
  intro?: string
  purpose?: string
  startAt?: string
  endAt?: string
  endUnset: boolean
  place?: string
  placeUnset: boolean
  address?: string
  placeDetail?: string
  audience?: string
  feeType: string
  paidAmount?: string
  unpaidAmount?: string
  payGuide?: string
  capacityType: string
  capacity?: string
  hostDepartment?: string
  hostPerson?: string
  contact?: string
  notice?: string
}

export async function eventBasicsDraft(
  db: Db,
  orgId: string,
  eventId: string,
): Promise<EventBasicsDraft> {
  const rows = await db
    .select({
      title: events.title,
      intro: events.intro,
      purpose: events.purpose,
      startAt: events.startAt,
      endAt: events.endAt,
      endUnset: events.endUnset,
      place: events.place,
      placeUnset: events.placeUnset,
      address: events.address,
      placeDetail: events.placeDetail,
      audience: events.audience,
      feeType: events.feeType,
      paidAmount: events.paidAmount,
      unpaidAmount: events.unpaidAmount,
      payGuide: events.payGuide,
      capacityType: events.capacityType,
      capacityCount: events.capacityCount,
      contact: events.contact,
      notice: events.notice,
      departmentName: departments.name,
      hostName: members.name,
    })
    .from(events)
    .leftJoin(
      departments,
      and(eq(events.hostDepartmentId, departments.id), eq(departments.orgId, orgId)),
    )
    .leftJoin(members, and(eq(events.hostMemberId, members.id), eq(members.orgId, orgId)))
    .where(and(eq(events.orgId, orgId), eq(events.id, eventId)))
    .limit(1)
  const row = rows[0]
  if (row === undefined) throw new NotFound('그 행사를 찾지 못했습니다')
  const draft: EventBasicsDraft = {
    title: row.title,
    feeType: row.feeType,
    capacityType: row.capacityType,
    endUnset: row.endUnset,
    placeUnset: row.placeUnset,
  }
  const words: Array<[keyof EventBasicsDraft, string | null]> = [
    ['intro', row.intro],
    ['purpose', row.purpose],
    ['place', row.place],
    ['address', row.address],
    ['placeDetail', row.placeDetail],
    ['audience', row.audience],
    ['payGuide', row.payGuide],
    ['hostDepartment', row.departmentName],
    ['hostPerson', row.hostName],
    ['contact', row.contact],
    ['notice', row.notice],
    ['paidAmount', row.paidAmount === null ? null : String(row.paidAmount)],
    ['unpaidAmount', row.unpaidAmount === null ? null : String(row.unpaidAmount)],
    ['capacity', row.capacityCount === null ? null : String(row.capacityCount)],
    ['startAt', row.startAt === null ? null : fieldMoment(row.startAt)],
    ['endAt', row.endAt === null ? null : fieldMoment(row.endAt)],
  ]
  for (const [key, value] of words) {
    if (value !== null && value !== '') Object.assign(draft, { [key]: value })
  }
  return draft
}
