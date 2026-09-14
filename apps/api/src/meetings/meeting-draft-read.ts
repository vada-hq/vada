import { and, asc, eq } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import { departments, documents, meetingAgendas, meetingParticipants, meetings, members } from '../db/schema.ts'
import { NotFound } from '../errors.ts'
import { fieldMoment } from '../time.ts'
import { listed, orNote, STATUS, word, type MeetingViewer } from './meetings.ts'

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
