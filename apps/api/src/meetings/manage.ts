import { and, eq } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import { meetingParticipants, meetings } from '../db/schema.ts'
import { AlreadyExists, Blocked, NotFound } from '../routes.ts'
import { readWord } from './fields.ts'
import type { MeetingViewer } from './meetings.ts'

// 회의를 관리한다 — 취소(OPS-MEET-D04)와 진행 권한 부여·해제(OPS-MEET-04B · D03).
//
// **만든 사람만 한다**(permissions.json의 meeting.own). 세 계단 중 맨 위의 일이다:
// 회의 생성자 ⊃ 진행 권한자 ⊃ 일반 참가자(docs/decisions/meeting-model.md). 누가 할 수
// 있는지는 미들웨어가 막고 여기는 무엇을 할 수 있는지만 본다.

/** 그 학생회의 그 회의. **없는 것은 없다고 말한다** — 남의 학생회의 것도 여기서는 없다. */
async function meetingOf(db: Db, orgId: string, meetingId: string) {
  const rows = await db
    .select({ id: meetings.id, status: meetings.status, creatorMemberId: meetings.creatorMemberId })
    .from(meetings)
    .where(and(eq(meetings.orgId, orgId), eq(meetings.id, meetingId)))
    .limit(1)
  const row = rows[0]
  if (row === undefined) throw new NotFound('그 회의를 찾지 못했습니다')
  return row
}

/**
 * 지금 취소할 수 있는 단계인가.
 *
 * **취소는 예정에서만 간다.** D04가 03B(예정 회의의 생성자 화면) 위에만 뜬다 — 도는
 * 회의는 끝내는 것이고 끝난 회의는 정리하는 것이다. 임시 저장한 회의는 아직 아무에게도
 * 보이지 않아 취소를 알릴 사람도 없다.
 *
 * **판정과 막는 검사가 한 함수에서 나온다.** 화면의 `canCancel`이 이것을 쓰고
 * `cancelMeeting`도 이것을 쓴다 — 두 곳에서 나오면 단추를 그렸는데 눌리면 막힌다.
 */
export function cancellableStage(status: string): boolean {
  return status === 'scheduled'
}

/**
 * 회의를 취소한다(`meeting.cancel`, OPS-MEET-D04).
 *
 * **지우는 것이 아니다.** 취소된 기록으로 남고 사유와 누가 언제를 갖는다 — 안건도
 * 참가자도 그대로다. 되돌리는 길은 없고(09에 조작 단추가 하나도 없다) 대신 새 회의를
 * 만들어 잇는다.
 *
 * **사유가 필수다.** 빈 글도 사유가 아니다 — '취소 사유를 입력해야 참가자들이 변경
 * 내용을 이해할 수 있습니다'(D04). 되풀이는 409다(계약의 repeat: conflict).
 */
export async function cancelMeeting(
  db: Db,
  orgId: string,
  meetingId: string,
  viewer: MeetingViewer,
  draft: Record<string, unknown>,
  now: Date,
): Promise<Record<string, never>> {
  const row = await meetingOf(db, orgId, meetingId)
  if (row.status === 'cancelled') throw new AlreadyExists('이미 취소된 회의입니다')
  if (!cancellableStage(row.status)) throw new Blocked('예정된 회의만 취소할 수 있습니다')
  const reason = readWord(draft, 'cancelReason', '취소 사유')
  if (reason === null) throw new Blocked('취소 사유를 적어 주세요')

  await db
    .update(meetings)
    .set({
      status: 'cancelled',
      cancelReason: reason,
      // **누가 취소했는지는 서버가 안다.** 몸통에 실려 온 이름을 믿으면 남의 이름으로 남는다.
      cancelledByMemberId: viewer.memberId,
      cancelledAt: now,
      updatedAt: now,
    })
    // 고칠 때도 학생회를 다시 건다. 위에서 찾았다고 빼면 울타리가 한 겹이 된다.
    .where(and(eq(meetings.orgId, orgId), eq(meetings.id, meetingId)))
  return {}
}

/** 이 회의의 그 참가자. 없으면 없다 — 참가자가 아닌 사람에게 줄 권한이 없다. */
async function participantOf(db: Db, orgId: string, meetingId: string, memberId: string) {
  const rows = await db
    .select({ id: meetingParticipants.id, isHost: meetingParticipants.isHost })
    .from(meetingParticipants)
    .where(
      and(
        eq(meetingParticipants.orgId, orgId),
        eq(meetingParticipants.meetingId, meetingId),
        eq(meetingParticipants.memberId, memberId),
      ),
    )
    .limit(1)
  return rows[0]
}

/**
 * 한 사람에게 진행 권한을 준다(`meeting.grantHostRole`, OPS-MEET-D03).
 *
 * **옮기는 것이 아니라 더하는 것이다.** 먼저 가진 사람은 그대로 가진 채다. 이미 가진
 * 사람에게 또 줘도 가진 채다(계약의 repeat: naturalKey).
 *
 * **참가자에게만 준다.** D03은 04B의 참가자 줄에서 열리고 그 목록에 없는 사람에게 줄
 * 권한이 없다. 만든 사람은 줄이 없어도 진행 권한자라(ORG-04) 줄 것이 없다 — 가진 채로 답한다.
 */
export async function grantHostRole(
  db: Db,
  orgId: string,
  meetingId: string,
  memberId: string,
): Promise<Record<string, never>> {
  const row = await meetingOf(db, orgId, meetingId)
  if (memberId === row.creatorMemberId) return {}
  const person = await participantOf(db, orgId, meetingId, memberId)
  if (person === undefined) throw new Blocked('이 회의의 참가자가 아닙니다')
  if (!person.isHost) {
    await db
      .update(meetingParticipants)
      .set({ isHost: true })
      .where(and(eq(meetingParticipants.orgId, orgId), eq(meetingParticipants.id, person.id)))
  }
  return {}
}

/**
 * 한 사람의 진행 권한을 뺀다(`meeting.revokeHostRole`).
 *
 * **만든 사람의 것은 뺄 수 없다.** 만든 사실에서 따라오는 권한이라(`isMeetingHost`가
 * 그렇게 답한다) 뺄 자리가 없다 — 그래서 '최소 1명 유지'(04B의 딱지)는 따로 세지 않아도
 * 지켜진다: 남을 다 빼도 만든 사람이 남는다. 이미 없는 사람에게서 또 빼도 없는 채로다
 * (계약의 repeat: overwrite). 참가자 줄은 남는다 — 권한을 뺀 것이지 회의에서 뺀 것이 아니다.
 */
export async function revokeHostRole(
  db: Db,
  orgId: string,
  meetingId: string,
  memberId: string,
): Promise<Record<string, never>> {
  const row = await meetingOf(db, orgId, meetingId)
  if (memberId === row.creatorMemberId) {
    throw new Blocked('회의 생성자의 진행 권한은 해제할 수 없습니다')
  }
  const person = await participantOf(db, orgId, meetingId, memberId)
  if (person === undefined) throw new Blocked('이 회의의 참가자가 아닙니다')
  if (person.isHost) {
    await db
      .update(meetingParticipants)
      .set({ isHost: false })
      .where(and(eq(meetingParticipants.orgId, orgId), eq(meetingParticipants.id, person.id)))
  }
  return {}
}
