import type { EventReportFacts, EventReportResponse, EventReportView } from '@vada/contracts'
import { event } from '../test-support/workflow-fixtures'

// 결과보고서·기록 목록 테스트가 같이 쓰는 고정값
export const facts = (overrides: Partial<EventReportFacts> = {}): EventReportFacts => ({
  event: { name: '체육대회', startsAt: '2026-09-26T10:00', endsAt: '2026-09-26T17:00', place: '대운동장' },
  owner: { department: '기획부', person: '정민재' }, registrations: { registered: 26, attended: 22 }, finance: { budget: 700000, spent: 512700 },
  tasks: { total: 3, done: 3, late: 1 }, purchases: { requested: 4, approved: 3 }, ...overrides })
const person = { id: 'u1', name: '정민재' }
export const reportView = (overrides: Partial<EventReportView> = {}): EventReportView => ({
  status: 'draft', operations: '10:00 시작', wentWell: null, shortfalls: null, improvements: null, handover: null, version: 1,
  created: { by: person, at: '2026-10-01T05:00:00.000Z' }, updated: { by: person, at: '2026-10-01T05:00:00.000Z' }, published: null, ...overrides })
export const completedEvent = () => ({ ...event(), completedAt: '2026-09-30T01:00:00.000Z', version: 2 })
export const reportResponse = (overrides: Partial<EventReportResponse> = {}): EventReportResponse => ({
  event: completedEvent(), report: reportView(), facts: facts(), factsAt: '2026-10-12T01:00:00.000Z', ...overrides })
export const full = { operations: '10:00 시작', wentWell: '조를 미리 정했다', shortfalls: '물이 모자랐다', improvements: '물은 1인 1병', handover: '대관은 6주 전' }
