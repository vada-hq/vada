import { and, asc, desc, eq } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import {
  attendanceCheckIns,
  attendanceQrs,
  events,
  surveyApplications,
  surveys,
} from '../db/schema.ts'
import { NotFound } from '../routes.ts'

// 행사 참가자 명단(EVT-04 · EVT-04B).
//
// **참가자는 학생회 구성원이 아니다.** 명세가 그렇게 못 박았다 — 조직 명단
// (`org.members`)과 다른 물건이고, 여기 오는 사람은 링크로 신청을 낸 사람이다.
// 그래서 `members`를 잇지 않는다.
//
// 사실은 두 표에서 온다. 낸 신청(`survey_applications`)이 줄을 만들고, 찍힌 참석
// (`attendance_check_ins`)이 그 줄의 셋째 딱지를 정한다. 둘을 잇는 것은 학번이다 —
// QR로 오는 사람은 로그인이 없어 그것 말고 이을 것이 없다.
//
// **거르는 일과 세는 일이 한 함수에서 나온다.** 목록은 한 쪽만큼만 가고 수는 전부를
// 세는데, 두 곳에서 거르면 언젠가 조건이 갈리고 '총 6명'인데 여섯 줄이 아닌 화면이
// 나온다. 그래서 `matching()`이 하나이고 두 자리가 그것을 나눠 쓴다.

/**
 * 한 쪽에 몇 줄인가. **서버가 정한다** — 명세가 이 수를 들지 않는다.
 *
 * 화면은 받아온 것을 자르지 않으므로 이 수가 곧 한 화면이다.
 */
const PAGE_SIZE = 20

/** 신청이 받아들여졌는가(EVT-04의 첫 딱지). 표의 갈래를 사람의 말로 옮긴다. */
const APPLY: Record<string, { label: string; tone: string }> = {
  applied: { label: '신청 완료', tone: 'blue' },
  waitlisted: { label: '대기 중', tone: 'gray' },
}

/** 참가비가 들어왔는가(둘째 딱지). **'모름'이 기본이다** — 안 낸 것과 다른 사실이다. */
const PAY: Record<string, { label: string; tone: string }> = {
  paid: { label: '납부 확인', tone: 'green' },
  unpaid: { label: '미납', tone: 'red' },
  unknown: { label: '미확인', tone: 'gray' },
}

/**
 * 당일에 왔는가(셋째 딱지).
 *
 * **'불참'은 여기서 나오지 않는다.** 그림은 셋을 그렸는데 표가 아는 것은 둘뿐이다 —
 * 찍힌 것은 사실이고, 안 찍힌 것은 '안 왔다'가 아니라 '아직 모른다'다. 행사가 끝났다는
 * 것만으로 불참이라 부르면 QR을 못 찍은 사람이 안 온 사람이 된다.
 */
const ATTENDED = { label: '참석', tone: 'green' }
const NOT_SEEN = { label: '미확인', tone: 'gray' }

/** 소속을 안 적은 사람. **빈 글로 대신하지 않는다**(조직도가 쓰는 규칙과 같다). */
const NO_AFFILIATION = '소속 미등록'

export interface Participant {
  id: string
  name: string
  studentNo: string
  affiliation: string
  applyStatus: string
  applyStatusTone: string
  payStatus: string
  payStatusTone: string
  attendStatus: string
  attendStatusTone: string
}

export interface ParticipantFilters {
  query?: string | undefined
  affiliation?: string | undefined
  applyStatus?: string | undefined
  payStatus?: string | undefined
  attendStatus?: string | undefined
  page?: string | undefined
}

/** 이 학생회의 그 행사인가. **남의 학생회 행사는 여기서도 없는 것이다.** */
async function eventOf(db: Db, orgId: string, eventId: string) {
  const rows = await db
    .select({ id: events.id, feeType: events.feeType })
    .from(events)
    .where(and(eq(events.orgId, orgId), eq(events.id, eventId)))
    .limit(1)
  const row = rows[0]
  if (row === undefined) throw new NotFound('그 행사를 찾지 못했습니다')
  return row
}

