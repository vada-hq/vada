import { and, eq, inArray } from 'drizzle-orm'
import optionSourcesJson from '../../../../specs/figma/vada-wireframe/option-sources.json' with { type: 'json' }
import type { Db } from '../db/client.ts'
import {
  departments,
  events,
  meetingAgendas,
  meetingParticipants,
  meetings,
  members,
} from '../db/schema.ts'
import { Blocked } from '../routes.ts'
import { momentOf } from '../time.ts'
import type { MeetingViewer } from './meetings.ts'

// 회의를 만들고 임시 저장한다(OPS-MEET-02의 두 단추).
//
// **둘은 같은 것을 보낸다.** 명세가 `payloadScope: meetingDraft` 하나로 묶어 두었고,
// 다른 것은 보내는 곳과 그 결과의 단계뿐이다 — 만들면 '예정'이고 임시 저장하면
// '초안'이며, 초안은 다른 참가자에게 보이지 않는다.
//
// **화면이 보내는 꼴이 계약이 적은 꼴과 다르다.** 계약은 참가자와 안건을 배열이라
// 적었는데 화면의 초안은 그것을 평평한 맵으로 담는다(`participants: 'r0\nr1'`과
// `participants.r0.memberId`). 어느 쪽으로 와도 같은 뜻으로 읽는다 — 한쪽만 읽으면
// 계약대로 보낸 쪽이나 화면이 보낸 쪽 중 하나가 조용히 빈 목록이 된다.

/** 회의의 종류는 **명세가 값을 갖고 있다**(meeting.types). 여기 다시 적으면 갈린다. */
const MEETING_KINDS = (
  optionSourcesJson.sources.find((source) => source.key === 'meeting.types') as
    | { options: Array<{ value: string }> }
    | undefined
)?.options.map((option) => option.value) ?? []

export interface MakeMeeting {
  id: () => string
  now: () => Date
}

/** 되풀이되는 묶음의 줄 이름은 줄바꿈으로 이어 담긴다(`spec/compute.ts`). */
const ROW_SEPARATOR = '\n'

/**
 * 묶음 하나를 줄로 편다.
 *
 * 계약이 적은 배열이면 그대로 쓰고, 화면이 보낸 평평한 꼴이면 줄 이름마다 모은다.
 */
function rowsOf(draft: Record<string, unknown>, listKey: string): Array<Record<string, unknown>> {
  const raw = draft[listKey]
  if (Array.isArray(raw)) {
    return raw.filter(
      (item): item is Record<string, unknown> => typeof item === 'object' && item !== null,
    )
  }
  if (typeof raw !== 'string' || raw.trim() === '') return []
  return raw
    .split(ROW_SEPARATOR)
    .filter((rowId) => rowId !== '')
    .map((rowId) => {
      const prefix = `${listKey}.${rowId}.`
      const row: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(draft)) {
        if (key.startsWith(prefix)) row[key.slice(prefix.length)] = value
      }
      return row
    })
}

