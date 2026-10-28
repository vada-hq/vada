import {
  TASK_LAYOUTS,
  TASK_TABS,
  type AppQuery,
  type TaskLayout,
  type TaskTab,
} from '@vada/contracts'

// 사람마다 마지막에 고른 업무 화면의 배치(보드·표·달력, DEC-94). 이 기기의 저장소에 운영진 번호마다 하나 둔다.
// 키는 로그인 계정이 아니라 운영진 번호(me.memberId)라 사람×학생회마다 따로다. 업무 화면까지 로그인 계정 번호가 오지 않아서다.
// 업무 화면으로 들어가는 링크(옆 메뉴 [업무], 행사의 업무 탭)가 이 값을 주소에 싣는다. 주소의 값이 원문이고, 이미 주소에 있으면 주소가 이긴다.
// 새로고침해도 남아야 해서 lib/menu-memory.ts(메모리)와 따로 둔다. 저장소를 못 쓰면 기억하지 않고 보드다.
const PREFIX = 'vada.task.layout.'
const TAB_PREFIX = 'vada.task.tab.'

export function rememberTaskTab(memberId: string, tab: TaskTab) {
  try {
    window.localStorage.setItem(TAB_PREFIX + memberId, tab)
  } catch {
    // 저장소를 못 쓰면 다음에 첫 탭으로 연다.
  }
}

// 옆 메뉴만 마지막 탭을 싣는다. 행사 업무 탭과 홈의 명시한 내 업무 주소는 영향을 받지 않는다.
export function withTaskTab(memberId: string | null, query: AppQuery): AppQuery {
  if (memberId === null || query['tab'] !== undefined) return query
  try {
    const saved = window.localStorage.getItem(TAB_PREFIX + memberId)
    const tab = TASK_TABS.find(value => value === saved)
    return tab === undefined ? query : { ...query, tab }
  } catch {
    return query
  }
}

export function rememberTaskLayout(memberId: string, layout: TaskLayout) {
  try {
    window.localStorage.setItem(PREFIX + memberId, layout)
  } catch {
    // 가득 찼거나 막혔다. 다음에 보드로 열릴 뿐이다.
  }
}

function recalled(memberId: string): TaskLayout | null {
  try {
    const value = window.localStorage.getItem(PREFIX + memberId)
    return TASK_LAYOUTS.find(layout => layout === value) ?? null
  } catch {
    return null
  }
}

// 업무 화면으로 가는 링크의 쿼리에 기억한 배치를 싣는다. 사람을 아직 모르면(학생회를 읽는 중) 그대로다.
export function withTaskLayout(
  memberId: string | null,
  query: AppQuery,
  allowCalendar = true,
): AppQuery {
  if (memberId === null || query['layout'] !== undefined) return query
  const layout = recalled(memberId)
  return layout === null || (layout === 'calendar' && !allowCalendar) ? query : { ...query, layout }
}
