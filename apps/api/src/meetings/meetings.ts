import { and, asc, eq, ilike, inArray, or, sql } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import {
  departments,
  documents,
  events,
  meetingAgendas,
  meetingParticipants,
  meetings,
  members,
} from '../db/schema.ts'
import optionSourcesJson from '../../../../specs/figma/vada-wireframe/option-sources.json' with { type: 'json' }
import { NotFound } from '../routes.ts'
import { dottedStamp, fieldMoment, weekdayStamp } from '../time.ts'

// 회의 목록(OPS-MEET-01A)과 회의 만들기(OPS-MEET-02)가 **읽는** 것.
//
// **묶음을 서버가 짓는다.** 묶음 하나가 행사 하나이고, 어느 행사에도 안 걸린 회의는
// '정기·상시 회의'로 온다 — 묶음 수가 데이터에 달려 있어 명세가 묶음마다 조회를
// 미리 적을 수 없다.
//
// **보는 사람에 따라 통째로 달라진다.** 목록 위의 띠도 줄마다의 딱지도 '누가
// 보느냐'가 정하고 그것은 서버만 안다. 화면이 정하면 같은 화면이 사람마다 다른
// 규칙으로 그려진다.

/** 이 요청을 보낸 학생회 구성원. 회의는 누가 보느냐로 갈리므로 늘 함께 온다. */
export interface MeetingViewer {
  memberId: string
}

/**
 * 회의가 어느 단계인가를 **말·색·갈 곳·문구로** 편다.
 *
 * 화면이 이 규칙을 알면 단계가 늘 때마다 화면을 고쳐야 한다 — 행사 목록이 단계를
 * 서버에서 받는 것과 같은 까닭이다.
 *
 * **`draft`가 여기 없다.** 임시 저장한 회의는 이 목록에 그려지지 않고(명세가 '다른
 * 참가자에게 표시되지 않는다'고 적었다), 명세가 그 단계에 줄 이름도 갈 곳(detailKind)도
 * 주지 않았다 — 지어내지 않고 목록에서 뺀다.
 */
const STATUS = {
  scheduled: {
    label: '예정',
    tone: 'blue',
    detailKind: 'scheduled',
    actionLabel: '회의 상세 보기',
  },
  inProgress: {
    label: '진행 중',
    tone: 'green',
    detailKind: 'live',
    actionLabel: '회의로 돌아가기',
  },
  wrapUp: {
    label: '정리 중',
    tone: 'yellow',
    detailKind: 'tidying',
    actionLabel: '회의 내용 보기',
  },
  done: { label: '완료', tone: 'gray', detailKind: 'done', actionLabel: '회의록 보기' },
  cancelled: { label: '취소', tone: 'red', detailKind: 'cancelled', actionLabel: '취소 내용 보기' },
} as const

type Listed = keyof typeof STATUS

/** 목록에 그려지는 단계인가. 초안은 아니다. */
function listed(status: string): status is Listed {
  return status in STATUS
}

/** 회의록이 어디까지 왔는가. 표의 세 값 그대로다. */
const MINUTES = {
  notStarted: '작성 전',
  drafting: '작성 중',
  done: '정리 완료',
} as const

/**
 * 목록에 그리는 회의록 상태.
 *
 * **두 축이 한 자리에 그려진다.** 회의록 자체의 단계(표의 `minutes_status`)와 회의의
 * 단계가 서로 다른 축인데, 그림은 취소된 회의에 '취소 사유 등록'을, 정리 중인 회의에
 * '내용 열람 가능'을 그렸다 — 그 둘은 회의록의 단계가 아니라 **지금 무엇을 볼 수
 * 있는가**다. 명세가 든 다섯 가지 말이 전부 나오려면 이 두 자리를 회의의 단계가 정한다.
 */
function minutesNote(status: Listed, minutes: keyof typeof MINUTES): string {
  if (status === 'cancelled') return '취소 사유 등록'
  if (status === 'wrapUp') return '내용 열람 가능'
  return MINUTES[minutes]
}

