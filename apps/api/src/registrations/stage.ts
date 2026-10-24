import { inArray } from 'drizzle-orm'
import type { TaskResultStage } from '@vada/contracts'
import { registrationForm } from '../db/schema.js'
import type { Db } from '../db/types.js'

// 신청 양식이 업무 결과물로서 어느 단계인가(RULE-41, DEC-82). 읽기만 하고 저장하지 않는다.
// 양식은 있으면 끝남이다. 양식을 지우는 길은 없다(멈추거나 마감할 뿐이라 단계가 내려가지 않는다).
export async function formStagesOf(
  db: Pick<Db, 'select'>,
  formIds: readonly string[],
): Promise<Map<string, TaskResultStage>> {
  if (!formIds.length) return new Map()
  const rows = await db
    .select({ id: registrationForm.id })
    .from(registrationForm)
    .where(inArray(registrationForm.id, [...formIds]))
  return new Map(rows.map(row => [row.id, 'finished']))
}
