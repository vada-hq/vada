import { expect, test } from 'vitest'
import type { HomeItem } from '@vada/contracts'
import { expense } from '../expenses/expense-fixtures'
import { taskSummary } from '../tasks/task-fixtures'
import { departments, homeDepartment, homeEvent, homeResponse, noCounts } from './home-fixtures'
import { daysSince, departmentGroupsOf, eventGroupsOf, eventLineOf, ownerIdsOf, rowOf, statusChipsOf, summaryChips, targetOf,
  taskCountsText } from './home-view'

const overdue: HomeItem = { kind: 'task_overdue', eventId: 'e', task: taskSummary({ id: 't1', event: { id: 'e', name: '체육대회' }, dueOn: '2026-10-09',
  department: { id: 'dp', name: '기획부' } }) }
const pending: HomeItem = { kind: 'purchases_pending', eventId: 'e', count: 3, since: '2026-10-11T14:30:00.000Z' }
const noEvidence: HomeItem = { kind: 'expense_no_evidence', eventId: null, expense: expense({ id: 'x1', event: null, description: '사무용품',
  amount: 8000, paidOn: '2026-10-03', payer: { id: 'f', name: '박재정' } }) }
const data = homeResponse({ events: [homeEvent()] })

test('날수는 한국 날짜끼리 센다', () => {
  expect(daysSince('2026-10-09', '2026-10-12')).toBe(3)
  expect(daysSince('2026-10-12', '2026-10-12')).toBe(0)
  expect(daysSince('2026-09-30', '2026-10-01')).toBe(1)
})

test('종류별 수는 업무 → 돈 → 행사 마무리 순이고 0은 감춘다', () => {
  expect(summaryChips({ ...noCounts(), completion_pending: 1, task_overdue: 3, fees_unconfirmed: 5 }))
    .toEqual(['지연 업무 3', '입금 확인 전 5명', '완료 전 행사 1'])
  expect(summaryChips(noCounts())).toEqual([])
})

test('할 차례: 업무는 그 업무의 부서, 돈은 재정 부서(없으면 회장단), 완료는 회장단이다', () => {
  expect(ownerIdsOf(overdue, departments())).toEqual(['dp'])
  expect(ownerIdsOf({ ...overdue, task: taskSummary({ department: null }) }, departments())).toEqual([])
  expect(ownerIdsOf(pending, departments())).toEqual(['df'])
  expect(ownerIdsOf(pending, [...departments(), homeDepartment({ id: 'dg', name: '재무부', handlesFinance: true })])).toEqual(['df', 'dg'])
  expect(ownerIdsOf(pending, departments().filter(department => !department.handlesFinance))).toEqual(['dl'])
  expect(ownerIdsOf(pending, [homeDepartment()])).toEqual([])
  expect(ownerIdsOf({ kind: 'completion_pending', eventId: 'e', endedOn: '2026-10-01' }, departments())).toEqual(['dl'])
  // 목록에 없는 부서는 버린다.
  expect(ownerIdsOf({ kind: 'tasks_unassigned', eventId: 'e', department: { id: 'gone', name: '없는 부서' }, count: 1 }, departments())).toEqual([])
  expect(ownerIdsOf({ ...overdue, task: taskSummary({ department: { id: 'gone', name: '없는 부서' } }) }, departments())).toEqual([])
})

test('줄 글: 행사별은 할 차례, 부서별은 행사 이름을 앞에 둔다', () => {
  expect(rowOf(overdue, 'events', data)).toEqual({ title: '현수막 디자인', detail: '기획부 · 윤태민 · 3일 지남' })
  expect(rowOf(overdue, 'departments', data)).toEqual({ title: '현수막 디자인', detail: '체육대회 · 윤태민 · 3일 지남' })
  expect(rowOf({ ...overdue, task: taskSummary({ dueOn: '2026-10-11', assignee: null, department: null }) }, 'events', data).detail)
    .toBe('담당 부서 없음 · 담당자 없음 · 1일 지남')
  expect(rowOf({ kind: 'tasks_unassigned', eventId: 'e', department: null, count: 2 }, 'events', data))
    .toEqual({ title: '담당자 없는 업무 2건', detail: '담당 부서 없음' })
  // 한국 시각 10월 11일 23:30에 낸 것은 다음 날 "1일 전 제출"이다(UTC로는 같은 날 14:30).
  expect(rowOf(pending, 'events', data)).toEqual({ title: '구매 승인 대기 3건', detail: '총무부 · 1일 전 제출' })
  expect(rowOf({ ...pending, since: '2026-10-12T00:10:00.000Z' }, 'events', data).detail).toBe('총무부 · 오늘 제출')
  expect(rowOf({ kind: 'purchases_late', eventId: 'e', count: 2, neededBy: '2026-10-10' }, 'events', data))
    .toEqual({ title: '필요한 날 지난 구매 2건', detail: '총무부 · 필요한 날 10.10' })
  expect(rowOf(noEvidence, 'events', data)).toEqual({ title: '증빙 없음 · 사무용품', detail: '총무부 · 8,000원 · 박재정 결제 · 10.3' })
  expect(rowOf(noEvidence, 'departments', data).detail).toBe('상시 운영 지출 · 8,000원 · 박재정 결제 · 10.3')
  expect(rowOf({ kind: 'fees_unconfirmed', eventId: 'e', count: 5 }, 'events', data)).toEqual({ title: '입금 확인 전 5명', detail: '총무부' })
  expect(rowOf({ kind: 'settlement_pending', eventId: 'e', endedOn: '2026-09-27', blockers: { missingEvidence: 1, pendingRequests: 0, unrecordedItems: 2, feePeriodMissing: false } },
    'events', data)).toEqual({ title: '정산 전 · 끝난 지 15일', detail: '총무부 · 증빙 없는 지출 1 · 지출 기록 전 품목 2' })
  expect(rowOf({ kind: 'settlement_pending', eventId: 'e', endedOn: '2026-10-12', blockers: { missingEvidence: 0, pendingRequests: 0, unrecordedItems: 0, feePeriodMissing: false } },
    'events', data)).toEqual({ title: '정산 전 · 오늘 끝남', detail: '총무부 · 정산할 수 있어요' })
  expect(rowOf({ kind: 'settlement_pending', eventId: 'e', endedOn: '2026-10-12', blockers: { missingEvidence: 0, pendingRequests: 0, unrecordedItems: 0,
    feePeriodMissing: true } }, 'events', data).detail).toBe('총무부 · 참가비를 넣을 회계 기간 없음')
  expect(rowOf({ kind: 'completion_pending', eventId: 'e', endedOn: '2026-09-27' }, 'events', data))
    .toEqual({ title: '정산 끝, 완료 전', detail: '회장단 · 끝난 지 15일' })
})

