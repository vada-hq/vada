import {
  TASK_FILTERS,
  TASK_LAYOUTS,
  TASK_STATUSES,
  TASK_TABS,
  TASK_VIEWS,
  type AppQuery,
  type TaskTab,
  type TaskFilter,
  type TaskLayout,
  type TaskStatus,
  type TaskView,
} from '@vada/contracts'
import { useRecordQuery } from '@/lib/use-address-record'
import { rememberTaskLayout, rememberTaskTab } from '@/lib/task-layout'
import { pickQuery as pick, useMenuQuery } from '@/lib/use-menu-query'
import { chipChange, type TaskChip } from './task-chips'

const CLEAR_NARROW = {
  dept: null,
  assignee: null,
  heads: null,
  attention: null,
  due: null,
  only: null,
}
type QueryUrl = Pick<ReturnType<typeof useMenuQuery>, 'query' | 'set'>

function listEventOf(eventId: string | undefined, inMenu: boolean, tab: TaskTab, query: AppQuery) {
  if (inMenu && tab === 'mine') return query['scope'] === 'council' ? 'none' : query['scope']
  return (
    eventId ?? (inMenu && tab === 'council' && query['events'] !== 'include' ? 'none' : undefined)
  )
}

const assigneeOf = (query: AppQuery) =>
  query['assignee'] ?? (query['view'] === 'unassigned' ? 'none' : null)

function scopeChanges(url: QueryUrl) {
  const { query } = url
  const legacy = query['view'] === 'unassigned'
  return {
    setDept: (dept: string | null) => url.set({ dept }),
    setAssignee: (assignee: string | null) =>
      url.set({ assignee, ...(legacy ? { view: 'all' } : {}) }),
    toggleChip: (chip: TaskChip) =>
      url.set({
        ...chipChange({ due: query['due'] ?? null, assignee: assigneeOf(query) }, chip),
        ...(legacy ? { view: 'all' } : {}),
      }),
    toggleEvents: () => url.set({ events: query['events'] === 'include' ? null : 'include' }),
    // 토글은 같은 보드 안에서 좁히므로 칩을 유지한다. 옛 행사 주소의 담당자 없음 보기도 칩으로 옮긴다.
    setView: (view: TaskView) =>
      url.set(
        query['tab'] === 'tasks'
          ? { ...(legacy ? { assignee: 'none' } : {}), view }
          : { only: view === 'mine' ? 'mine' : null },
      ),
    clearNarrow: () => url.set({ ...CLEAR_NARROW, view: null, events: null }),
  }
}

function changesOf(url: QueryUrl, memberId: string) {
  return {
    ...scopeChanges(url),
    setTab: (tab: TaskTab) => {
      rememberTaskTab(memberId, tab)
      url.set({ ...CLEAR_NARROW, tab, view: null, events: null })
    },
    // 넓은 화면의 끝남 거르기와 좁은 화면의 끝남 탭은 같은 것을 고른다. 마지막에 고른 쪽이 폭을 바꿔도 남는다.
    setFilter: (filter: TaskFilter) => url.set({ filter, col: null }),
    // 휴대폰 상태 탭. 할 일은 기본값이라 주소에서 빠진다.
    setColumn: (col: TaskStatus) => url.set({ col, filter: col === 'done' ? 'done' : null }),
    setScope: (scope: string | null) => url.set({ scope }),
    setState: (state: string | null) => url.set({ state }),
    clearMyFilters: () => url.set({ scope: null, state: null }),
    setLayout: (layout: TaskLayout) => {
      rememberTaskLayout(memberId, layout)
      url.set({ layout })
    },
    // 끝남 열이 넘칠 때 표의 '끝남'으로 간다. 고른 배치가 아니라 길이라 기억하지 않는다.
    showDoneTable: () => url.set({ layout: 'list', filter: 'done', col: null }),
  }
}

function viewsOf(
  inMenu: boolean,
  tab: TaskTab,
  query: AppQuery,
): { view: TaskView; listView: TaskView } {
  const startView: TaskView =
    inMenu && (tab === 'mine' || query['only'] === 'mine') ? 'mine' : 'all'
  const view = inMenu ? startView : pick(TASK_VIEWS, query['view'], startView)
  const shown = view === 'unassigned' ? 'all' : view
  return {
    view: shown,
    // 보이는 목록은 상한 전에 서버가 거른다(담당자 없음, 내 업무, 옛 내 부서). 칩 수는 useTaskChipData가 전체 열린 목록에서 센다.
    listView: shown === 'all' && assigneeOf(query) === 'none' ? 'unassigned' : shown,
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
  return {
    ...changesOf(url, memberId),
    tab,
    inMenu,
    ...viewsOf(inMenu, tab, query),
    listEvent: listEventOf(eventId, inMenu, tab, query),
    includeEvents: query['events'] === 'include',
    filter: pick<TaskFilter>(TASK_FILTERS, query['filter'], 'open'),
    layout: pick<TaskLayout>(TASK_LAYOUTS, query['layout'], 'board'),
    column: pick<TaskStatus>(
      TASK_STATUSES,
      query['col'],
      query['filter'] === 'done' ? 'done' : 'todo',
    ),
    dept: query['dept'] ?? null,
    assignee: assigneeOf(query),
    due: query['due'] ?? null,
    heads: query['heads'] === 'true',
    attention: query['attention'] === 'true',
    week: query['due'] === 'week',
    scope: query['scope'] ?? null,
    state: query['state'] ?? null,
  }
}
