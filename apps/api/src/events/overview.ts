import optionSourcesJson from '../../../../specs/figma/vada-wireframe/option-sources.json' with { type: 'json' }
import type { Db } from '../db/client.ts'
import { NotFound } from '../routes.ts'
import { UNASSIGNED } from '../tasks/labels.ts'
import { clock, day, daysBetween, shortStamp, stamp } from '../time.ts'
import {
  applicantsOf,
  applicationMomentsOf,
  attendanceQrOf,
  currentSurvey,
  eventFacts,
  meetingMomentsOf,
  openTasksOf,
  touchedOf,
  type EventFacts,
  type OpenTask,
  type SurveyFacts,
} from './counts.ts'
import { STATUS, type Status } from './events.ts'

// 행사 개요(EVT-02)가 읽는 여섯 자리.
//
// **여기 있는 것은 전부 완성된 글이다.** 표에 '모집 마감까지 3일'이라는 열은 없고
// 있는 것은 설문의 마감 시각과 지금뿐이다 — 오늘이 언제인지는 서버만 안다. 무엇을
// 급한 것으로 셀지도 마찬가지다: 계약이 그 판단을 서버에 맡겼다.
//
// **세는 일은 `counts.ts`가 하고 여기서는 말과 색만 붙인다.** 후속 정리 개요
// (EVT-02D)가 같은 사실을 함께 세므로, 세는 규칙이 두 벌이면 같은 행사가 갈피마다
// 다른 수를 갖는다.

/** 신청 방식의 말은 **명세가 갖고 있다**(event.surveyApplyMethods). 두 벌을 들면 갈린다. */
const APPLY_METHOD = new Map<string, string>(
  (
    optionSourcesJson.sources.find((source) => source.key === 'event.surveyApplyMethods') as
      | { options: Array<{ value: string; label: string }> }
      | undefined
  )?.options.map((option) => [option.value, option.label]) ?? [],
)

/**
 * 지금 단계 다음에 오는 운영 단계.
 *
 * **명세가 이 짝을 정하지 않았다.** 그림이 예로 든 문장('다음 운영 단계는 모집
 * 마감 확인입니다')은 한 행사의 한 순간을 적은 것이라 규칙이 아니다. 그래서 표가
 * 아는 것에서만 짓는다 — 행사 단계는 `event_status`가 넷으로 고정이고 그 차례가
 * 곧 운영의 차례다. 넘어갈 곳이 생기는 날 고칠 자리는 여기 하나다.
 */
const NEXT_STEP: Record<Status, string | null> = {
  planning: '행사 진행',
  inProgress: '후속 정리',
  wrapUp: '행사 완료 처리',
  done: null,
}

/** 이 학생회의 그 행사. **없으면 404다** — 계약이 이 자리들에 404를 두었다. */
async function must(db: Db, orgId: string, eventId: string): Promise<EventFacts> {
  const row = await eventFacts(db, orgId, eventId)
  if (row === null) throw new NotFound('그 행사를 찾지 못했습니다')
  return row
}

/** 아직 안 정한 것들. 개요 맨 위가 그 사실을 말한다. */
function missingParts(row: EventFacts): string[] {
  const missing: string[] = []
  if (row.startAt === null) missing.push('일시')
  if (row.place === null || row.place.trim() === '') missing.push('장소')
  if (row.hostDepartment === null && row.hostMember === null) missing.push('담당')
  return missing
}

/** 모집이 언제 닫히는가를 **남은 날로** 말한다. 오늘이 언제인지는 서버만 안다. */
function deadlineNote(closesAt: Date, now: Date): string {
  const days = daysBetween(now, closesAt)
  if (days > 0) return `모집 마감까지 ${days}일 남았습니다`
  if (days === 0) return '오늘 모집이 마감됩니다'
  return `모집이 ${-days}일 전에 마감되었습니다`
}

/**
 * 정원. **'제한 없음'과 '아직 안 정했다'는 다른 사실이다** — 표가 그 둘을
 * `capacityType`으로 갈라 두었으므로 말도 갈린다.
 */
