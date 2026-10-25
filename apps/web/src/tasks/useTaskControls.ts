import { useState } from 'react'
import {
  TASK_FILTERS,
  TASK_LAYOUTS,
  TASK_VIEWS,
  type TaskFilter,
  type TaskLayout,
  type TaskView,
} from '@vada/contracts'
import { useMenuQuery } from '@/lib/use-menu-query'

const pick = <T extends string>(values: readonly T[], value: string | undefined, fallback: T): T =>
  values.find(item => item === value) ?? fallback

// 업무 화면의 보기, 거르기, 배치, 부서 거르기. 업무 메뉴에서는 주소의 쿼리가 원문이라 새로고침해도 같고 바꿔도 기록을 쌓지 않는다.
// 행사의 업무 탭은 행사 화면이 품은 화면이라 주소를 쓰지 않고 이 화면의 상태로 둔다(행사 화면의 주소는 행사 쪽이 정한다).
export function useTaskControls(councilId: string, inEvent: boolean, startView: TaskView) {
  const url = useMenuQuery('tasks', councilId)
  const [local, setLocal] = useState({ view: startView, filter: 'open' as TaskFilter })
  if (inEvent)
    return {
      view: local.view,
      filter: local.filter,
      layout: 'list' as TaskLayout,
      dept: null,
      setView: (view: TaskView) => setLocal(current => ({ ...current, view })),
      setFilter: (filter: TaskFilter) => setLocal(current => ({ ...current, filter })),
      setLayout: () => undefined,
      clearDept: () => undefined,
    }
  const { query } = url
  return {
    view: pick(TASK_VIEWS, query['view'], 'mine'),
    filter: pick(TASK_FILTERS, query['filter'], 'open'),
    layout: pick(TASK_LAYOUTS, query['layout'], 'list'),
    dept: query['dept'] ?? null,
    // 보기를 바꾸면 그 보기에서 고른 부서 거르기는 풀린다.
    setView: (view: TaskView) => url.set({ view, dept: null }),
    setFilter: (filter: TaskFilter) => url.set({ filter }),
    setLayout: (layout: TaskLayout) => url.set({ layout }),
    clearDept: () => url.set({ dept: null }),
  }
}