/** 정해지지 않은 것은 **그 사실을 말로** 준다. 빈 글을 주면 화면이 빈 자리를 그린다. */
function orNote(value: string | null, note: string): string {
  return value === null || value.trim() === '' ? note : value
}

/** 적히지 않은 칸. 고치는 화면에는 **안내가 아니라 빈 자리**가 가야 한다. */
function word(value: string | null): string | null {
  return value === null || value.trim() === '' ? null : value
}

export interface MeetingRow {
  meetingId: string
  title: string
  status: string
  statusTone: string
  badge?: string
  startAt: string
  place: string
  host: string
  attendees: string
  agenda: string
  minutesStatus: string
  detailKind: string
  actionLabel: string
  actionEmphasis: string
  viewerChipLabel: string
  viewerChipTone: string
}

export interface MeetingGroup {
  title: string
  nextMeetingNote: string
  meetings: MeetingRow[]
}

/** 어디에도 안 걸린 회의가 모이는 묶음. 명세가 이름을 적어 두었다. */
const REGULAR_GROUP = '정기·상시 회의'

export interface MeetingQuery {
  query?: string
}

/**
 * 묶음으로 오는 회의 목록(OPS-MEET-01A).
 *
 * **거르는 것도 세는 것도 서버가 한다.** 참가자 수와 안건 수는 다른 표에 있고,
 * 화면이 그것을 받아 세면 '몇 명인가'의 답이 화면마다 갈린다.
 */
export async function meetingGroups(
  db: Db,
  orgId: string,
  viewer: MeetingViewer,
  asked: MeetingQuery,
): Promise<MeetingGroup[]> {
  const wanted = (asked.query ?? '').trim()
  const rows = await db
    .select({
      id: meetings.id,
      eventId: meetings.eventId,
      title: meetings.title,
      status: meetings.status,
      minutesStatus: meetings.minutesStatus,
      scheduledAt: meetings.scheduledAt,
      place: meetings.place,
      isPrivate: meetings.isPrivate,
      hostName: members.name,
      eventTitle: events.title,
    })
    .from(meetings)
    // **이어 붙인 표도 자기 학생회를 확인한다.** 벽은 두 겹이 낫다.
    .leftJoin(
      members,
      and(eq(meetings.creatorMemberId, members.id), eq(members.orgId, orgId)),
    )
    .leftJoin(events, and(eq(meetings.eventId, events.id), eq(events.orgId, orgId)))
    .where(
      and(
        eq(meetings.orgId, orgId),
        // **임시 저장한 회의는 이 목록에 없다.** 아직 아무에게도 알리지 않은 것이다.
        sql`${meetings.status} <> 'draft'`,
        // 화면의 칸 이름이 '회의명 검색'이다. 찾는 것은 회의의 이름뿐이다.
        wanted === '' ? undefined : ilike(meetings.title, `%${wanted}%`),
      ),
    )

  const ids = rows.map((row) => row.id)
  const attendees = await participantCounts(db, ids)
  const agendas = await agendaCounts(db, ids)
  const mine = await viewerPlaces(db, orgId, viewer, ids)

  /** 이 사람과 이 회의의 관계. **없으면 빈 글이다** — 일반 참가자에게는 안 그려진다. */
  const chipOf = (id: string): { label: string; tone: string } => {
    const place = mine.get(id)
    if (place === undefined) return { label: '미참가', tone: 'gray' }
    return place.isHost ? { label: '진행 권한', tone: 'blue' } : { label: '', tone: '' }
  }

  const made = new Map<string, { title: string; rows: typeof rows }>()
  for (const row of rows) {
    if (!listed(row.status)) continue
    // 행사가 지워졌거나 남의 행사면 이름이 없다. 그때도 회의는 어딘가에 있어야 한다.
    const key = row.eventTitle === null ? '' : row.eventId!
    const group = made.get(key)
    if (group === undefined) {
      made.set(key, { title: row.eventTitle ?? REGULAR_GROUP, rows: [row] })
    } else {
      group.rows.push(row)
    }
  }

  const groups = [...made.entries()].map(([key, group]) => ({
    key,
    title: group.title,
    rows: [...group.rows].sort(byTime),
  }))

  // 정기·상시가 먼저(어디에도 안 걸린 것들의 자리다), 그다음은 **가장 가까운 회의가
  // 이른 묶음부터**. 묶음의 차례를 명세가 말하지 않으므로 목록 안의 차례와 같은
  // 규칙을 쓴다 — 두 규칙을 두면 위아래가 서로 다른 순서로 읽힌다.
  groups.sort((left, right) => {
    if (left.key === '') return -1
    if (right.key === '') return 1
    return orderKey(nearest(left.rows)).localeCompare(orderKey(nearest(right.rows)))
  })

  return groups.map((group) => ({
    title: group.title,
    nextMeetingNote: nextNote(nearest(group.rows)),
    meetings: group.rows.map((row) => {
      const status = STATUS[row.status as Listed]
      const chip = chipOf(row.id)
      const drawn: MeetingRow = {
        meetingId: row.id,
        title: row.title,
        status: status.label,
        statusTone: status.tone,
        startAt: row.scheduledAt === null ? '일시 미정' : dottedStamp(row.scheduledAt),
        place: orNote(row.place, '미정'),
        host: orNote(row.hostName, '주최자 미정'),
        attendees: `${attendees.get(row.id) ?? 0}명`,
        agenda: `${agendas.get(row.id) ?? 0}개`,
        minutesStatus: minutesNote(row.status as Listed, row.minutesStatus),
        detailKind: status.detailKind,
        actionLabel: status.actionLabel,
        // **지금 진행 중인 회의만 앞세운다.** 명세가 그렇게 적었다.
        actionEmphasis: row.status === 'inProgress' ? 'primary' : 'secondary',
        viewerChipLabel: chip.label,
        viewerChipTone: chip.tone,
      }
      // **없으면 오지 않는다.** 빈 글을 주면 화면이 빈 딱지를 그린다.
      if (row.isPrivate) drawn.badge = '비공개'
      return drawn
    }),
  }))
}