test('누르면: 업무·지출은 상세, 구매는 권한에 따라 구매 검토나 행사 구매 탭, 입금 확인 전은 부서가 있으면 참가자 탭', () => {
  const finance = { approvePurchases: true, manageEvents: true }
  const member = { approvePurchases: false, manageEvents: true }
  const unassigned = { approvePurchases: false, manageEvents: false }
  expect(targetOf(overdue, member)).toEqual({ type: 'task', eventId: 'e', taskId: 't1' })
  expect(targetOf(noEvidence, member)).toEqual({ type: 'expense', expenseId: 'x1' })
  expect(targetOf(pending, finance)).toEqual({ type: 'review' })
  expect(targetOf(pending, member)).toEqual({ type: 'event', eventId: 'e', tab: 'purchases' })
  const fees: HomeItem = { kind: 'fees_unconfirmed', eventId: 'e', count: 5 }
  expect(targetOf(fees, member)).toEqual({ type: 'event', eventId: 'e', tab: 'registrations' })
  expect(targetOf(fees, unassigned)).toEqual({ type: 'event', eventId: 'e', tab: 'finance' })
  expect(targetOf({ kind: 'tasks_unassigned', eventId: 'e', department: null, count: 1 }, member)).toEqual({ type: 'event', eventId: 'e', tab: 'tasks' })
  expect(targetOf({ kind: 'completion_pending', eventId: 'e', endedOn: '2026-10-01' }, finance)).toEqual({ type: 'event', eventId: 'e', tab: 'finance' })
})

test('행사별은 행사 순서대로 묶고 상시 운영 지출은 맨 뒤, 부서별은 할 차례로 묶고 담당 부서 없음은 맨 뒤다', () => {
  const second = homeEvent({ event: { ...homeEvent().event, id: 'e2', name: '축제' } })
  const unowned: HomeItem = { ...overdue, task: taskSummary({ id: 't9', department: null }) }
  const both = homeResponse({ events: [homeEvent(), second], items: [overdue, pending, unowned, noEvidence] })
  expect(eventGroupsOf(both).map(group => [group.key, group.items.length])).toEqual([['e', 3], ['e2', 0], ['operating', 1]])
  expect(departmentGroupsOf(both).map(group => [group.name, group.items.length])).toEqual([['회장단', 0], ['기획부', 1], ['총무부', 2], ['담당 부서 없음', 1]])
  expect(departmentGroupsOf(homeResponse()).map(group => group.name)).toEqual(['회장단', '기획부', '총무부'])
  expect(departmentGroupsOf(homeResponse({ unownedTasks: { open: 1, overdue: 0, done: 0 } })).at(-1)!.name).toBe('담당 부서 없음')
  expect(taskCountsText({ open: 5, overdue: 1, done: 12 })).toBe('할 일 5 · 지연 1 · 완료 12')
})

test('행사 카드: 날짜(D-n)와 담당, 상태 칩', () => {
  const home = homeEvent({ event: { ...homeEvent().event, ownerDepartment: { id: 'dp', name: '기획부' }, owner: { membershipId: 'm', name: '정민재' } },
    tasks: { total: 10, done: 6, overdue: 1, unassigned: 0 },
    registration: { registered: 47, capacity: 60, closesAt: '2026-10-15T23:59', accepting: true }, settled: false })
  expect(eventLineOf(home, '2026-10-12')).toBe('10.20 (D-8) · 기획부 · 정민재')
  expect(eventLineOf(homeEvent({ event: { ...homeEvent().event, startsAt: null, endsAt: null } }), '2026-10-12')).toBe('날짜 미정')
  expect(statusChipsOf(home, '2026-10-12T12:00')).toEqual(['업무 6/10', '신청 47/60명', '신청 마감 10.15'])
  expect(statusChipsOf({ ...home, registration: { ...home.registration!, capacity: null, accepting: false }, settled: true }, '2026-10-12T12:00'))
    .toEqual(['업무 6/10', '신청 47명', '정산함'])
  expect(statusChipsOf({ ...home, registration: home.registration }, '2026-10-16T00:00')).toEqual(['업무 6/10', '신청 47/60명'])
})
