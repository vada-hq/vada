import { HOME_VIEWS } from './home.js'
import { CALENDAR_KINDS } from './calendar.js'
import { MEETING_STATUSES } from './meetings.js'
import { isUuid } from './input.js'
import { PURCHASE_STAGES, PURCHASE_VIEWS } from './purchases.js'
import { TASK_FILTERS, TASK_VIEWS, type TaskStatus, type TaskView } from './tasks.js'

// 화면 주소의 원문(기능 016). 서버 진입 목록(web.ts), 알림 주소(push.ts), 화면 해석기가 모두 이것만 쓴다.
// 주소는 볼 권한을 주지 않는다. 학생회 격리는 서버의 읽기가 요청마다 지킨다.
export const APP_MENUS = [
  'home',
  'chat',
  'events',
  'council',
  'tasks',
  'meetings',
  // 메뉴 v7(설계 2.2): 구매·캘린더는 주소만 먼저 둔다. 화면이 그리기 전까지는 지금 그 일을 그리는 곳으로 바꿔 쓴다(web live-moves).
  'calendar',
  'purchases',
  'finance',
  'people',
  'departments',
  'settings',
] as const
export type AppMenu = (typeof APP_MENUS)[number]

// 화면의 탭·보기 타입이 이 목록에서 나온다. 한쪽에만 탭을 더하면 주소가 그 탭을 기본값으로 읽는다.
// 메시지가 행사의 첫 탭이자 기본 탭이다(DEC-90 "행사 화면의 첫 탭은 메시지다", 022 정한 것 28).
export const EVENT_TABS = ['messages', 'overview', 'tasks', 'registrations', 'money'] as const
export type EventTab = (typeof EVENT_TABS)[number]
// 행사 안에서는 그 행사의 전체 요청과 내 요청만 본다(메뉴 v7 S3).
export const EVENT_PURCHASE_VIEWS = [
  'all',
  'mine',
] as const satisfies readonly (typeof PURCHASE_VIEWS)[number][]
// 메뉴 v7 업무의 탭 둘(설계 3.1). 학생회 업무가 첫 탭이자 기본이다.
export const TASK_TABS = ['council', 'mine'] as const
export type TaskTab = (typeof TASK_TABS)[number]
const MY_TASK_STATES = ['todo', 'in_progress'] as const satisfies readonly TaskStatus[]
// 업무 화면의 배치(DEC-94). 기본은 보드이고, list는 기능 018의 표(화면 이름 '표')다.
export const TASK_LAYOUTS = ['board', 'list', 'calendar'] as const
export type TaskLayout = (typeof TASK_LAYOUTS)[number]

export const PEOPLE_TABS = ['people', 'fees'] as const
export type PeopleTab = (typeof PEOPLE_TABS)[number]

export const FINANCE_TABS = [
  'overview',
  'ledger',
  'accounts', // 옛 재정 주소는 설정의 계좌로 옮긴다(DEC-92).
  'closing',
] as const
export type FinanceTab = (typeof FINANCE_TABS)[number]
// 북마크와 이미 보낸 주소는 계속 읽어 새 자리로 바꿔 쓴다.
const FINANCE_TAB_VALUES = [
  ...FINANCE_TABS,
  'settlements',
  'requests',
  'expenses',
  'incomes',
  'budget',
  'fees',
] as const

// 기록 종류마다 여는 메뉴와 탭. 구매 요청의 상위 목록은 구매 메뉴다.
const RECORD_PARENTS = {
  chat: { menu: 'chat' },
  events: { menu: 'events' },
  tasks: { menu: 'tasks' },
  meetings: { menu: 'meetings' },
  schedule: { menu: 'calendar' },
  purchases: { menu: 'purchases' },
  expenses: { menu: 'finance', query: { tab: 'ledger' } },
  incomes: { menu: 'finance', query: { tab: 'ledger', kind: 'income' } },
} as const satisfies Record<string, { menu: AppMenu; query?: Record<string, string> }>
export type RecordKind = keyof typeof RECORD_PARENTS
export const RECORD_KINDS = Object.keys(RECORD_PARENTS) as RecordKind[]

// onlyWith가 있으면 그 키가 그 값일 때만 남는다(그 키는 규칙에서 앞에 둔다).
// 그 키가 쿼리에 없으면 그 키의 기본값으로 본다(기본 탭의 쿼리도 남는다). also는 uuid 칸이 함께 받는 낱말이다.
type QueryRule = {
  values: readonly string[] | 'uuid'
  also?: readonly string[]
  fallback: string | null
  onlyWith?: { key: string; value: string | readonly string[] } | undefined
}
type QuerySpec = Record<string, QueryRule | QueryRule[]>

