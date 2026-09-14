import type { Db } from '../db/client.ts'
import optionSourcesJson from '../../../../specs/figma/vada-wireframe/option-sources.json' with { type: 'json' }
import { clock, daysBetween, dottedStamp } from '../time.ts'
import { cancellableStage } from './manage.ts'
import { listed, MINUTES, orNote, STATUS, word, type Listed, type MeetingViewer } from './meetings.ts'
import { endableStage, startableStage } from './run.ts'
import {
  agendasOf,
  cancellerNote,
  materialCount,
  meetingDetailRow,
  participantsOf,
  personNote,
} from './detail-records.ts'
import { runs, stateBanner, viewerBand, viewerChip } from './detail-view.ts'


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
  const row = await meetingDetailRow(db, orgId, meetingId)

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

export { agendasOf, meetingOf, participantsOf } from './detail-records.ts'
export { attendanceChip, runs } from './detail-view.ts'
