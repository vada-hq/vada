import { appPath, parseAppPath, type AppLocation, type AppMenu, type AppQuery } from './paths.js'

// 메뉴 v7로 옮겨 간 옛 주소의 새 자리(notes 메뉴 v7 설계 2.2). 옛 주소는 parseAppPath가 계속 읽고 화면이 새 자리로
// 바꿔 쓴다(replace). 북마크·기기에 남은 마지막 주소·홈 화면 앱 시작 주소가 옛 꼴이어도 열리고, 뒤로가 옛 주소로 가지 않는다.
// 옮기기는 새 자리를 그리는 조각이 켠다(chat S5, tasks S4, calendar S7, purchases S1, ledger S6a, settings S6b).
// 기록 주소(/chat|tasks|purchases|expenses|incomes|events/<c>/<id>)는 옮기지 않는다. 이미 보낸 알림이 그 꼴이다.
// 행사 방의 대화 기록 주소 → 행사 메시지 탭은 방 요약(eventId)이 있어야 가려 대화 화면이 맡는다(S5).
const ADDRESS_MOVES = ['chat', 'tasks', 'calendar', 'purchases', 'ledger', 'settings'] as const
export type AddressMove = (typeof ADDRESS_MOVES)[number]

type MenuLocation = Extract<AppLocation, { type: 'menu' }>
// 내 부서: 옛 '내 부서' 보기가 부서 칩으로 옮겨 갈 때 쓴다. 부서가 둘이면 첫 부서다(028 정한 것 10).
type Context = { department: string | null }
type Step = (location: MenuLocation, context: Context) => MenuLocation | null

const at = (from: MenuLocation, menu: AppMenu, query: AppQuery): MenuLocation => ({
  type: 'menu',
  menu,
  councilId: from.councilId,
  query,
})

const without = (query: AppQuery, keys: string[]) =>
  Object.fromEntries(Object.entries(query).filter(([key]) => !keys.includes(key)))

// 옛 보기 넷 → 탭 둘과 칩(설계 3.1). 전체·담당자 없음 보기는 행사 업무도 보였으므로 '행사 업무 포함'을 붙인다.
function taskTabQuery(view: string, rest: AppQuery, department: string | null): AppQuery {
  if (view === 'mine') return { ...rest, tab: 'mine' }
  if (view === 'department') {
    const dept = department ?? rest['dept']
    return dept === undefined ? { ...rest, tab: 'council' } : { ...rest, tab: 'council', dept }
  }
  const all = { ...rest, tab: 'council', events: 'include' }
  return view === 'unassigned' ? { ...all, assignee: 'none' } : all
}

// 우리 학생회의 메시지 탭(기본) → 메시지 메뉴.
const chatMove: Step = location =>
  location.menu === 'council' && location.query['tab'] === undefined
    ? at(location, 'chat', {})
    : null

// 우리 학생회 업무 탭 → 업무 > 학생회 업무(같은 목록이라 행사 업무 포함), 업무 메뉴의 옛 보기 → 탭과 칩.
const tasksMove: Step = (location, { department }) => {
  if (location.menu === 'council' && location.query['tab'] === 'tasks') {
    const query = taskTabQuery(
      location.query['view'] ?? 'all',
      without(location.query, ['tab', 'view']),
      department,
    )
    return at(
      location,
      'tasks',
      query['tab'] === 'council' ? { ...query, events: 'include' } : query,
    )
  }
  const view = location.query['view']
  if (location.menu !== 'tasks' || view === undefined) return null
  return at(location, 'tasks', taskTabQuery(view, without(location.query, ['view']), department))
}

// 업무 메뉴의 달력 배치 → 캘린더 메뉴(설계 3.1 '업무에서 달력 걷기').
const calendarMove: Step = location =>
  location.menu === 'tasks' && location.query['layout'] === 'calendar'
    ? at(location, 'calendar', {})
    : null

// 재정의 구매 요청 탭과 쓰기 → 구매 메뉴. 보기는 그대로 싣는다.
const purchasesMove: Step = location => {
  if (location.menu !== 'finance') return null
  if (location.query['compose'] === 'new') return at(location, 'purchases', { compose: 'new' })
  if (location.query['tab'] !== 'requests') return null
  // 옛 기본 mine은 읽을 때 빠지지만, 새 메뉴의 역할별 기본값으로 바뀌면 보던 목록을 잃는다.
  return at(location, 'purchases', {
    ...without(location.query, ['tab', 'period']),
    view: location.query['view'] ?? 'mine',
  })
}

// 재정 탭 → 예산 현황(기본)·사용 내역(설계 3.3). 회계 기간은 그대로 싣는다.
const LEDGER_TABS: Record<string, AppQuery> = {
  overview: {},
  budget: {},
  expenses: { tab: 'ledger' },
  incomes: { tab: 'ledger', kind: 'income' },
}
const ledgerMove: Step = location => {
  const next = LEDGER_TABS[location.query['tab'] ?? '']
  if (location.menu !== 'finance' || next === undefined) return null
  return at(location, 'finance', { ...without(location.query, ['tab', 'view']), ...next })
}

// 계좌·납부자 명단 → 설정, 행사 정산 → 결산 탭(설계 3.3 안 B, 권장. 안 A가 되면 이 줄만 바꾼다).
const settingsMove: Step = location => {
  const tab = location.query['tab']
  if (location.menu !== 'finance') return null
  if (tab === 'accounts' || tab === 'fees') return at(location, 'settings', { section: tab })
  if (tab !== 'settlements') return null
  return at(location, 'finance', { ...without(location.query, ['tab', 'view']), tab: 'closing' })
}

// 차례가 있다: 우리 학생회 업무 탭의 달력 배치는 업무로 옮긴 뒤 캘린더로 간다.
const STEPS: Record<AddressMove, Step> = {
  chat: chatMove,
  tasks: tasksMove,
  calendar: calendarMove,
  purchases: purchasesMove,
  ledger: ledgerMove,
  settings: settingsMove,
}

// 옛 꼴이면 새 자리, 아니면 null. moves는 켠 옮기기(기본은 모두)다. 돌려준 자리는 읽기가 돌려주는 꼴이다.
export function movedLocationOf(
  location: AppLocation,
  options: { moves?: readonly AddressMove[]; department?: string | null } = {},
): AppLocation | null {
  if (location.type !== 'menu') return null
  const moves = options.moves ?? ADDRESS_MOVES
  const context = { department: options.department ?? null }
  let moved: MenuLocation | null = null
  for (const move of ADDRESS_MOVES) {
    if (moves.includes(move)) moved = STEPS[move](moved ?? location, context) ?? moved
  }
  return moved && parseAppPath(appPath(moved))
}