/** 글 칸 하나. **빈 글은 저장하지 않는다** — 지운 것과 안 적은 것을 같게 둔다. */
function readWord(draft: Record<string, unknown>, key: string, label: string): string | null {
  const value = draft[key]
  if (value === null || value === undefined) return null
  if (typeof value !== 'string') throw new Blocked(`${label} 칸은 글로 적어 주세요`)
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

/**
 * 켜고 끄는 칸.
 *
 * **두 꼴로 온다.** 계약은 참거짓이라 적었고 화면의 체크 상자는 켜짐을 `'y'`로
 * 담는다(OPS-MEET-02). 어느 쪽이든 같은 뜻으로 읽되, **모르는 값은 막는다** —
 * 조용히 거짓으로 읽으면 비공개로 만든 회의가 모두에게 열린다.
 */
function readFlag(draft: Record<string, unknown>, key: string, label: string): boolean {
  const value = draft[key]
  if (typeof value === 'boolean') return value
  if (value === null || value === undefined || value === '') return false
  if (value === 'y' || value === 'true') return true
  if (value === 'n' || value === 'false') return false
  throw new Blocked(`${label} 칸은 참 또는 거짓이어야 합니다`)
}

/**
 * 날짜 칸과 시각 칸을 하나의 때로 잇는다.
 *
 * **읽지 못하면 막는다.** 지금 시각으로 대신하면 회의가 조용히 다른 때로 옮겨진다 —
 * 행사 기본정보가 같은 자리에서 같은 규칙을 지킨다.
 */
function readWhen(
  draft: Record<string, unknown>,
  timeKey: string,
  label: string,
): Date | null {
  const date = readWord(draft, 'date', '회의 날짜')
  const time = readWord(draft, timeKey, label)
  if (date === null || time === null) return null
  const when = momentOf(`${date}T${time}`)
  if (when === null) throw new Blocked(`${label} 칸의 일시를 읽지 못했습니다`)
  return when
}

/** 이 학생회의 그 행사인가. 못 찾으면 막는다 — 조용히 비우면 연결한 줄 알고 지나간다. */
async function linkedEventOf(
  db: Db,
  orgId: string,
  eventId: string | null,
): Promise<string | null> {
  if (eventId === null) return null
  const rows = await db
    .select({ id: events.id })
    .from(events)
    .where(and(eq(events.orgId, orgId), eq(events.id, eventId)))
    .limit(1)
  if (rows[0] === undefined) throw new Blocked('이 학생회에 그런 행사가 없습니다')
  return eventId
}

/** 이 학생회의 그 부서인가. */
async function hostDepartmentOf(
  db: Db,
  orgId: string,
  departmentId: string | null,
): Promise<string | null> {
  if (departmentId === null) return null
  const rows = await db
    .select({ id: departments.id })
    .from(departments)
    .where(and(eq(departments.orgId, orgId), eq(departments.id, departmentId)))
    .limit(1)
  if (rows[0] === undefined) throw new Blocked('이 학생회에 그런 부서가 없습니다')
  return departmentId
}

/**
 * 고른 참가자들.
 *
 * **남의 학생회 사람은 막는다.** 조용히 빼면 사람은 넣었다고 믿고 그 사람은 회의를
 * 영영 못 본다 — 표가 막기도 하지만 표가 막으면 500이 되고, 500은 안쪽 사정을 흘린다.
 */
async function participantsOf(
  db: Db,
  orgId: string,
  draft: Record<string, unknown>,
): Promise<string[]> {
  const asked = rowsOf(draft, 'participants')
    .map((row) => readWord(row, 'memberId', '참가자'))
    .filter((memberId): memberId is string => memberId !== null)
  // 한 사람이 두 줄로 오면 표가 막는다. 여기서 미리 하나로 만든다.
  const wanted = [...new Set(asked)]
  if (wanted.length === 0) return []

  const rows = await db
    .select({ id: members.id })
    .from(members)
    .where(and(eq(members.orgId, orgId), inArray(members.id, wanted)))
  const here = new Set(rows.map((row) => row.id))
  for (const memberId of wanted) {
    if (!here.has(memberId)) throw new Blocked('이 학생회에 없는 사람은 참가자로 넣을 수 없습니다')
  }
  return wanted
}

interface Agenda {
  title: string
  description: string | null
}

/**
 * 세워 둔 안건들.
 *
 * **이름 없는 안건은 막는다.** 표가 이름을 요구하고, 조용히 빼면 사람이 적어 둔 줄이
 * 저장되지 않은 채 사라진다.
 *
 * **예상 소요 시간은 담지 않는다.** 고를 수 있는 값의 목록을 명세가
 * `meeting.agendaDurations`로 서버에 물어 두었는데 디자인이 그 목록을 그리지 않았다 —
 * 값의 꼴을 모르는 채로 분으로 옮기면 그 옮기는 규칙을 여기서 지어내는 것이 된다.
 */
function agendasOf(draft: Record<string, unknown>): Agenda[] {
  return rowsOf(draft, 'agendaItems').map((row) => {
    const title = readWord(row, 'agendaTitle', '안건명')
    if (title === null) throw new Blocked('안건명을 적어 주세요')
    return { title, description: readWord(row, 'agendaNote', '안건 설명') }
  })
}

/** 표에 담는 값 한 벌. 만들기와 임시 저장이 같은 것을 만든다. */
async function readDraft(db: Db, orgId: string, draft: Record<string, unknown>) {
  const title = readWord(draft, 'title', '회의명')
  // 이름 없는 회의는 목록에서 가리킬 수 없다. 임시 저장도 같다 — 표가 이름을 요구한다.
  if (title === null) throw new Blocked('회의명을 적어 주세요')

  const asked = readWord(draft, 'meetingType', '회의 유형')
  if (asked !== null && !MEETING_KINDS.includes(asked)) {
    throw new Blocked('그런 회의 유형은 없습니다')
  }
  const kind = (asked ?? 'regular') as 'regular' | 'event'

  return {
    title,
    kind,
    // **정기·상시 회의에는 행사가 걸리지 않는다.** 유형을 바꾸고 저장했는데 앞서
    // 고른 행사가 남으면 그 회의는 두 곳에 걸린 것이 된다.
    eventId:
      kind === 'event'
        ? await linkedEventOf(db, orgId, readWord(draft, 'linkedEventId', '연결 행사'))
        : null,
    departmentId: await hostDepartmentOf(
      db,
      orgId,
      readWord(draft, 'departmentId', '주관 부서'),
    ),
    purpose: readWord(draft, 'purpose', '회의 목적'),
    scheduledAt: readWhen(draft, 'startTime', '시작 예정 시각'),
    plannedEndAt: readWhen(draft, 'endTime', '종료 예정 시각'),
    // 진행 방식은 **글로 담는다.** 고를 수 있는 값의 목록이 명세에 없어 갈래로 둘 수
    // 없다고 표가 적어 두었다 — 여기서 목록을 지어내지 않고 적힌 대로 담는다.
    mode: readWord(draft, 'mode', '진행 방식'),
    place: readWord(draft, 'place', '장소'),
    onlineLink: readWord(draft, 'onlineLink', '온라인 링크'),
    isPrivate: readFlag(draft, 'isPrivate', '비공개 회의'),
    people: await participantsOf(db, orgId, draft),
    agendas: agendasOf(draft),
  }
}

/** 참가자와 안건을 통째로 갈아 끼운다. 남기면 지운 사람이 되살아난다. */
async function replaceParts(
  db: Db,
  orgId: string,
  meetingId: string,
  read: Awaited<ReturnType<typeof readDraft>>,
  make: MakeMeeting,
): Promise<void> {
  // 지울 때도 학생회를 함께 건다 — 이음매마다 울타리를 다시 세운다.
  await db
    .delete(meetingParticipants)
    .where(
      and(eq(meetingParticipants.orgId, orgId), eq(meetingParticipants.meetingId, meetingId)),
    )
  await db
    .delete(meetingAgendas)
    .where(and(eq(meetingAgendas.orgId, orgId), eq(meetingAgendas.meetingId, meetingId)))

  if (read.people.length > 0) {
    await db.insert(meetingParticipants).values(
      read.people.map((memberId) => ({ id: make.id(), orgId, meetingId, memberId })),
    )
  }
  if (read.agendas.length > 0) {
    await db.insert(meetingAgendas).values(
      read.agendas.map((agenda, at) => ({
        id: make.id(),
        orgId,
        meetingId,
        sortOrder: at,
        title: agenda.title,
        description: agenda.description,
      })),
    )
  }
}

/**
 * 회의를 만든다(OPS-MEET-02의 '회의 만들기').
 *
 * **만든 사람은 서버가 안다.** 몸통에 실려 오는 주최자 이름은 읽기 전용 칸에 그린
 * 글이고, 그것을 믿으면 남의 이름으로 회의를 만들 수 있다.
 */
export async function createMeeting(
  db: Db,
  orgId: string,
  viewer: MeetingViewer,
  draft: Record<string, unknown>,
  make: MakeMeeting,
): Promise<{ id: string }> {
  const read = await readDraft(db, orgId, draft)
  const id = make.id()
  const at = make.now()
  await db.insert(meetings).values({
    id,
    orgId,
    title: read.title,
    kind: read.kind,
    eventId: read.eventId,
    departmentId: read.departmentId,
    purpose: read.purpose,
    // **새 회의는 예정으로 생긴다.** 화면의 안내가 그렇게 적었다.
    status: 'scheduled',
    scheduledAt: read.scheduledAt,
    plannedEndAt: read.plannedEndAt,
    mode: read.mode,
    place: read.place,
    onlineLink: read.onlineLink,
    isPrivate: read.isPrivate,
    creatorMemberId: viewer.memberId,
    createdAt: at,
    updatedAt: at,
  })
  await replaceParts(db, orgId, id, read, make)
  return { id }
}

/**
 * 회의를 임시 저장한다(OPS-MEET-02의 '임시 저장').
 *
 * **덮어쓰기다.** 명세가 `repeat: overwrite`와 '초안은 회의마다 하나뿐이다'라고
 * 적었다. 그런데 이 자리는 **어느 회의의 초안인지를 받지 않는다** — 보내는 길에
 * 인자가 하나도 없다. 그래서 덮어쓸 것을 정할 수 있는 유일한 사실이 '이 사람이
 * 쓰던 초안'이고, 그것으로 잡는다. 새로 넣기만 하면 임시 저장을 누를 때마다 초안이
 * 하나씩 쌓이고, 그러면 어느 것이 그 사람이 쓰던 것인지 아무도 모른다.
 */
export async function saveMeetingDraft(
  db: Db,
  orgId: string,
  viewer: MeetingViewer,
  draft: Record<string, unknown>,
  make: MakeMeeting,
): Promise<{ id: string }> {
  const read = await readDraft(db, orgId, draft)
  const at = make.now()
  const already = await db
    .select({ id: meetings.id })
    .from(meetings)
    .where(
      and(
        eq(meetings.orgId, orgId),
        eq(meetings.status, 'draft'),
        eq(meetings.creatorMemberId, viewer.memberId),
      ),
    )
    .limit(1)

  const stored = {
    title: read.title,
    kind: read.kind,
    eventId: read.eventId,
    departmentId: read.departmentId,
    purpose: read.purpose,
    scheduledAt: read.scheduledAt,
    plannedEndAt: read.plannedEndAt,
    mode: read.mode,
    place: read.place,
    onlineLink: read.onlineLink,
    isPrivate: read.isPrivate,
    updatedAt: at,
  }

  const found = already[0]
  const id = found?.id ?? make.id()
  if (found === undefined) {
    await db.insert(meetings).values({
      id,
      orgId,
      // **임시 저장한 회의는 다른 참가자에게 보이지 않는다.** 그것도 회의이므로
      // 표를 따로 두지 않고 단계로 둔다.
      status: 'draft',
      creatorMemberId: viewer.memberId,
      createdAt: at,
      ...stored,
    })
  } else {
    await db
      .update(meetings)
      .set(stored)
      // 고칠 때도 학생회를 다시 건다. 위에서 찾았다고 여기서 빼면 울타리가 한 겹이 된다.
      .where(and(eq(meetings.orgId, orgId), eq(meetings.id, id)))
  }
  await replaceParts(db, orgId, id, read, make)
  return { id }
}
