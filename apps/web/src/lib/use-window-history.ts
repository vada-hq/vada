import { useEffect } from 'react'
import { useLatest } from './use-latest'

// 창과 옆 메뉴가 방문 기록 한 칸을 쓰게 해서, 뒤로 가기가 앱을 떠나지 않고 맨 위 창부터 닫게 한다(DEC-78 이동 4).
// 상태 객체에는 KEY 하나만 더하고 다른 키는 그대로 둔다. 기능 016이 같은 기록에 주소 상태를 얹는다.
const KEY = 'vadaWindow'
// 주소 층이 기록 주소로 쌓은 칸의 표시. 그 칸에서 처음 열리는 창은 칸을 또 쌓지 않고 이 칸을 자기 칸으로 쓴다
// (기록 상세 창이 주소 한 칸과 창 한 칸을 둘 다 쌓아 뒤로를 두 번 눌러야 닫히는 것을 막는다). 새로 고침으로 되살린 창도 같은 칸을 쓴다.
export const ADOPT_KEY = 'vadaAdopt'
// 주소 칸에 매기는 창 깊이: 이 칸을 자기 칸으로 쓰는 창이 base + 1이 되게, 지금 칸보다 하나 깊다.
export const adoptDepth = (state: unknown) => depthOf(state) + 1

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
// 창이 모두 닫힌 뒤에 할 일(주소 이동).
let waiting: (() => void)[] = []

function depthOf(state: unknown): number {
  if (typeof state !== 'object' || state === null) return 0
  const depth = (state as Record<string, unknown>)[KEY]
  return typeof depth === 'number' ? depth : 0
}

function isAdoptable(state: unknown) {
  return typeof state === 'object' && state !== null && ADOPT_KEY in state
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
  if (have === 0) {
    const state: unknown = window.history.state
    const adopt = stack.length > 0 && isAdoptable(state)
    base = depthOf(state) - (adopt ? 1 : 0)
    if (adopt) have = 1
  }
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
    if (expectedPops === 0) runWaiting()
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

function runWaiting() {
  const tasks = waiting
  waiting = []
  for (const task of tasks) task()
}

// 열려 있는 창의 칸을 모두 거둔 뒤에 주소 이동을 한다. 창이 열린 채 주소를 쌓으면 창이 닫힐 때의 되돌리기가 새 주소까지 되돌린다.
// 거둘 창이 없고 되돌리는 중도 아니면 바로 한다. 그 뒤에도 열려 있는 창은 새 주소 위에 칸을 다시 쌓는다.
export function afterWindowsClosed(task: () => void) {
  if (have === 0 && expectedPops === 0) {
    task()
    return
  }
  waiting.push(task)
  if (have > 0) {
    const extra = have
    have = 0
    expectedPops += 1
    window.history.go(-extra)
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