// 업무 화면의 쿼리. 업무 메뉴와 행사의 업무 탭이 같은 정의를 쓴다(DEC-94). 기본 보기만 다르다(행사 안은 그 행사의 모든 업무).
const taskQuery = (startView: TaskView | null, onlyWith?: QueryRule['onlyWith']) =>
  ({
    view: { values: TASK_VIEWS, fallback: startView, onlyWith },
    filter: { values: TASK_FILTERS, fallback: 'open', onlyWith },
    layout: { values: TASK_LAYOUTS, fallback: 'board', onlyWith },
    dept: { values: 'uuid', also: ['none'], fallback: null, onlyWith },
    // none은 메뉴 v7의 '담당자 없음' 칩이다(옛 보기 unassigned를 옮긴 곳, 설계 2.2).
    assignee: { values: 'uuid', also: ['none'], fallback: null, onlyWith },
    heads: { values: ['true'], fallback: null, onlyWith },
    attention: { values: ['true'], fallback: null, onlyWith },
    due: { values: ['week', 'overdue', 'none'], fallback: null, onlyWith },
  }) satisfies QuerySpec

const eventTaskQuery = taskQuery('all', { key: 'tab', value: 'tasks' })

// 쿼리에는 기본값이 아닌 값만 둔다. fallback이 null이면 값이 없는 것이 기본이다. 검색어 같은 자유 입력은 넣지 않는다.
const MENU_QUERY: Record<AppMenu, QuerySpec> = {
  // 회장단+재정의 재정 보기(DEC-95). 운영 보기가 기본이라 주소에 없다.
  home: { view: { values: HOME_VIEWS, fallback: null } },
  chat: {
    // 메시지 첫 화면의 [전체 보기]가 전체 방 목록(MSG-01)을 연다.
    rooms: { values: ['all'], fallback: null },
  },
  events: {},
  council: {
    tab: { values: ['messages', 'tasks'], fallback: 'messages' },
    ...taskQuery('all', { key: 'tab', value: 'tasks' }),
  },
  // 옛 view는 기본값까지 남겨 v7 탭·칩 주소로 바꿔 쓴다. 쿼리 없는 주소는 학생회 업무다.
  tasks: {
    tab: { values: TASK_TABS, fallback: 'council' },
    ...taskQuery(null),
    only: { values: ['mine'], fallback: null, onlyWith: { key: 'tab', value: 'council' } },
    events: { values: ['include'], fallback: null },
    // 내 업무에서 고른 학생회 업무·행사 범위를 새로고침해도 유지한다.
    scope: {
      values: 'uuid',
      also: ['council'],
      fallback: null,
      onlyWith: { key: 'tab', value: 'mine' },
    },
    // 내 업무의 할 일·진행 중 거르기를 유지한다. 완료된 업무 탭은 기존 filter를 쓴다.
    state: { values: MY_TASK_STATES, fallback: null, onlyWith: { key: 'tab', value: 'mine' } },
  },
  meetings: {
    status: { values: MEETING_STATUSES, fallback: null },
    compose: { values: ['new'], fallback: null },
  },
  calendar: {
    view: { values: ['month', 'list'], fallback: null },
    kind: { values: CALENDAR_KINDS, fallback: null },
  },
  // 기본 보기는 사람마다 달라(재정부는 결재 대기, 설계 4) 고른 보기는 모두 주소에 남긴다.
  purchases: {
    compose: { values: ['new'], fallback: null },
    view: { values: PURCHASE_VIEWS, fallback: null },
    scope: { values: 'uuid', also: ['none'], fallback: null },
    stage: { values: PURCHASE_STAGES, fallback: null },
  },
  finance: {
    compose: { values: ['new'], fallback: null },
    // 재정 첫 탭은 개요다. 옛 구매 요청 탭도 읽어서 구매 메뉴로 바꿔 쓴다.
    tab: { values: FINANCE_TAB_VALUES, fallback: null },
    // 사용 내역의 수입 구분(설계 3.3).
    kind: { values: ['income'], fallback: null, onlyWith: { key: 'tab', value: 'ledger' } },
    event: {
      values: 'uuid',
      also: ['none'],
      fallback: null,
      onlyWith: { key: 'tab', value: 'ledger' },
    },
    section: { values: ['items'], fallback: null },
    view: { values: PURCHASE_VIEWS, fallback: 'mine' },
    period: { values: 'uuid', fallback: null },
    spending: {
      values: ['committed'],
      fallback: null,
      onlyWith: { key: 'tab', value: ['expenses', 'ledger'] },
    },
  },
  people: { tab: { values: PEOPLE_TABS, fallback: 'people' } },
  departments: {},
  // 계좌·납부자 명단이 옮겨 올 칸(설계 3.3).
  settings: { section: { values: ['accounts', 'fees'], fallback: null } },
}
const RECORD_QUERY: Record<RecordKind, QuerySpec> = {
  meetings: {
    agenda: { values: 'uuid', fallback: null },
    mode: { values: ['edit', 'minutes'], fallback: null },
  },
  schedule: {},
  chat: {},
  // 업무 탭의 보기와 거르기는 업무 탭일 때만 남는다. 다른 탭으로 가면 빠진다.
  // 메시지 탭의 방(DEC-96: 처음 여는 방이면 주소에 없다)은 메시지 탭일 때만 남는다.
  events: {
    tab: { values: EVENT_TABS, fallback: 'messages' },
    room: { values: 'uuid', fallback: null, onlyWith: { key: 'tab', value: 'messages' } },
    ...eventTaskQuery,
    view: [
      eventTaskQuery.view,
      { values: EVENT_PURCHASE_VIEWS, fallback: 'all', onlyWith: { key: 'tab', value: 'money' } },
    ],
    stage: { values: PURCHASE_STAGES, fallback: null, onlyWith: { key: 'tab', value: 'money' } },
  },
  tasks: {},
  purchases: {},
  expenses: {},
  incomes: {},
}

