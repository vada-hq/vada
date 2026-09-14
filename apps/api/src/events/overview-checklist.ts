import type { Db } from '../db/client.ts'
import { day, daysBetween, stamp } from '../time.ts'
import {
  applicantsOf,
  attendanceQrOf,
  currentSurvey,
  eventFacts,
  openTasksOf,
} from './counts.ts'
import {
  deadlineNote,
  NEEDS_CHECK_REASON,
  unassigned,
} from './overview-shared.ts'

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
