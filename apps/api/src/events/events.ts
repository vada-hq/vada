import { and, eq, ilike, sql } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import { departments, events, members } from '../db/schema.ts'
import { Blocked } from '../routes.ts'

// 행사(EVT-00A · EVT-02 …)가 읽는 것.
//
// **저장하는 것과 그리는 것이 다르다.** 표에는 `startAt`이 때 하나로 들어 있고,
// 화면은 '2026. 08. 20 10:00'이나 '일시 미정'을 받는다 — 어느 쪽인지 고르는 것도,
// 형식을 만드는 것도 서버의 일이다. 화면이 하면 그 규칙이 화면마다 흩어진다.

type Status = 'planning' | 'inProgress' | 'wrapUp' | 'done'

/** 단계를 사람이 읽는 말과 색으로. **화면이 이 규칙을 알면 단계가 늘 때마다 화면을 고친다.** */
const STATUS: Record<Status, { label: string; tone: string }> = {
  planning: { label: '기획 중', tone: 'blue' },
  inProgress: { label: '진행 중', tone: 'green' },
  wrapUp: { label: '후속 정리 중', tone: 'yellow' },
  done: { label: '완료', tone: 'gray' },
}

/** 정해지지 않은 것은 **그 사실을 말로** 준다. 빈 글을 주면 화면이 그 자리에 무엇이든 그린다. */
function orNote(value: string | null, note: string): string {
  return value === null || value.trim() === '' ? note : value
}

function stamp(at: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${at.getFullYear()}. ${pad(at.getMonth() + 1)}. ${pad(at.getDate())} ${pad(at.getHours())}:${pad(at.getMinutes())}`
}

function shortStamp(at: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${pad(at.getMonth() + 1)}.${pad(at.getDate())} ${pad(at.getHours())}:${pad(at.getMinutes())}`
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

async function base(db: Db, where: ReturnType<typeof and>) {
  return db
    .select(ROW)
    .from(events)
    .leftJoin(departments, eq(events.hostDepartmentId, departments.id))
    .leftJoin(members, eq(events.hostMemberId, members.id))
    .where(where)
}

type Row = Awaited<ReturnType<typeof base>>[number]

/** 맡은 곳. 부서도 사람도 없으면 '담당 미정'이다. */
function hostLine(row: Row): string {
  const parts = [row.departmentName, row.hostName].filter((part) => part !== null)
  return parts.length === 0 ? '담당 미정' : parts.join(' · ')
}

/** 마지막으로 손댄 때. **오늘·어제 같은 상대적인 말은 오늘이 언제인지 아는 쪽이 만든다.** */
function lastModified(at: Date, now: Date): string {
  const days = Math.floor((startOfDay(now).getTime() - startOfDay(at).getTime()) / 86_400_000)
  if (days <= 0) return `오늘 ${shortStamp(at).split(' ')[1]} 수정`
  if (days === 1) return '어제 수정'
  return `${days}일 전 수정`
}

/** 목록의 차례: 이른 행사가 먼저, 일시가 없으면 뒤로. 그림이 그린 차례다. */
function order(row: Row): string {
  return `${row.startAt === null ? '9' : '0'}${row.startAt?.toISOString() ?? ''}${row.title}`
}

function startOfDay(at: Date): Date {
  return new Date(at.getFullYear(), at.getMonth(), at.getDate())
}

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

/**
 * 진행 중인 행사 목록(EVT-00A).
 *
 * **완료된 행사는 오지 않는다** — 머리의 별도 이동이 그것을 본다.
 */
export async function eventList(
  db: Db,
  orgId: string,
  filters: { query?: string; status?: string },
  clock: Now,
): Promise<EventListRow[]> {
  const wanted = (filters.query ?? '').trim()
  const rows = (
    await base(
      db,
      and(
        eq(events.orgId, orgId),
        sql`${events.status} <> 'done'`,
        wanted === '' ? undefined : ilike(events.title, `%${wanted}%`),
        filters.status === undefined || filters.status === ''
          ? undefined
          : eq(events.status, filters.status as Status),
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
    // **무엇이 눈에 띄어야 하는지는 행사마다 다르다.** 기획 중이면 무엇이 비었는지가,
    // 진행 중이면 무엇이 밀렸는지가 온다. 개수도 데이터가 정한다.
    highlights: missingParts(row).map((label) => ({ label })),
    lastModifiedNote: lastModified(row.updatedAt, now),
  }))
}

/** 아직 안 채운 것들. 기획 중인 행사에서 눈에 띄어야 하는 것이 이것이다. */
function missingParts(row: Row): string[] {
  const missing: string[] = []
  if (row.startAt === null) missing.push('일시가 아직 없습니다')
  if (row.place === null || row.place.trim() === '') missing.push('장소가 아직 없습니다')
  if (row.departmentName === null && row.hostName === null) missing.push('담당이 아직 없습니다')
  return missing
}

export interface EventSummary {
  title: string
  schedule: string
  dday: string
  progressPercent: number
  progressLabel: string
}

/**
 * 행사 카드(작업공간의 머리 위).
 *
 * **남은 날은 서버가 센다** — 오늘이 언제인지 화면이 알 수 없다.
 */
export async function eventSummary(
  db: Db,
  orgId: string,
  eventId: string,
  clock: Now,
): Promise<EventSummary | null> {
  const rows = await base(db, and(eq(events.orgId, orgId), eq(events.id, eventId)))
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
    // 업무 표가 아직 없다. **0이라고 지어내지 않고** 아직 셀 것이 없다고 말한다.
    progressPercent: 0,
    progressLabel: '업무가 아직 없습니다',
  }
}