export type AppQuery = Readonly<Record<string, string>>
export type AppLocation =
  | { type: 'menu'; menu: AppMenu; councilId: string; query: AppQuery }
  | { type: 'record'; record: RecordKind; councilId: string; recordId: string; query: AppQuery }

function allowed(rule: QueryRule, value: string) {
  if (rule.also?.includes(value)) return true
  return rule.values === 'uuid' ? isUuid(value) : rule.values.includes(value)
}

function matchesQueryRequirement(spec: QuerySpec, query: AppQuery, needs: QueryRule['onlyWith']) {
  if (!needs) return true
  const accepted = typeof needs.value === 'string' ? [needs.value] : needs.value
  const dependency = spec[needs.key]
  const fallback = Array.isArray(dependency) ? dependency[0]?.fallback : dependency?.fallback
  return accepted.includes(query[needs.key] ?? fallback ?? '')
}

// 모르는 키와 값, 기본값은 버린다. 순서는 규칙의 순서다.
function cleanQuery(spec: QuerySpec, params: URLSearchParams) {
  const query: Record<string, string> = {}
  for (const [key, candidates] of Object.entries(spec)) {
    const rules = Array.isArray(candidates) ? candidates : [candidates]
    const rule = rules.find(candidate => matchesQueryRequirement(spec, query, candidate.onlyWith))
    if (!rule) continue
    const value = params.get(key)
    if (value !== null && value !== rule.fallback && allowed(rule, value))
      query[key] = value.toLowerCase()
  }
  return query
}

const isMenu = (value: string | undefined): value is AppMenu =>
  APP_MENUS.some(menu => menu === value)
// 구매 요청 쓰기는 메뉴의 하위 주소다(새로고침해도 쓰던 화면). 옛 꼴(재정 아래)도 계속 읽는다.
const COMPOSE_MENUS = { purchases: 'new', finance: 'requests/new', meetings: 'new' } as const
type ComposeMenu = keyof typeof COMPOSE_MENUS
const isComposeMenu = (menu: AppMenu): menu is ComposeMenu => menu in COMPOSE_MENUS
const isRecordKind = (value: string | undefined): value is RecordKind =>
  RECORD_KINDS.some(kind => kind === value)

function decodeId(segment: string | undefined) {
  if (segment === undefined) return null
  try {
    const id = decodeURIComponent(segment).toLowerCase()
    return isUuid(id) ? id : null
  } catch {
    return null
  }
}

function splitTarget(input: string) {
  const [target = ''] = input.split('#', 1)
  const mark = target.indexOf('?')
  const pathname = mark < 0 ? target : target.slice(0, mark)
  const params = new URLSearchParams(mark < 0 ? '' : target.slice(mark + 1))
  return {
    segments: (pathname.endsWith('/') ? pathname.slice(0, -1) : pathname).slice(1).split('/'),
    params,
  }
}

// 경로(와 쿼리)를 읽는다. 끝 슬래시 하나는 같은 화면이다. 모르는 꼴은 null이다.
// '//'나 역슬래시로 시작하는 주소, 바깥 주소는 메뉴·종류가 아니라 읽지 않는다(로그인 돌아올 곳이 이것만 통과시킨다).
function menuLocationOf(head: AppMenu, councilId: string, params: URLSearchParams): AppLocation {
  const query = cleanQuery(MENU_QUERY[head], params)
  return {
    type: 'menu',
    menu: head,
    councilId,
    query: isComposeMenu(head) && query['compose'] === 'new' ? { compose: 'new' } : query,
  }
}

