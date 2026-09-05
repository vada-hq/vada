import { and, asc, eq, ilike, or, sql } from 'drizzle-orm'
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
import { clock, daysBetween, dottedStamp } from '../time.ts'
import { cancellableStage } from './manage.ts'
import { listed, MINUTES, orNote, STATUS, word, type Listed, type MeetingViewer } from './meetings.ts'
import { endableStage, startableStage } from './run.ts'

// 회의 한 건과 그 곁의 넷(OPS-MEET-03A·03B·03C · 05A · D01 · D02가 읽는다).
//
// **한 출처가 여러 단계를 답한다.** 명세가 단계마다 출처를 가르지 않았고, 가르면
// 화면이 '지금 어느 단계인가'를 알아야 한다 — 그 단계에 없는 조각은 비운다.
//
// **보는 사람에 따라 통째로 달라진다.** 띠의 제목도 상태 띠의 글도 '누가 보느냐'와
// '지금 어느 단계인가' 둘 다에 매여 있고, 그 둘을 함께 아는 것은 서버뿐이다.
//
// ## 왜 빈 글이 오는가 — 없는 것과 그릴 자리가 없는 것
//
// 목록의 `badge`는 없으면 **안 온다**. 그런데 여기서는 그리지 못하는 조각이 **빈
// 글로** 온다. 두 규칙이 다른 까닭은 그리는 자리가 다르기 때문이다.
//
// - `badge`는 **있으면 붙는 딱지**다. 없으면 그 자리도 없다.
// - 상세가 그리는 것은 **자리가 미리 잡힌 칸**이다. '예상 시간' 카드는 값이 없어도
//   카드가 그려지고, 화면은 그 칸의 값을 반드시 읽는다 — 없는 조각을 만나면 그
//   자리에서 터진다(화면 열한 장의 `scalar`가 다 그렇다).
//
// 그래서 **칸이 있는 조각은 빈 글로, 붙었다 떨어지는 조각은 없이** 보낸다. 회의
// 목록이 `viewerChipLabel`을 빈 글로 보내는 것과 같은 규칙이고, 학생 명단의
// `rowTone`도 그 자리에서 그렇게 한다.
//
// **빈 글은 '모른다'는 뜻이지 '0'이라는 뜻이 아니다.** 셀 수 있는 것은 세어서 보내고
// (`총 3개`·`등록 자료 0개`), 셀 근거가 없는 것만 빈 글이다 — 안건마다의 업무 수가
// 그렇다(어느 안건에서 나온 업무인지를 담는 열이 `tasks`에 없다).

/** 회의 분류 딱지의 말은 **명세가 갖는다**(meeting.types). 여기 다시 적으면 갈린다. */
const KIND_LABEL = new Map<string, string>(
  (
    optionSourcesJson.sources.find((source) => source.key === 'meeting.types') as
      | { options: Array<{ value: string; label: string }> }
      | undefined
  )?.options.map((option) => [option.value, option.label]) ?? [],
)

/** 회의록이 어디까지 왔는가를 알리는 색. 표의 세 값과 짝이다. */
const MINUTES_TONE: Record<keyof typeof MINUTES, string> = {
  notStarted: 'gray',
  drafting: 'yellow',
  done: 'green',
}

/**
 * 이 사람이 이 회의에서 무엇을 할 수 있는가.
 *
 * **막는 검사와 같은 곳에서 온다.** 자리마다 `canDo`가 답하고 그 답이 그대로
 * 화면으로 간다 — 두 곳에서 나오면 단추를 그렸는데 눌리면 막힌다.
 */
export interface MeetingPowers {
  /** 이 회의를 진행할 수 있는가(meeting.run). 시작·종료를 막는 그 판정이다. */
  canRun: boolean
  /** 이 회의를 만든 사람인가(meeting.own). 수정·취소·권한 관리를 막는 그 판정이다. */
  canOwn: boolean
  /**
   * 회의록을 정리할 수 있는가.
   *
   * **명세가 아직 말하지 않았다**(permissions.json이 그 자리를 `unstated`로 두었다).
   * 지어내서 열어 두면 그 자리는 규칙 없이 열려 있고 아무도 그 사실을 모른다.
   */
  canEditMinutes: boolean
}

