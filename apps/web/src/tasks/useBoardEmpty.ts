import type { TaskView } from '@vada/contracts'
import { useTasks, type TaskList } from './useTasks'

// 목록들이 다 읽혔고 모두 비었으면 참, 하나라도 업무가 있으면 거짓, 아직 모르면 null이다.
function emptyOf(lists: TaskList[]): boolean | null {
  if (lists.some(list => list.state.kind === 'ready' && list.state.tasks.length > 0)) return false
  return lists.every(list => list.state.kind === 'ready') ? true : null
}

type Args = {
  councilId: string
  eventId: string | undefined
  view: TaskView
  // 서버가 칩·홈 범위로 거른 목록인가
  narrowed: boolean
  // 넓은 화면의 보드와 좁은 화면의 상태 탭일 때만 센다.
  board: boolean
  // 보이는 목록
  shown: TaskList[]
  onForbidden: () => void
}

// 보드의 빈 상태(첫 업무 추가)는 거르기 전 업무가 하나도 없을 때만이다(와이어프레임 OPS-TASK-01 tasks.length).
// 보기(내 업무 등)나 칩·부서로 좁혀 비었을 뿐이면 그 보기의 빈 문구다. 좁힌 목록이면 비었을 때만 거르지 않은 전체 목록을 더 읽어 가린다.
// 행사의 업무 탭은 그 행사의 업무가 전부다.
export function useBoardEmpty({
  councilId,
  eventId,
  view,
  narrowed,
  board,
  shown,
  onForbidden,
}: Args) {
  const shownEmpty = board && emptyOf(shown) === true
  const scoped = view !== 'all' || narrowed
  const probing = shownEmpty && scoped
  const allOpen = useTasks(
    councilId,
    { view: 'all', filter: 'open', eventId },
    onForbidden,
    probing,
  )
  const allDone = useTasks(
    councilId,
    { view: 'all', filter: 'done', eventId },
    onForbidden,
    probing,
  )
  if (!shownEmpty) return false
  return scoped ? emptyOf([allOpen, allDone]) : true
}
