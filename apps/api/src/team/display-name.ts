import { inArray, sql, type SQL } from 'drizzle-orm'
import type { AnyPgColumn } from 'drizzle-orm/pg-core'
import { member } from '../db/schema.js'
import type { Db } from '../db/types.js'

type MemberColumns = { id: AnyPgColumn; name: AnyPgColumn; leftAt: AnyPgColumn }

// 운영진의 표시 이름(logical-model.md 계산되는 값, DEC-54). 탈퇴하지 않았으면 이름, 탈퇴했으면 '떠난 운영진 N'이다.
// N은 그 학생회에 소속(어느 기수든)이 있었던 탈퇴한 운영진을 탈퇴한 시각, 같으면 운영진 번호 차례로 센 번호다.
// 새 탈퇴는 늘 뒤에 붙어 이미 매긴 N이 바뀌지 않는다. 저장하지 않고 읽을 때 센다.
// 이름을 읽는 모든 조회가 이 도우미를 쓴다(display-name-only.test.ts가 지킨다). 운영진 표를 alias로 읽어도 된다.
// 전제: 학생회 번호는 NULL이 아니고, 운영진은 그 학생회에 소속이 있었던 사람이다(그 학생회 기록을 만들거나 맡거나 결재한 사람).
// 어기면 탈퇴한 사람이 자기 차례에 들지 않아 '떠난 운영진 0'이 된다. 학생회 기록의 council_id와 그 기록에 적힌 운영진만 넘긴다.
// 열을 sql``로 한 번 더 감싸는 까닭: drizzle은 표 하나만 읽는 select에서 맨 바깥 열의 표 이름을 떼는데,
// 그러면 안쪽 조회의 같은 이름 칸(left_peer.id 등)으로 읽힌다. 감싼 열은 표 이름이 붙은 채로 남는다.
function nameSql<T>(people: MemberColumns, councilId: string | AnyPgColumn | SQL): SQL<T> {
  const id = sql`${people.id}`
  const leftAt = sql`${people.leftAt}`
  return sql<T>`CASE WHEN ${leftAt} IS NULL THEN ${sql`${people.name}`} ELSE '떠난 운영진 ' || (
    SELECT count(*) FROM member AS left_peer
    WHERE left_peer.left_at IS NOT NULL
      AND (left_peer.left_at, left_peer.id) <= (${leftAt}, ${id})
      AND EXISTS (
        SELECT 1 FROM council_membership AS left_cm
        JOIN cohort AS left_cohort ON left_cohort.id = left_cm.cohort_id
        WHERE left_cm.member_id = left_peer.id AND left_cohort.council_id = ${sql`${councilId}`}
      )
  ) END`
}

// leftJoin한 운영진(담당자, 먼저 낸 사람처럼 비어 있을 수 있는 칸). 운영진 행이 없으면 NULL이다.
export const displayNameOf = (people: MemberColumns, councilId: string | AnyPgColumn | SQL) =>
  nameSql<string | null>(people, councilId)

// 운영진 표를 from하거나 innerJoin해 행이 반드시 있는 조회. 이름과 탈퇴한 시각 중 하나는 늘 있어(member CHECK) NULL이 아니다.
// leftJoin에 쓰면 없는 행의 NULL을 타입이 숨기므로 displayNameOf를 쓴다.
export const joinedDisplayNameOf = (people: MemberColumns, councilId: string | AnyPgColumn | SQL) =>
  nameSql<string>(people, councilId)

// 기록 하나가 속한 학생회 번호(SQL 식). 기록 번호만 받는 조회(판, 결재)가 그 학생회의 차례로 이름을 얻는 데 쓴다.
export const recordCouncilSql = (recordId: string) =>
  sql`(SELECT named_record.council_id FROM record AS named_record WHERE named_record.id = ${recordId}::uuid)`

// 운영진 번호 → 표시 이름. 판의 바꾼 사람, 판에 담긴 책임자·담당자처럼 번호만 아는 곳이 쓴다.
export async function memberNamesOf(
  db: Pick<Db, 'select'>,
  councilId: string | SQL,
  ids: Iterable<string>,
): Promise<Map<string, string>> {
  const wanted = [...new Set(ids)]
  if (!wanted.length) return new Map()
  const rows = await db
    .select({ id: member.id, name: joinedDisplayNameOf(member, councilId) })
    .from(member)
    .where(inArray(member.id, wanted))
  return new Map(rows.map(row => [row.id, row.name]))
}
