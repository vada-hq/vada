import {
  TASK_FILTERS,
  TASK_LAYOUTS,
  TASK_VIEWS,
  type TaskFilter,
  type TaskLayout,
  type TaskView,
} from '@vada/contracts'
import { useRecordQuery } from '@/lib/use-address-record'
import { rememberTaskLayout } from '@/lib/task-layout'
import { pickQuery as pick, useMenuQuery } from '@/lib/use-menu-query'

// 업무 화면의 보기, 거르기, 배치, 부서 거르기. 주소의 쿼리가 원문이라 새로고침해도 같고 바꿔도 기록을 쌓지 않는다(DEC-78).
// 업무 메뉴는 메뉴 주소의, 행사의 업무 탭은 그 행사 주소의 쿼리다. 키와 값은 둘이 같다(contracts paths.ts).
// 행사 안의 기본 보기는 그 행사의 모든 업무다. 고른 배치는 이 기기에 그 사람(memberId)마다 기억해, 업무 화면으로 들어가는 링크가 싣는다(lib/task-layout.ts).
export function useTaskControls(councilId: string, eventId: string | undefined, memberId: string) {
  const menu = useMenuQuery('tasks', councilId)
  const event = useRecordQuery('events', councilId, eventId)
  const url = eventId === undefined ? menu : event
  const startView: TaskView = eventId === undefined ? 'mine' : 'all'
  const { query } = url
  return {
    view: pick(TASK_VIEWS, query['view'], startView),
    filter: pick<TaskFilter>(TASK_FILTERS, query['filter'], 'open'),
    layout: pick<TaskLayout>(TASK_LAYOUTS, query['layout'], 'board'),
    dept: query['dept'] ?? null,
    // 보기를 바꾸면 그 보기에서 고른 부서 거르기는 풀린다.
    setView: (view: TaskView) => url.set({ view, dept: null }),
    setFilter: (filter: TaskFilter) => url.set({ filter }),
    setLayout: (layout: TaskLayout) => {
      rememberTaskLayout(memberId, layout)
      url.set({ layout })
    },
    // 끝남 열이 넘칠 때 표의 '끝남'으로 간다. 고른 배치가 아니라 길이라 기억하지 않는다.
    showDoneTable: () => url.set({ layout: 'list', filter: 'done' }),
    clearDept: () => url.set({ dept: null }),
  }
}