function capacityNote(row: EventFacts): string {
  if (row.capacityType === 'unlimited') return '정원 제한 없음'
  if (row.capacityType === 'limited' && row.capacityCount !== null) {
    return `정원 ${row.capacityCount}명`
  }
  return '정원 미정'
}

export interface OverviewBriefing {
  headline: string
  stateNote: string
}

/**
 * 개요 맨 위의 안내(EVT-02).
 *
 * **참인 문장만 잇는다.** 설문이 없으면 마감도 신청자도 말하지 않고, 확인할 것이
 * 없으면 그 문장이 아예 오지 않는다 — '확인 필요 0명'을 말하면 사람이 급한 것으로 읽는다.
 */
export async function overviewBriefing(
  db: Db,
  orgId: string,
  eventId: string,
  time: { now: () => Date },
): Promise<OverviewBriefing> {
  const row = await must(db, orgId, eventId)
  const survey = await currentSurvey(db, orgId, eventId)
  const applicants = await applicantsOf(db, orgId, survey)
  const now = time.now()

  const said: string[] = []
  if (survey === null) {
    said.push('참여 설문을 아직 만들지 않았습니다.')
  } else {
    if (survey.closesAt !== null) said.push(`${deadlineNote(survey.closesAt, now)}.`)
    const capacity = capacityNote(row)
    said.push(
      capacity === '정원 미정' || capacity === '정원 제한 없음'
        ? `${applicants.total}명이 신청했습니다.`
        : `${capacity} 중 ${applicants.total}명이 신청했습니다.`,
    )
  }
  if (applicants.needsCheck > 0) {
    said.push(`명단 확인이 필요한 신청자가 ${applicants.needsCheck}명 있습니다.`)
  }
  const missing = missingParts(row)
  if (missing.length > 0) said.push(`아직 정하지 않은 것이 있습니다: ${missing.join(' · ')}.`)

  const next = NEXT_STEP[row.status as Status]
  return {
    headline: said.join(' '),
    // 단계의 말은 행사 목록과 같은 곳에서 온다.
    stateNote:
      next === null
        ? `현재 상태: ${STATUS[row.status as Status].label} · 다음 운영 단계가 없습니다.`
        : `현재 상태: ${STATUS[row.status as Status].label} · 다음 운영 단계는 ${next}입니다.`,
  }
}

/** 확인이 왜 필요한지. **명세가 이 말을 적어 두었다**(event.checklist의 detail). */
const NEEDS_CHECK_REASON = '학번·이름 불일치 또는 명단 외 학생'

export interface OverviewHighlights {
  unassignedTasks: string
  unassignedTasksDetail: string
  needsCheck: string
  needsCheckDetail: string
  nextMilestone: string
  nextMilestoneDetail: string
}

/** 담당자가 아직 없는 업무. 끝난 업무는 여기 들지 않는다. */
function unassigned(rows: OpenTask[]): OpenTask[] {
  return rows.filter((row) => row.assignee === null)
}

interface Milestone {
  at: Date
  title: string
  owner: string | null
}

/**
 * 다음 핵심 일정.
 *
 * **일정 화면(EVT-SCHED-01)과 같은 세 원본에서 고른다** — 업무 마감·회의 일시·
 * 행사 당일. 강조 카드를 누르면 그 화면으로 가므로, 여기서 말한 것이 거기 없으면
 * 사람이 눌러 보고서야 안다.
 *
 * **끝난 업무의 기한은 다음 일정이 아니다.** 이미 한 일을 앞으로 올 것으로 세면
 * 사람이 그것을 다시 한다.
 */