/** 남은 날. 지났으면 그 사실까지 붙는다. */
function dday(startAt: Date | null, now: Date): string {
  if (startAt === null) return '일시 미정'
  const days = Math.floor((startOfDay(startAt).getTime() - startOfDay(now).getTime()) / 86_400_000)
  if (days === 0) return 'D-DAY'
  return days > 0 ? `D-${days}` : `D+${-days}`
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

/**
 * 작업공간의 머리 한 줄.
 *
 * 갈피를 옮겨 다녀도 그대로다 — 화면이 아니라 **행사에 딸린 값**이기 때문이다.
 *
 * `alert`와 `alertTone`은 **없으면 오지 않는다**(카탈로그가 optional로 적었다).
 * 지금은 알릴 것을 셀 표가 없으므로 늘 오지 않는다 — 빈 글을 주면 화면이 빈 딱지를 그린다.
 */
export async function eventWorkspace(
  db: Db,
  orgId: string,
  eventId: string,
  viewer: { canManage: boolean },
): Promise<EventWorkspace | null> {
  const rows = await base(db, and(eq(events.orgId, orgId), eq(events.id, eventId)))
  const row = rows[0]
  if (row === undefined) return null

  return {
    status: STATUS[row.status].label,
    statusKey: row.status,
    statusTone: STATUS[row.status].tone,
    host: `담당 ${hostLine(row)}`,
    startAt: row.startAt === null ? '일시 미정' : shortStamp(row.startAt),
    // 일정 표가 아직 없다. 지어내지 않고 그 사실을 말한다.
    nextSchedule: '다음 일정이 아직 없습니다',
    // **역할 이름을 들지 않는다.** 무엇을 할 수 있는지로 말한다 — 조직 규칙이
    // 바뀔 때마다 이 글이 틀리지 않게.
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

/** 사람이 입력한 값. **비어 있으면 완성된 안내로 온다.** */
export async function eventBasics(
  db: Db,
  orgId: string,
  eventId: string,
): Promise<EventBasics | null> {
  const rows = await base(db, and(eq(events.orgId, orgId), eq(events.id, eventId)))
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
    // 참석자는 후속 정리부터 센다. 아직 셀 표가 없으므로 그 사실을 말한다.
    attendeeCount: '집계 전',
    host: row.hostName ?? '담당 미정',
  }
}

/**
 * 행사를 만든다(EVT-00B).
 *
 * **행사명 하나만 받는다** — 나머지는 행사 공간에서 채운다.
 */
export async function createEvent(
  db: Db,
  orgId: string,
  draft: { title?: unknown },
  make: { id: () => string; now: () => Date },
): Promise<{ id: string }> {
  const title = typeof draft.title === 'string' ? draft.title.trim() : ''
  if (title === '') {
    throw new Blocked('행사명을 적어 주세요')
  }
  const id = make.id()
  const at = make.now()
  await db.insert(events).values({ id, orgId, title, createdAt: at, updatedAt: at })
  return { id }
}
