import { isUuid } from './input.js'
import { PURCHASE_VIEWS } from './purchases.js'
import { TASK_FILTERS, TASK_VIEWS } from './tasks.js'

// 화면 주소의 원문(기능 016). 서버 진입 목록(web.ts), 알림 주소(push.ts), 화면 해석기가 모두 이것만 쓴다.
// 주소는 볼 권한을 주지 않는다. 학생회 격리는 서버의 읽기가 요청마다 지킨다.
export const APP_MENUS = [
  'home',
  'chat',
  'events',
  'tasks',
  'finance',
  'people',
  'departments',
  'settings',
] as const
export type AppMenu = (typeof APP_MENUS)[number]

// 화면의 탭·보기 타입이 이 목록에서 나온다. 한쪽에만 탭을 더하면 주소가 그 탭을 기본값으로 읽는다.
export const EVENT_TABS = ['overview', 'tasks', 'registrations', 'money'] as const
export type EventTab = (typeof EVENT_TABS)[number]
export const TASK_LAYOUTS = ['list', 'calendar'] as const
export type TaskLayout = (typeof TASK_LAYOUTS)[number]

export const FINANCE_TABS = [
  'overview',
  'requests',
  'expenses',
  'incomes',
  'budget',
  'accounts',
  'fees',
  'closing',
] as const
export type FinanceTab = (typeof FINANCE_TABS)[number]

// 기록 종류마다 여는 메뉴와 탭. purchases·expenses·incomes는 재정의 그 탭이다.
const RECORD_PARENTS = {
  chat: { menu: 'chat' },
  events: { menu: 'events' },
  tasks: { menu: 'tasks' },
  purchases: { menu: 'finance', query: { tab: 'requests' } },
  expenses: { menu: 'finance', query: { tab: 'expenses' } },
  incomes: { menu: 'finance', query: { tab: 'incomes' } },
} as const satisfies Record<string, { menu: AppMenu; query?: Record<string, string> }>
export type RecordKind = keyof typeof RECORD_PARENTS
export const RECORD_KINDS = Object.keys(RECORD_PARENTS) as RecordKind[]

type QueryRule = { values: readonly string[] | 'uuid'; fallback: string | null }
type QuerySpec = Record<string, QueryRule>

// 쿼리에는 기본값이 아닌 값만 둔다. fallback이 null이면 값이 없는 것이 기본이다. 검색어 같은 자유 입력은 넣지 않는다.
const MENU_QUERY: Record<AppMenu, QuerySpec> = {
  home: {},
  chat: { tab: { values: ['notices'], fallback: null } },
  events: {},
  tasks: {
    view: { values: TASK_VIEWS, fallback: 'mine' },
    filter: { values: TASK_FILTERS, fallback: 'open' },
    layout: { values: TASK_LAYOUTS, fallback: 'list' },
    dept: { values: 'uuid', fallback: null },
  },
  finance: {
    // 기본 탭은 사람마다 다르다(재정부는 개요, 나머지는 구매 요청). 그래서 고른 탭은 모두 주소에 남긴다.
    tab: { values: FINANCE_TABS, fallback: null },
    view: { values: PURCHASE_VIEWS, fallback: 'mine' },
    period: { values: 'uuid', fallback: null },
  },
  people: {},
  departments: {},
  settings: {},
}
const RECORD_QUERY: Record<RecordKind, QuerySpec> = {
  chat: {},
  events: { tab: { values: EVENT_TABS, fallback: 'overview' } },
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
  return rule.values === 'uuid' ? isUuid(value) : rule.values.includes(value)
}

// 모르는 키와 값, 기본값은 버린다. 순서는 규칙의 순서다.
function cleanQuery(spec: QuerySpec, params: URLSearchParams) {
  const query: Record<string, string> = {}
  for (const [key, rule] of Object.entries(spec)) {
    const value = params.get(key)
    if (value !== null && value !== rule.fallback && allowed(rule, value))
      query[key] = value.toLowerCase()
  }
  return query
}

const isMenu = (value: string | undefined): value is AppMenu =>
  APP_MENUS.some(menu => menu === value)
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
export function parseAppPath(input: string): AppLocation | null {
  if (!input.startsWith('/')) return null
  const { segments, params } = splitTarget(input)
  const [head, council, record, ...rest] = segments
  const councilId = decodeId(council)
  if (!councilId || rest.length > 0) return null
  if (record === undefined)
    return isMenu(head)
      ? { type: 'menu', menu: head, councilId, query: cleanQuery(MENU_QUERY[head], params) }
      : null
  const recordId = decodeId(record)
  if (!recordId || !isRecordKind(head)) return null
  const query = cleanQuery(RECORD_QUERY[head], params)
  return { type: 'record', record: head, councilId, recordId, query }
}

// 주소 만들기. 읽기의 거울이라 만든 주소를 다시 읽으면 같은 값이 나온다(id는 읽기처럼 소문자 한 가지로 쓴다).
// uuid가 아닌 id로 만든 주소는 읽히지 않는다.
export function appPath(location: AppLocation) {
  const council = encodeURIComponent(location.councilId.toLowerCase())
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

// 기록 주소의 상위 목록. 없는 기록, 볼 수 없는 기록의 '찾을 수 없음'이 이리로 돌아간다.
// 쿼리는 읽기가 돌려주는 꼴(기본값 없음)이라, 만든 주소를 다시 읽은 값과 같다.
export function parentOf(location: AppLocation): AppLocation {
  if (location.type === 'menu') return location
  const parent: { menu: AppMenu; query?: AppQuery } = RECORD_PARENTS[location.record]
  const params = new URLSearchParams(Object.entries(parent.query ?? {}))
  return {
    type: 'menu',
    menu: parent.menu,
    councilId: location.councilId.toLowerCase(),
    query: cleanQuery(MENU_QUERY[parent.menu], params),
  }
}

// 서버 진입 목록(Hono 경로). 학생회와 기록 칸은 uuid만 받아, 모르는 꼴은 서버가 404로 돌린다.
// 끝 슬래시가 있는 꼴도 같은 화면이다.
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
    ...APP_MENUS.map(menu => `/${menu}/:council{${UUID_SEGMENT}}`),
    ...RECORD_KINDS.map(kind => `/${kind}/:council{${UUID_SEGMENT}}/:record{${UUID_SEGMENT}}`),
  ]),
]
