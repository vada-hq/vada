import { useSyncExternalStore } from 'react'
import { appPath, parentOf, parseAppPath, type AppLocation } from '@vada/contracts'
import {
  ADOPT_KEY,
  adoptDepth,
  adoptTag,
  afterWindowsClosed,
  releaseAdopted,
} from './use-window-history'
import { INDEX_KEY, indexOf, noteIndex } from './back-guard'
import { askLeave, stayHere } from './leave-guard'
import { recalledQuery } from './menu-memory'

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
  // 몇 칸을 건넜는지 알 수 있게 순번을 단다(기기 뒤로의 떠날 때 확인, back-guard.ts).
  state[INDEX_KEY] = indexOf(window.history.state) + (mode === 'replace' ? 0 : 1)
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
  noteIndex(window.history.state)
  notify()
}

const tagOf = (location: AppLocation | null) =>
  location?.type === 'record' ? adoptTag(location.record, location.recordId) : undefined

type GoOptions = { replace?: boolean; overRecord?: boolean | undefined }

function go(target: string, options: GoOptions) {
  const parsed = parseAppPath(target)
  const path = parsed ? appPath(parsed) : target
  const tag = tagOf(parsed)
  if (options.replace) {
    write(path, 'replace', tag)
    return
  }
  // 기록 상세 위에 쌓는 이동은 그 칸을 창에서 떼어 두고 쌓아, 뒤로가 그 기록 상세로 돌아오게 한다.
  if (options.overRecord) releaseAdopted()
  const mode: Mode = tag ? 'adopt' : 'push'
  afterWindowsClosed(() => write(path, mode, tag))
}

// 앱 안에서 한 칸 쌓거나(기본) 현재 칸의 주소를 바꿔 쓴다(replace). 알려진 학생회 안 주소는 읽기가 돌려주는 한 가지 꼴로 쓴다.
// 기록 주소는 상세 창이 그 칸을 자기 칸으로 쓰도록 표시해 쌓는다. 창이 열려 있으면 창의 칸을 먼저 거둔 뒤에 쌓는다.
// 저장하지 않은 입력이 있으면 확인 창을 먼저 보인다. 소속을 잃어 떠나야 하는 이동은 force로 묻지 않는다.
// 기록 상세 창에서 다른 기록으로 가는 이동은 overRecord다(창을 닫지 않고 그 기록 칸 위에 쌓는다).
export function navigate(target: string, options: GoOptions & { force?: boolean } = {}) {
  if (options.force) {
    // 떠 있던 확인은 옛 이동을 가리키므로 버린다. 남겨 두면 다음 작업 공간이 그 확인을 띄운다.
    stayHere()
    go(target, options)
  } else askLeave(() => go(target, options))
}

// 주소의 모양만 고쳐 쓴다(모르는 값을 기본값으로 읽은 주소). 사용자의 이동이 아니라서 떠날 때 확인을 거치지 않는다.
export const rewriteAddress = (target: string) => go(target, { replace: true })

// 기록 상세 창이 닫히면서 같은 페이지에 남으려 할 때(다른 탭으로 가기, 기록을 잃음) 부른다. 뒤로 가기는 주소를 떠나
// 페이지가 새로 그려지므로, 이어받은 칸을 상위 목록 주소로 바꿔 쓰고 페이지는 그대로 둔다. 이어받은 창이 아니면 아무것도 하지 않는다.
export function releaseRecord() {
  const location = parseAppPath(window.location.pathname + window.location.search)
  if (location?.type !== 'record' || !releaseAdopted()) return
  const state = stateObject()
  delete state[ADOPT_KEY]
  state[RELEASED_KEY] = true
  const parent = parentOf(location)
  // 상위 목록은 상세를 열기 전에 보던 보기로 돌아간다(탭이 정해진 종류는 그 탭이 먼저다).
  const seen = parent.type === 'menu' ? recalledQuery(parent.menu, parent.councilId) : undefined
  const query = seen ? { ...seen, ...parent.query } : parent.query
  window.history.replaceState(state, '', appPath({ ...parent, query }))
  notify()
}

// 화면 안의 뒤로·닫기: 앱 안에서 쌓은 칸이면 한 칸 뒤로(들어온 곳으로), 아니면(링크로 바로 들어옴) 상위 목록으로 바꿔 쓴다.
export function leave(fallback: string) {
  askLeave(() => {
    if (typeof stateObject()[FROM_KEY] === 'string') window.history.back()
    else go(fallback, { replace: true })
  })
}

// 기록 주소 칸 아래에 상위 목록 칸을 깔고 그 위에 기록 칸을 이어받기로 쌓는다.
function layerRecord(location: Extract<AppLocation, { type: 'record' }>) {
  window.history.replaceState(stateFor('replace'), '', appPath(parentOf(location)))
  write(appPath(location), 'adopt', tagOf(location))
}

// 기록 주소로 바로 들어오면(링크, 알림, 새로 고침) 그 아래에 상위 목록 칸을 깔아, 어느 뒤로든 상위 목록으로 가게 한다.
// 이미 이 층이 쌓은 칸(새로 고침한 칸 포함)이면 하지 않는다.
export function layerDirectRecord() {
  const here = current()
  if (here.location?.type !== 'record' || here.key !== '') return
  layerRecord(here.location)
}

// '/'로 열린 시작을 start로 바꿔 쓴다. 기록 주소면 바로 들어온 기록과 같게 목록 칸을 깐다.
export function startAt(start: string) {
  const parsed = parseAppPath(start)
  if (parsed?.type === 'record') layerRecord(parsed)
  else write(parsed ? appPath(parsed) : start, 'replace')
}
