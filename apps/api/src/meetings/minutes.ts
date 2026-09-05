import { and, eq, sql } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import { meetingAgendas, meetings, tasks } from '../db/schema.ts'
import { NotFound } from '../routes.ts'
import { orNote, word } from './meetings.ts'

// 회의록(OPS-MEET-06A · 06B · 07이 읽는다).
//
// **안건마다의 기록과 다른 물건이다.** 안건의 논의·결정은 `meeting.agendas`가 갖고
// 여기 있는 것은 회의 전체를 한 덩이로 줄인 글이다.
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

  // **후속 업무는 업무 표의 것이다.** 회의가 따로 세면 같은 수를 두 곳에서 세게 된다.
  const linked = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(tasks)
    .where(and(eq(tasks.orgId, orgId), eq(tasks.fromMeetingId, meetingId)))

  // 논의가 끝난 안건이 '정리된' 안건이다 — 06A가 마친 둘을 '정리됨'으로 그렸다.
  const tidied = agendas.filter((one) => one.status === 'done').length
  // 결정은 안건마다 하나다(표가 한 칸을 갖는다). 그래서 셀 수 있다.
  const decisions = agendas.filter((one) => word(one.decisionText) !== null).length

  return {
    parts: [
      { label: '안건 내용', stateNote: `${tidied} / ${agendas.length} 정리` },
      { label: '의사결정', stateNote: `${decisions}건 확인` },
      { label: '후속 업무', stateNote: `${Number(linked[0]?.total ?? 0)}건 연결` },
      // **요약은 세는 것이 아니라 있는지다.** 있으면 초안이고 없으면 아직이다 —
      // 사람이 고쳐 쓴 요약과 기계가 만든 초안을 가르는 말을 그림이 안 그렸다.
      {
        label: '전체 요약',
        stateNote: word(row.minutesSummary) === null ? '작성 전' : '초안 작성',
      },
    ],
  }
}
