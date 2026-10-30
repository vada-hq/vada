import { useLayoutEffect, useState, useSyncExternalStore } from 'react'
import { afterWindowsClosed } from './use-window-history'

// 떠날 때 확인(DEC-78 이동 10). 화면이 저장하지 않은 입력이 있다고 이 층에 알리면(useUnsavedInput),
// 앱 안 이동(메뉴, 탭, 화면 안 뒤로)은 확인 창을 먼저 보이고(askLeave), 기기 뒤로(back-guard.ts)는 한 칸 되돌려 놓고 묻는다.
// 새로 고침·닫기는 입력이 있는 동안만 beforeunload로 브라우저의 확인을 건다.
// 입력 창은 닫는 길을 모두 useWindowLeave의 close로 모은다. 기기 뒤로도 창의 기록 칸을 지나 그 길로 온다.
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
// holder는 입력 창이 useWindowLeave에서 받은 표시다. 창을 닫을 때 그 창의 입력만 보려고 준다.
export function useUnsavedInput(dirty: boolean, holder?: symbol) {
  const [own] = useState(() => Symbol('unsaved-input'))
  const mine = holder ?? own
  useLayoutEffect(() => {
    if (!dirty) return
    register(mine)
    return () => unregister(mine)
  }, [dirty, mine])
  return () => unregister(mine)
}

export const hasUnsavedInput = () => holders.size > 0

// holder가 있으면 창 하나만 닫는 요청이다(useWindowLeave).
type Pending = { proceed: () => void; holder?: symbol }
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

// 입력 창의 닫기. Esc, ×, [닫기], 바깥 누름, 기기 뒤로가 모두 부르게 onOpenChange와 닫기 버튼에 close를 준다
// (뒤로는 창의 기록 칸이라 주소와 순번이 같아 back-guard가 지나치고, 창의 보이지 않는 Close를 눌러 이리로 온다).
// 그 창의 입력이 없으면 바로 닫는다. 뒤 화면에 입력이 있어도 창을 닫을 뿐이라 묻지 않고, 나가기를 골라도 뒤 화면의 지킴은 남는다.
// 입력은 useUnsavedInput(dirty, holder)로 알린다. 창의 겉과 입력을 가진 폼이 다른 부품이어도 holder만 넘기면 된다.
export function useWindowLeave(onClose: () => void) {
  const [holder] = useState(() => Symbol('window-input'))
  const close = () => {
    if (!holders.has(holder)) {
      onClose()
      return
    }
    pending = { proceed: onClose, holder }
    notify()
  }
  return { holder, close }
}

// 나가기: 입력을 버리기로 했으니 지킴을 풀고, 확인 창의 기록 칸을 먼저 거둔 뒤 이동한다(창이 열린 채 주소를 쌓으면 뒤로가 두 번 걸린다).
// 창 하나만 닫는 요청이면 그 창의 입력만 풀고 닫는다. 칸은 창이 사라지며 스스로 거둔다(전부 거두면 기록 상세 창의 주소 칸까지 되돌린다).
export function confirmLeave() {
  const current = pending
  pending = null
  if (current?.holder) {
    unregister(current.holder)
    notify()
    current.proceed()
    return
  }
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