export interface MeetingDetail {
  title: string
  description: string
  status: string
  statusTone: string
  minutesStatus: string
  minutesStatusTone: string
  kindLabel: string
  kindTone: string
  eventTitle: string
  eventId?: string
  creatorNote: string
  updatedNote: string
  scheduledAt: string
  plannedDurationNote: string
  place: string
  inviteeCountNote: string
  viewerTitle: string
  viewerNote: string
  viewerChipLabel: string
  viewerChipTone: string
  stateBannerTitle: string
  stateBannerNote: string
  stateBannerTone: string
  canStart: boolean
  canEnd: boolean
  canEdit: boolean
  canCancel: boolean
  canManageHostRole: boolean
  canEditMinutes: boolean
  startedAt: string
  elapsedNote: string
  presentNote: string
  actualTimeNote: string
  closedByNote: string
  attendanceResultNote: string
  agendaCountNote: string
  materialCountNote: string
  participantCountNote: string
  decisionCountNote: string
  followUpCountLabel: string
  myFollowUpCountLabel: string
  cancelReason: string
  cancelledByNote: string
  cancelledAtNote: string
  replacementNote: string
}

/** 몇 분을 사람이 읽는 말로. '1시간 30분'·'1시간'·'45분' 셋이 그림에 다 있다. */
function spanNote(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) return `${rest}분`
  return rest === 0 ? `${hours}시간` : `${hours}시간 ${rest}분`
}

function minutesBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 60_000)
}

/** 이름과 소속을 이은 한 줄. **화면이 이으면 잇는 방법이 명세의 일이 된다.** */
function personNote(name: string | null, department: string | null): string | null {
  if (name === null) return null
  return department === null || department.trim() === '' ? name : `${name} · ${department}`
}

/** 이 사람이 이 회의를 진행할 수 있는가. **만든 사람은 기본 진행 권한자다**(ORG-04). */
function runs(
  row: { memberId: string; isHost: boolean },
  creatorMemberId: string | null,
): boolean {
  return row.isHost || row.memberId === creatorMemberId
}

/**
 * 참석 딱지.
 *
 * **말이 단계마다 다르다** — 회의가 도는 동안은 '참가'이고 끝난 뒤에는 '참석'이다
 * (05A와 07이 같은 사람에게 다른 말을 그렸다). 시작하기 전에는 잴 것이 없어 빈 글이다.
 *
 * **시각이 붙지 않는다.** 그림은 '15:00 참가'라 적었는데 언제 들어왔는지를 담는
 * 열이 `meeting_participants`에 없다 — 지어낸 시각을 붙이는 대신 아는 것만 준다.
 */
function attendanceChip(stage: Listed, attendance: string): { label: string; tone: string } {
  if (stage === 'scheduled' || stage === 'cancelled') return { label: '', tone: '' }
  if (attendance === 'present') {
    return { label: stage === 'inProgress' ? '참가' : '참석', tone: 'green' }
  }
  // '안 왔다'와 '아직 확인 안 했다'는 다른 사실이라 표가 갈라 두었다. 말도 가른다.
  return attendance === 'absent'
    ? { label: '불참', tone: 'gray' }
    : { label: '미참석', tone: 'gray' }
}

/** 그 학생회의 그 회의인가. **없는 것은 없다고 말한다.** */
async function meetingOf(db: Db, orgId: string, meetingId: string) {
  const rows = await db
    .select({
      id: meetings.id,
      status: meetings.status,
      creatorMemberId: meetings.creatorMemberId,
    })
    .from(meetings)
    .where(and(eq(meetings.orgId, orgId), eq(meetings.id, meetingId)))
    .limit(1)
  const row = rows[0]
  if (row === undefined) throw new NotFound('그 회의를 찾지 못했습니다')
  return row
}

/** 이 회의의 사람들. 세 자리(상세·안건·참가자)가 같은 것을 본다. */
async function participantsOf(db: Db, orgId: string, meetingId: string) {
  return db
    .select({
      memberId: meetingParticipants.memberId,
      isHost: meetingParticipants.isHost,
      attendance: meetingParticipants.attendance,
      name: members.name,
      department: departments.name,
    })
    .from(meetingParticipants)
    .innerJoin(members, and(eq(meetingParticipants.memberId, members.id), eq(members.orgId, orgId)))
    .leftJoin(
      departments,
      and(eq(members.departmentId, departments.id), eq(departments.orgId, orgId)),
    )
    .where(
      and(eq(meetingParticipants.orgId, orgId), eq(meetingParticipants.meetingId, meetingId)),
    )
}

