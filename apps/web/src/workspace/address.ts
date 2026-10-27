import {
  appPath,
  EVENT_TABS,
  menuPath,
  movedLocationOf,
  parentOf,
  parseAppPath,
  type AppLocation,
  type AppMenu,
  type EventTab,
  type MyCouncil,
  type RecordKind,
} from '@vada/contracts'
import type { Here } from '@/lib/app-location'
import { LIVE_MOVES } from './live-moves'

// 주소가 가리키는 작업 공간의 자리. 화면은 서버가 준 내 학생회 목록에 있는 학생회만 연다(학생회 격리).
export type Target =
  | {
      kind: 'ready'
      councilId: string
      page: AppMenu
      // 기록 주소로 열었으면 그 기록. 지정한 페이지가 이 기록을 한 번 연다.
      record: { kind: RecordKind; id: string; tab: EventTab | undefined } | null
    }
  // 모르는 학생회, 모르는 주소: 있는지 없는지를 가르지 않는 '찾을 수 없음'. fallback은 상위 목록(첫 학생회 홈)이다.
  | { kind: 'notFound'; fallback: string }
  // 옮겨 간 옛 주소(메뉴 v7). 부르는 쪽이 to로 바꿔 쓰고(replace) 그 주소로 다시 연다.
  | { kind: 'moved'; to: string }

// 아직 그리지 않은 새 메뉴는 지금 그 일을 그리는 메뉴가 그린다. 그 메뉴의 옮기기를 켜면(LIVE_MOVES) 새 메뉴가 그린다.
const UNTIL_DRAWN = { purchases: 'finance', calendar: 'tasks' } as const satisfies Partial<
  Record<AppMenu, AppMenu>
>
const isUndrawn = (menu: AppMenu): menu is keyof typeof UNTIL_DRAWN =>
  menu in UNTIL_DRAWN && !LIVE_MOVES.some(move => move === menu)
export const drawnMenu = (menu: AppMenu): AppMenu => (isUndrawn(menu) ? UNTIL_DRAWN[menu] : menu)

// 그리지 않은 새 메뉴의 주소 → 지금 그 일을 그리는 곳(구매 → 재정 구매 요청 탭, 캘린더 → 업무 달력).
function untilDrawn(location: AppLocation): AppLocation | null {
  if (location.type !== 'menu' || !isUndrawn(location.menu)) return null
  const { compose, view } = location.query
  const query =
    location.menu === 'calendar'
      ? { layout: 'calendar' }
      : compose === 'new'
        ? { compose }
        : { tab: 'requests', ...(view === undefined ? {} : { view }) }
  return { ...location, menu: drawnMenu(location.menu), query }
}

// 바꿔 쓸 주소: 옮겨 간 옛 주소면 새 자리, 그리지 않은 새 메뉴면 지금 자리, 아니면 null.
// department는 내 첫 부서다(옛 '내 부서' 보기 → 부서 칩).
export function movedPathOf(location: AppLocation | null, department: string | null = null) {
  if (!location) return null
  const moved = movedLocationOf(location, { moves: LIVE_MOVES, department }) ?? untilDrawn(location)
  return moved && appPath(moved)
}

export const firstDepartmentOf = (councils: MyCouncil[], councilId: string) =>
  councils.find(council => council.id === councilId)?.departments[0]?.id ?? null

const isEventTab = (value: string | undefined): value is EventTab =>
  EVENT_TABS.some(tab => tab === value)

const locationOf = (here: Here, start: string | null | undefined) =>
  here.location ?? (here.path === '/' && start ? parseAppPath(start) : null)

// '/'로 열리면 start(마지막에 본 주소)가 있으면 그곳, 없으면 첫 학생회 홈이다. start가 내 학생회의 것인지는 부르는 쪽이 가린다.
export function targetOf(here: Here, councils: MyCouncil[], start?: string | null): Target {
  const first = councils[0]
  if (!first) return { kind: 'notFound', fallback: '/' }
  const fallback = menuPath('home', first.id)
  const location = locationOf(here, start)
  if (!location) {
    return here.path === '/'
      ? { kind: 'ready', councilId: first.id, page: 'home', record: null }
      : { kind: 'notFound', fallback }
  }
  if (!councils.some(council => council.id === location.councilId))
    return { kind: 'notFound', fallback }
  const to = movedPathOf(location, firstDepartmentOf(councils, location.councilId))
  if (to !== null) return { kind: 'moved', to }
  if (location.type === 'menu')
    return { kind: 'ready', councilId: location.councilId, page: location.menu, record: null }
  const tab = location.query['tab']
  const up = parentOf(location)
  return {
    kind: 'ready',
    councilId: location.councilId,
    page: up.type === 'menu' ? drawnMenu(up.menu) : 'home',
    record: {
      kind: location.record,
      id: location.recordId,
      tab: isEventTab(tab) ? tab : undefined,
    },
  }
}
