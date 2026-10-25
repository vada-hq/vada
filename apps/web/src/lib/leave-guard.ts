import { useLayoutEffect, useRef, useSyncExternalStore } from 'react'
import { afterWindowsClosed } from './use-window-history'

// 떠날 때 확인(DEC-78 이동 10). 화면이 저장하지 않은 입력이 있다고 이 층에 알리면(useUnsavedInput),
// 앱 안 이동(메뉴, 탭, 화면 안 뒤로)은 확인 창을 먼저 보이고(askLeave), 기기 뒤로(back-guard.ts)는 한 칸 되돌려 놓고 묻는다.
// 새로 고침·닫기는 입력이 있는 동안만 beforeunload로 브라우저의 확인을 건다.
const holders = new Set<symbol>()

function warnBeforeUnload(event: BeforeUnloadEvent) {
  event.preventDefault()
}

// 입력이 있는 동안에만 건다. 늘 걸어 두면 일부 브라우저는 뒤로 가기·앞으로 가기 때 페이지를 되살리는 캐시(bfcache)를 못 쓴다(MDN beforeunload).
function register(holder: symbol) {
  holders.add(holder)
  if (holders.size === 1) window.addEventListener('beforeunload', warnBeforeUnload)
}

function unregister(holder: symbol) {
  if (!holders.delete(holder)) return
  if (holders.size === 0) window.removeEventListener('beforeunload', warnBeforeUnload)
}

// 화면이 쓰던 입력이 남았는지 알린다. 저장하거나 지우면 false로, 화면이 사라져도 알아서 풀린다.
// 돌려주는 함수는 저장이 끝난 순간 바로 푼다. 저장 직후 같은 틱에 이어서 하는 이동(만든 기록 열기)이 확인에 막히지 않게 한다.
// 걸고 푸는 것은 화면을 그리는 때(layout effect)에 한다. useEffect는 저장 응답처럼 이벤트 밖의 갱신에서 그린 뒤 따로 돌아,
// 부하가 크면 '저장했어요.'가 보이는 사이에 누른 이동·beforeunload가 옛 지킴에 막혔다(App.leave 시험이 CI에서만 흔들림).
export function useUnsavedInput(dirty: boolean) {
  const holder = useRef(Symbol('unsaved-input'))
  useLayoutEffect(() => {
    if (!dirty) return
    const mine = holder.current
    register(mine)
    return () => unregister(mine)
  }, [dirty])
  return () => unregister(holder.current)
}

export const hasUnsavedInput = () => holders.size > 0

type Pending = { proceed: () => void }
let pending: Pending | null = null
const listeners = new Set<() => void>()
const notify = () => {
  for (const listener of listeners) listener()
}

// 이동을 하려 한다. 저장하지 않은 입력이 없으면 바로 하고, 있으면 확인 창을 띄워 '나가기'를 고른 뒤에 한다.
export function askLeave(proceed: () => void) {
  if (!hasUnsavedInput()) {
    proceed()
    return
  }
  pending = { proceed }
  notify()
}

// 나가기: 입력을 버리기로 했으니 지킴을 풀고, 확인 창의 기록 칸을 먼저 거둔 뒤 이동한다(창이 열린 채 주소를 쌓으면 뒤로가 두 번 걸린다).
export function confirmLeave() {
  const current = pending
  pending = null
  for (const holder of holders) unregister(holder)
  notify()
  if (current) afterWindowsClosed(current.proceed)
}

// 계속 쓰기: 그대로 둔다.
export function stayHere() {
  pending = null
  notify()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export const useLeaveRequest = () =>
  useSyncExternalStore(
    subscribe,
    () => pending,
    () => null,
  )

// 시험용: 앞 시험이 남긴 입력과 확인 요청을 비운다.
export function resetLeaveGuard() {
  for (const holder of holders) unregister(holder)
  pending = null
  notify()
}
