import {
  TaskListQuerySchema,
  TaskOptionsQuerySchema,
  type TaskListQuery,
  type TaskOptionsQuery,
} from '@vada/contracts'
import { parseQuery } from '../http/query.js'

export const listQueryOf = (queries: Record<string, string[]>): TaskListQuery =>
  parseQuery(TaskListQuerySchema, queries)

export const optionsQueryOf = (queries: Record<string, string[]>): TaskOptionsQuery =>
  parseQuery(TaskOptionsQuerySchema, queries)
