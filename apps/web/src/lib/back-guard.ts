import { askLeave, hasUnsavedInput } from './leave-guard'

// 기기·브라우저 뒤로(앞으로)는 막을 수 없다. 저장하지 않은 입력이 있으면 한 칸 되돌려 놓고 묻는다(DEC-78 이동 10).
// 주소 칸마다 순번을 기록 상태에 달아(INDEX_KEY) 몇 칸을 건넜는지 알고, 창이 쓴 기록 칸(013)은 주소와 순번이 같아 건드리지 않는다.
// popstate 처리기는 다른 처리기(주소 읽기, 창 기록)보다 먼저 서야 해서 이 모듈을 읽을 때 건다. 막으면 다른 처리기는 이 이동을 모른다.
export const INDEX_KEY = 'vadaIdx'

export function indexOf(state: unknown) {
  if (typeof state !== 'object' || state === null) return 0
  const index = (state as Record<string, unknown>)[INDEX_KEY]
  return typeof index === 'number' ? index : 0
}

let known = typeof window === 'undefined' ? 0 : indexOf(window.history.state)
// 되돌리는 이동이 끝나면 할 일(확인 창 열기). 그 전에 창을 열면 창이 쌓는 기록 칸이 이동과 꼬인다.
let afterUndo: (() => void) | null = null

// 우리가 기록을 쌓거나 바꿔 쓴 뒤 지금 칸의 순번을 알린다.
export const noteIndex = (state: unknown) => {
  known = indexOf(state)
}

function onPop(event: PopStateEvent) {
  if (afterUndo) {
    const next = afterUndo
    afterUndo = null
    event.stopImmediatePropagation()
    next()
    return
  }
  const index = indexOf(window.history.state)
  const steps = index - known
  if (steps === 0 || !hasUnsavedInput()) {
    known = index
    return
  }
  event.stopImmediatePropagation()
  afterUndo = () => askLeave(() => window.history.go(steps))
  window.history.go(-steps)
}

if (typeof window !== 'undefined') window.addEventListener('popstate', onPop)
