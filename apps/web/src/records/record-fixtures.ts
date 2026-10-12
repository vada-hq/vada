import type { EventReportFacts, EventReportResponse, RecordEntry, RetrospectiveView } from '@vada/contracts'
import { event } from '../test-support/workflow-fixtures'

// 결과보고서·기록 목록·Workspace 테스트가 같이 쓰는 고정값. 행사는 2026-09-26(D-day)이다.
export const facts = (overrides: Partial<EventReportFacts> = {}): EventReportFacts => ({
  event: { name: '체육대회', startsAt: '2026-09-26T10:00', endsAt: '2026-09-26T17:00', place: '대운동장' },
  owner: { department: '기획부', person: '정민재' }, registrations: { registered: 26, attended: 22 }, finance: { budget: 700000, spent: 512700 },
  tasks: { total: 3, done: 3, late: 1 }, purchases: { requested: 4, approved: 3 }, ...overrides })
const person = { id: 'u1', name: '정민재' }
export const completedEvent = () => ({ ...event(), completedAt: '2026-09-30T01:00:00.000Z', version: 2 })
export const timeline = (): RecordEntry[] => [
  { id: 'event:created', day: '2026-09-01', at: '2026-09-01T01:00:00.000Z', kind: 'event', text: '행사 만듦', note: null, warning: false, tab: null },
  { id: 'registration:open', day: '2026-09-06', at: '2026-09-06T00:00:00.000Z', kind: 'registration', text: '참가 신청 시작', note: null, warning: false,
    tab: 'registrations' },
  { id: 'submission:s1', day: '2026-09-15', at: '2026-09-15T05:00:00.000Z', kind: 'purchase', text: '구매 요청 2건: 과자, 콜라', note: '기획부',
    warning: false, tab: 'purchases' },
  { id: 'task:t1', day: '2026-09-24', at: '2026-09-24T05:00:00.000Z', kind: 'task', text: '업무 완료: 현수막', note: '홍보부 · 마감 9월 22일 · 2일 늦음',
    warning: true, tab: 'tasks' },
  { id: 'expense:x1', day: '2026-09-25', at: null, kind: 'expense', text: '지출 46,000원: 쿠팡', note: '물품', warning: false, tab: 'finance' },
  { id: 'event:day', day: '2026-09-26', at: '2026-09-26T01:00:00.000Z', kind: 'event', text: '행사', note: '대운동장', warning: false, tab: null },
]
export const retrospectiveView = (overrides: Partial<RetrospectiveView> = {}): RetrospectiveView => ({
  wentWell: [{ id: 'w1', text: '조를 미리 정했다.', sources: [{ kind: 'message', messageId: 'm1', excerpt: '조 편성 끝났어요', at: '2026-09-20T03:00:00.000Z' }] }],
  shortfalls: [{ id: 's1', text: '현수막이 이틀 늦었다.', sources: [{ kind: 'entry', id: 'task:t1', text: '업무 완료: 현수막', tab: 'tasks' }] }],
  nextTime: [{ id: 'n1', text: '현수막은 D-10에 맡기자.', sources: [{ kind: 'fact', id: 'fact:tasks', text: '업무 3건 중 3건 완료 · 지연 1건' },
    { kind: 'missing' }] }],
  questions: [{ id: 'q1', text: '참석이 4명 적은 이유가 있었나요?', sources: [], answer: null }],
  version: 1, generated: { by: person, at: '2026-10-01T05:00:00.000Z' }, confirmed: null, stale: false, ...overrides })
export const reportResponse = (overrides: Partial<EventReportResponse> = {}): EventReportResponse => ({
  event: completedEvent(), facts: facts(), timeline: timeline(), retrospective: null, ...overrides })