/** 차례를 정하는 데 필요한 것만. 회의도 행사도 이 셋으로 줄을 선다. */
interface Timed {
  scheduledAt: Date | null
  title: string
  status: string
}

/** 목록의 차례: 이른 것이 먼저, 일시가 없으면 뒤로. 행사 목록이 쓰는 규칙과 같다. */
function orderKey(row: Timed | undefined): string {
  if (row === undefined) return '9'
  return `${row.scheduledAt === null ? '9' : '0'}${row.scheduledAt?.toISOString() ?? ''}${row.title}`
}

function byTime(left: Timed, right: Timed): number {
  return orderKey(left).localeCompare(orderKey(right))
}

/**
 * 이 묶음에서 **가장 가까운** 회의.
 *
 * 무엇을 그렇게 세는지는 화면이 유도할 수 없어 명세가 서버에 맡겼고, 명세가 그림을
 * 보고 적어 두었다 — **완료는 빼고 취소는 넣는다.**
 */
function nearest(rows: readonly Timed[]): Timed | undefined {
  return rows.filter((row) => row.status !== 'done' && row.scheduledAt !== null).sort(byTime)[0]
}

function nextNote(row: Timed | undefined): string {
  // 아직 아무것도 잡히지 않은 묶음이 있다. 빈 글을 주면 화면이 빈 줄을 그린다.
  return row === undefined
    ? '예정된 회의가 없습니다'
    : `가장 가까운 회의: ${weekdayStamp(row.scheduledAt!)}`
}