/** 이 회의의 안건들. 차례는 표의 `sortOrder`가 든다. */
async function agendasOf(db: Db, orgId: string, meetingId: string) {
  return db
    .select({
      id: meetingAgendas.id,
      title: meetingAgendas.title,
      description: meetingAgendas.description,
      plannedMinutes: meetingAgendas.plannedMinutes,
      status: meetingAgendas.status,
      discussionText: meetingAgendas.discussionText,
      decisionText: meetingAgendas.decisionText,
    })
    .from(meetingAgendas)
    .where(and(eq(meetingAgendas.orgId, orgId), eq(meetingAgendas.meetingId, meetingId)))
    .orderBy(asc(meetingAgendas.sortOrder), asc(meetingAgendas.id))
}

/**
 * 이 회의에 등록된 자료가 몇인가.
 *
 * 자료의 **목록**은 다른 자리가 준다(`meeting.documents`). 여기서 세는 까닭은
 * 그 수가 목록이 아니라 회의의 사실이기 때문이다 — 목록이 쪽으로 나뉘어도 수는
 * 변하지 않는다.
 */
async function materialCount(db: Db, orgId: string, meetingId: string): Promise<number> {
  const rows = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(documents)
    .where(and(eq(documents.orgId, orgId), eq(documents.meetingId, meetingId)))
  return Number(rows[0]?.total ?? 0)
}

/** 같은 자리라도 **단계가 바뀌면 할 수 있는 일이 바뀐다.** 그림이 단계마다 적었다. */
const GUEST_NOTE: Record<Listed, string> = {
  scheduled: '회의 정보를 확인할 수 있지만 회의를 시작하거나 설정을 변경할 수 없습니다.',
  inProgress: '회의록을 함께 작성할 수 있지만 회의를 끝내거나 안건을 넘길 수 없습니다.',
  wrapUp: '현재 내용은 진행 권한자가 수정할 수 있습니다.',
  done: '정리된 회의록을 읽고 받아 갈 수 있습니다.',
  cancelled: '취소된 회의는 기록으로만 남습니다.',
}

/**
 * 이 자리에서 무엇을 할 수 있는지 알리는 띠.
 *
 * 제목은 `meeting.attention`의 같은 이름과 **같은 계급**이라고 명세가 적었다. 설명은
 * 그림이 이미 적어 둔 말에서 온다 — 생성자와 진행 권한자의 것은 03B·03C가, 일반
 * 참가자의 것은 단계마다 03A·05A·06A·07·09가 적었다.
 */
function viewerBand(
  stage: Listed,
  seen: { isCreator: boolean; canRun: boolean; joined: boolean },
): { viewerTitle: string; viewerNote: string } {
  if (seen.isCreator) {
    return {
      viewerTitle: '회의 생성자 화면',
      viewerNote: '회의 수정·취소와 진행 권한 관리, 회의 시작을 할 수 있습니다.',
    }
  }
  if (seen.canRun) {
    return {
      viewerTitle: '진행 권한자 화면',
      viewerNote:
        '회의를 시작·종료하고 안건을 진행할 수 있지만 권한이나 회의 정보는 변경할 수 없습니다.',
    }
  }
  if (!seen.joined) {
    // 회의 목록의 띠가 미참가자에게 하는 말과 같다. 두 벌을 들면 갈린다.
    return {
      viewerTitle: '미참가자 화면',
      viewerNote: '초대되지 않은 회의는 상세만 열람할 수 있습니다.',
    }
  }
  return { viewerTitle: '일반 참가자 화면', viewerNote: GUEST_NOTE[stage] }
}

/**
 * 상태 띠.
 *
 * **상태와 보는 사람 둘 다에 매인다.** 같은 예정 회의라도 시작할 수 있는 사람에게는
 * '시작 전 확인'이 오고(03B·03C가 그렇게 그렸다) 그럴 수 없는 사람에게는 '아직
 * 시작되지 않았습니다'가 온다(03A).
 *
 * **'시작 전 확인'만 무채색이다.** 그림이 그 자리를 흰 카드로 그렸다 — 띠의 색표에
 * 없는 이름이 오면 화면이 무채색으로 그린다(`BANNER_TONE`의 기본값).
 *
 * 정리 중과 취소의 띠는 **제목과 색까지만** 준다. 본문으로 그려진 글이 그림마다
 * 달라(06A와 09가 서로 다른 문장을 그렸다) 하나를 고르면 그것은 고르는 일이 된다.
 */
