import {
  TASK_FILTERS,
  TASK_LAYOUTS,
  TASK_TABS,
  TASK_VIEWS,
  type AppQuery,
  type TaskTab,
  type TaskFilter,
  type TaskLayout,
  type TaskView,
} from '@vada/contracts'
import { useRecordQuery } from '@/lib/use-address-record'
import { rememberTaskLayout, rememberTaskTab } from '@/lib/task-layout'
import { pickQuery as pick, useMenuQuery } from '@/lib/use-menu-query'

const CLEAR_NARROW = { dept: null, assignee: null, heads: null, attention: null, due: null }
type QueryUrl = Pick<ReturnType<typeof useMenuQuery>, 'query' | 'set'>

function listEventOf(eventId: string | undefined, inMenu: boolean, tab: TaskTab, query: AppQuery) {
  return (
    eventId ?? (inMenu && tab === 'council' && query['events'] !== 'include' ? 'none' : undefined)
  )
}

function changesOf(url: QueryUrl, memberId: string) {
  const { query } = url
  return {
    setTab: (tab: TaskTab) => {
      rememberTaskTab(memberId, tab)
      url.set({ ...CLEAR_NARROW, tab, view: null, events: null })
    },
    setDept: (dept: string | null) => url.set({ dept }),
    toggleUnassigned: () =>
      url.set(
        query['view'] === 'unassigned'
          ? { view: 'all', assignee: null }
          : { assignee: query['assignee'] === 'none' ? null : 'none' },
      ),
    toggleEvents: () => url.set({ events: query['events'] === 'include' ? null : 'include' }),
    // 토글은 같은 보드 안에서 좁히므로 칩을 유지한다. 옛 행사 주소의 담당자 없음 보기도 칩으로 옮긴다.
    setView: (view: TaskView) =>
      url.set({ ...(query['view'] === 'unassigned' ? { assignee: 'none' } : {}), view }),
    setFilter: (filter: TaskFilter) => url.set({ filter }),
    setLayout: (layout: TaskLayout) => {
      rememberTaskLayout(memberId, layout)
      url.set({ layout })
    },
    // 끝남 열이 넘칠 때 표의 '끝남'으로 간다. 고른 배치가 아니라 길이라 기억하지 않는다.
    showDoneTable: () => url.set({ layout: 'list', filter: 'done' }),
    clearDept: () => url.set({ dept: null }),
    clearNarrow: () =>
      url.set({ ...CLEAR_NARROW, ...(query['view'] === 'unassigned' ? { view: 'all' } : {}) }),
  }
}

// 업무 화면의 보기, 거르기, 배치, 부서 거르기. 주소의 쿼리가 원문이라 새로고침해도 같고 바꿔도 기록을 쌓지 않는다(DEC-78).
// 업무 메뉴는 메뉴 주소의, 행사의 업무 탭은 그 행사 주소의 쿼리다. 키와 값은 둘이 같다(contracts paths.ts).
// 행사 안의 기본 보기는 그 행사의 모든 업무다. 고른 배치는 이 기기에 그 사람(memberId)마다 기억해, 업무 화면으로 들어가는 링크가 싣는다(lib/task-layout.ts).
export function useTaskControls(councilId: string, eventId: string | undefined, memberId: string) {
  const menu = useMenuQuery('tasks', councilId)
  const event = useRecordQuery('events', councilId, eventId)
  const url = eventId === undefined ? menu : event
  const { query } = url
  const inMenu = eventId === undefined
  const tab = pick(TASK_TABS, query['tab'], 'council')
  const startView: TaskView = inMenu && tab === 'mine' ? 'mine' : 'all'
  return {
    ...changesOf(url, memberId),
    tab,
    inMenu,
    view: inMenu ? startView : pick(TASK_VIEWS, query['view'], startView),
    listEvent: listEventOf(eventId, inMenu, tab, query),
    includeEvents: query['events'] === 'include',
    filter: pick<TaskFilter>(TASK_FILTERS, query['filter'], 'open'),
    layout: pick<TaskLayout>(TASK_LAYOUTS, query['layout'], 'board'),
    dept: query['dept'] ?? null,
    assignee: query['assignee'] ?? null,
    heads: query['heads'] === 'true',
    attention: query['attention'] === 'true',
    week: query['due'] === 'week',
  }
}
