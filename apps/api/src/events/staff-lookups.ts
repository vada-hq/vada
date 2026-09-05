import { and, eq } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import { eventStaffMembers } from '../db/schema.ts'
import type { Lookups } from '../permissions.ts'

// 행사 운영 조직에 매인 권한 둘을 **저장소가 답한다**.
//
// permissions.json의 `event.manage`·`event.staff`가 회장단이 아닌 사람에게 '행사 조직만'·
// '행사 조직 관리자만'을 건다. 그것은 표를 봐야 나오는 사실이라 판정 함수
// (`permissions.ts`)가 표를 직접 열지 않도록 밖에서 준다 — 회의의 `meetingLookups`와
// 같은 짜임이다.
//
// **울타리는 표가 든다.** 여기 오는 인자는 사람과 행사뿐이라 학생회를 걸 자리가 없지만,
// 조직원 줄은 (학생회, 행사)와 (학생회, 사람)으로 묶인 외래키를 지나야만 들어간다
// (`event_staff_members_event_same_org`·`event_staff_members_member_same_org`) — 남의
// 학생회 행사의 조직원이 될 길이 없다.
//
// **관리자는 행사 책임자다.** ORG-04가 '행사 조직 관리자만은 그 조직의 관리자인
// 경우'라고 적었다. 이 조직에서 뿌리에 있는 사람이 책임자이고(EVT-01이 고르고 EVT-03A가
// 뿌리에 그린다), 부서장은 자기 부서를 맡지 조직을 맡지 않는다 — 부서장까지 관리자로
// 열면 조직 전체를 고치는 자리가 부서마다 열린다.

/**
 * 행사 조직을 여는 두 물음의 답.
 *
 * `serve.ts`가 아직 `async () => false`를 주고 있다 — 그 자리를 이것으로 바꾸면
 * 배포된 서버에서도 행사 조직의 사람에게 그 자리들이 열린다. 검사는 이미 이것을 쓴다.
 */
export function eventStaffLookups(
  db: Db,
): Pick<Lookups, 'isEventStaff' | 'isEventStaffManager'> {
  return {
    /** 그 행사의 운영 조직에 속했는가. 책임자·부서장·부원 — 줄이 있으면 조직원이다. */
    async isEventStaff(memberId, eventId) {
      const rows = await db
        .select({ id: eventStaffMembers.id })
        .from(eventStaffMembers)
        .where(
          and(eq(eventStaffMembers.eventId, eventId), eq(eventStaffMembers.memberId, memberId)),
        )
        .limit(1)
      return rows.length > 0
    },

    /** 그 행사 조직의 관리자인가 — 행사 책임자. */
    async isEventStaffManager(memberId, eventId) {
      const rows = await db
        .select({ id: eventStaffMembers.id })
        .from(eventStaffMembers)
        .where(
          and(
            eq(eventStaffMembers.eventId, eventId),
            eq(eventStaffMembers.memberId, memberId),
            eq(eventStaffMembers.isEventLeader, true),
          ),
        )
        .limit(1)
      return rows.length > 0
    },
  }
}
