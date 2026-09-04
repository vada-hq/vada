import { and, asc, eq } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import { meetingAgendas, meetings } from '../db/schema.ts'
import { AlreadyExists, NotFound } from '../routes.ts'

// 회의를 시작하고 끝내고 안건을 넘긴다(OPS-MEET-D01 · D02 · 05B).
//
// **넷 다 인자가 회의 하나뿐이다.** 무엇을 시작할지도, 어느 안건을 마칠지도 몸통에
// 실려 오지 않는다 — 단추의 뜻이 '이 회의'와 '이 안건'이고, 어느 것이 지금 진행
// 중인지는 서버가 안다(명세가 '화면에는 안건 id를 넘길 길이 없었다'고 적었다).
//
// **되풀이는 조용히 넘어가지 않는다.** 계약이 넷 다 `conflict`라 적었다. 진행
// 권한자가 여럿일 수 있으므로 남이 먼저 눌렀을 수 있고, 그때 아무 일도 안 일어나면
// 두 사람이 서로 다른 회의를 보고 있게 된다.

/**
 * 지금 시작할 수 있는 단계인가.
 *
 * **판정과 막는 검사가 한 함수에서 나온다.** 화면의 `canStart`가 이것을 쓰고
 * `startMeeting`도 이것을 쓴다 — 두 곳에서 나오면 단추를 그렸는데 눌리면 막힌다.
 */
export function startableStage(status: string): boolean {
  return status === 'scheduled'
}

/** 지금 끝낼 수 있는 단계인가. 시작하지 않은 회의도 끝난 회의도 아니다. */
export function endableStage(status: string): boolean {
  return status === 'inProgress'
}

/** 그 학생회의 그 회의. **없는 것은 없다고 말한다** — 남의 학생회의 것도 여기서는 없다. */
async function meetingOf(db: Db, orgId: string, meetingId: string) {
  const rows = await db
    .select({ id: meetings.id, status: meetings.status })
    .from(meetings)
    .where(and(eq(meetings.orgId, orgId), eq(meetings.id, meetingId)))
    .limit(1)
  const row = rows[0]
  if (row === undefined) throw new NotFound('그 회의를 찾지 못했습니다')
  return row
}

/**
 * 회의를 시작한다(OPS-MEET-D01).
 *
 * **예정 일시와 다른 사실을 남긴다.** 실제로 시작한 때가 있어야 '진행 27분'을 셀 수
 * 있고, 끝난 뒤의 '15:00–16:12'도 이 값과 짝이다.
 *
 * **안건은 건드리지 않는다.** 명세가 시작하면 무엇이 바뀌는지를 '상태가 진행 중으로
 * 바뀌고 참가자에게 회의 참가가 열린다'로 못 박았다 — 첫 안건까지 여는 것은 그림에
 * 없는 일이고, 여는 자리는 따로 있다(`startNextAgenda`).
 */
export async function startMeeting(
  db: Db,
  orgId: string,
  meetingId: string,
  now: Date,
): Promise<Record<string, never>> {
  const meeting = await meetingOf(db, orgId, meetingId)
  if (!startableStage(meeting.status)) {
    throw new AlreadyExists('이미 시작된 회의입니다')
  }
  await db
    .update(meetings)
    .set({ status: 'inProgress', startedAt: now, updatedAt: now })
    // 고칠 때도 학생회를 다시 건다. 위에서 찾았다고 빼면 울타리가 한 겹이 된다.
    .where(and(eq(meetings.orgId, orgId), eq(meetings.id, meetingId)))
  return {}
}

/**
 * 회의를 끝낸다(OPS-MEET-D02).
 *
 * **상태가 '완료'가 아니라 '정리 중'이 된다.** 명세가 못 박았고 표도 두 단계를 따로
 * 갖는다 — 하나로 합치면 '끝났는데 회의록이 없는 회의'를 담을 자리가 없어진다.
 *
 * **미완료 안건이 남아도 막지 않는다.** 살펴 준 것(`endConfirm`)은 알려 줄 뿐이라고
 * 명세가 적었다.
 */