async function nextMilestone(
  db: Db,
  orgId: string,
  row: EventFacts,
  openTasks: OpenTask[],
  now: Date,
): Promise<Milestone | null> {
  const meetings = await meetingMomentsOf(db, orgId, row.id)
  const candidates: Milestone[] = [
    ...openTasks
      .filter((task) => task.dueDate !== null)
      .map((task) => ({ at: task.dueDate!, title: task.title, owner: task.assignee })),
    ...meetings
      .filter((meeting) => meeting.scheduledAt !== null)
      .map((meeting) => ({ at: meeting.scheduledAt!, title: meeting.title, owner: meeting.owner })),
    ...(row.startAt === null
      ? []
      : [{ at: row.startAt, title: row.title, owner: row.hostMember }]),
  ]
  // 앞으로 올 것만. 날짜로 센다 — '지났다'는 스물네 시간이 아니라 하루 뒤의 날짜다.
  const ahead = candidates
    .filter((one) => daysBetween(now, one.at) >= 0)
    .sort((left, right) => left.at.getTime() - right.at.getTime())
  return ahead[0] ?? null
}

export async function overviewHighlights(
  db: Db,
  orgId: string,
  eventId: string,
  time: { now: () => Date },
): Promise<OverviewHighlights> {
  const row = await must(db, orgId, eventId)
  const openTasks = await openTasksOf(db, orgId, eventId)
  const survey = await currentSurvey(db, orgId, eventId)
  const applicants = await applicantsOf(db, orgId, survey)
  const waiting = unassigned(openTasks)
  const milestone = await nextMilestone(db, orgId, row, openTasks, time.now())

  return {
    unassignedTasks: `${waiting.length}건`,
    unassignedTasksDetail:
      waiting.length === 0
        ? '담당자 없는 업무가 없습니다'
        : waiting.map((task) => task.title).join(' · '),
    needsCheck: `${applicants.needsCheck}명`,
    needsCheckDetail:
      applicants.needsCheck === 0 ? '확인이 필요한 신청자가 없습니다' : NEEDS_CHECK_REASON,
    nextMilestone: milestone === null ? '다음 일정이 아직 없습니다' : milestone.title,
    nextMilestoneDetail:
      milestone === null
        ? '앞으로 잡힌 일정이 없습니다'
        : `${shortStamp(milestone.at).split(' ')[0]} · ${milestone.owner ?? UNASSIGNED}`,
  }
}

export interface ParticipantStats {
  applicants: string
  applicantsNote: string
  paid: string
  paidNote: string
  needsCheck: string
  needsCheckNote: string
  unassignedTasks: string
  unassignedTasksNote: string
}

export async function participantStats(
  db: Db,
  orgId: string,
  eventId: string,
): Promise<ParticipantStats> {
  const row = await must(db, orgId, eventId)
  const survey = await currentSurvey(db, orgId, eventId)
  const applicants = await applicantsOf(db, orgId, survey)
  const waiting = unassigned(await openTasksOf(db, orgId, eventId))

  return {
    applicants: `${applicants.total}명`,
    applicantsNote: capacityNote(row),
    paid: `${applicants.paid}명`,
    // **미납과 미확인은 다른 사실이다.** 표가 셋을 갈라 두었으므로 하나로 합치지 않는다.
    paidNote:
      applicants.unknown === 0
        ? `미납 ${applicants.unpaid}명`
        : `미납 ${applicants.unpaid}명 · 미확인 ${applicants.unknown}명`,
    needsCheck: `${applicants.needsCheck}명`,
    needsCheckNote: applicants.needsCheck === 0 ? '확인할 것이 없습니다' : '명단 불일치',
    // 세는 말이 강조 카드('건')와 다르다 — 그림이 이 자리를 '개'로 그렸다.
    unassignedTasks: `${waiting.length}개`,
    unassignedTasksNote: waiting.length === 0 ? '배정할 것이 없습니다' : '처리 필요',
  }
}

export interface RecruitSettings {
  surveyStatus: string
  period: string
  method: string
  applicantCount: string
}

/**
 * 신청 기간.
 *
 * **정해지지 않은 것은 그 사실이 말로 온다.** 빈 글을 주면 화면이 그 자리에
 * 무엇이든 그리고, '마감일을 안 적었다'와 '설문이 아예 없다'가 같아진다.
 */
