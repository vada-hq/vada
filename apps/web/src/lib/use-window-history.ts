import { useEffect } from 'react'
import { useLatest } from './use-latest'

// 창과 옆 메뉴가 방문 기록 한 칸을 쓰게 해서, 뒤로 가기가 앱을 떠나지 않고 맨 위 창부터 닫게 한다(DEC-78 이동 4).
// 상태 객체에는 KEY 하나만 더하고 다른 키는 그대로 둔다. 기능 016이 같은 기록에 주소 상태를 얹는다.
const KEY = 'vadaWindow'
// 주소 층이 기록 주소로 쌓은 칸의 표시. 그 칸에서 처음 열리는 창은 칸을 또 쌓지 않고 이 칸을 자기 칸으로 쓴다
// (기록 상세 창이 주소 한 칸과 창 한 칸을 둘 다 쌓아 뒤로를 두 번 눌러야 닫히는 것을 막는다). 새로 고침으로 되살린 창도 같은 칸을 쓴다.
export const ADOPT_KEY = 'vadaAdopt'
// 이어받기 표시의 값: 그 기록의 상세 창만 칸을 가져가도록 종류와 id를 적는다.
export const adoptTag = (kind: string, id: string) => `${kind}/${id.toLowerCase()}`
// 주소 칸에 매기는 창 깊이: 이 칸을 자기 칸으로 쓰는 창이 base + 1이 되게, 지금 칸보다 하나 깊다.
export const adoptDepth = (state: unknown) => depthOf(state) + 1

type Entry = { back: () => void; mounted: boolean; adopts: string | undefined }

// 열려 있는 창, 위가 맨 위 창이다.
const stack: Entry[] = []
// 우리가 더한 기록 칸 수(have)와 그 아래 칸의 깊이(base). 새로 고침 뒤에는 이전 문서가 남긴 칸이 base로 잡힌다.
let have = 0
let base = 0
// 주소 칸을 이어받은 창. 이 창이 칸을 쓰는 동안만 있다.
let adopter: Entry | null = null
// history.go가 일으키는 popstate는 사용자의 뒤로 가기가 아니다.
let expectedPops = 0
let scheduled = false
let listening = false
// 창이 모두 닫힌 뒤에 할 일(주소 이동).
let waiting: (() => void)[] = []
// 기록 이동이 모두 끝나길 기다리는 쪽(시험).
let idleWaiters: (() => void)[] = []

function depthOf(state: unknown): number {
  if (typeof state !== 'object' || state === null) return 0
  const depth = (state as Record<string, unknown>)[KEY]
  return typeof depth === 'number' ? depth : 0
}

// 칸의 이어받기 표시가 맨 아래 창이 말한 기록과 같을 때만 그 창이 칸을 가져간다.
function isAdoptableBy(state: unknown, entry: Entry | undefined) {
  if (!entry?.adopts || typeof state !== 'object' || state === null) return false
  return (state as Record<string, unknown>)[ADOPT_KEY] === entry.adopts
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
    const adopt = isAdoptableBy(state, stack[0])
    base = depthOf(state) - (adopt ? 1 : 0)
    adopter = adopt ? (stack[0] ?? null) : null
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
  flushIdle()
}

function flushIdle() {
  if (expectedPops > 0 || scheduled) return
  const waiters = idleWaiters
  idleWaiters = []
  for (const resolve of waiters) resolve()
}

function schedule() {
  if (scheduled) return
  scheduled = true
  queueMicrotask(sync)
}

// 보내는 중이거나 입력을 물어 창이 닫지 않은 채 남으면, 뒤로 가기로 쓴 칸을 다시 채운다.
// 묻는 확인 창이 그사이 맨 위에 섰으므로 창은 원래 자리로 돌아간다. 맨 위에 두면 다음 뒤로가 확인 창을 닫지 못한다.
function closeEntry(entry: Entry) {
  const place = stack.length
  entry.back()
  setTimeout(() => {
    if (entry.mounted) stack.splice(place, 0, entry)
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

// 이 문서를 떠나기 전에 창 칸을 모두 거둔다. 새로 고침 전 문서가 쌓은 칸은 이 문서의 수(have)에 없어 afterWindowsClosed가 남긴다.
// 지금 칸의 깊이가 곧 그 칸 수다. 그대로 떠나면 칸이 남아 뒤로가 지운 화면으로 돌아온다. 쓰던 칸이 없으면 바로 한다.
export function afterAllWindowEntries(task: () => void) {
  afterWindowsClosed(() => {
    const left = depthOf(window.history.state)
    if (left === 0) {
      task()
      return
    }
    waiting.push(task)
    expectedPops += 1
    window.history.go(-left)
  })
}

// 이어받은 칸을 창에서 떼어 평범한 앱 칸으로 둔다. 창을 닫으면서 같은 페이지에 남으려는 동작(다른 탭으로, 잃음)이
// 뒤로 가기(go(-1))로 주소를 떠나지 않게, 칸의 주소를 바꿔 쓰기 직전에 부른다. 이어받은 창이 없으면 false다.
export function releaseAdopted() {
  if (!adopter || have === 0) return false
  const index = stack.indexOf(adopter)
  if (index >= 0) stack.splice(index, 1)
  adopter = null
  base += 1
  have -= 1
  return true
}

// 창이 거두는 기록 이동(history.go)이 진행 중인가. 그 popstate는 사용자의 뒤로가 아니라서 떠날 때 확인(back-guard)이 막으면 안 된다.
export const isPopExpected = () => expectedPops > 0

// 시험용: 창이 거두는 기록 이동(history.go)이 모두 끝나면 풀린다. 시간을 재지 않고 끝난 일을 기다린다.
export function windowHistoryIdle() {
  return new Promise<void>(resolve => {
    idleWaiters.push(resolve)
    queueMicrotask(flushIdle)
  })
}

// 시험용: 앞 시험이 남긴 모듈 상태를 비운다.
export function resetWindowHistory() {
  stack.length = 0
  have = 0
  base = 0
  adopter = null
  expectedPops = 0
  scheduled = false
  waiting = []
  flushIdle()
}

// 열려 있는 동안 기록 한 칸을 쓴다. back은 뒤로 가기가 이 창을 닫으라고 할 때 불린다.
// adopts는 기록 상세 창이 자기 기록(adoptTag)을 말하는 것으로, 주소 칸이 그 기록의 것일 때만 칸을 이어받는다.
export function useWindowHistory(back: () => void, adopts?: string) {
  const latest = useLatest(back)
  useEffect(() => {
    const entry: Entry = { back: () => latest.current(), mounted: true, adopts }
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
  }, [latest, adopts])
}
