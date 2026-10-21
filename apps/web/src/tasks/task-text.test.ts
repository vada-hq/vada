import { expect, test } from 'vitest'
import type { TaskChange } from '@vada/contracts'
import { monthDay, monthDayTime } from '@/lib/korean-date-text'
import { versionLine } from './task-text'

const by = { id: 'm1', name: '김회장' }
const line = (changes: TaskChange[], at = '2026-10-20T05:03:00.000Z') =>
  versionLine({ versionNo: 2, at, by, changes })

test('이력 줄은 이름, 한국 시각, 바뀐 칸 차례다', () => {
  expect(line([{ field: 'status', from: 'todo', to: 'in_progress' }])).toBe(
    '김회장 · 10월 20일 14:03 · 상태 할 일 → 진행 중',
  )
})

test('판 1은 만듦이고 만든 사람이 없으면 알 수 없는 사람이다', () => {
  expect(
    versionLine({
      versionNo: 1,
      at: '2026-10-20T05:03:00.000Z',
      by: null,
      changes: [{ field: 'created' }],
    }),
  ).toBe('알 수 없는 사람 · 10월 20일 14:03 · 만듦')
})

test('한국 자정 전후 1초는 다른 날로 보인다', () => {
  expect(monthDayTime('2026-10-20T14:59:59.000Z')).toBe('10월 20일 23:59')
  expect(monthDayTime('2026-10-20T15:00:00.000Z')).toBe('10월 21일 00:00')
  expect(monthDay('2026-01-05')).toBe('1월 5일')
})

test('부서, 사람, 마감, 내용, 제목이 바뀐 글', () => {
  expect(
    line([
      { field: 'department', from: null, to: { id: 'd1', name: '재정부' } },
      { field: 'assignee', from: { id: 'm9', name: null }, to: null },
      { field: 'dueDate', from: null, to: '2026-10-25' },
      { field: 'body' },
      { field: 'title', from: '가', to: '나' },
    ]),
  ).toContain(
    '담당 부서 학생회 업무 → 재정부, 담당자 알 수 없는 사람 → 없음, 마감 없음 → 10월 25일, 내용 고침, 제목 가 → 나',
  )
  expect(line([{ field: 'department', from: { id: 'd1', name: null }, to: null }])).toContain(
    '담당 부서 없앤 부서 → 학생회 업무',
  )
})