/**
 * 회의마다 참가자가 몇인가. **세는 것은 서버가 한다.**
 *
 * 화면이 참가자 목록을 통째로 받아 세면 '몇 명인가'의 답이 화면마다 갈린다 —
 * 학생 명단이 같은 자리에서 같은 규칙을 지킨다.
 */
async function participantCounts(db: Db, ids: string[]): Promise<Map<string, number>> {
  if (ids.length === 0) return new Map()
  const rows = await db
    .select({ meetingId: meetingParticipants.meetingId, total: sql<number>`count(*)::int` })
    .from(meetingParticipants)
    .where(inArray(meetingParticipants.meetingId, ids))
    .groupBy(meetingParticipants.meetingId)
  return new Map(rows.map((row) => [row.meetingId, Number(row.total)]))
}

/** 회의마다 안건이 몇인가. */
async function agendaCounts(db: Db, ids: string[]): Promise<Map<string, number>> {
  if (ids.length === 0) return new Map()
  const rows = await db
    .select({ meetingId: meetingAgendas.meetingId, total: sql<number>`count(*)::int` })
    .from(meetingAgendas)
    .where(inArray(meetingAgendas.meetingId, ids))
    .groupBy(meetingAgendas.meetingId)
  return new Map(rows.map((row) => [row.meetingId, Number(row.total)]))
}

/** 이 사람이 어느 회의에 어떤 자리로 들어 있는가. */
async function viewerPlaces(
  db: Db,
  orgId: string,
  viewer: MeetingViewer,
  ids: string[],
): Promise<Map<string, { isHost: boolean }>> {
  if (ids.length === 0) return new Map()
  const rows = await db
    .select({ meetingId: meetingParticipants.meetingId, isHost: meetingParticipants.isHost })
    .from(meetingParticipants)
    .where(
      and(
        eq(meetingParticipants.orgId, orgId),
        eq(meetingParticipants.memberId, viewer.memberId),
        inArray(meetingParticipants.meetingId, ids),
      ),
    )
  return new Map(rows.map((row) => [row.meetingId, { isHost: row.isHost }]))
}

export interface MeetingAttention {
  viewerTitle: string
  viewerNote: string
  attentionNote: string
  canCreateMeeting: boolean
}

/** 역할의 이름은 **명세가 갖고 있다**(org.baseRoles). 두 벌을 들면 갈린다. */
const ROLE_LABEL = new Map<string, string>(
  (
    optionSourcesJson.sources.find((source) => source.key === 'org.baseRoles') as
      | { options: Array<{ value: string; label: string }> }
      | undefined
  )?.options.map((option) => [option.value, option.label]) ?? [],
)

/**
 * 회의 목록 위의 띠(OPS-MEET-01A).
 *
 * **와이어프레임이 넷을 그렸다** — 일반 참가자·진행 권한자·회의 생성 가능·미참가자.
 * 누가 보느냐는 서버만 알므로 제목도 설명도 곁의 값도 여기서 나온다.
 *
 * 넷을 무엇이 가르는지는 그림이 말하지 않아 **회의와의 관계가 진한 쪽부터** 잡는다:
 * 진행 권한을 가진 회의가 있으면 그 자리가 먼저이고, 초대만 받았으면 참가자이고,
 * 아무 회의에도 없으면 그 사람이 무엇을 할 수 있는지로 갈린다. 그래야 넷이 다 나온다.
 *
 * 곁의 한 줄은 **셀 것이 있을 때만** 온다 — 명세가 '회의 생성 가능·미참가자 화면에는
 * 그려지지 않는다'고 적었고, 그 둘은 아무 회의에도 없으므로 셀 것이 저절로 없다.
 */