function stateBanner(
  stage: Listed,
  canStart: boolean,
  daysLeft: number | null,
): { title: string; note: string; tone: string } {
  if (stage === 'scheduled') {
    if (!canStart) {
      return {
        title: '아직 회의가 시작되지 않았습니다',
        note: '회의가 시작되면 목록과 이 화면의 버튼이 ‘회의 참가’로 변경됩니다. 이 화면을 확인한 것은 참석으로 기록되지 않습니다.',
        tone: 'blue',
      }
    }
    // 셀 날이 없으면 남은 날만 빠진다 — 할 일을 이르는 말은 그대로 온다.
    const left =
      daysLeft === null || daysLeft <= 0 ? null : `현재 예정 시각까지 ${daysLeft}일 남았습니다.`
    return {
      title: '시작 전 확인',
      note: [left, '안건과 참가자를 확인한 뒤 회의를 시작하세요.']
        .filter((part): part is string => part !== null)
        .join(' '),
      // 띠의 색표에 무채색이 없다 — 이름을 그대로 주면 화면이 흰 카드로 그린다.
      tone: 'gray',
    }
  }
  if (stage === 'wrapUp') {
    return { title: '회의가 종료되어 정리 중입니다', note: '', tone: 'yellow' }
  }
  if (stage === 'cancelled') return { title: '이 회의는 취소되었습니다', note: '', tone: 'red' }
  return { title: '', note: '', tone: '' }
}

/**
 * 회의 한 건(`meeting.detail`).
 *
 * **화면 열한 장이 이것을 읽는다.** 그래서 여기서 하는 일의 절반은 '이 단계에 없는
 * 것을 안 보내는' 일이다.
 */
