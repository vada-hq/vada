import { and, asc, eq, sql } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import { meetingAgendas, meetings, tasks } from '../db/schema.ts'
import { NotFound } from '../routes.ts'
import { orNote, word } from './meetings.ts'

// 회의록(OPS-MEET-06A · 06B · 07이 읽는다). 쓰는 쪽은 `minutes-write.ts`다.
//
// **안건마다의 기록과 다른 물건이다.** 안건의 논의·결정은 `meeting.agendas`가 갖고
// 여기 있는 것은 회의 전체를 한 덩이로 줄인 글과, 그 정리가 어디까지 왔는가다.
//
// ## 왜 없다는 말을 서버가 주는가
//
// 전체 요약은 **없을 수 있다** — 06B가 빈 상태를 그렸고 '요약이 없어도 정리 완료가
// 막히지는 않습니다'라고 적어 두었다. 그런데 그 자리는 **칸이 미리 잡힌 곳**이라
// 화면이 값을 반드시 읽는다. 빈 글을 주면 화면이 빈 칸을 그리고, 사람은 요약이 없는
// 것인지 화면이 고장 난 것인지 가릴 수 없다. 그래서 없다는 사실을 말로 준다
// (회의 상세가 장소 없는 회의에 '미정'을 주는 것과 같은 규칙이다).

/**
 * 아직 확정되지 않은 요약에 붙는 딱지.
 *
 * **회의록이 정리 완료가 아닌 동안만 붙는다.** 06A가 정리 중인 회의록에 그렸고
 * 07(완료된 회의록)은 같은 자리에 딱지를 그리지 않았다 — 확정된 글에 '변경될 수
 * 있음'을 붙이면 그것이 거짓말이 된다.
 */
const UNSETTLED = { label: '정리 중 · 변경될 수 있음', tone: 'yellow' } as const

/**
 * AI 초안이 무엇을 하고 무엇을 하지 않는지.
 *
 * **화면에 적힌 이 글이 곧 계약이다**(06B). 명세가 이 문장을 들면 초안이 하는 일이
 * 바뀔 때 명세가 틀린다 — 그래서 서버가 든다.
 */
const AI_DISCLAIMER =
  'AI 초안은 안건별 논의·결정 기록만 재구성하며, 기록에 없는 결정·담당자·기한을 새로 만들지 않습니다.\n' +
  '요약이 없어도 정리 완료가 막히지는 않습니다.'

/** 요약이 아직 없을 때 그 자리에 그려지는 말. 06B가 그 문장을 그려 두었다. */
const NO_SUMMARY = '아직 작성된 전체 요약이 없습니다'

export interface MeetingMinutes {
  summaryText: string
  statusLabel: string
  statusTone: string
  aiDisclaimer: string
}

/** 그 학생회의 그 회의인가. **없는 것은 없다고 말한다.** */
async function minutesRow(db: Db, orgId: string, meetingId: string) {
  const rows = await db
    .select({
      status: meetings.status,
      minutesStatus: meetings.minutesStatus,
      minutesSummary: meetings.minutesSummary,
    })
    .from(meetings)
    .where(and(eq(meetings.orgId, orgId), eq(meetings.id, meetingId)))
    .limit(1)
  const row = rows[0]
  if (row === undefined) throw new NotFound('그 회의를 찾지 못했습니다')
  return row
}

/**
 * 회의록의 전체 요약(`meeting.minutes`).
 *
 * 넷 다 **칸이 잡힌 자리**라 빈 글로라도 온다 — 화면이 그 조각을 반드시 읽는다.
 */
