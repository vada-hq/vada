import { expect, test } from 'vitest'
import type { EventSummary } from '@vada/contracts'
import { dDayText, dueText, groupByDate, isOverdue, matchesFilter, scheduleOf, sortByDue, taskCounts, taskHistoryText, taskMessage } from './task-view'
import { taskSummary } from './task-fixtures'

const event = (overrides: Partial<EventSummary> = {}): EventSummary => ({ id: 'e1', organizationId: 'o1', name: '체육대회', createdBy: 'u1',
  createdAt: '2026-09-01T00:00:00Z', startsAt: '2026-10-20T10:00', endsAt: '2026-10-20T18:00', place: null, version: 1, completedAt: null, ...overrides })

test('지연은 완료가 아니고 마감일이 오늘보다 앞일 때다. 마감일 당일은 지연이 아니다', () => {
  expect(isOverdue(taskSummary({ dueOn: '2026-10-10' }), '2026-10-11')).toBe(true)
  expect(isOverdue(taskSummary({ dueOn: '2026-10-11' }), '2026-10-11')).toBe(false)
  expect(isOverdue(taskSummary({ dueOn: '2026-10-10', status: 'done', completedAt: '2026-10-10T01:00:00Z' }), '2026-10-11')).toBe(false)
  expect(isOverdue(taskSummary({ dueOn: null }), '2026-10-11')).toBe(false)
})

test('D-day: 앞이면 D-N, 당일이면 D-DAY, 지나면 D+N, 시작이 없으면 없다', () => {
  expect(dDayText('2026-10-20T10:00', '2026-10-11')).toBe('D-9')
  expect(dDayText('2026-10-11T23:00', '2026-10-11')).toBe('D-DAY')
  expect(dDayText('2026-10-09T10:00', '2026-10-11')).toBe('D+2')
  expect(dDayText('2027-01-01T10:00', '2026-12-31')).toBe('D-1')
  expect(dDayText(null, '2026-10-11')).toBeNull()
  expect(dueText('2026-03-05')).toBe('3.5')
})

test('요약 수와 거르기: 완료한 업무는 지연·담당자 없음·내 담당에서 빠진다', () => {
  const list = [taskSummary({ id: 'a', dueOn: '2026-10-01' }), taskSummary({ id: 'b', assignee: null }),
    taskSummary({ id: 'c', assignee: { membershipId: 'm1', name: '테스터' } }),
    taskSummary({ id: 'd', status: 'done', completedAt: '2026-10-02T00:00:00Z', assignee: null, dueOn: '2026-10-01' })]
  expect(taskCounts(list, '2026-10-11', 'm1')).toEqual({ total: 4, done: 1, overdue: 1, unassigned: 1, mine: 1 })
  expect(list.filter(task => matchesFilter(task, 'unassigned', '2026-10-11', 'm1')).map(task => task.id)).toEqual(['b'])
  expect(list.filter(task => matchesFilter(task, null, '2026-10-11', 'm1')).length).toBe(4)
})

test('서버와 같은 순서로 놓는다: 마감일 순, 마감일 없으면 뒤, 같으면 만든 순', () => {
  const list = [taskSummary({ id: 'none', dueOn: null }), taskSummary({ id: 'late', dueOn: '2026-10-25' }),
    taskSummary({ id: 'early2', dueOn: '2026-10-05', createdAt: '2026-10-02T00:00:00Z' }), taskSummary({ id: 'early1', dueOn: '2026-10-05' })]
  expect(sortByDue(list).map(task => task.id)).toEqual(['early1', 'early2', 'late', 'none'])
})

test('일정은 행사 일시·참가 신청 마감·마감일 있는 업무를 날짜순으로 모은다', () => {
  const items = scheduleOf([taskSummary({ id: 't1', title: '현수막', dueOn: '2026-10-15' }), taskSummary({ id: 't2', dueOn: null }),
    taskSummary({ id: 't3', title: '정산', dueOn: '2026-10-25' })], event(), '2026-10-18T23:59')
  expect(items.map(item => [item.date, item.kind, item.title, item.note])).toEqual([
    ['2026-10-15', 'task', '현수막', null], ['2026-10-18', 'deadline', '참가 신청 마감', '23:59'],
    ['2026-10-20', 'event', '체육대회', '10:00~18:00'], ['2026-10-25', 'task', '정산', null]])
  expect(scheduleOf([], event({ endsAt: '2026-10-22T18:00' }), null)[0]?.note).toBe('10:00 ~ 10.22 18:00')
  expect(scheduleOf([], event({ endsAt: null }), null)[0]?.note).toBe('10:00')
  expect(scheduleOf([], event({ startsAt: null, endsAt: null }), null)).toEqual([])
  expect(groupByDate(items).map(group => group.date)).toEqual(['2026-10-15', '2026-10-18', '2026-10-20', '2026-10-25'])
})

test('처리 기록과 오류 문구', () => {
  const entry = (action: 'created' | 'updated' | 'status_changed', changes: Record<string, unknown> = {}) =>
    ({ id: 'h', action, actor: { id: 'u', name: '기획' }, changes, createdAt: '2026-10-11T00:00:00Z' })
  expect(taskHistoryText(entry('created'))).toBe('만듦')
  expect(taskHistoryText(entry('status_changed', { status: { from: 'todo', to: 'doing' } }))).toBe('상태: 예정 → 진행 중')
  expect(taskHistoryText(entry('updated', { assignee: { from: null, to: '윤태민' }, dueOn: { from: '2026-10-20', to: null },
    description: { from: '가', to: '나' } }))).toBe('수정: 담당자 없음 → 윤태민 · 마감일 10.20 → 없음 · 설명 고침')
  expect(taskMessage('TASKS_FULL')).toBe('이 행사의 업무가 너무 많아요. 끝난 업무를 지운 뒤 더해 주세요.')
  expect(taskMessage('SOMETHING')).toBe('처리하지 못했어요. 다시 시도해 주세요.')
})
