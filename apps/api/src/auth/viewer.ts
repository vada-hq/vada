import { and, eq } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import { departments, members } from '../db/schema.ts'
import type { Viewer } from '../permissions.ts'

// 로그인한 사람이 **이 학생회에서 누구인가.**
//
// 세션은 '어느 사용자인가'까지만 안다. 그 사람이 어느 학생회의 어떤 역할이고 재정을
// 맡는 부서인지는 `members`가 알고, **그것이 권한 판정의 전부**다.
//
// **한 사람이 여러 학생회에 속할 수 있다**(ONB-02가 '새로 만들기'와 '초대받아
// 참여하기'를 나란히 둔다). 그래서 어느 학생회를 보고 있는지가 따로 필요하다.

export interface Session {
  userId: string
}

/** 지금 보고 있는 학생회. 아직 고르는 화면이 없으므로 속한 곳 하나를 쓴다. */
export interface ViewerLookup {
  who(session: Session | null): Promise<Viewer | null>
}

export function viewerLookup(db: Db): ViewerLookup {
  return {
    async who(session) {
      if (session === null) return null

      const rows = await db
        .select({
          orgId: members.orgId,
          memberId: members.id,
          role: members.role,
          departmentId: members.departmentId,
          // **재정부인지는 부서 이름으로 보지 않는다.** 부서에 단 표시가 정한다.
          handlesFinance: departments.handlesFinance,
        })
        .from(members)
        .leftJoin(departments, and(eq(members.departmentId, departments.id), eq(departments.orgId, members.orgId)))
        .where(eq(members.userId, session.userId))
        .limit(2)

      const row = rows[0]
      // **구성원이 아니어도 로그인한 사람이다.** 학생회를 만들려는 사람과 초대 코드를
      // 확인하는 사람이 그렇다 — 그 자리를 막으면 아무도 들어올 수 없다.
      if (row === undefined) {
        return { userId: session.userId, membership: null }
      }

      // 아직 어느 학생회를 보고 있는지 고르는 화면이 없다. 둘 이상이면 **지어내지 않고**
      // 첫 것을 쓰되 그 사실을 여기 적어 둔다 — 화면이 생기면 그 값이 여기로 온다.
      return {
        userId: session.userId,
        membership: {
          orgId: row.orgId,
          memberId: row.memberId,
          role: row.role,
          departmentId: row.departmentId,
          inFinanceDepartment: row.handlesFinance === true,
        },
      }
    },
  }
}