function composeMenuOf(head: string | undefined, record: string | undefined, rest: string[]) {
  return isMenu(head) && isComposeMenu(head) && [record, ...rest].join('/') === COMPOSE_MENUS[head]
    ? head
    : null
}

export function parseAppPath(input: string): AppLocation | null {
  if (!input.startsWith('/')) return null
  const { segments, params } = splitTarget(input)
  const [head, council, record, ...rest] = segments
  const councilId = decodeId(council)
  if (!councilId) return null
  const compose = composeMenuOf(head, record, rest)
  if (compose) return { type: 'menu', menu: compose, councilId, query: { compose: 'new' } }
  if (rest.length > 0) return null
  if (record === undefined) return isMenu(head) ? menuLocationOf(head, councilId, params) : null
  const recordId = decodeId(record)
  if (!recordId || !isRecordKind(head)) return null
  const query = cleanQuery(RECORD_QUERY[head], params)
  return { type: 'record', record: head, councilId, recordId, query }
}

// 주소 만들기. 읽기의 거울이라 만든 주소를 다시 읽으면 같은 값이 나온다(id는 읽기처럼 소문자 한 가지로 쓴다).
// uuid가 아닌 id로 만든 주소는 읽히지 않는다.
export function appPath(location: AppLocation) {
  const council = encodeURIComponent(location.councilId.toLowerCase())
  if (
    location.type === 'menu' &&
    isComposeMenu(location.menu) &&
    location.query['compose'] === 'new'
  )
    return `/${location.menu}/${council}/${COMPOSE_MENUS[location.menu]}`
  const base =
    location.type === 'menu'
      ? `/${location.menu}/${council}`
      : `/${location.record}/${council}/${encodeURIComponent(location.recordId.toLowerCase())}`
  const spec = location.type === 'menu' ? MENU_QUERY[location.menu] : RECORD_QUERY[location.record]
  const query = cleanQuery(spec, new URLSearchParams(Object.entries(location.query)))
  const text = new URLSearchParams(query).toString()
  return text ? `${base}?${text}` : base
}

export const menuPath = (menu: AppMenu, councilId: string, query: AppQuery = {}) =>
  appPath({ type: 'menu', menu, councilId, query })
export const recordPath = (record: RecordKind, councilId: string, recordId: string) =>
  appPath({ type: 'record', record, councilId, recordId, query: {} })
// 행사 메시지 탭의 그 방(022 정한 것 28). 방이 없으면 처음 여는 방이다. 홈 메시지함의 행사 방 칩도 이 주소로 연다(DEC-90).
export const eventRoomPath = (councilId: string, eventId: string, roomId: string | null) =>
  appPath({
    type: 'record',
    record: 'events',
    councilId,
    recordId: eventId,
    query: roomId === null ? {} : { room: roomId },
  })

// 기록 주소의 상위 목록. 없는 기록, 볼 수 없는 기록의 '찾을 수 없음'이 이리로 돌아간다.
// 쿼리는 읽기가 돌려주는 꼴(기본값 없음)이라, 만든 주소를 다시 읽은 값과 같다.
export function parentOf(location: AppLocation): AppLocation {
  if (location.type === 'menu') return location
  const parent: { menu: AppMenu; query?: AppQuery } = RECORD_PARENTS[location.record]
  const params = new URLSearchParams(Object.entries(parent.query ?? {}))
  return menuLocationOf(parent.menu, location.councilId.toLowerCase(), params)
}

// 서버 진입 목록(Hono 경로). 학생회와 기록 칸은 uuid만 받아, 모르는 꼴은 서버가 404로 돌린다.
// 끝 슬래시가 있는 꼴도 같은 화면이다. 옮겨 간 옛 꼴(council, 재정 아래 구매 요청 쓰기)도 남긴다. 지우면 북마크·새로고침이 404다.
const UUID_SEGMENT = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}'
const withSlash = (paths: string[]) =>
  paths.flatMap(path => (path === '/' ? [path] : [path, `${path}/`]))
export const ENTRY_PATHS = [
  '/',
  '/index.html',
  ...withSlash([
    '/join/:code',
    '/apply/:code',
    '/r',
    '/auth-done',
    `/finance/:council{${UUID_SEGMENT}}/requests/new`,
    `/purchases/:council{${UUID_SEGMENT}}/new`,
    `/meetings/:council{${UUID_SEGMENT}}/new`,
    ...APP_MENUS.map(menu => `/${menu}/:council{${UUID_SEGMENT}}`),
    ...RECORD_KINDS.map(kind => `/${kind}/:council{${UUID_SEGMENT}}/:record{${UUID_SEGMENT}}`),
  ]),
]
