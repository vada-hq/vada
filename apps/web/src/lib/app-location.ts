import { useSyncExternalStore } from 'react'
import { appPath, parentOf, parseAppPath, type AppLocation } from '@vada/contracts'
import {
  ADOPT_KEY,
  adoptDepth,
  adoptTag,
  afterWindowsClosed,
  releaseAdopted,
} from './use-window-history'

// 주소 층(기능 016). 화면의 위치는 브라우저 주소가 원문이고, 이 모듈이 주소를 읽고(useHere) 쌓고 바꿔 쓴다(navigate).
// 주소를 만들고 읽는 규칙은 contracts의 paths.ts 하나다. 라이브러리 없이 History API만 쓴다.
// 기록 상태에는 이 층의 키만 더하고 다른 키(창 기록의 vadaWindow)는 그대로 둔다.
const NAV_KEY = 'vadaNav'
const FROM_KEY = 'vadaFrom'
const RELEASED_KEY = 'vadaReleased'

export type Here = {
  // 경로와 쿼리. 읽는 쪽이 비교하려면 parseAppPath/appPath를 거친다.
  path: string
  // 칸마다 다른 표시. 같은 주소를 또 쌓아도 다른 칸이라, 닫았던 기록을 같은 알림으로 다시 열 수 있다.
  key: string
  // 학생회 안 주소로 읽은 값. 모르는 꼴이면 null이다.
  location: AppLocation | null
  // 기록 상세 창이 같은 페이지에 남으려고 칸을 상위 목록으로 바꿔 쓴 칸. 페이지를 새로 그리지 않는다.
  released: boolean
}

type Mode = 'push' | 'adopt' | 'replace'

function stateObject(): Record<string, unknown> {
  const state: unknown = window.history.state
  return typeof state === 'object' && state !== null && !Array.isArray(state)
    ? { ...(state as Record<string, unknown>) }
    : {}
}

function read(): Here {
  const key = stateObject()[NAV_KEY]
  const path = window.location.pathname + window.location.search
  return {
    path,
    key: typeof key === 'string' ? key : '',
    location: parseAppPath(path),
    released: stateObject()[RELEASED_KEY] === true,
  }
}

let snapshot = read()
const listeners = new Set<() => void>()

// 같은 칸이면 같은 객체를 돌려준다(useSyncExternalStore가 다시 그리지 않게).
function current() {
  const next = read()
  if (
    next.path !== snapshot.path ||
    next.key !== snapshot.key ||
    next.released !== snapshot.released
  )
    snapshot = next
  return snapshot
}

function notify() {
  current()
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  if (listeners.size === 0) window.addEventListener('popstate', notify)
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) window.removeEventListener('popstate', notify)
  }
}

export const useHere = () => useSyncExternalStore(subscribe, current)

const RADIX = 36
let counter = 0
// adopt는 그 기록의 상세 창만 칸을 가져가도록 기록의 표시(tag)를 단다. 바꿔 쓴 칸은 같은 기록이 아니면 표시를 지운다.
function stateFor(mode: Mode, tag?: string) {
  const state = stateObject()
  state[NAV_KEY] = `${Date.now().toString(RADIX)}.${(counter++).toString(RADIX)}`
  delete state[RELEASED_KEY]
  if (mode !== 'replace') {
    delete state[ADOPT_KEY]
    state[FROM_KEY] = window.location.pathname + window.location.search
  } else if (state[ADOPT_KEY] !== tag) delete state[ADOPT_KEY]
  if (mode === 'adopt') {
    state[ADOPT_KEY] = tag
    state['vadaWindow'] = adoptDepth(window.history.state)
  }
  return state
}

function write(path: string, mode: Mode, tag?: string) {
  if (mode === 'replace') window.history.replaceState(stateFor(mode, tag), '', path)
  else window.history.pushState(stateFor(mode, tag), '', path)
  notify()
}

const tagOf = (location: AppLocation | null) =>
  location?.type === 'record' ? adoptTag(location.record, location.recordId) : undefined

// 앱 안에서 한 칸 쌓거나(기본) 현재 칸의 주소를 바꿔 쓴다(replace). 알려진 학생회 안 주소는 읽기가 돌려주는 한 가지 꼴로 쓴다.
// 기록 주소는 상세 창이 그 칸을 자기 칸으로 쓰도록 표시해 쌓는다. 창이 열려 있으면 창의 칸을 먼저 거둔 뒤에 쌓는다.
export function navigate(target: string, options: { replace?: boolean } = {}) {
  const parsed = parseAppPath(target)
  const path = parsed ? appPath(parsed) : target
  const tag = tagOf(parsed)
  if (options.replace) {
    write(path, 'replace', tag)
    return
  }
  const mode: Mode = tag ? 'adopt' : 'push'
  afterWindowsClosed(() => write(path, mode, tag))
}

// 기록 상세 창이 닫히면서 같은 페이지에 남으려 할 때(다른 탭으로 가기, 기록을 잃음) 부른다. 뒤로 가기는 주소를 떠나
// 페이지가 새로 그려지므로, 이어받은 칸을 상위 목록 주소로 바꿔 쓰고 페이지는 그대로 둔다. 이어받은 창이 아니면 아무것도 하지 않는다.
export function releaseRecord() {
  const location = parseAppPath(window.location.pathname + window.location.search)
  if (location?.type !== 'record' || !releaseAdopted()) return
  const state = stateObject()
  delete state[ADOPT_KEY]
  state[RELEASED_KEY] = true
  window.history.replaceState(state, '', appPath(parentOf(location)))
  notify()
}

// 화면 안의 뒤로·닫기: 앱 안에서 쌓은 칸이면 한 칸 뒤로(들어온 곳으로), 아니면(링크로 바로 들어옴) 상위 목록으로 바꿔 쓴다.
export function leave(fallback: string) {
  if (typeof stateObject()[FROM_KEY] === 'string') window.history.back()
  else navigate(fallback, { replace: true })
}

// 기록 주소로 바로 들어오면(링크, 알림, 새로 고침) 그 아래에 상위 목록 칸을 깔아, 어느 뒤로든 상위 목록으로 가게 한다.
// 이미 이 층이 쌓은 칸(새로 고침한 칸 포함)이면 하지 않는다.
export function layerDirectRecord() {
  const here = current()
  if (here.location?.type !== 'record' || here.key !== '') return
  window.history.replaceState(stateFor('replace'), '', appPath(parentOf(here.location)))
  write(appPath(here.location), 'adopt', tagOf(here.location))
}