export async function meetingDetail(
  db: Db,
  orgId: string,
  viewer: MeetingViewer,
  meetingId: string,
  allowed: MeetingPowers,
  now: Date,
): Promise<MeetingDetail> {
  const rows = await db
    .select({
      id: meetings.id,
      kind: meetings.kind,
      eventId: meetings.eventId,
      title: meetings.title,
      purpose: meetings.purpose,
      status: meetings.status,
      minutesStatus: meetings.minutesStatus,
      scheduledAt: meetings.scheduledAt,
      plannedEndAt: meetings.plannedEndAt,
      place: meetings.place,
      creatorMemberId: meetings.creatorMemberId,
      startedAt: meetings.startedAt,
      endedAt: meetings.endedAt,
      updatedAt: meetings.updatedAt,
      cancelReason: meetings.cancelReason,
      cancelledByMemberId: meetings.cancelledByMemberId,
      cancelledAt: meetings.cancelledAt,
      creatorName: members.name,
      creatorDepartment: departments.name,
      eventTitle: events.title,
    })
    .from(meetings)
    // **이어 붙인 표도 자기 학생회를 확인한다.** 벽은 두 겹이 낫다.
    .leftJoin(members, and(eq(meetings.creatorMemberId, members.id), eq(members.orgId, orgId)))
    .leftJoin(
      departments,
      and(eq(members.departmentId, departments.id), eq(departments.orgId, orgId)),
    )
    .leftJoin(events, and(eq(meetings.eventId, events.id), eq(events.orgId, orgId)))
    .where(and(eq(meetings.orgId, orgId), eq(meetings.id, meetingId)))
    .limit(1)
  const row = rows[0]
  // **없는 것은 없다고 말한다.** 남의 학생회의 회의도 여기서는 없는 것이다.
  if (row === undefined) throw new NotFound('그 회의를 찾지 못했습니다')

  // 임시 저장한 회의에 줄 이름을 명세가 주지 않았다. 고치는 화면이 그것을 '예정'으로
  // 그리는 것과 같은 자리에서 같은 답을 준다(`meetingDraft`).
  const stage: Listed = listed(row.status) ? row.status : 'scheduled'
  const drawnStage = STATUS[stage]

  const people = await participantsOf(db, orgId, meetingId)
  const agendas = await agendasOf(db, orgId, meetingId)
  const materials = await materialCount(db, orgId, meetingId)

  const runners = people.filter((one) => runs(one, row.creatorMemberId)).length
  const present = people.filter((one) => one.attendance === 'present').length
  const decisions = agendas.filter((one) => word(one.decisionText) !== null).length
  const plannedMinutes = agendas.reduce((sum, one) => sum + (one.plannedMinutes ?? 0), 0)
  const mine = people.find((one) => one.memberId === viewer.memberId)

  const canStart = allowed.canRun && startableStage(row.status)
  const canEnd = allowed.canRun && endableStage(row.status)
  const daysLeft = row.scheduledAt === null ? null : daysBetween(now, row.scheduledAt)
  const banner = stateBanner(stage, canStart, daysLeft)
  const chip = viewerChip(stage, mine)
  const live = stage === 'inProgress'

  const drawn: MeetingDetail = {
    title: row.title,
    // 목적을 안 적은 회의가 있다. **정해지지 않은 것은 그 사실을 말로 준다.**
    description: orNote(row.purpose, '회의 목적이 적히지 않았습니다'),
    status: drawnStage.label,
    statusTone: drawnStage.tone,
    // 회의록의 단계는 **회의의 단계와 다른 축이다.** 표가 늘 값을 갖는다.
    minutesStatus: MINUTES[row.minutesStatus],
    minutesStatusTone: MINUTES_TONE[row.minutesStatus],
    kindLabel: KIND_LABEL.get(row.kind) ?? '',
    kindTone: KIND_LABEL.has(row.kind) ? 'gray' : '',
    // 행사가 지워졌거나 남의 행사면 이름이 없다. 그때는 딸린 곳이 없는 것과 같다.
    eventTitle: row.eventTitle ?? '',
    creatorNote: orNote(personNote(row.creatorName, row.creatorDepartment), '주최자 미정'),
    updatedNote: `${dottedStamp(row.updatedAt)} 수정`,
    scheduledAt: row.scheduledAt === null ? '일시 미정' : dottedStamp(row.scheduledAt),
    plannedDurationNote:
      row.scheduledAt === null || row.plannedEndAt === null
        ? ''
        : plannedSpan(row.scheduledAt, row.plannedEndAt),
    place: orNote(row.place, '미정'),
    inviteeCountNote: `${people.length}명`,
    ...viewerBand(stage, {
      isCreator: viewer.memberId === row.creatorMemberId,
      canRun: allowed.canRun,
      joined: mine !== undefined,
    }),
    viewerChipLabel: chip.label,
    viewerChipTone: chip.tone,
    stateBannerTitle: banner.title,
    stateBannerNote: banner.note,
    stateBannerTone: banner.tone,
    canStart,
    canEnd,
    // **고치기·권한 관리는 단계를 함께 보지 않는다.** 그 둘을 단계로 막는 자리가 아직
    // 없어서, 여기서만 막으면 그 판정이 막는 검사와 갈린다.
    canEdit: allowed.canOwn,
    // 취소는 예정에서만 간다 — 막는 자리(`cancelMeeting`)와 같은 함수가 답한다.
    canCancel: allowed.canOwn && cancellableStage(row.status),
    canManageHostRole: allowed.canOwn,
    canEditMinutes: allowed.canEditMinutes,
    // **진행 중부터 오는 조각들.** 가만히 있어도 자라는 값이라 서버가 잰다.
    startedAt: row.startedAt === null ? '' : `${clock(row.startedAt)} 시작`,
    elapsedNote:
      row.startedAt === null || !live
        ? ''
        : `진행 ${spanNote(Math.max(0, minutesBetween(row.startedAt, now)))}`,
    presentNote: live ? `${present}명 참가 중` : '',
    // **끝난 뒤에 오는 조각들.** 예정 일시가 아니라 실제로 돈 시각이다.
    actualTimeNote:
      row.startedAt === null || row.endedAt === null
        ? ''
        : `${clock(row.startedAt)}–${clock(row.endedAt)}`,
    // **누가 끝냈는지는 표가 모른다.** 종료한 사람을 담는 열이 `meetings`에 없다 —
    // 지어내면 그것이 기록으로 남는다(보고했다).
    closedByNote: '',
    attendanceResultNote:
      row.endedAt === null ? '' : `${present}명 참석 · ${people.length - present}명 불참`,
    agendaCountNote: `총 ${agendas.length}개${
      plannedMinutes === 0 ? '' : ` · 예상 ${plannedMinutes}분`
    }`,
    materialCountNote: `등록 자료 ${materials}개`,
    participantCountNote: `초대 ${people.length}명${
      runners === 0 ? '' : ` · 진행 권한 ${runners}명`
    }`,
    // 결정은 안건마다 하나다(표가 한 칸을 갖는다). 그래서 셀 수 있다.
    decisionCountNote: `${decisions}건`,
    // **후속 업무는 업무 표의 것이다.** 그 표를 맡은 자리가 따로 붙인다 — 여기서
    // 세면 같은 수를 두 곳에서 세게 되고, 두 답은 언젠가 갈린다.
    followUpCountLabel: '',
    myFollowUpCountLabel: '',
    cancelReason: word(row.cancelReason) ?? '',
    cancelledByNote:
      row.cancelledByMemberId === null
        ? ''
        : ((await cancellerNote(db, orgId, row.cancelledByMemberId)) ?? ''),
    cancelledAtNote: row.cancelledAt === null ? '' : dottedStamp(row.cancelledAt),
    // **대체 회의를 알리는 글은 아직 짓지 않는다.** 그림이 회의 이름을 문장 가운데
    // 끼워 넣었는데, 이름의 끝소리에 따라 조사가 갈린다('회의가' · '회의록이').
    // 규칙 없이 하나를 박으면 절반이 틀린 글이 된다(보고했다).
    replacementNote: '',
  }
  // **갈 곳을 가리키는 인자는 붙었다 떨어진다.** 빈 글을 주면 화면이 아무 데도 아닌
  // 곳으로 가는 이음을 그린다.
  if (row.eventTitle !== null && row.eventId !== null) drawn.eventId = row.eventId
  return drawn
}

