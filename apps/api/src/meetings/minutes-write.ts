import { and, eq } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import { meetingAgendas, meetingParticipants, meetings } from '../db/schema.ts'
import { AlreadyExists, Blocked, NotFound } from '../routes.ts'
import { readFlag, readWord } from './fields.ts'
import { word, type MeetingViewer } from './meetings.ts'
import { agendaRecordsOf, minutesProgress } from './minutes.ts'

// 회의록을 **쓴다**(OPS-MEET-06B의 결정사항·요약 초안·정리 완료, OPS-MEET-08의 요약 확인).
// 읽는 쪽은 `minutes.ts`다 — 아카이브가 `archive-facts`와 `archive-write`로 가른 것과
// 같은 가름이다.
//
// **참가자가 쓴다**(permissions.json의 meeting.minutes, 사람이 정함 2026-09-05). 만든
// 사람과 진행 권한자도 참가자다. 누가 쓸 수 있는지는 미들웨어가 막고 여기는 무엇을
// 쓸 수 있는지만 본다.
//
// **정리가 끝난 회의록은 고치지 않는다.** 마치는 순간 '변경될 수 있음' 딱지가 떨어지고
// (`meetingMinutes`), 그 뒤에 고치면 뗀 딱지가 거짓이 된다.

/** 그 학생회의 그 회의. **없는 것은 없다고 말한다** — 남의 학생회의 것도 여기서는 없다. */
async function meetingOf(db: Db, orgId: string, meetingId: string) {
  const rows = await db
    .select({ id: meetings.id, status: meetings.status, minutesStatus: meetings.minutesStatus })
    .from(meetings)
    .where(and(eq(meetings.orgId, orgId), eq(meetings.id, meetingId)))
    .limit(1)
  const row = rows[0]
  if (row === undefined) throw new NotFound('그 회의를 찾지 못했습니다')
  return row
}

type MeetingRow = Awaited<ReturnType<typeof meetingOf>>

/** 마친 회의록에는 아무것도 쓰지 않는다. */
function mustBeOpen(row: MeetingRow, what: string): void {
  if (row.minutesStatus === 'done') {
    throw new Blocked(`이미 정리가 끝난 회의록은 ${what} 수 없습니다`)
  }
}

/**
 * 손도 안 댄 회의록에 무엇이든 쓰면 그때부터 '작성 중'이다. 목록이 '작성 전'과
 * '작성 중'을 갈라 그리므로(`MINUTES`) 첫 글이 그 갈림을 넘긴다. 이미 작성 중이면 그대로다.
 */
function drafting(row: MeetingRow): { minutesStatus?: 'drafting' } {
  return row.minutesStatus === 'notStarted' ? { minutesStatus: 'drafting' } : {}
}

/**
 * 안건 하나의 정리 내용을 저장한다(`meeting.saveMinutes`).
 *
 * **덮어쓴다**(계약의 repeat: overwrite). 안건 하나의 정리 내용 전부가 한 번에 오므로
 * 빈 결정은 결정을 지운 것이다.
 *
 * **'없음' 표시는 아직 담을 자리가 없다.** 06B가 '이 안건은 결정사항 없음'과 '후속 업무
 * 없음' 두 체크를 그렸는데 그것을 담는 열이 `meeting_agendas`에 없다(보고했다). 받았다고
 * 답하고 잊으면 사람은 표시했다고 믿고 정리 완료 조건은 영영 안 찬다 — 그래서 켜져서
 * 오면 막는다. 열이 생기면 여기서 담고 `decided`(minutes.ts)가 그것을 함께 본다.
 */
export async function saveMinutes(
  db: Db,
  orgId: string,
  meetingId: string,
  draft: Record<string, unknown>,
  now: Date,
): Promise<Record<string, never>> {
  const row = await meetingOf(db, orgId, meetingId)
  mustBeOpen(row, '고칠')

  const agendaId = readWord(draft, 'agendaId', '안건')
  if (agendaId === null) throw new Blocked('어느 안건의 정리인지 골라 주세요')
  if (readFlag(draft, 'noDecision', '결정사항 없음')) {
    throw new Blocked("'결정사항 없음' 표시는 아직 저장할 수 없습니다")
  }
  if (readFlag(draft, 'noFollowUp', '후속 업무 없음')) {
    throw new Blocked("'후속 업무 없음' 표시는 아직 저장할 수 없습니다")
  }

  // **이 회의의 안건이어야 한다.** 다른 회의의 안건 id를 보내면 남의 결정을 고치게 된다.
  const agendas = await db
    .select({ id: meetingAgendas.id })
    .from(meetingAgendas)
    .where(
      and(
        eq(meetingAgendas.orgId, orgId),
        eq(meetingAgendas.meetingId, meetingId),
        eq(meetingAgendas.id, agendaId),
      ),
    )
    .limit(1)
  if (agendas[0] === undefined) throw new Blocked('이 회의에 그런 안건이 없습니다')

  await db
    .update(meetingAgendas)
    .set({ decisionText: readWord(draft, 'decisionText', '결정사항') })
    // 고칠 때도 학생회를 다시 건다. 위에서 찾았다고 빼면 울타리가 한 겹이 된다.
    .where(and(eq(meetingAgendas.orgId, orgId), eq(meetingAgendas.id, agendaId)))
  await db
    .update(meetings)
    .set({ ...drafting(row), updatedAt: now })
    .where(and(eq(meetings.orgId, orgId), eq(meetings.id, meetingId)))
  return {}
}

/** 기록에 없는 것을 적는 자리에 쓰는 말. 지어내는 대신 없다는 사실을 적는다. */
const NO_RECORD = '기록 없음'
const NO_AGENDAS = '기록된 안건이 없습니다'