export async function meetingMinutes(
  db: Db,
  orgId: string,
  meetingId: string,
): Promise<MeetingMinutes> {
  const row = await minutesRow(db, orgId, meetingId)
  // 회의의 단계가 아니라 **회의록의 단계**가 확정 여부를 정한다. 표가 두 축을
  // 갈라 두었고(schema.ts의 minutes_status), 여기서 합치면 그 가름이 사라진다.
  const settled = row.minutesStatus === 'done'
  return {
    summaryText: orNote(row.minutesSummary, NO_SUMMARY),
    statusLabel: settled ? '' : UNSETTLED.label,
    statusTone: settled ? '' : UNSETTLED.tone,
    aiDisclaimer: AI_DISCLAIMER,
  }
}

export interface MinutesPart {
  label: string
  stateNote: string
}

/**
 * 회의록의 각 부분이 지금 어디까지 왔는가(`meeting.minutesStatus`).
 *
 * **`meeting.minutesProgress`와 다른 사실이다.** 저것은 '정리를 마칠 수 있는가'를
 * 조건으로 세고(06B), 이것은 '지금 어디까지 왔는가'를 부분마다 말한다 — 06A는
 * '안건 내용 2 / 3 정리'를 그리고 06B는 '안건별 논의 내용 ✓'을 그린다.
 *
 * **세는 단위가 부분마다 다르다.** 안건은 몇 개 중 몇이고 결정과 후속 업무는 몇
 * 건이며 요약은 초안이 있는지다 — 화면이 그 규칙을 가질 수 없어 완성된 문구로 준다.
 *
 * **부분 목록도 서버가 든다.** 회의록이 몇 부분으로 이루어지는지는 조직의 양식이
 * 정하고, 명세가 그 목록을 들면 양식이 바뀔 때마다 명세가 틀린다.
 */
export async function meetingMinutesStatus(
  db: Db,
  orgId: string,
  meetingId: string,
): Promise<{ parts: MinutesPart[] }> {
  const row = await minutesRow(db, orgId, meetingId)

  const agendas = await db
    .select({ status: meetingAgendas.status, decisionText: meetingAgendas.decisionText })
    .from(meetingAgendas)
    .where(and(eq(meetingAgendas.orgId, orgId), eq(meetingAgendas.meetingId, meetingId)))

  const linked = await linkedTaskCount(db, orgId, meetingId)

  // 논의가 끝난 안건이 '정리된' 안건이다 — 06A가 마친 둘을 '정리됨'으로 그렸다.
  const tidied = agendas.filter((one) => one.status === 'done').length
  // 결정은 안건마다 하나다(표가 한 칸을 갖는다). 그래서 셀 수 있다.
  const decisions = agendas.filter(decided).length

  return {
    parts: [
      { label: '안건 내용', stateNote: `${tidied} / ${agendas.length} 정리` },
      { label: '의사결정', stateNote: `${decisions}건 확인` },
      { label: '후속 업무', stateNote: `${linked}건 연결` },
      // **요약은 세는 것이 아니라 있는지다.** 있으면 초안이고 없으면 아직이다 —
      // 사람이 고쳐 쓴 요약과 기계가 만든 초안을 가르는 말을 그림이 안 그렸다.
      {
        label: '전체 요약',
        stateNote: word(row.minutesSummary) === null ? '작성 전' : '초안 작성',
      },
    ],
  }
}

/**
 * 이 회의가 만든 후속 업무의 수.
 *
 * **후속 업무는 업무 표의 것이다.** 회의가 따로 세면 같은 수를 두 곳에서 세게 된다.
 * 어느 **안건**에서 나왔는지는 그 표가 담지 않으므로 회의 단위로만 셀 수 있다.
 */
async function linkedTaskCount(db: Db, orgId: string, meetingId: string): Promise<number> {
  const rows = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(tasks)
    .where(and(eq(tasks.orgId, orgId), eq(tasks.fromMeetingId, meetingId)))
  return Number(rows[0]?.total ?? 0)
}

/**
 * 이 회의의 안건들. 차례는 표의 `sortOrder`가 든다 — 고르는 목록과 요약 초안이 같은
 * 차례로 '안건 1·2·3'을 붙여야 한 안건을 두 자리가 다른 번호로 부르지 않는다.
 */
