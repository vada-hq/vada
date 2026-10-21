import { TaskListQuerySchema, type TaskListQuery } from '@vada/contracts'
import { parseQuery } from '../http/query.js'

export const listQueryOf = (queries: Record<string, string[]>): TaskListQuery =>
  parseQuery(TaskListQuerySchema, queries)