/**
 * 요약 초안의 글.
 *
 * **안건별 논의·결정 기록만 재구성한다** — 06B의 `aiDisclaimer`가 약속한 그 범위다.
 * 기계가 짓지 않고 표에서 결정적으로 옮겨 적는다(아카이브의 인수인계 초안과 같은 태도).
 * 없는 결정·담당자·기한은 한 글자도 나오지 않는다: 결정이 없는 안건은 '기록 없음'이다.
 */
function summaryDraftOf(
  agendas: Array<{ title: string; discussionText: string | null; decisionText: string | null }>,
): string {
  if (agendas.length === 0) return NO_AGENDAS
  return agendas
    .map(
      (agenda, at) =>
        `안건 ${at + 1} '${agenda.title}' — 논의: ${word(agenda.discussionText) ?? NO_RECORD} / 결정: ${
          word(agenda.decisionText) ?? NO_RECORD
        }`,
    )
    .join('\n')
}

/**
 * 전체 요약 초안을 만든다(`meeting.generateSummary`).
 *
 * **덮어쓰기다.** 초안은 회의마다 하나뿐이고 다시 만들면 그 하나가 바뀐다(계약의
 * repeat: overwrite). 기계가 만든 때를 남긴다 — 사람이 쓴 것과 가르는 근거다.
 */
export async function generateSummary(
  db: Db,
  orgId: string,
  meetingId: string,
  now: Date,
): Promise<Record<string, never>> {
  const row = await meetingOf(db, orgId, meetingId)
  mustBeOpen(row, '요약할')
  const text = summaryDraftOf(await agendaRecordsOf(db, orgId, meetingId))
  await db
    .update(meetings)
    .set({
      minutesSummary: text,
      minutesSummaryDraftedAt: now,
      ...drafting(row),
      updatedAt: now,
    })
    .where(and(eq(meetings.orgId, orgId), eq(meetings.id, meetingId)))
  return {}
}

/**
 * 회의록 정리를 마친다(`meeting.completeMinutes`).
 *
 * **조건이 다 찼을 때만이다.** 무엇이 조건인지는 `minutesProgress`가 든다 — 화면의 딱지와
 * 목록과 이 막음이 한 셈에서 나와야 단추를 그렸는데 눌리면 막히는 일이 없다.
 *
 * **회의도 함께 '완료'가 된다.** 종료는 회의를 '정리 중'에 두었고(D02), 정리를 마쳐야
 * '완료'다 — 표가 두 축을 가른 까닭이 바로 이 순간을 담기 위해서다.
 *
 * **되풀이는 409다**(계약의 repeat: conflict). 참가자가 여럿이라 남이 먼저 마쳤을 수 있다.
 * 알림은 아직 없다 — 확인이 필요한 사람은 목록 위의 띠가 세어서 알린다(`meetingAttention`).
 */
export async function completeMinutes(
  db: Db,
  orgId: string,
  meetingId: string,
  now: Date,
): Promise<Record<string, never>> {
  const row = await meetingOf(db, orgId, meetingId)
  if (row.minutesStatus === 'done') throw new AlreadyExists('이미 정리가 끝난 회의록입니다')
  const progress = await minutesProgress(db, orgId, meetingId)
  if (!progress.canComplete) {
    throw new Blocked(progress.blockedNote ?? '아직 정리를 마칠 수 없습니다')
  }
  await db
    .update(meetings)
    .set({
      minutesStatus: 'done',
      ...(row.status === 'wrapUp' ? { status: 'done' as const } : {}),
      updatedAt: now,
    })
    .where(and(eq(meetings.orgId, orgId), eq(meetings.id, meetingId)))
  return {}
}

/**
 * 이 사람이 회의 요약을 확인했다고 기록한다(`meeting.acknowledgeSummary`, OPS-MEET-08).
 *
 * **회의의 상태가 아니라 그 사람의 확인 상태다** — 명세가 못 박았다. 회의 줄은 아무것도
 * 안 바뀐다. 두 번 확인해도 확인된 채이고(계약의 repeat: overwrite) 처음 확인한 때가 남는다.
 *
 * **확정된 요약만 확인할 수 있다.** 아직 바뀔 수 있는 글을 확인했다고 적으면 무엇을
 * 확인했는지 알 수 없다. 참가자 줄이 없는 사람(만든 사람이 스스로를 초대하지 않은 회의)은
 * 적을 자리가 없다 — 줄을 지어내 만들면 그 사람을 참가자로 만드는 일이 된다.
 */
export async function acknowledgeSummary(
  db: Db,
  orgId: string,
  meetingId: string,
  viewer: MeetingViewer,
  now: Date,
): Promise<Record<string, never>> {
  const row = await meetingOf(db, orgId, meetingId)
  if (row.minutesStatus !== 'done') throw new Blocked('아직 정리가 끝나지 않은 회의록입니다')

  const mine = await db
    .select({ id: meetingParticipants.id, acknowledgedAt: meetingParticipants.acknowledgedAt })
    .from(meetingParticipants)
    .where(
      and(
        eq(meetingParticipants.orgId, orgId),
        eq(meetingParticipants.meetingId, meetingId),
        eq(meetingParticipants.memberId, viewer.memberId),
      ),
    )
    .limit(1)
  const me = mine[0]
  if (me === undefined) throw new Blocked('이 회의의 참가자 목록에 없어 확인을 기록할 수 없습니다')

  if (me.acknowledgedAt === null) {
    await db
      .update(meetingParticipants)
      .set({ acknowledgedAt: now })
      .where(and(eq(meetingParticipants.orgId, orgId), eq(meetingParticipants.id, me.id)))
  }
  return {}
}
