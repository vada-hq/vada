import {
  EVENT_TABS,
  appPath,
  menuPath,
  parentOf,
  recordPath,
  type AppMenu,
  type EventTab,
  type MyCouncil,
  type RecordKind,
} from '@vada/contracts'
import type { Here } from '@/lib/app-location'

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

const isEventTab = (value: string | undefined): value is EventTab =>
  EVENT_TABS.some(tab => tab === value)

// '/'로 열리면 첫 학생회 홈이다(마지막에 본 곳으로 돌아오는 것은 로그인 복귀 조각).
export function targetOf(here: Here, councils: MyCouncil[]): Target {
  const first = councils[0]
  if (!first) return { kind: 'notFound', fallback: '/' }
  const fallback = menuPath('home', first.id)
  const { location } = here
  if (!location) {
    return here.path === '/'
      ? { kind: 'ready', councilId: first.id, page: 'home', record: null }
      : { kind: 'notFound', fallback }
  }
  if (!councils.some(council => council.id === location.councilId))
    return { kind: 'notFound', fallback }
  if (location.type === 'menu')
    return { kind: 'ready', councilId: location.councilId, page: location.menu, record: null }
  const tab = location.query['tab']
  const up = parentOf(location)
  return {
    kind: 'ready',
    councilId: location.councilId,
    page: up.type === 'menu' ? up.menu : 'home',
    record: {
      kind: location.record,
      id: location.recordId,
      tab: isEventTab(tab) ? tab : undefined,
    },
  }
}

// 기록 하나로 가는 주소. 행사는 탭이 기본(개요)이 아니면 쿼리에 둔다.
export const recordTarget = (kind: RecordKind, councilId: string, id: string, tab?: EventTab) =>
  tab
    ? appPath({ type: 'record', record: kind, councilId, recordId: id, query: { tab } })
    : recordPath(kind, councilId, id)
