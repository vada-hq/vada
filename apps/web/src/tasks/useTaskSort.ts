import { useMemo, useState } from 'react'
import type { CouncilView, TeamResponse } from '@vada/contracts'
import { sortTasks, TASK_SORTS, type TaskSort } from './task-sort'
import type { TaskList } from './useTasks'

// 고른 정렬은 이 기기에 운영진 번호(사람×학생회)마다 기억한다(배치 기억 lib/task-layout.ts와 같은 방식). 서버에는 두지 않는다.
// 학생회 업무·내 업무·행사의 업무 탭이 같은 값을 쓴다. 저장소를 못 쓰면 기억하지 않고 부서별이다.
const PREFIX = 'vada.task.sort.'
const DEFAULT_SORT: TaskSort = 'department'

function recalled(memberId: string): TaskSort {
  try {
    const value = window.localStorage.getItem(PREFIX + memberId)
    return TASK_SORTS.find(sort => sort === value) ?? DEFAULT_SORT
  } catch {
    return DEFAULT_SORT
  }
}

function useTaskSort(memberId: string) {
  const [sort, setSort] = useState(() => recalled(memberId))
  const change = (next: TaskSort) => {
    setSort(next)
    try {
      window.localStorage.setItem(PREFIX + memberId, next)
    } catch {
      // 가득 찼거나 막혔다. 다음에 부서별로 열릴 뿐이다.
    }
  }
  return { value: sort, onChange: change }
}

const NO_DEPARTMENTS: readonly { id: string }[] = []

// 받은 목록을 고른 정렬로 줄 세운 목록. 같은 응답·정렬·부서 차례면 같은 배열이라 표의 칸 고침(useEffect 의존)이 렌더마다 풀리지 않는다.
function useSortedList(
  list: TaskList,
  sort: TaskSort,
  departments: readonly { id: string }[] | undefined,
): TaskList {
  const order = departments ?? NO_DEPARTMENTS
  const { state, reload } = list
  const sorted = useMemo(
    () =>
      state.kind === 'ready' ? { ...state, tasks: sortTasks(state.tasks, sort, order) } : state,
    [state, sort, order],
  )
  return { state: sorted, reload }
}

// 업무 화면의 두 목록(끝나지 않은 것·끝난 것)을 고른 정렬로 줄 세운다. 부서 차례는 조직(운영진 > 부서)의 차례다.
// 보이는 몸통에만 쓴다. 칩 수와 빈 보드 판단은 차례와 상관없어 받은 목록 그대로 센다.
export function useSortedTasks(
  view: Pick<CouncilView, 'me'>,
  lists: { list: TaskList; done: TaskList },
  team: Pick<TeamResponse, 'departments'> | null,
) {
  const sort = useTaskSort(view.me.memberId)
  const list = useSortedList(lists.list, sort.value, team?.departments)
  const done = useSortedList(lists.done, sort.value, team?.departments)
  return { sort, list, done }
}
