import type { Db } from '../db/client.ts'
import { UNASSIGNED } from '../tasks/labels.ts'
import { daysBetween, shortStamp } from '../time.ts'
import {
  applicantsOf,
  currentSurvey,
  meetingMomentsOf,
  openTasksOf,
  type EventFacts,
  type OpenTask,
} from './counts.ts'
import { STATUS, type Status } from './events.ts'
import {
  capacityNote,
  must,
  NEEDS_CHECK_REASON,
  unassigned,
} from './overview-shared.ts'

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

/** 아직 안 정한 것들. 개요 맨 위가 그 사실을 말한다. */
function missingParts(row: EventFacts): string[] {
  const missing: string[] = []
  if (row.startAt === null) missing.push('일시')
  if (row.place === null || row.place.trim() === '') missing.push('장소')
  if (row.hostDepartment === null && row.hostMember === null) missing.push('담당')
  return missing
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

export interface OverviewHighlights {
  unassignedTasks: string
  unassignedTasksDetail: string
  needsCheck: string
  needsCheckDetail: string
  nextMilestone: string
  nextMilestoneDetail: string
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
