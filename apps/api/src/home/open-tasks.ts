import { HOME_LIST_LIMIT, type HomeList } from '@vada/contracts'
import type { OpenTask } from '../tasks/open-tasks.js'

// 상한까지의 줄과 전체 수
export const listOf = (items: OpenTask[]): HomeList => ({
  tasks: items.slice(0, HOME_LIST_LIMIT).map(item => item.summary),
  total: items.length,
})
