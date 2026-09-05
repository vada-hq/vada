import { and, eq, inArray, isNull, ne, sql } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import {
  departments,
  events,
  members,
  paymentDocuments,
  students,
  surveyApplications,
  surveys,
  tasks,
} from '../db/schema.ts'
import { inThisWeek, labelOf, orgSchedules, shortDay } from '../ops/calendar.ts'
import { NotFound } from '../routes.ts'
import { daysBetween, moment } from '../time.ts'

// 홈(HOME-01K).
//
// **홈은 어느 영역도 아니다.** 행사도 회의도 업무도 아닌 그 전부의 요약이라 자리마다
// 다른 표를 센다 — 운영 허브(`ops/space.ts`)와 같은 성질이고, 그래서 어느 영역에도
// 넣지 않았다.
//
// **다가오는 일정은 캘린더와 같은 흐름이다.** 딱지가 마감·회의·행사이고 곁의 단추가
// '캘린더 보기'라 OPS-CAL-01로 간다 — 두 벌을 만들면 같은 날의 같은 일정이 두 화면에서
// 갈린다. 그래서 흐름은 `ops/calendar.ts`가 만들고 여기서는 홈의 꼴로 옮기기만 한다.
//
// **재정 요약은 여기 없다**(`home.financeSummary`). 예산을 정하는 화면이 명세에 없어
// 붙여도 0원 위에 선다 — 백로그의 '결정 대기'이고, 그 자리만 화면에서 따로 가려진다.

/** 이 학생회에서 보는 사람의 이름. 인사에 들어가므로 서버가 완성해서 준다. */
async function nameOf(db: Db, orgId: string, memberId: string): Promise<string> {
  const rows = await db
    .select({ name: members.name })
    .from(members)
    .where(and(eq(members.orgId, orgId), eq(members.id, memberId)))
    .limit(1)
  const row = rows[0]
  if (row === undefined) throw new NotFound('이 학생회의 구성원이 아닙니다')
  return row.name
}

export interface BriefingNotice {
  message: string
}

/**
 * 브리핑이 짚어 주는 문장들(`home.briefingNotices`).
 *
 * **짚을 것이 없으면 빈 목록이다**(명세가 그렇게 적었다). 그래서 0건인 줄은 아예
 * 오지 않는다 — '지연된 업무가 0건 있습니다'는 짚는 말이 아니다.
 *
 * 무엇을 짚는가는 **이 저장소가 이미 든 두 사실**이다.
 *
 * 1. **지연** — 기한이 지났고 아직 안 끝난 업무(`tasks/labels.ts`의 `isOverdue`).
 *    브리핑 곁의 단추가 '지연 업무 보기'라 같은 것을 가리킨다.
 * 2. **담당자 없음** — 배정해야 하는 업무. 업무 보드가 이것을 맨 위로 올린다
 *    (`tasks/board.ts`의 차례: '먼저 봐야 하는 것(담당자 없음)이 위로').
 *    **끝난 업무는 세지 않는다** — 이미 한 일에 사람을 붙일 까닭이 없다.
 *
 * **학생회 전체를 센다.** 홈은 내 업무가 아니라 학생회의 요약이고, 내 것은 옆의
 * '내 담당 업무'가 따로 든다(MY-01).
 */
export async function homeBriefingNotices(
  db: Db,
  orgId: string,
  now: Date,
): Promise<BriefingNotice[]> {
  // **지났는지는 시간대가 정한다.** 저장소에 물으면 시간대 이름이 여기 또 적힌다 —
  // 날 수를 세는 일은 `time.ts` 하나가 든다(운영 허브가 같은 자리에서 같은 것을 했다).
  const rows = await db
    .select({ dueDate: tasks.dueDate, assigneeMemberId: tasks.assigneeMemberId })
    .from(tasks)
    .where(and(eq(tasks.orgId, orgId), ne(tasks.status, 'done')))

  const delayed = rows.filter(
    (row) => row.dueDate !== null && daysBetween(row.dueDate, now) > 0,
  ).length
  const unassigned = rows.filter((row) => row.assigneeMemberId === null).length

  const notices: BriefingNotice[] = []
  if (delayed > 0) notices.push({ message: `지연된 업무가 ${delayed}건 있습니다.` })
  if (unassigned > 0) notices.push({ message: `담당자가 없는 업무가 ${unassigned}건 있습니다.` })
  return notices
}

