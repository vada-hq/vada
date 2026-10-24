import { and, eq } from 'drizzle-orm'
import type { Actor } from '../access/actor.js'
import { task } from '../db/schema.js'
import type { Tx } from '../db/types.js'
import { ApiError } from '../http/errors.js'
import { canLinkResult, factsOf } from './policy.js'
import { inCouncil, taskSelect } from './queries.js'
import type { TaskStatus } from '@vada/contracts'

// 결과물을 만드는 거래가 이을 업무를 확인한다(기능 015). 이 학생회의 취소하지 않은 업무이고, 끝나지 않았고, 내가 그 업무의 상태를 바꿀 수 있어야 한다.
// 아니면(다른 학생회, 없는 번호, 취소·끝남, 권한 없음) 모두 같은 409 TASK_INVALID라 업무가 있는지 드러나지 않는다.
// 결과물 자체의 권한(403)은 부르는 쪽이 먼저 본다. 상세의 canMake와 같은 판정(canLinkResult)이다.
export async function assertLinkableTask(tx: Tx, actor: Actor, taskId: string, now: Date) {
  const [row] = await taskSelect(tx, actor, now).where(and(inCouncil(actor), eq(task.id, taskId)))
  if (!row || !canLinkResult(actor, factsOf(row), row.status as TaskStatus))
    throw new ApiError('TASK_INVALID')
}