export async function meetingAttention(
  db: Db,
  orgId: string,
  viewer: MeetingViewer,
  allowed: { canCreateMeeting: boolean },
): Promise<MeetingAttention> {
  const rows = await db
    .select({
      isHost: meetingParticipants.isHost,
      acknowledgedAt: meetingParticipants.acknowledgedAt,
      status: meetings.status,
    })
    .from(meetingParticipants)
    .innerJoin(
      meetings,
      and(eq(meetingParticipants.meetingId, meetings.id), eq(meetings.orgId, orgId)),
    )
    .where(
      and(
        eq(meetingParticipants.orgId, orgId),
        eq(meetingParticipants.memberId, viewer.memberId),
        sql`${meetings.status} <> 'draft'`,
      ),
    )

  // **아직 확인하지 않은 회의 요약.** 정리 완료된 회의의 요약을 확인했는지는
  // 회의의 상태가 아니라 **이 사람의 상태**다(OPS-MEET-08).
  const needCheck = rows.filter(
    (row) => row.status === 'done' && row.acknowledgedAt === null,
  ).length
  // 끝난 회의의 진행 권한은 세지 않는다 — 할 것이 남은 회의만 곁에 알린다.
  const hosting = rows.filter(
    (row) => row.isHost && row.status !== 'done' && row.status !== 'cancelled',
  ).length
  const isHost = rows.some((row) => row.isHost)

  const parts = []
  if (needCheck > 0) parts.push(`확인 필요한 회의 ${needCheck}건`)
  if (hosting > 0) parts.push(`진행 권한 ${hosting}건`)

  return {
    ...(await band(db, orgId, viewer, {
      isHost,
      joined: rows.length > 0,
      canCreateMeeting: allowed.canCreateMeeting,
    })),
    attentionNote: parts.join(' · '),
    canCreateMeeting: allowed.canCreateMeeting,
  }
}

/**
 * 띠의 제목과 설명.
 *
 * 설명은 **그림이 이미 적어 둔 말**에서 온다 — 진행 권한자가 무엇을 할 수 있는지는
 * OPS-MEET-02가, 미참가자가 무엇을 열 수 있는지는 OPS-MEET-01D의 갈래가 적었다.
 */
async function band(
  db: Db,
  orgId: string,
  viewer: MeetingViewer,
  seen: { isHost: boolean; joined: boolean; canCreateMeeting: boolean },
): Promise<{ viewerTitle: string; viewerNote: string }> {
  if (seen.isHost) {
    return {
      viewerTitle: '진행 권한자 화면',
      viewerNote: '진행 권한을 가진 회의는 시작·종료하고 안건과 회의록을 정리할 수 있습니다.',
    }
  }
  if (seen.joined) {
    return {
      viewerTitle: '일반 참가자 화면',
      viewerNote: '초대된 회의의 일정과 참가 상태를 확인합니다.',
    }
  }
  if (!seen.canCreateMeeting) {
    return {
      viewerTitle: '미참가자 화면',
      viewerNote: '초대되지 않은 회의는 상세만 열람할 수 있습니다.',
    }
  }
  // 만들 수 있는 사람에게는 **그 사람이 누구인지**를 말한다. 아직 어느 회의에도
  // 들어 있지 않으므로 회의와의 관계로는 부를 이름이 없다.
  const rows = await db
    .select({ name: members.name, role: members.role, department: departments.name })
    .from(members)
    .leftJoin(
      departments,
      and(eq(members.departmentId, departments.id), eq(departments.orgId, orgId)),
    )
    .where(and(eq(members.orgId, orgId), eq(members.id, viewer.memberId)))
    .limit(1)
  const row = rows[0]
  if (row === undefined) throw new NotFound('그 구성원을 찾지 못했습니다')
  const place = [row.department, ROLE_LABEL.get(row.role) ?? row.role].filter(
    (part): part is string => part !== null && part !== '',
  )
  return {
    viewerTitle: `${row.name} (${place.join(' ')})`,
    viewerNote: '새 회의를 만들고 참가자와 안건을 등록할 수 있습니다.',
  }
}

export interface DraftParticipant {
  memberId: string
  name: string
  departmentNote: string
  chips: Array<{ label: string; tone: string }>
  actionLabel?: string
  actionEmphasis?: string
  canRemove?: boolean
}