export interface Briefing {
  title: string
}

/**
 * 브리핑의 인사 제목(`home.briefing`).
 *
 * **사람 이름이 들어가므로 서버가 완성해서 준다**(명세가 그렇게 적었다).
 *
 * 명세는 인사를 하나만 예로 들었다('박해랑님, 확인이 필요해요'). 그런데 짚을 것이
 * 없는 상태를 명세가 이미 인정하고 있으므로(`home.briefingNotices`가 빈 목록일 수
 * 있다) 그때도 '확인이 필요해요'라고 말하면 **화면이 없는 일을 알린다.** 그래서
 * 짚을 것이 있을 때만 그 말을 하고, 없으면 없다고 말한다.
 */
export async function homeBriefing(
  db: Db,
  orgId: string,
  memberId: string,
  now: Date,
): Promise<Briefing> {
  const [name, notices] = await Promise.all([
    nameOf(db, orgId, memberId),
    homeBriefingNotices(db, orgId, now),
  ])
  return {
    title:
      notices.length === 0 ? `${name}님, 지금은 확인할 내용이 없어요` : `${name}님, 확인이 필요해요`,
  }
}

export interface EventCounts {
  activeEvents: number
  upcomingEvents: number
  weeklySchedules: number
}

/**
 * 홈 머리의 건수(`home.eventCounts`).
 *
 * **'예정 행사'는 기획 중인 행사다.** 일시가 잡혔는가로 가르지 않는다 — 곁의 목록이
 * '진행 중이거나 예정된 행사'인데 거기에 일시가 '미정'인 행사가 든다(명세가 그
 * 조각에 '정해지지 않았으면 미정'이라 적었다). 단계로 가르는 것이 운영 허브의
 * 두 수와도 같은 규칙이다(`ops.spaceStats`의 eventInProgress·eventPlanning).
 *
 * **'이번 주 주요 일정'은 캘린더의 흐름이다** — 행사·회의·마감 셋을 함께 센다.
 */
export async function homeEventCounts(db: Db, orgId: string, now: Date): Promise<EventCounts> {
  const rows = await db
    .select({ status: events.status })
    .from(events)
    .where(eq(events.orgId, orgId))
  const schedules = await orgSchedules(db, orgId, null)
  return {
    activeEvents: rows.filter((row) => row.status === 'inProgress').length,
    upcomingEvents: rows.filter((row) => row.status === 'planning').length,
    weeklySchedules: schedules.filter((one) => inThisWeek(one.at, now)).length,
  }
}

/**
 * 행사 단계를 사람이 읽는 말로.
 *
 * **`events/events.ts`가 같은 표를 들고 있다.** 그쪽 것이 내보내지지 않아 여기 둘을
 * 다시 적었다 — 이 회차가 그 영역의 파일을 건드리지 않기 때문이다. 두 벌이 갈릴 수
 * 있는 자리이므로, 행사 영역을 다음에 손볼 때 한 곳으로 모으는 것이 옳다.
 */
const EVENT_STATUS: Record<string, string> = {
  planning: '기획 중',
  inProgress: '진행 중',
}

/** 정해지지 않은 것은 **그 사실을 말로** 준다(명세가 이 출처에 '미정'이라 적었다). */
const UNDECIDED = '미정'

function orNote(value: string | null): string {
  return value === null || value.trim() === '' ? UNDECIDED : value
}

export interface HomeEvent {
  status: string
  title: string
  date: string
  place: string
  team: string
  progressPercent: number
  delayedTaskCount?: number
}