function periodNote(survey: SurveyFacts | null): string {
  if (survey === null) return '기간 미입력'
  if (survey.opensAt !== null && survey.closesAt !== null) {
    return `${day(survey.opensAt)} ~ ${day(survey.closesAt)}`
  }
  if (survey.closesAt !== null) return `마감 ${day(survey.closesAt)}`
  if (survey.opensAt !== null) return `${day(survey.opensAt)} 시작`
  return '마감일 미입력'
}

/**
 * 설문의 상태. **행사의 단계와 다른 축이다** — 명세가 그렇게 못 박았다.
 *
 * 아직 안 만든 것은 '초안'이 아니다. 셋을 넷으로 두는 까닭이 그것이다.
 */
function surveyStatusOf(survey: SurveyFacts | null): string {
  if (survey === null) return '아직 없음'
  if (survey.replacedById !== null) return '교체됨'
  return survey.active ? '활성' : '초안'
}

export async function recruitSettings(
  db: Db,
  orgId: string,
  eventId: string,
): Promise<RecruitSettings> {
  await must(db, orgId, eventId)
  const survey = await currentSurvey(db, orgId, eventId)
  const applicants = await applicantsOf(db, orgId, survey)

  return {
    surveyStatus: surveyStatusOf(survey),
    period: periodNote(survey),
    method: survey === null ? '미정' : (APPLY_METHOD.get(survey.applyMethod) ?? survey.applyMethod),
    applicantCount: `${applicants.total}명`,
  }
}

export interface ChecklistRow {
  title: string
  detail: string
  tone: string
  targetKind?: string
  actionLabel?: string
}

/**
 * 항목을 그리는 차례. **급한 것이 위로 온다.**
 *
 * 명세가 차례를 정하지 않았고 개수도 데이터가 정한다 — 그래서 고정된 자리가 아니라
 * 색이 차례를 만든다. 색은 화면의 아이콘 표가 아는 넷뿐이다(EVT-02의 checklistByTone).
 */
const TONE_ORDER = ['red', 'orange', 'yellow', 'green']

/**
 * 지금 확인해야 할 항목(EVT-02).
 *
 * **참인 것만 온다.** '담당자 없는 업무 0개'를 주면 화면이 할 일 없는 줄을 그리고,
 * 사람은 그 줄을 눌러 빈 목록을 본다.
 *
 * **계약이 이 자리에 404를 두지 않았다.** 남의 학생회 행사를 물으면 거르고 남은
 * 것이 없다고 답한다 — 없는 값을 지어내는 것이 아니라, 우리 것 중에 그런 것이
 * 없다는 사실이다(행사에 걸린 회의가 이미 같은 길이다).
 */
export async function checklist(
  db: Db,
  orgId: string,
  eventId: string,
  time: { now: () => Date },
): Promise<ChecklistRow[]> {
  const row = await eventFacts(db, orgId, eventId)
  if (row === null) return []

  const now = time.now()
  const openTasks = await openTasksOf(db, orgId, eventId)
  const waiting = unassigned(openTasks)
  const survey = await currentSurvey(db, orgId, eventId)
  const applicants = await applicantsOf(db, orgId, survey)
  const qr = await attendanceQrOf(db, orgId, eventId)

  const rows: ChecklistRow[] = []
  if (waiting.length > 0) {
    rows.push({
      title: `담당자 없는 업무 ${waiting.length}개`,
      detail: waiting.map((task) => task.title).join(' · '),
      tone: 'red',
      // **화면 이름이 아니라 갈래다.** 데이터가 화면 이름을 주면 없는 화면을
      // 가리켜도 아무도 모른다 — 갈 곳은 명세가 이 열쇠로 정한다.
      targetKind: 'tasks',
      actionLabel: '업무 보기',
    })
  }
  // 이미 지난 마감은 확인할 것이 아니다.
  if (survey?.closesAt != null && daysBetween(now, survey.closesAt) >= 0) {
    rows.push({
      title: deadlineNote(survey.closesAt, now),
      detail: `${day(survey.closesAt)} 마감`,
      tone: 'orange',
    })
  }
  if (applicants.needsCheck > 0) {
    rows.push({
      title: `명단 확인이 필요한 신청자 ${applicants.needsCheck}명`,
      detail: NEEDS_CHECK_REASON,
      tone: 'yellow',
      targetKind: 'participants',
      actionLabel: '참가자 명단 보기',
    })
  }
  if (qr !== null && qr.active) {
    rows.push({
      title: 'QR 참석 확인 설정 완료',
      detail: qr.opensAt === null ? '시작 시간 미정' : `${stamp(qr.opensAt)} 시작`,
      tone: 'green',
    })
  }
  return rows.sort((left, right) => TONE_ORDER.indexOf(left.tone) - TONE_ORDER.indexOf(right.tone))
}