/** 잡아 둔 예상 시간. 끝이 시작보다 앞이면 잰 것이 아니다. */
function plannedSpan(from: Date, to: Date): string {
  const minutes = minutesBetween(from, to)
  return minutes <= 0 ? '' : spanNote(minutes)
}

/** 취소한 사람. 이름과 소속을 이어 준다. */
async function cancellerNote(db: Db, orgId: string, memberId: string): Promise<string | null> {
  const rows = await db
    .select({ name: members.name, department: departments.name })
    .from(members)
    .leftJoin(
      departments,
      and(eq(members.departmentId, departments.id), eq(departments.orgId, orgId)),
    )
    .where(and(eq(members.orgId, orgId), eq(members.id, memberId)))
    .limit(1)
  const row = rows[0]
  return row === undefined ? null : personNote(row.name, row.department)
}

/**
 * 보는 사람과 이 회의의 관계 딱지.
 *
 * 예정 회의에는 아직 잴 관계가 없어 **회의가 어떤 회의인지**가 온다(그림이 그 자리에
 * '예정 회의'를 그렸다). 시작한 뒤부터는 이 사람의 참석이 그 자리를 채운다.
 */
function viewerChip(
  stage: Listed,
  mine: { attendance: string } | undefined,
): { label: string; tone: string } {
  if (stage === 'scheduled') return { label: '예정 회의', tone: 'gray' }
  if (mine === undefined) return { label: '', tone: '' }
  if (stage === 'inProgress' && mine.attendance === 'present') {
    // 그림은 '참석 처리됨 · 15:07 참가'라 적었다. 들어온 시각을 담는 열이 없어
    // **아는 절반만** 준다 — 지어낸 시각을 붙이면 그것이 기록이 된다.
    return { label: '참석 처리됨', tone: 'green' }
  }
  return attendanceChip(stage, mine.attendance)
}

export interface MeetingAgenda {
  agendaId: string
  orderLabel: string
  title: string
  description: string
  durationNote: string
  status: string
  statusTone: string
  isCurrent?: boolean
  discussionText: string
  decisionText: string
  decisionEmptyNote: string
  summaryLine: string
  decisionCountNote: string
  taskCountNote: string
}

/**
 * 안건 하나가 지금 어느 단계인가. 표의 세 값을 말과 색으로 편다.
 *
 * 색은 05A가 그린 그대로다 — 아직 안 한 것은 노랑, 지금 하는 것은 초록, 마친 것은
 * 회색. 03 계열은 이 딱지를 아예 그리지 않는다.
 */
const AGENDA_STATUS: Record<string, { label: string; tone: string }> = {
  pending: { label: '대기', tone: 'yellow' },
  current: { label: '진행 중', tone: 'green' },
  done: { label: '논의 완료', tone: 'gray' },
}

/** 결정이 아직 없는 자리에 그릴 말. 06B가 그 문장을 그려 두었다. */
const NO_DECISION =
  '아직 결정사항이 정리되지 않았습니다. 오른쪽 패널에서 작성하거나 ‘결정사항 없음’을 선택하세요.'

/**
 * 이 회의의 안건들(`meeting.agendas`).
 *
 * **단계마다 갖는 것이 다르다** — 예정일 때는 예상 소요를, 진행 중에는 논의 내용을,
 * 끝난 뒤에는 확정된 결정을 갖는다. 그래도 출처는 하나다.
 *
 * **사전 자료는 여기 없다.** 자료는 `documents` 표에 있고 그것을 주는 자리가 따로다
 * (`meeting.documents`).
 */