/**
 * 진행 중이거나 예정된 행사(`home.events`).
 *
 * **준비율과 지연은 그 행사의 업무에서 나온다.** 화면이 그 둘을 한 줄기에 나란히
 * 그리고(`준비 62% · 지연 업무 1건`) 행사 업무 보드가 같은 표를 본다 — 준비가
 * 얼마나 됐는가는 그 행사에 걸린 업무 중 몇이 끝났는가다.
 *
 * **업무가 하나도 없으면 0%다.** 명세가 이 조각을 수 하나로 적어 두어 '셀 것이
 * 없다'고 말할 자리가 없다 — 행사 카드(`event.summary`)에는 그 말을 담는 조각이
 * 따로 있고 여기에는 없다.
 *
 * 차례는 이른 행사가 먼저, 일시가 없으면 뒤다(행사 목록이 그린 그 차례다).
 */
export async function homeEvents(db: Db, orgId: string, now: Date): Promise<HomeEvent[]> {
  const rows = await db
    .select({
      id: events.id,
      title: events.title,
      status: events.status,
      startAt: events.startAt,
      place: events.place,
      departmentName: departments.name,
    })
    .from(events)
    // **이어 붙인 표도 자기 조직을 확인한다.** 부서만 id로 이으면 남의 조직의 이름이
    // 우리 카드에 그려진다(행사 목록이 같은 구멍을 겪었다).
    .leftJoin(
      departments,
      and(eq(events.hostDepartmentId, departments.id), eq(departments.orgId, orgId)),
    )
    .where(and(eq(events.orgId, orgId), inArray(events.status, ['planning', 'inProgress'])))

  const ordered = rows.sort((left, right) => orderOf(left).localeCompare(orderOf(right)))
  const ids = ordered.map((row) => row.id)
  const workload = await eventWorkload(db, orgId, ids, now)

  return ordered.map((row) => {
    const work = workload.get(row.id) ?? { total: 0, done: 0, delayed: 0 }
    return {
      status: EVENT_STATUS[row.status] ?? row.status,
      title: row.title,
      date: row.startAt === null ? UNDECIDED : moment(row.startAt).slice(0, 10),
      place: orNote(row.place),
      team: orNote(row.departmentName),
      progressPercent: work.total === 0 ? 0 : Math.round((work.done / work.total) * 100),
      // **없으면 오지 않는다**(명세가 optional로 적었다).
      ...(work.delayed === 0 ? {} : { delayedTaskCount: work.delayed }),
    }
  })
}

function orderOf(row: { startAt: Date | null; title: string }): string {
  return `${row.startAt === null ? '9' : '0'}${row.startAt?.toISOString() ?? ''}${row.title}`
}

interface Workload {
  total: number
  done: number
  delayed: number
}

/** 행사마다의 업무 셈. **한 번에 걷는다** — 행사마다 조회하면 목록이 길어질수록 는다. */
async function eventWorkload(
  db: Db,
  orgId: string,
  eventIds: readonly string[],
  now: Date,
): Promise<Map<string, Workload>> {
  const found = new Map<string, Workload>()
  if (eventIds.length === 0) return found
  const rows = await db
    .select({ eventId: tasks.eventId, status: tasks.status, dueDate: tasks.dueDate })
    .from(tasks)
    .where(and(eq(tasks.orgId, orgId), inArray(tasks.eventId, [...eventIds])))
  for (const row of rows) {
    const key = row.eventId!
    const already = found.get(key) ?? { total: 0, done: 0, delayed: 0 }
    already.total += 1
    if (row.status === 'done') already.done += 1
    // 끝난 업무는 기한이 지나도 지연이 아니다 — 이미 한 일을 다시 재촉하지 않는다.
    else if (row.dueDate !== null && daysBetween(row.dueDate, now) > 0) already.delayed += 1
    found.set(key, already)
  }
  return found
}

export interface HomeSchedule {
  date: string
  title: string
  badge: string
}