export async function agendaRecordsOf(db: Db, orgId: string, meetingId: string) {
  return db
    .select({
      id: meetingAgendas.id,
      title: meetingAgendas.title,
      status: meetingAgendas.status,
      discussionText: meetingAgendas.discussionText,
      decisionText: meetingAgendas.decisionText,
    })
    .from(meetingAgendas)
    .where(and(eq(meetingAgendas.orgId, orgId), eq(meetingAgendas.meetingId, meetingId)))
    .orderBy(asc(meetingAgendas.sortOrder), asc(meetingAgendas.id))
}

/**
 * 이 안건의 결정 정리가 끝났는가.
 *
 * **결정이 적혀 있으면 끝난 것이다.** 그림의 조건은 '결정사항 또는 없음 표시'인데
 * '없음' 표시를 담는 열이 아직 `meeting_agendas`에 없다(보고했다) — 그래서 지금은 앞의
 * 절반만 셀 수 있다. 열이 생기면 **여기 한 곳만** 넓히면 된다: 고르는 목록의 '확인
 * 필요'와 정리 완료 조건의 둘째 줄과 06A의 '의사결정 n건'이 이 답 하나를 나눠 쓴다.
 */
export function decided(agenda: { decisionText: string | null }): boolean {
  return word(agenda.decisionText) !== null
}

/** 끝난 회의인가. 논의 내용과 참가 결과는 회의가 끝나야 닫히는 사실이다. */
function ended(status: string): boolean {
  return status === 'wrapUp' || status === 'done'
}

/** 참·거짓을 계약이 적은 꼴로. 조건의 `done`은 글이다('y' 또는 빈 글). */
function flag(value: boolean): string {
  return value ? 'y' : ''
}

/** 머리에 그려진 막는 말. 06B가 이 문장을 그렸다. */
const AGENDAS_LEFT = '안건별 필수 정리를 완료해 주세요'
/** 그림이 안 그린 두 상태의 말. 끝나기 전에는 마칠 것이 없고, 마친 것은 다시 못 마친다. */
const NOT_ENDED = '회의가 끝난 뒤에 정리를 마칠 수 있습니다'
const ALREADY_DONE = '이미 정리가 끝난 회의록입니다'

export interface MinutesCondition {
  label: string
  done: string
  optional?: string
}

export interface MinutesProgress {
  requiredDoneNote: string
  blockedNote?: string
  canComplete: boolean
  conditions: MinutesCondition[]
}

/**
 * 회의록 정리를 마칠 수 있는가(`meeting.minutesProgress`, OPS-MEET-06B의 '정리 완료 조건').
 *
 * **조건 줄은 그림이 그린 그대로다.** 06B가 다섯 줄을 그렸고 마지막 하나가 선택이다.
 * **딱지의 수와 목록과 막는 말이 한 셈에서 나온다** — 두 곳에서 세면 언젠가 목록에는
 * 빈 줄이 하나인데 딱지는 '필수 2 / 4'라고 말하는 날이 온다. `completeMinutes`도 이
 * 답으로 막는다.
 *
 * 줄마다 무엇을 보는가 — 명세는 줄의 이름만 주고 판정은 여기서 정했다(보고했다):
 *
 * - **안건별 논의 내용 · 참가 결과**: 회의가 끝났는가. 논의 내용은 회의가 도는 동안만
 *   적히고(05B) 06B에는 고칠 자리가 없다 — 끝난 회의에서 이 줄이 비면 영영 못 마친다.
 *   미완료 안건이 남은 채 끝내는 길을 D02가 열어 두었으므로 그 회의도 마칠 수 있어야
 *   한다. 참가 결과도 같다: 끝나는 순간 굳고(07이 그때부터 '참석·불참'을 그린다) 그
 *   뒤에 고치는 자리가 없다.
 * - **결정사항 또는 없음 표시**: 안건마다 결정이 적혔는가(`decided`). '없음' 표시는
 *   담을 열이 없어 아직 못 센다. 안건이 없으면 결정할 것도 없다.
 * - **후속 업무 또는 없음 표시**: 이 회의가 만든 업무가 하나라도 있는가. 업무는 어느
 *   안건의 것인지를 모르므로 회의 단위다. '없음' 표시는 위와 같다.
 * - **회의 전체 요약 (선택)**: 요약이 있는가. 없어도 마칠 수 있다(06B가 그렇게 적었다).
 */