export async function meetingAgendaList(
  db: Db,
  orgId: string,
  meetingId: string,
): Promise<MeetingAgenda[]> {
  await meetingOf(db, orgId, meetingId)
  const rows = await agendasOf(db, orgId, meetingId)

  return rows.map((row, at) => {
    const isCurrent = row.status === 'current'
    const drawnStatus = AGENDA_STATUS[row.status]
    const decision = word(row.decisionText)
    const drawn: MeetingAgenda = {
      agendaId: row.id,
      orderLabel: `안건 ${at + 1}`,
      title: row.title,
      description: word(row.description) ?? '',
      // 지금 하고 있는 안건의 소요만 '예상'이 붙는다 — 그림이 그 자리만 그렇게 그렸다.
      durationNote:
        row.plannedMinutes === null ? '' : `${isCurrent ? '예상 ' : ''}${row.plannedMinutes}분`,
      status: drawnStatus?.label ?? '',
      statusTone: drawnStatus?.tone ?? '',
      discussionText: word(row.discussionText) ?? '',
      decisionText: decision ?? '',
      // **없다는 말도 서버가 준다.** 무엇을 하라고 이르는 문장이라 조직의 것이다.
      decisionEmptyNote: decision === null ? NO_DECISION : '',
      // **한 줄 요약은 아직 없다.** 06A가 그 자리를 그렸는데 논의 내용을 줄인 것과
      // 다른 글이고(둘을 나란히 그린 화면이 있다) 담을 열도 없다(보고했다).
      summaryLine: '',
      // 결정은 안건마다 하나다(표가 한 칸을 갖는다). 그래서 셀 수 있다.
      decisionCountNote: `결정 ${decision === null ? 0 : 1}`,
      // **안건마다의 업무 수는 셀 수 없다.** `tasks`는 어느 회의의 것인지는 알아도
      // (`from_meeting_id`) 어느 **안건**의 것인지는 담지 않는다 — 0으로 채우면
      // 회의가 만든 업무가 없는 것처럼 보인다(보고했다).
      taskCountNote: '',
    }
    // **없으면 오지 않는다.** 거짓을 실어 보내면 화면이 빈 표시를 그린다.
    if (isCurrent) drawn.isCurrent = true
    return drawn
  })
}

export interface MeetingPerson {
  memberId: string
  name: string
  department: string
  departmentNote: string
  chips: Array<{ label: string; tone: string }>
  capabilityNote: string
  attendanceLabel: string
  attendanceTone: string
  isPresent?: boolean
  actionLabel?: string
  actionEmphasis?: string
  actionEnabled?: boolean
}

export interface MeetingPeopleQuery {
  query?: string
  excludeHostOwner?: boolean
}

/**
 * 이 회의의 사람들(`meeting.participants`).
 *
 * **03의 참가자 목록, 05의 참가 현황, 07의 참석 결과, 04B의 권한 관리 목록이 전부
 * 같은 사람들이다** — 명세가 그렇게 합쳤고 표도 하나다.
 *
 * **거르는 것은 조회의 일이다.** 04B가 만든 사람을 위 칸에 따로 그리므로 목록에서
 * 빼 달라고 말한다(`excludeHostOwner`) — 화면이 받아 온 것을 걸러 내면 그 규칙이
 * 화면마다 갈린다.
 */