/**
 * 지금 이 행사의 설문. **없으면 `null`이다.**
 *
 * 교체하면 옛 설문이 남은 채 새 것이 생기므로 한 행사에 여러 줄이 있을 수 있고,
 * 지금의 것은 마지막에 만들어진 것이다(`events/survey.ts`가 쓰는 규칙과 같다).
 *
 * **여기서는 없는 것이 오류가 아니다.** 설문을 아직 안 만든 행사의 참가자 명단은
 * 비어 있는 것이 맞다 — 그림이 그 자리에 '아직 참가 신청자가 없습니다'를 그렸다.
 */
async function currentSurveyId(db: Db, orgId: string, eventId: string): Promise<string | null> {
  const rows = await db
    .select({ id: surveys.id })
    .from(surveys)
    .where(and(eq(surveys.orgId, orgId), eq(surveys.eventId, eventId)))
    .orderBy(desc(surveys.createdAt), desc(surveys.id))
    .limit(1)
  return rows[0]?.id ?? null
}

/** 이 행사의 QR을 찍고 간 학번들. QR이 여럿이면(다시 만들었으면) 전부 본다. */
async function checkedIn(db: Db, orgId: string, eventId: string): Promise<Set<string>> {
  const rows = await db
    .select({ studentNumber: attendanceCheckIns.studentNumber })
    .from(attendanceCheckIns)
    .innerJoin(attendanceQrs, eq(attendanceCheckIns.qrId, attendanceQrs.id))
    .where(and(eq(attendanceQrs.orgId, orgId), eq(attendanceQrs.eventId, eventId)))
  return new Set(rows.map((row) => row.studentNumber))
}

/**
 * 이 행사에 신청한 사람 전부. **딱지의 말과 색까지 여기서 만든다.**
 *
 * 낸 차례로 온다 — 그림이 이름순도 학번순도 아닌 차례로 그렸고, 명단에서 뜻을 갖는
 * 차례는 '누가 먼저 냈는가'뿐이다(선착순 행사에서는 그것이 곧 순위다).
 */
async function everyone(db: Db, orgId: string, eventId: string): Promise<Participant[]> {
  const surveyId = await currentSurveyId(db, orgId, eventId)
  if (surveyId === null) return []
  const [rows, attended] = await Promise.all([
    db
      .select({
        id: surveyApplications.id,
        name: surveyApplications.name,
        studentNumber: surveyApplications.studentNumber,
        department: surveyApplications.department,
        applyStatus: surveyApplications.applyStatus,
        payStatus: surveyApplications.payStatus,
      })
      .from(surveyApplications)
      .where(eq(surveyApplications.surveyId, surveyId))
      .orderBy(asc(surveyApplications.at), asc(surveyApplications.id)),
    checkedIn(db, orgId, eventId),
  ])
  return rows.map((row) => {
    const apply = APPLY[row.applyStatus]!
    const pay = PAY[row.payStatus]!
    const attend = attended.has(row.studentNumber) ? ATTENDED : NOT_SEEN
    return {
      id: row.id,
      name: row.name,
      studentNo: row.studentNumber,
      affiliation: row.department ?? NO_AFFILIATION,
      applyStatus: apply.label,
      applyStatusTone: apply.tone,
      payStatus: pay.label,
      payStatusTone: pay.tone,
      attendStatus: attend.label,
      attendStatusTone: attend.tone,
    }
  })
}

/**
 * 거른 뒤에 남는 사람.
 *
 * **거르개는 그려지는 말로 온다.** 고르는 목록의 값이 곧 그 말이기 때문이다 — 값과
 * 말을 갈라 두면 화면이 그 사이를 다시 알아야 하고, 상태가 늘 때 두 벌이 갈린다.
 */
function matching(rows: Participant[], filters: ParticipantFilters): Participant[] {
  const query = (filters.query ?? '').trim()
  return rows.filter((row) => {
    if (query !== '' && !row.name.includes(query) && !row.studentNo.includes(query)) return false
    if ((filters.affiliation ?? '') !== '' && row.affiliation !== filters.affiliation) return false
    if ((filters.applyStatus ?? '') !== '' && row.applyStatus !== filters.applyStatus) return false
    if ((filters.payStatus ?? '') !== '' && row.payStatus !== filters.payStatus) return false
    if ((filters.attendStatus ?? '') !== '' && row.attendStatus !== filters.attendStatus) {
      return false
    }
    return true
  })
}