export async function minutesProgress(
  db: Db,
  orgId: string,
  meetingId: string,
): Promise<MinutesProgress> {
  const row = await minutesRow(db, orgId, meetingId)
  const agendas = await agendaRecordsOf(db, orgId, meetingId)
  const linked = await linkedTaskCount(db, orgId, meetingId)
  const closed = ended(row.status)

  const conditions: MinutesCondition[] = [
    { label: '안건별 논의 내용', done: flag(closed) },
    { label: '결정사항 또는 없음 표시', done: flag(agendas.every(decided)) },
    { label: '후속 업무 또는 없음 표시', done: flag(linked > 0) },
    { label: '참가 결과', done: flag(closed) },
    { label: '회의 전체 요약 (선택)', done: flag(word(row.minutesSummary) !== null), optional: 'y' },
  ]
  const required = conditions.filter((one) => one.optional === undefined)
  const met = required.filter((one) => one.done !== '').length
  const settled = row.minutesStatus === 'done'

  const answer: MinutesProgress = {
    requiredDoneNote: `필수 ${met} / ${required.length}`,
    canComplete: met === required.length && !settled,
    conditions,
  }
  // 계약이 optional로 적었다 — 막히지 않았으면 까닭도 없다.
  if (settled) answer.blockedNote = ALREADY_DONE
  else if (!closed) answer.blockedNote = NOT_ENDED
  else if (met < required.length) answer.blockedNote = AGENDAS_LEFT
  return answer
}

/** 아직 결정이 없는 안건 곁에 붙는 말. 06B가 그 자리에 이 글을 그렸다. */
const NEEDS_CHECK = '확인 필요'

export interface AgendaOption {
  value: string
  label: string
  description?: string
  initiallySelected?: boolean
}

/**
 * 회의록을 정리할 때 어느 안건을 열지 고르는 목록(`meeting.agendaPicker`, OPS-MEET-06B).
 *
 * **곁말도 열려 있을 것도 서버가 표시한다.** '확인 필요'는 아직 결정이 없는 안건에
 * 붙는다 — 정리 완료 조건의 둘째 줄과 같은 셈(`decided`)이라 조건이 차면 곁말도 함께
 * 떨어진다. 처음 열려 있는 것은 그중 첫째다: 정리할 것이 남은 첫 안건이 지금 정리할
 * 것이다. 남은 것이 없으면 첫 안건을 연다 — 그림이 아무것도 안 고른 상태를 그리지 않았다.
 *
 * 글은 그림이 그린 대로 '안건 n'이다. 이름은 고른 뒤 오른쪽 아래가 그린다.
 */
export async function agendaPickerOptions(
  db: Db,
  orgId: string,
  meetingId: string,
): Promise<AgendaOption[]> {
  await minutesRow(db, orgId, meetingId)
  const agendas = await agendaRecordsOf(db, orgId, meetingId)
  const firstOpen = agendas.findIndex((agenda) => !decided(agenda))
  const opened = firstOpen === -1 ? 0 : firstOpen
  return agendas.map((agenda, at) => {
    const option: AgendaOption = { value: agenda.id, label: `안건 ${at + 1}` }
    // **없으면 오지 않는다.** 빈 곁말과 거짓 표시를 실어 보내면 화면이 빈 자리를 그린다.
    if (!decided(agenda)) option.description = NEEDS_CHECK
    if (at === opened) option.initiallySelected = true
    return option
  })
}
