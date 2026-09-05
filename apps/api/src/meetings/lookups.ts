import { and, eq, or } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import { meetingParticipants, meetings } from '../db/schema.ts'
import type { Lookups } from '../permissions.ts'

// 회의에 매인 권한 둘을 **저장소가 답한다**.
//
// **조직 역할이 답하지 않는다**(permissions.json의 meeting.run). 회장단이라도 그
// 회의의 진행 권한자가 아니면 시작할 수 없다고 명세가 적었고, 그것은 표를 봐야
// 나오는 사실이다 — 판정 함수(`permissions.ts`)가 표를 직접 열지 않도록 밖에서 준다.
//
// **울타리는 표가 든다.** 여기 오는 인자는 사람과 회의뿐이라 학생회를 걸 자리가
// 없지만, 참가자도 만든 사람도 (학생회, 회의)로 묶인 외래키를 지나야만 들어간다
// (`meeting_participants_member_same_org`·`meetings_creator_same_org`) — 남의
// 학생회 회의의 진행 권한자가 될 길이 없다.

/**
 * 회의를 여는 두 물음의 답.
 *
 * `serve.ts`가 아직 `async () => false`를 주고 있다 — 그 자리를 이것으로 바꾸면
 * 배포된 서버에서도 회의 시작·종료가 열린다. 검사는 이미 이것을 쓴다.
 */
export function meetingLookups(
  db: Db,
): Pick<Lookups, 'isMeetingHost' | 'isMeetingCreator' | 'isMeetingParticipant'> {
  return {
    /**
     * 그 회의를 진행할 수 있는 사람인가.
     *
     * **만든 사람도 진행 권한자다.** ORG-04가 '회의 생성자 — 기본 진행 권한자이며'라고
     * 적었다. 참가자 표의 `isHost`만 보면 자기가 만든 회의를 못 여는 사람이 생긴다.
     */
    async isMeetingHost(memberId, meetingId) {
      const rows = await db
        .select({ id: meetings.id })
        .from(meetings)
        .leftJoin(
          meetingParticipants,
          and(
            eq(meetingParticipants.meetingId, meetings.id),
            eq(meetingParticipants.memberId, memberId),
          ),
        )
        .where(
          and(
            eq(meetings.id, meetingId),
            or(
              eq(meetings.creatorMemberId, memberId),
              eq(meetingParticipants.isHost, true),
            ),
          ),
        )
        .limit(1)
      return rows.length > 0
    },

    /**
     * 그 회의의 참가자인가. **회의록은 참가자가 함께 쓴다**(OPS-MEET-02의 문장, 사람이
     * 정함 2026-09-05). 만든 사람은 참가자 줄이 없어도 참가자다 — 진행 권한자와 같은 까닭.
     */
    async isMeetingParticipant(memberId, meetingId) {
      const rows = await db
        .select({ id: meetings.id })
        .from(meetings)
        .leftJoin(
          meetingParticipants,
          and(
            eq(meetingParticipants.meetingId, meetings.id),
            eq(meetingParticipants.memberId, memberId),
          ),
        )
        .where(
          and(
            eq(meetings.id, meetingId),
            or(eq(meetings.creatorMemberId, memberId), eq(meetingParticipants.memberId, memberId)),
          ),
        )
        .limit(1)
      return rows.length > 0
    },

    /** 그 회의를 만든 사람인가. 수정·취소와 진행 권한 부여는 이 사람만 한다. */
    async isMeetingCreator(memberId, meetingId) {
      const rows = await db
        .select({ id: meetings.id })
        .from(meetings)
        .where(and(eq(meetings.id, meetingId), eq(meetings.creatorMemberId, memberId)))
        .limit(1)
      return rows.length > 0
    },
  }
}