export interface DraftAgenda {
  agendaTitle: string
  agendaNote?: string
  attachmentName?: string
}

export interface MeetingDraft {
  hostName: string
  statusLabel: string
  meetingType?: string
  linkedEventId?: string
  title?: string
  departmentId?: string
  purpose?: string
  date?: string
  startTime?: string
  endTime?: string
  mode?: string
  place?: string
  onlineLink?: string
  isPrivate?: boolean
  participants?: DraftParticipant[]
  agendaItems?: DraftAgenda[]
}

/**
 * 회의를 만들거나 고칠 때 화면이 처음 받는 값(OPS-MEET-02).
 *
 * **`meetingId`가 없으면 새로 쓰는 것이다.** 그때는 서버가 아는 것만 온다 —
 * 주최자는 지금 만드는 사람이고 상태는 새 회의의 그것이다.
 *
 * **안 적은 칸은 아예 오지 않는다.** 빈 칸에 '미정' 같은 말을 넣으면 사람이 그것을
 * 지우지 않고 저장해 회의명이 '미정'이 된다 — 행사 기본정보가 같은 자리에서 같은
 * 규칙을 지킨다.
 */
export async function meetingDraft(
  db: Db,
  orgId: string,
  viewer: MeetingViewer,
  meetingId: string | undefined,
): Promise<MeetingDraft> {
  if (meetingId === undefined || meetingId.trim() === '') {
    const rows = await db
      .select({ name: members.name })
      .from(members)
      .where(and(eq(members.orgId, orgId), eq(members.id, viewer.memberId)))
      .limit(1)
    const row = rows[0]
    if (row === undefined) throw new NotFound('그 구성원을 찾지 못했습니다')
    // **'예정'을 명세에 박으면 안 된다**고 카탈로그가 적었다. 새 회의가 어느 단계로
    // 생기는지는 서버가 알고 있고(만들기가 그 단계로 넣는다) 그 이름을 여기서 준다.
    return { hostName: row.name, statusLabel: STATUS.scheduled.label }
  }

  const rows = await db
    .select({
      id: meetings.id,
      kind: meetings.kind,
      eventId: meetings.eventId,
      title: meetings.title,
      purpose: meetings.purpose,
      status: meetings.status,
      scheduledAt: meetings.scheduledAt,
      plannedEndAt: meetings.plannedEndAt,
      mode: meetings.mode,
      place: meetings.place,
      onlineLink: meetings.onlineLink,
      isPrivate: meetings.isPrivate,
      departmentId: meetings.departmentId,
      creatorMemberId: meetings.creatorMemberId,
      hostName: members.name,
    })
    .from(meetings)
    .leftJoin(members, and(eq(meetings.creatorMemberId, members.id), eq(members.orgId, orgId)))
    .where(and(eq(meetings.orgId, orgId), eq(meetings.id, meetingId)))
    .limit(1)
  const row = rows[0]
  // **없는 것은 없다고 말한다.** 남의 학생회의 회의도 여기서는 없는 것이다.
  if (row === undefined) throw new NotFound('그 회의를 찾지 못했습니다')

  const draft: MeetingDraft = {
    hostName: orNote(row.hostName, '주최자 미정'),
    // 초안으로 저장된 회의도 '예정'으로 그린다 — 화면의 안내가 '새 회의는 예정
    // 상태로 생성됩니다'라고 적었고, 임시 저장에 붙는 이름은 그림에 없다.
    statusLabel: STATUS[listed(row.status) ? row.status : 'scheduled'].label,
    meetingType: row.kind,
    isPrivate: row.isPrivate,
    participants: await draftParticipants(db, orgId, viewer, row),
    agendaItems: await draftAgendas(db, orgId, row.id),
  }
  const filled: Array<[keyof MeetingDraft, string | null]> = [
    ['linkedEventId', row.eventId],
    ['title', row.title],
    ['departmentId', row.departmentId],
    ['purpose', word(row.purpose)],
    ['mode', word(row.mode)],
    ['place', word(row.place)],
    ['onlineLink', word(row.onlineLink)],
    // 날짜 칸과 시각 칸이 따로다. 표에는 때 하나로 드는 것을 여기서 가른다.
    ['date', row.scheduledAt === null ? null : fieldMoment(row.scheduledAt).slice(0, 10)],
    ['startTime', row.scheduledAt === null ? null : fieldMoment(row.scheduledAt).slice(11)],
    ['endTime', row.plannedEndAt === null ? null : fieldMoment(row.plannedEndAt).slice(11)],
  ]
  for (const [key, value] of filled) {
    if (value !== null && value !== '') Object.assign(draft, { [key]: value })
  }
  return draft
}

