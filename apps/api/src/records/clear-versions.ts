import { sql } from 'drizzle-orm'
import type { Tx } from '../db/types.js'

// 번호들을 한 문장에 넣는 목록(번호가 많아도 매개변수는 하나다).
export const idList = (ids: readonly string[]) =>
  sql`(SELECT jsonb_array_elements_text(${JSON.stringify(ids)}::jsonb)::uuid)`

// 기록들의 모든 판에서 칸 값을 비운다(DEC-54: 행은 남기고 값을 모든 판에서 비운다). 판을 새로 열지 않는다.
// 지금 값은 부르는 쪽이 같은 거래에서 비운다. 판의 키는 DB 칸 이름(snake_case)이다. 신청자 정보와 지운 메시지가 같이 쓴다.
export async function clearVersionKeys(
  tx: Tx,
  recordIds: readonly string[],
  keys: readonly string[],
) {
  if (!recordIds.length || !keys.length) return
  const nulls = JSON.stringify(Object.fromEntries(keys.map(key => [key, null])))
  const filled = sql.join(
    keys.map(key => sql`data ->> ${key} IS NOT NULL`),
    sql` OR `,
  )
  await tx.execute(sql`UPDATE record_version SET data = data || ${nulls}::jsonb
    WHERE record_id IN ${idList(recordIds)} AND (${filled})`)
}
