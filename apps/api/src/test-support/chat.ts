import type { PGlite } from '@electric-sql/pglite'

// 학생회의 대화방을 "방 이름 → 참여한 운영진 이름(정렬)"으로 읽는다. 방 이름은 all, leadership, dept:부서이름, direct:번호다.
// 참여자가 없는 방도 빈 목록으로 나온다(방은 지우지 않으므로 그것도 지켜야 할 모습이다).
export async function roomMap(pg: PGlite, councilId: string): Promise<Record<string, string[]>> {
  const { rows } = await pg.query<{ room: string; person: string | null }>(
    `SELECT CASE WHEN cr.type = 'department' THEN 'dept:' || d.name
                 WHEN cr.type = 'direct' THEN 'direct:' || cr.id
                 WHEN cr.type = 'all_members' THEN 'all'
                 ELSE cr.type END AS room, m.name AS person
       FROM chat_room cr
       JOIN record r ON r.id = cr.id
       LEFT JOIN department d ON d.id = cr.department_id
       LEFT JOIN room_membership rm ON rm.room_id = cr.id
       LEFT JOIN member m ON m.id = rm.member_id
      WHERE r.council_id = $1
      ORDER BY m.name`,
    [councilId],
  )
  const rooms: Record<string, string[]> = {}
  for (const { room, person } of rows) (rooms[room] ??= []).push(...(person ? [person] : []))
  return rooms
}

// 방 하나에서 한 사람이 들어온 시각. 줄이 없으면 null이다.
export async function joinedAtOf(pg: PGlite, councilId: string, room: string, person: string) {
  const { rows } = await pg.query<{ joined_at: string }>(
    `SELECT rm.joined_at::text FROM room_membership rm
       JOIN member m ON m.id = rm.member_id
       JOIN chat_room cr ON cr.id = rm.room_id
       JOIN record r ON r.id = cr.id
       LEFT JOIN department d ON d.id = cr.department_id
      WHERE r.council_id = $1 AND m.name = $2
        AND CASE WHEN cr.type = 'department' THEN 'dept:' || d.name
                 WHEN cr.type = 'all_members' THEN 'all' ELSE cr.type END = $3`,
    [councilId, person, room],
  )
  return rows[0]?.joined_at ?? null
}