/**
 * 고른 참가자들.
 *
 * **줄 단추는 회의 생성자에게만 온다.** 다른 사람의 진행 권한을 바꾸는 것은 생성자만
 * 할 수 있다고 명세가 못 박았다(permissions.json의 meeting.own) — 판정이 화면에서
 * 나오면 단추를 그렸는데 눌리면 막힌다.
 */
async function draftParticipants(
  db: Db,
  orgId: string,
  viewer: MeetingViewer,
  meeting: { id: string; creatorMemberId: string | null },
): Promise<DraftParticipant[]> {
  const rows = await db
    .select({
      memberId: meetingParticipants.memberId,
      isHost: meetingParticipants.isHost,
      name: members.name,
      department: departments.name,
    })
    .from(meetingParticipants)
    .innerJoin(
      members,
      and(eq(meetingParticipants.memberId, members.id), eq(members.orgId, orgId)),
    )
    .leftJoin(
      departments,
      and(eq(members.departmentId, departments.id), eq(departments.orgId, orgId)),
    )
    .where(
      and(
        eq(meetingParticipants.orgId, orgId),
        eq(meetingParticipants.meetingId, meeting.id),
      ),
    )

  const canManage = viewer.memberId === meeting.creatorMemberId
  // 만든 사람이 먼저, 그다음 진행 권한자, 그다음 이름순. 그림이 그린 차례다.
  const order = (row: (typeof rows)[number]) =>
    `${row.memberId === meeting.creatorMemberId ? 0 : 1}${row.isHost ? 0 : 1}${row.name}`

  return [...rows]
    .sort((left, right) => order(left).localeCompare(order(right)))
    .map((row) => {
      const chips: Array<{ label: string; tone: string }> = []
      if (row.memberId === meeting.creatorMemberId) {
        chips.push({ label: '회의 생성자', tone: 'gray' })
      }
      if (row.isHost) chips.push({ label: '진행 권한', tone: 'blue' })

      const drawn: DraftParticipant = {
        memberId: row.memberId,
        name: row.name,
        departmentNote: orNote(row.department, '부서 미배정'),
        chips,
      }
      // 만든 사람의 줄에는 단추가 없다 — 자기 권한을 스스로 빼는 그림이 없다.
      if (canManage && row.memberId !== meeting.creatorMemberId) {
        drawn.actionLabel = row.isHost ? '권한 해제' : '진행 권한 부여'
        // 글만으로는 부족하다 — 권한을 빼는 것과 주는 것이 다른 색으로 그려진다.
        drawn.actionEmphasis = row.isHost ? 'danger' : 'primary'
        drawn.canRemove = true
      }
      return drawn
    })
}

/**
 * 세워 둔 안건들.
 *
 * **예상 소요 시간(`duration`)은 오지 않는다.** 고를 수 있는 값의 목록을 명세가
 * `meeting.agendaDurations`로 서버에 물어 두었는데 디자인이 그 목록을 그리지 않았다 —
 * 값의 꼴을 모르는 채로 내려보내면 화면의 고르는 칸에 목록에 없는 값이 앉는다.
 */