/**
 * 다가오는 주요 일정(`home.schedules`).
 *
 * **캘린더와 같은 흐름을 오늘부터 잘라 온다.** 딱지(`badge`)는 그 일정의 유형이고,
 * 유형의 이름은 명세가 든다(`ops.calendarTypes`의 행사·회의·마감).
 *
 * **몇 개까지인지 명세가 말하지 않아 자르지 않는다.** 자르면 그 수가 서버가 지어낸
 * 값이 되고, 그 다음 화면은 '더 보기'가 없어 나머지를 영영 못 본다.
 */
export async function homeSchedules(db: Db, orgId: string, now: Date): Promise<HomeSchedule[]> {
  const schedules = await orgSchedules(db, orgId, null)
  return schedules
    // 오늘 걸린 것은 아직 다가오는 것이다 — 지난 것만 뺀다.
    .filter((one) => daysBetween(now, one.at) >= 0)
    .map((one) => ({ date: shortDay(one.at), title: one.title, badge: labelOf(one.type) }))
}

export interface OrgAlert {
  kind: string
  label: string
  count: number
}

/**
 * 조직 운영에서 확인이 필요한 항목(`home.orgAlerts`).
 *
 * **종류가 상황에 따라 달라진다**(명세가 그렇게 적었다). 그래서 0건인 종류는 아예
 * 오지 않는다 — '확인이 필요한 항목'에 0이 오면 그것은 확인할 것이 있다는 말이 된다.
 *
 * 화면이 아는 종류가 둘이고(문서형·인원형 아이콘) 각각이 가리키는 사실이 이 저장소에
 * 이미 있다.
 *
 * - **증빙 서류 누락**(`document`) — 붙어야 하는데 안 붙은 결제 증빙이다. 표가 그
 *   자리를 미리 만들어 두고 붙으면 `registeredAt`이 찍힌다(`db/schema.ts`), 그리고
 *   증빙 정리 화면이 그 상태를 이미 '누락'이라 부른다(`finance/evidence.ts`).
 *   **예산과 무관하다** — 그래서 재정 요약이 미뤄져 있어도 이것은 셀 수 있다.
 * - **참가자 명단 확인 필요**(`members`) — 학생 명단에서 찾지 못한 신청자다. 무엇이
 *   확인 대상인지는 명세가 다른 자리에서 말해 두었다: '학번·이름 불일치 또는 명단 외
 *   학생'(`event.checklist`의 detail). 그 규칙을 학생회 전체로 넓힌 것이 이 수다.
 */
export async function homeOrgAlerts(db: Db, orgId: string): Promise<OrgAlert[]> {
  const [missingProof, unmatchedApplicants] = await Promise.all([
    missingProofCount(db, orgId),
    unmatchedApplicantCount(db, orgId),
  ])

  const alerts: OrgAlert[] = []
  if (missingProof > 0) {
    alerts.push({ kind: 'document', label: '증빙 서류 누락', count: missingProof })
  }
  if (unmatchedApplicants > 0) {
    alerts.push({ kind: 'members', label: '참가자 명단 확인 필요', count: unmatchedApplicants })
  }
  return alerts
}

async function missingProofCount(db: Db, orgId: string): Promise<number> {
  const rows = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(paymentDocuments)
    .where(and(eq(paymentDocuments.orgId, orgId), isNull(paymentDocuments.registeredAt)))
  return Number(rows[0]?.total ?? 0)
}

/**
 * 학생 명단에서 찾지 못한 신청자.
 *
 * **학번과 이름이 함께 맞아야 찾은 것이다.** 학번만 보면 남의 학번으로 낸 신청이
 * 조용히 통과하고, 이름만 보면 동명이인이 통과한다.
 */
async function unmatchedApplicantCount(db: Db, orgId: string): Promise<number> {
  const rows = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(surveyApplications)
    .innerJoin(
      surveys,
      and(eq(surveyApplications.surveyId, surveys.id), eq(surveys.orgId, orgId)),
    )
    .leftJoin(
      students,
      and(
        eq(students.orgId, orgId),
        eq(students.studentNumber, surveyApplications.studentNumber),
        eq(students.name, surveyApplications.name),
      ),
    )
    .where(isNull(students.id))
  return Number(rows[0]?.total ?? 0)
}
