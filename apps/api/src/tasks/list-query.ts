import { TaskListQuerySchema, type TaskListQuery } from '@vada/contracts'
import { ApiError } from '../http/errors.js'

// 같은 키를 두 번 준 쿼리는 어느 값을 쓸지 정할 수 없어 400이다. 모르는 키와 틀린 값도 400이다.
export function listQueryOf(queries: Record<string, string[]>): TaskListQuery {
  const entries = Object.entries(queries)
  if (entries.some(([, values]) => values.length !== 1)) throw new ApiError('INVALID_INPUT')
  const parsed = TaskListQuerySchema.safeParse(
    Object.fromEntries(entries.map(([key, values]) => [key, values[0]])),
  )
  if (!parsed.success) throw new ApiError('INVALID_INPUT')
  return parsed.data
}