export async function endMeeting(
  db: Db,
  orgId: string,
  meetingId: string,
  now: Date,
): Promise<Record<string, never>> {
  const meeting = await meetingOf(db, orgId, meetingId)
  if (!endableStage(meeting.status)) {
    throw new AlreadyExists('진행 중인 회의가 아닙니다')
  }
  await db
    .update(meetings)
    .set({ status: 'wrapUp', endedAt: now, updatedAt: now })
    .where(and(eq(meetings.orgId, orgId), eq(meetings.id, meetingId)))
  return {}
}

/** 지금 진행 중인 안건. 회의마다 하나다. */
async function currentAgendaOf(db: Db, orgId: string, meetingId: string) {
  const rows = await db
    .select({ id: meetingAgendas.id })
    .from(meetingAgendas)
    .where(
      and(
        eq(meetingAgendas.orgId, orgId),
        eq(meetingAgendas.meetingId, meetingId),
        eq(meetingAgendas.status, 'current'),
      ),
    )
    .limit(1)
  return rows[0]
}

/**
 * 지금 진행 중인 안건의 논의를 마친다(OPS-MEET-05B).
 *
 * **어느 안건인지를 받지 않는다.** 단추의 뜻이 '이 안건'이고 그것은 지금 진행 중인
 * 것이다 — 그래서 진행 중인 것이 없으면 마칠 것도 없다.
 */
export async function completeCurrentAgenda(
  db: Db,
  orgId: string,
  meetingId: string,
  now: Date,
): Promise<Record<string, never>> {
  const meeting = await meetingOf(db, orgId, meetingId)
  // 안건은 회의가 도는 동안만 넘어간다. 시작하지 않은 회의의 안건은 전부 대기다.
  if (!endableStage(meeting.status)) {
    throw new AlreadyExists('진행 중인 회의가 아닙니다')
  }
  const agenda = await currentAgendaOf(db, orgId, meetingId)
  if (agenda === undefined) throw new AlreadyExists('진행 중인 안건이 없습니다')

  await db
    .update(meetingAgendas)
    .set({ status: 'done', endedAt: now })
    .where(and(eq(meetingAgendas.orgId, orgId), eq(meetingAgendas.id, agenda.id)))
  return {}
}

/**
 * 다음 안건을 진행 중으로 넘긴다(OPS-MEET-05B).
 *
 * **진행 중인 안건이 있으면 막는다.** 두 번 넘기면 안건 하나를 건너뛴다고 명세가
 * 적었고, 건너뛴 안건은 논의도 결정도 없이 회의록에 남는다. 지금 것을 마친 뒤에야
 * 다음이 열린다.
 *
 * '다음'은 **차례가 가장 앞인 대기 안건**이다. 그 차례를 표의 `sortOrder`가 든다.
 */
export async function startNextAgenda(
  db: Db,
  orgId: string,
  meetingId: string,
  now: Date,
): Promise<Record<string, never>> {
  const meeting = await meetingOf(db, orgId, meetingId)
  if (!endableStage(meeting.status)) {
    throw new AlreadyExists('진행 중인 회의가 아닙니다')
  }
  if ((await currentAgendaOf(db, orgId, meetingId)) !== undefined) {
    throw new AlreadyExists('아직 진행 중인 안건이 있습니다')
  }

  const waiting = await db
    .select({ id: meetingAgendas.id })
    .from(meetingAgendas)
    .where(
      and(
        eq(meetingAgendas.orgId, orgId),
        eq(meetingAgendas.meetingId, meetingId),
        eq(meetingAgendas.status, 'pending'),
      ),
    )
    // 차례가 같으면 이름표로 가른다. 두 번 불러도 같은 것이 나와야 한다.
    .orderBy(asc(meetingAgendas.sortOrder), asc(meetingAgendas.id))
    .limit(1)
  const next = waiting[0]
  if (next === undefined) throw new AlreadyExists('넘길 안건이 남지 않았습니다')

  await db
    .update(meetingAgendas)
    .set({ status: 'current', startedAt: now })
    .where(and(eq(meetingAgendas.orgId, orgId), eq(meetingAgendas.id, next.id)))
  return {}
}
