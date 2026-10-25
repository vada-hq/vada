import { expect, test } from 'vitest'
import type { TaskSummary } from '@vada/contracts'
import { eventDetail } from '@/test-support/event-fixtures'
import { settlementOf } from '@/test-support/settlement-fixtures'
import { staffForm } from '@/test-support/staff-registration-fixtures'
import { taskDetail } from '@/test-support/task-detail-fixtures'
import { attentionOf, isBlank, nextTasks, registrationTotals, setupSteps } from './overview-view'

const task = (id: string, extra: Partial<TaskSummary> = {}): TaskSummary => {
  const {
    body: _body,
    createdBy: _by,
    createdAt: _at,
    history: _history,
    ...summary
  } = taskDetail({ id, title: `업무${id}` })
  return { ...summary, ...extra }
}

test('챙길 것: 지난 업무와 담당자 없는 업무를 수와 앞의 두 제목으로 센다', () => {
  const tasks = [
    task('1', { overdue: true }),
    task('2', { overdue: true, assignee: null }),
    task('3', { overdue: true }),
    task('4'),
  ]
  const items = attentionOf(eventDetail(), tasks, null)
  expect(items.map(item => [item.key, item.value, item.detail])).toEqual([
    ['overdue', '3개', '업무1 · 업무2 외 1개'],
    ['unassigned', '1개', '업무2'],
  ])
})

test('챙길 것의 담당자 없음은 머리와 같이 담당자 없음, 떠난 담당자, 부서 없는 업무를 센다', () => {
  const tasks = [
    task('1', { assignee: null }),
    task('2', { assignee: { id: 'm9', name: '떠난 운영진 1', current: false } }),
    task('3', { department: null }),
    task('4'),
  ]
  const items = attentionOf(eventDetail(), tasks, null)
  expect(items.map(item => [item.key, item.value, item.detail])).toEqual([
    ['unassigned', '3개', '업무1 · 업무2 외 1개'],
  ])
})

test('챙길 것: 끝난 행사는 정산에 남은 것을, 정산이 끝났고 완료할 수 있으면 완료를 말한다', () => {
  const ended = eventDetail({ status: 'ended' })
  const left = attentionOf(ended, [], settlementOf().settlement)
  expect(left.map(item => [item.key, item.value])).toEqual([['settlement', '4개']])
  const settled = settlementOf({ settled: true, remaining: [] }).settlement
  expect(attentionOf(ended, [], settled)).toEqual([])
  const canComplete = eventDetail({ status: 'ended' }, ['event.complete'])
  expect(attentionOf(canComplete, [], settled).map(item => item.key)).toEqual(['complete'])
})

test('챙길 것: 끝나지 않은 행사의 정산은 말하지 않는다', () => {
  expect(attentionOf(eventDetail(), [], settlementOf().settlement)).toEqual([])
})

test('다음 업무: 지난 것, 마감이 가까운 것, 마감 없는 것 순으로 앞의 몇 개', () => {
  const tasks = [
    task('a', { dueDate: null }),
    task('b', { dueDate: '2026-10-30' }),
    task('c', { dueDate: '2026-10-20', overdue: true }),
    task('d', { dueDate: '2026-10-26' }),
  ]
  expect(nextTasks(tasks, 3).map(item => item.id)).toEqual(['c', 'd', 'b'])
})

test('신청 합계: 양식을 더하고, 정원은 모든 양식에 있을 때만 더한다', () => {
  const forms = [
    staffForm({ id: 'f1', applicantCount: 30, attendedCount: 5, capacity: 40 }),
    staffForm({ id: 'f2', applicantCount: 12, attendedCount: 2, capacity: 20 }),
  ]
  expect(registrationTotals(forms)).toEqual({ applicants: 42, attended: 7, capacity: 60 })
  expect(registrationTotals([...forms, staffForm({ capacity: null })]).capacity).toBeNull()
})

test('준비 단계: 새 행사는 네 단계가 모두 남고, 열린 행사나 꼭 할 단계를 끝낸 행사에는 없다', () => {
  const blank = eventDetail({
    startsAt: null,
    endsAt: null,
    place: null,
    status: 'tbd',
    tasks: { open: 0, total: 0 },
  })
  const noMoney = settlementOf({
    budget: { expense: 0, income: 0, items: [] },
    actual: { expense: 0, fee: 0, income: 0, depositCount: 0, refundPendingCount: 0 },
  }).settlement
  expect(setupSteps(blank, [], noMoney)?.map(step => step.done)).toEqual([
    false,
    false,
    false,
    false,
  ])
  expect(isBlank(blank, [], noMoney)).toBe(true)
  expect(setupSteps(eventDetail({ status: 'ongoing' }), [], noMoney)).toBeNull()
  const ready = eventDetail()
  // 예산과 참가 신청은 필요할 때만 하므로, 그것만 남았으면 준비 단계를 숨긴다.
  expect(setupSteps(ready, [], noMoney)).toBeNull()
  expect(isBlank(ready, [], noMoney)).toBe(false)
})