/** 몇 쪽을 달라는 것인가. 안 넘기거나 읽을 수 없으면 첫 쪽이다. */
function pageOf(text: string | undefined): number {
  const number = Number(text)
  return Number.isFinite(number) && number >= 1 ? Math.floor(number) : 1
}

/** 행사 참가자 명단 한 쪽(EVT-04). */
export async function eventParticipants(
  db: Db,
  orgId: string,
  eventId: string,
  filters: ParticipantFilters,
): Promise<Participant[]> {
  await eventOf(db, orgId, eventId)
  const rows = matching(await everyone(db, orgId, eventId), filters)
  const from = (pageOf(filters.page) - 1) * PAGE_SIZE
  return rows.slice(from, from + PAGE_SIZE)
}

export interface ParticipantPaging {
  totalNote: string
  pageCount: number
}

/**
 * 명단이 몇 쪽이고 모두 몇 명인가.
 *
 * **화면이 수에 '명'을 붙이지 않는다** — 무엇을 세어 뭐라 부르는지는 서버가 안다.
 *
 * 빈 명단도 한 쪽이다. 쪽이 0개면 화면의 '다음'이 열린 채로 남고, 누르면 0쪽으로 간다.
 */
export async function participantPaging(
  db: Db,
  orgId: string,
  eventId: string,
  filters: ParticipantFilters,
): Promise<ParticipantPaging> {
  await eventOf(db, orgId, eventId)
  const total = matching(await everyone(db, orgId, eventId), filters).length
  return { totalNote: `총 ${total}명`, pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)) }
}

export interface FilterOption {
  value: string
  label: string
}

/** 고르는 값이 곧 사람이 읽는 말이다(개발용 응답이 쓰던 규칙과 같다). */
const asOption = (label: string): FilterOption => ({ value: label, label })

/**
 * 소속으로 거르는 선택지.
 *
 * **어느 학부·학과가 오는지는 그 행사에 신청한 사람이 정한다** — 명세가 목록을 들 수
 * 없다고 적었다. 표에 그려지는 말 그대로 모으므로 '소속 미등록'도 고를 수 있다.
 */
export async function participantAffiliations(
  db: Db,
  orgId: string,
  eventId: string,
): Promise<FilterOption[]> {
  await eventOf(db, orgId, eventId)
  const rows = await everyone(db, orgId, eventId)
  return [...new Set(rows.map((row) => row.affiliation))].sort().map(asOption)
}

/**
 * 신청 상태로 거르는 선택지. **표의 딱지에 그려지는 말과 같은 목록이다**(계약의 말).
 *
 * 지금 그 상태인 사람이 없어도 고를 수 있다 — 걸러서 0건이 나오는 것과 고를 수 없는
 * 것은 다른 일이고, 앞엣것은 사람이 답을 얻은 것이다.
 */
export async function participantApplyStatuses(
  db: Db,
  orgId: string,
  eventId: string,
): Promise<FilterOption[]> {
  await eventOf(db, orgId, eventId)
  return [APPLY.applied!.label, APPLY.waitlisted!.label].map(asOption)
}

/**
 * 입금 상태로 거르는 선택지.
 *
 * **참가비를 받지 않는 행사는 목록이 비어 온다**(계약이 그렇게 적었다). 무료라고
 * 정해 둔 행사가 그것이다 — 아직 안 정한 행사는 받을지도 모르므로 셋을 그대로 준다.
 */
export async function participantPayStatuses(
  db: Db,
  orgId: string,
  eventId: string,
): Promise<FilterOption[]> {
  const event = await eventOf(db, orgId, eventId)
  if (event.feeType === 'free') return []
  return [PAY.paid!.label, PAY.unpaid!.label, PAY.unknown!.label].map(asOption)
}

/**
 * 참석 상태로 거르는 선택지.
 *
 * **행사 전에는 미확인뿐이고 당일에 늘어난다**(계약이 그렇게 적었다). 그래서 앞의
 * 둘과 달리 표에 실제로 그려진 말만 모은다.
 */
export async function participantAttendStatuses(
  db: Db,
  orgId: string,
  eventId: string,
): Promise<FilterOption[]> {
  await eventOf(db, orgId, eventId)
  const drawn = new Set((await everyone(db, orgId, eventId)).map((row) => row.attendStatus))
  return [ATTENDED.label, NOT_SEEN.label].filter((label) => drawn.has(label)).map(asOption)
}