async function draftAgendas(db: Db, orgId: string, meetingId: string): Promise<DraftAgenda[]> {
  const rows = await db
    .select({
      id: meetingAgendas.id,
      title: meetingAgendas.title,
      description: meetingAgendas.description,
      attachment: documents.title,
    })
    .from(meetingAgendas)
    // 사전 자료는 문서 표에 있다(명세가 '안건의 사전 자료와 회의록의 관련 자료가
    // 같은 물건'이라 적었다). 이음매마다 학생회를 다시 건다.
    .leftJoin(
      documents,
      and(eq(documents.agendaId, meetingAgendas.id), eq(documents.orgId, orgId)),
    )
    .where(and(eq(meetingAgendas.orgId, orgId), eq(meetingAgendas.meetingId, meetingId)))
    .orderBy(asc(meetingAgendas.sortOrder), asc(meetingAgendas.id), asc(documents.createdAt))

  const made = new Map<string, DraftAgenda>()
  for (const row of rows) {
    // 한 안건에 자료가 여럿일 수 있다. 그림의 그 자리는 이름 하나라 먼저 온 것을 든다.
    if (made.has(row.id)) continue
    const item: DraftAgenda = { agendaTitle: row.title }
    const note = word(row.description)
    if (note !== null) item.agendaNote = note
    const attachment = word(row.attachment)
    if (attachment !== null) item.attachmentName = attachment
    made.set(row.id, item)
  }
  return [...made.values()]
}

export interface MemberCandidate {
  memberId: string
  name: string
  departmentNote: string
}

/**
 * 참가자로 넣을 수 있는 사람들(OPS-MEET-02·04B의 검색).
 *
 * **이름으로도 부서로도 찾는다** — 화면의 칸 이름이 '이름 또는 부서로 구성원 검색'이다.
 *
 * **`alreadyAdded`는 오지 않는다.** '이미 넣었는가'는 어느 회의의 초안인지를 알아야
 * 답할 수 있는데 이 자리가 받는 인자는 검색어뿐이다. 지어낸 답을 주는 대신 보내지
 * 않는다 — 카탈로그도 이 조각을 optional로 적었고, 고른 사람은 화면의 초안이 든다.
 */
export async function memberCandidates(
  db: Db,
  orgId: string,
  asked: MeetingQuery,
): Promise<MemberCandidate[]> {
  const wanted = (asked.query ?? '').trim()
  const rows = await db
    .select({
      memberId: members.id,
      name: members.name,
      department: departments.name,
    })
    .from(members)
    .leftJoin(
      departments,
      and(eq(members.departmentId, departments.id), eq(departments.orgId, orgId)),
    )
    .where(
      and(
        eq(members.orgId, orgId),
        wanted === ''
          ? undefined
          : or(ilike(members.name, `%${wanted}%`), ilike(departments.name, `%${wanted}%`)),
      ),
    )
    .orderBy(asc(members.name))

  return rows.map((row) => ({
    memberId: row.memberId,
    name: row.name,
    departmentNote: orNote(row.department, '부서 미배정'),
  }))
}

/**
 * 회의를 걸 수 있는 행사.
 *
 * **거르지 않는다.** 어느 행사에 회의를 걸 수 있는지를 명세가 말하지 않았다 —
 * 끝난 행사를 빼는 규칙은 행사 목록의 것이고, 그것을 여기 옮기면 지어낸 규칙이 된다.
 */
export async function linkableEventOptions(
  db: Db,
  orgId: string,
): Promise<Array<{ value: string; label: string }>> {
  const rows = await db
    .select({ id: events.id, title: events.title, startAt: events.startAt })
    .from(events)
    .where(eq(events.orgId, orgId))
  return rows
    // 이른 행사가 먼저, 일시가 없으면 뒤로. 회의 목록이 줄 세우는 규칙과 같다.
    .map((row) => ({ ...row, scheduledAt: row.startAt, status: '' }))
    .sort(byTime)
    .map((row) => ({ value: row.id, label: row.title }))
}