export async function meetingPeople(
  db: Db,
  orgId: string,
  meetingId: string,
  asked: MeetingPeopleQuery,
  allowed: { canManageHostRole: boolean },
): Promise<MeetingPerson[]> {
  const meeting = await meetingOf(db, orgId, meetingId)
  const stage: Listed = listed(meeting.status) ? meeting.status : 'scheduled'
  const wanted = (asked.query ?? '').trim()

  const rows = await db
    .select({
      memberId: meetingParticipants.memberId,
      isHost: meetingParticipants.isHost,
      attendance: meetingParticipants.attendance,
      name: members.name,
      department: departments.name,
    })
    .from(meetingParticipants)
    .innerJoin(members, and(eq(meetingParticipants.memberId, members.id), eq(members.orgId, orgId)))
    .leftJoin(
      departments,
      and(eq(members.departmentId, departments.id), eq(departments.orgId, orgId)),
    )
    .where(
      and(
        eq(meetingParticipants.orgId, orgId),
        eq(meetingParticipants.meetingId, meetingId),
        // 04B의 칸 이름이 '이름 또는 부서로 구성원 검색'이다. 둘 다 찾는다.
        wanted === ''
          ? undefined
          : or(ilike(members.name, `%${wanted}%`), ilike(departments.name, `%${wanted}%`)),
      ),
    )

  // 만든 사람이 먼저, 그다음 진행 권한자, 그다음 이름순. 그림이 그린 차례다.
  const order = (row: (typeof rows)[number]) =>
    `${row.memberId === meeting.creatorMemberId ? 0 : 1}${runs(row, meeting.creatorMemberId) ? 0 : 1}${row.name}`

  // **진행 권한자를 하나는 남긴다**(명세의 '최소 1명 유지'). 세는 자리가 걸러지기
  // 전이어야 한다 — 검색으로 좁힌 목록이 권한자의 수를 바꾸지는 않는다.
  const everyone = await participantsOf(db, orgId, meetingId)
  const runners = everyone.filter((one) => runs(one, meeting.creatorMemberId)).length

  return [...rows]
    .filter(
      (row) => !(asked.excludeHostOwner === true && row.memberId === meeting.creatorMemberId),
    )
    .sort((left, right) => order(left).localeCompare(order(right)))
    .map((row) => {
      const isCreator = row.memberId === meeting.creatorMemberId
      const isRunner = runs(row, meeting.creatorMemberId)
      const chips: Array<{ label: string; tone: string }> = []
      if (isCreator) chips.push({ label: '회의 생성자', tone: 'gray' })
      if (isRunner) chips.push({ label: '진행 권한', tone: 'blue' })

      const attendance = attendanceChip(stage, row.attendance)
      const drawn: MeetingPerson = {
        memberId: row.memberId,
        name: row.name,
        department: orNote(row.department, '부서 미배정'),
        departmentNote: `${orNote(row.department, '부서 미배정')} · 회의 참가자`,
        chips,
        capabilityNote: isRunner ? '시작·종료 가능' : '일반 참가자',
        // 시작하기 전에는 잴 것이 없다. 빈 딱지는 화면이 그리지 않는다.
        attendanceLabel: attendance.label,
        attendanceTone: attendance.tone,
      }
      // 지금 들어와 있는가는 **회의가 도는 동안만** 물을 수 있다.
      if (stage === 'inProgress' && row.attendance === 'present') drawn.isPresent = true

      // 만든 사람의 줄에는 단추가 없다 — 자기 권한을 스스로 빼는 그림이 없다.
      if (allowed.canManageHostRole && !isCreator) {
        drawn.actionLabel = row.isHost ? '권한 해제' : '진행 권한 부여'
        drawn.actionEmphasis = row.isHost ? 'secondary' : 'primary'
        drawn.actionEnabled = row.isHost ? runners > 1 : true
      }
      return drawn
    })
}

/**
 * 시작해도 되는지 살펴 준 것(OPS-MEET-D01).
 *
 * **며칠 이른지는 서버만 안다.** 그리고 **막지 않는다** — 이른 것이 잘못이라는 뜻이
 * 아니라 잘못 누른 것은 아닌지 묻는 자리다.
 */
export async function startConfirm(
  db: Db,
  orgId: string,
  meetingId: string,
  now: Date,
): Promise<{ warningNote?: string }> {
  const rows = await db
    .select({ scheduledAt: meetings.scheduledAt })
    .from(meetings)
    .where(and(eq(meetings.orgId, orgId), eq(meetings.id, meetingId)))
    .limit(1)
  const row = rows[0]
  if (row === undefined) throw new NotFound('그 회의를 찾지 못했습니다')

  // 예정 시각에 시작하면 살펴볼 것이 없다 — 명세가 '오지 않을 수 있다'고 적었다.
  if (row.scheduledAt === null) return {}
  const days = daysBetween(now, row.scheduledAt)
  if (days <= 0) return {}
  return {
    warningNote: `예정 시간보다 ${days}일 이른 시각입니다. 잘못 시작한 것은 아닌지 확인해 주세요.`,
  }
}

/**
 * 종료해도 되는지 살펴 준 것(OPS-MEET-D02).
 *
 * **막지는 않는다.** 미완료 안건이 남아도 종료 단추는 살아 있다 — 알려 줄 뿐이다.
 *
 * '미완료'는 **아직 시작하지 않은 안건**이다. 그림이 마친 것 하나·진행 중 하나·대기
 * 하나를 그려 놓고 '미완료 안건 1개'라 적었다.
 */
export async function endConfirm(
  db: Db,
  orgId: string,
  meetingId: string,
): Promise<{ warningNote: string }> {
  await meetingOf(db, orgId, meetingId)
  const agendas = await agendasOf(db, orgId, meetingId)
  const people = await participantsOf(db, orgId, meetingId)

  const waiting = agendas.filter((one) => one.status === 'pending').length
  const present = people.filter((one) => one.attendance === 'present').length
  return {
    warningNote: `미완료 안건 ${waiting}개 · 참석 ${present}명 · 미참가 ${people.length - present}명`,
  }
}
