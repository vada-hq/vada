import { useEffect } from 'react'
import { useLatest } from './use-latest'

// 창과 옆 메뉴가 방문 기록 한 칸을 쓰게 해서, 뒤로 가기가 앱을 떠나지 않고 맨 위 창부터 닫게 한다(DEC-78 이동 4).
// 상태 객체에는 KEY 하나만 더하고 다른 키는 그대로 둔다. 기능 016이 같은 기록에 주소 상태를 얹는다.
const KEY = 'vadaWindow'

type Entry = { back: () => void; mounted: boolean }

// 열려 있는 창, 위가 맨 위 창이다.
const stack: Entry[] = []
// 우리가 더한 기록 칸 수(have)와 그 아래 칸의 깊이(base). 새로 고침 뒤에는 이전 문서가 남긴 칸이 base로 잡힌다.
let have = 0
let base = 0
// history.go가 일으키는 popstate는 사용자의 뒤로 가기가 아니다.
let expectedPops = 0
let scheduled = false
let listening = false

function depthOf(state: unknown): number {
  if (typeof state !== 'object' || state === null) return 0
  const depth = (state as Record<string, unknown>)[KEY]
  return typeof depth === 'number' ? depth : 0
}

function baseState(): Record<string, unknown> {
  const state: unknown = window.history.state
  return typeof state === 'object' && state !== null && !Array.isArray(state)
    ? { ...(state as Record<string, unknown>) }
    : {}
}

// 창 수와 기록 칸 수를 맞춘다. 개발 모드의 effect 두 번 실행처럼 같은 틱 안의 열고 닫음은 한 번에 모아 칸을 만들지도 거두지도 않게 한다.
function sync() {
  scheduled = false
  // 거두는 이동이 끝나기 전에 칸을 더하면 순서가 꼬인다. 그 popstate가 다시 맞춘다.
  if (expectedPops > 0) return
  if (have === 0) base = depthOf(window.history.state)
  while (have < stack.length) {
    have += 1
    window.history.pushState({ ...baseState(), [KEY]: base + have }, '')
  }
  if (have > stack.length) {
    const extra = have - stack.length
    have = stack.length
    expectedPops += 1
    window.history.go(-extra)
  }
}

function schedule() {
  if (scheduled) return
  scheduled = true
  queueMicrotask(sync)
}

// 보내는 중이라 창이 닫지 않은 채 남으면, 뒤로 가기로 쓴 칸을 다시 채운다.
function closeEntry(entry: Entry) {
  entry.back()
  setTimeout(() => {
    if (entry.mounted) stack.push(entry)
    schedule()
  }, 0)
}

function onPop(event: PopStateEvent) {
  if (expectedPops > 0) {
    expectedPops -= 1
    schedule()
    return
  }
  const target = Math.max(depthOf(event.state) - base, 0)
  // 앞으로 가기는 창과 상관없다.
  if (target >= have) return
  while (have > target) {
    have -= 1
    const entry = stack.pop()
    if (entry) closeEntry(entry)
  }
}

// 열려 있는 동안 기록 한 칸을 쓴다. back은 뒤로 가기가 이 창을 닫으라고 할 때 불린다.
export function useWindowHistory(back: () => void) {
  const latest = useLatest(back)
  useEffect(() => {
    const entry: Entry = { back: () => latest.current(), mounted: true }
    if (!listening) {
      listening = true
      window.addEventListener('popstate', onPop)
    }
    stack.push(entry)
    schedule()
    return () => {
      entry.mounted = false
      const index = stack.indexOf(entry)
      if (index >= 0) stack.splice(index, 1)
      schedule()
    }
  }, [latest])
}
