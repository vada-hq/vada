import { HOME_ITEM_KINDS, type HomeDepartment, type HomeEvent, type HomeResponse } from '@vada/contracts'
import { event } from '../test-support/workflow-fixtures'

// 운영 현황 화면 테스트용 고정값. 오늘은 2026-10-12, 행사는 10월 20일 체육대회(기획 중)다.
export const noCounts = () => Object.fromEntries(HOME_ITEM_KINDS.map(kind => [kind, 0])) as HomeResponse['counts']
export const homeEvent = (overrides: Partial<HomeEvent> = {}): HomeEvent => ({
  event: { ...event(), startsAt: '2026-10-20T10:00', endsAt: '2026-10-20T18:00' }, phase: 'planning',
  tasks: { total: 0, done: 0, overdue: 0, unassigned: 0 }, registration: null, settled: false, ...overrides })
export const homeDepartment = (overrides: Partial<HomeDepartment> = {}): HomeDepartment => ({ id: 'dp', name: '기획부', isLeadership: false,
  handlesFinance: false, tasks: { open: 0, overdue: 0, done: 0 }, ...overrides })
export const departments = () => [homeDepartment({ id: 'dl', name: '회장단', isLeadership: true }), homeDepartment(),
  homeDepartment({ id: 'df', name: '총무부', handlesFinance: true })]
export const homeResponse = (overrides: Partial<HomeResponse> = {}): HomeResponse => ({ today: '2026-10-12', events: [], departments: departments(),
  unownedTasks: { open: 0, overdue: 0, done: 0 }, items: [], counts: noCounts(), truncated: false, ...overrides })
