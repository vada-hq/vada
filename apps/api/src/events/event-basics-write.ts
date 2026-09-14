import { and, eq } from 'drizzle-orm'
import optionSources from '../../../../specs/figma/vada-wireframe/option-sources.json' with { type: 'json' }
import type { Db } from '../db/client.ts'
import { departments, events, members } from '../db/schema.ts'
import { Blocked, NotFound } from '../errors.ts'
import { readWord } from '../input.ts'
import { momentOf } from '../time.ts'

function optionsOf(key: string): string[] {
  const sources = optionSources.sources as Array<{
    key: string
    options?: Array<{ value: string }>
  }>
  const source = sources.find((one) => one.key === key)
  if (source?.options === undefined) throw new Error(`선택지 '${key}'가 명세에 없습니다.`)
  return source.options.map((option) => option.value)
}

export const FEE_TYPES = optionsOf('event.feeTypes')
export const CAPACITY_TYPES = optionsOf('event.capacityTypes')

export interface SaveClock {
  now: () => Date
}

function readCount(draft: Record<string, unknown>, key: string, label: string): number | null {
  const value = draft[key]
  if (value === null || value === undefined || value === '') return null
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new Blocked(`${label} 칸은 0 이상의 정수로 적어 주세요`)
  }
  return value
}

function readFlag(draft: Record<string, unknown>, key: string, label: string): boolean {
  const value = draft[key]
  if (typeof value !== 'boolean') throw new Blocked(`${label} 칸은 참 또는 거짓이어야 합니다`)
  return value
}

function readChoice(
  draft: Record<string, unknown>,
  key: string,
  allowed: string[],
  label: string,
): string {
  const value = draft[key]
  if (typeof value !== 'string' || !allowed.includes(value)) {
    throw new Blocked(`그런 ${label}은 없습니다`)
  }
  return value
}

function readMoment(draft: Record<string, unknown>, key: string, label: string): Date | null {
  const text = readWord(draft, key, label)
  if (text === null) return null
  const when = momentOf(text)
  if (when === null) throw new Blocked(`${label} 칸의 일시를 읽지 못했습니다`)
  return when
}

async function hostDepartmentOf(db: Db, orgId: string, name: string | null): Promise<string | null> {
  if (name === null) return null
  const rows = await db
    .select({ id: departments.id })
    .from(departments)
    .where(and(eq(departments.orgId, orgId), eq(departments.name, name)))
  const found = rows[0]
  if (found === undefined) throw new Blocked(`이 학생회에 그런 부서가 없습니다: ${name}`)
  return found.id
}

async function hostMemberOf(
  db: Db,
  orgId: string,
  current: { id: string | null; name: string | null },
  name: string | null,
): Promise<string | null> {
  if (name === null) return null
  if (current.id !== null && current.name === name) return current.id
  const rows = await db
    .select({ id: members.id })
    .from(members)
    .where(and(eq(members.orgId, orgId), eq(members.name, name)))
  if (rows.length === 0) throw new Blocked(`이 학생회에 그런 구성원이 없습니다: ${name}`)
  if (rows.length > 1) throw new Blocked(`같은 이름의 구성원이 둘 이상입니다: ${name}`)
  return rows[0]!.id
}

export async function saveEventBasics(
  db: Db,
  orgId: string,
  eventId: string,
  draft: Record<string, unknown>,
  clock: SaveClock,
): Promise<Record<string, never>> {
  const rows = await db
    .select({ hostMemberId: events.hostMemberId, hostName: members.name })
    .from(events)
    .leftJoin(members, and(eq(events.hostMemberId, members.id), eq(members.orgId, orgId)))
    .where(and(eq(events.orgId, orgId), eq(events.id, eventId)))
    .limit(1)
  const row = rows[0]
  if (row === undefined) throw new NotFound('그 행사를 찾지 못했습니다')
  const changes: Record<string, unknown> = {}
  const has = (key: string) => Object.hasOwn(draft, key)
  if (has('title')) {
    const title = readWord(draft, 'title', '행사명')
    if (title === null) throw new Blocked('행사명을 적어 주세요')
    changes.title = title
  }
  if (has('intro')) changes.intro = readWord(draft, 'intro', '행사 소개')
  if (has('purpose')) changes.purpose = readWord(draft, 'purpose', '행사 목적·주요 내용')
  if (has('startAt')) changes.startAt = readMoment(draft, 'startAt', '시작 일시')
  if (has('endAt')) changes.endAt = readMoment(draft, 'endAt', '종료 일시')
  if (has('endUnset')) changes.endUnset = readFlag(draft, 'endUnset', '종료 시간 미정')
  if (has('place')) changes.place = readWord(draft, 'place', '장소')
  if (has('placeUnset')) changes.placeUnset = readFlag(draft, 'placeUnset', '장소 미정')
  if (has('address')) changes.address = readWord(draft, 'address', '주소')
  if (has('placeDetail')) changes.placeDetail = readWord(draft, 'placeDetail', '상세 위치')
  if (has('audience')) changes.audience = readWord(draft, 'audience', '참가 대상')
  if (has('feeType')) changes.feeType = readChoice(draft, 'feeType', FEE_TYPES, '참가비 유형')
  if (has('paidAmount')) changes.paidAmount = readCount(draft, 'paidAmount', '납부자 금액')
  if (has('unpaidAmount')) changes.unpaidAmount = readCount(draft, 'unpaidAmount', '미납자 금액')
  if (has('payGuide')) changes.payGuide = readWord(draft, 'payGuide', '결제 안내')
  if (has('capacityType')) {
    changes.capacityType = readChoice(draft, 'capacityType', CAPACITY_TYPES, '정원 유형')
  }
  if (has('capacity')) changes.capacityCount = readCount(draft, 'capacity', '정원 인원')
  if (has('contact')) changes.contact = readWord(draft, 'contact', '문의 방법·연락처')
  if (has('notice')) changes.notice = readWord(draft, 'notice', '참가자 유의사항')
  if (has('hostDepartment')) {
    changes.hostDepartmentId = await hostDepartmentOf(
      db,
      orgId,
      readWord(draft, 'hostDepartment', '담당 부서'),
    )
  }
  if (has('hostPerson')) {
    changes.hostMemberId = await hostMemberOf(
      db,
      orgId,
      { id: row.hostMemberId, name: row.hostName },
      readWord(draft, 'hostPerson', '담당자'),
    )
  }
  changes.updatedAt = clock.now()
  await db
    .update(events)
    .set(changes)
    .where(and(eq(events.orgId, orgId), eq(events.id, eventId)))
  return {}
}