export interface RecentChange {
  at: string
  title: string
}

/**
 * 최근 몇 줄까지 보이는가.
 *
 * **명세가 수를 정하지 않았다.** 그림이 넷을 그렸고 '최근'이라는 말이 자르라는
 * 뜻이므로 다섯으로 둔다 — 자르지 않으면 오래된 행사에서 이 카드가 화면을 덮는다.
 */
const RECENT = 5

/** `오늘 10:30` · `어제 16:20` · `07. 14`. **오늘이 언제인지는 서버만 안다.** */
function whenNote(at: Date, now: Date): string {
  const days = daysBetween(at, now)
  if (days <= 0) return `오늘 ${clock(at)}`
  if (days === 1) return `어제 ${clock(at)}`
  return day(at).slice(6)
}

/**
 * 최근 변경 사항(EVT-02 · EVT-02D).
 *
 * **표는 무엇이 바뀌었는지를 모른다.** 담고 있는 것은 어느 줄이 언제 만들어졌고
 * 언제 손대졌는가뿐이라, 여기서 만드는 말도 거기까지다 — '행사 장소 ERICA
 * 체육관으로 확정'처럼 무엇이 무엇으로 바뀌었는지 말하려면 옛 값을 담는 표가
 * 있어야 하고, 그런 표는 명세에 없다(`permission_changes`가 권한에만 그것을 둔다).
 *
 * 지어내지 않고 아는 것만 말한다: **무엇이 손대졌는지, 더해진 것인지 고쳐진 것인지.**
 * 그 표가 생기는 날 고칠 자리는 여기와 `counts.ts`의 `touchedOf` 둘이다.
 *
 * 신청은 **하루치를 묶는다** — 한 사람씩 줄이 되면 모집 중인 행사에서 이 카드가
 * 신청자 명단이 되고, 다른 변경이 전부 밀려난다.
 */
export async function recentChanges(
  db: Db,
  orgId: string,
  eventId: string,
  time: { now: () => Date },
): Promise<RecentChange[]> {
  const row = await eventFacts(db, orgId, eventId)
  if (row === null) return []

  const survey = await currentSurvey(db, orgId, eventId)
  const moments: Array<{ at: Date; title: string }> = [
    {
      at: row.updatedAt,
      title:
        row.updatedAt.getTime() === row.createdAt.getTime()
          ? '행사를 만들었습니다'
          : '행사 기본정보 수정',
    },
    ...(await touchedOf(db, orgId, eventId)).map((one) => ({ at: one.at, title: one.title })),
    ...applicationDays(await applicationMomentsOf(db, survey)),
  ]

  const now = time.now()
  return moments
    .sort((left, right) => right.at.getTime() - left.at.getTime())
    .slice(0, RECENT)
    .map((one) => ({ at: whenNote(one.at, now), title: one.title }))
}

/** 하루에 들어온 신청을 한 줄로. 그 줄의 때는 그날 마지막 신청이다. */
function applicationDays(moments: Date[]): Array<{ at: Date; title: string }> {
  const byDay = new Map<string, { at: Date; count: number }>()
  for (const at of moments) {
    const key = day(at)
    const already = byDay.get(key)
    if (already === undefined) byDay.set(key, { at, count: 1 })
    else byDay.set(key, { at: at > already.at ? at : already.at, count: already.count + 1 })
  }
  return [...byDay.values()].map((one) => ({
    at: one.at,
    title: `신규 신청자 ${one.count}명 추가`,
  }))
}
