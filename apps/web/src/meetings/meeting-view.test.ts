import { expect, test } from 'vitest'
import {
  meetingGroups,
  meetingTime,
  meetingDuration,
  myMeetingRows,
  sortedMeetings,
} from './meeting-view'
import { meetingSample } from './test-support/meeting-samples'

test('묶음 안은 다가오는 순·지난 최근 순이며 정기 묶음 다음 가장 가까운 행사 순이다', () => {
  const now = '2026-10-29T12:00'
  const items = [
    meetingSample({ id: 'past', heldAt: '2026-10-20T12:00', endsAt: '2026-10-20T13:00' }),
    meetingSample({ id: 'future', heldAt: '2026-10-30T12:00', endsAt: '2026-10-30T13:00' }),
    meetingSample({ id: 'recent', heldAt: '2026-10-28T12:00', endsAt: '2026-10-28T13:00' }),
    meetingSample({
      id: 'later',
      event: { id: 'e1', name: '나중 행사' },
      heldAt: '2026-11-20T12:00',
    }),
    meetingSample({
      id: 'sooner',
      event: { id: 'e2', name: '가까운 행사' },
      heldAt: '2026-10-31T12:00',
    }),
  ]
  const groups = meetingGroups(items, '', null, now)
  expect(groups.map(group => group.name)).toEqual(['정기·상시 회의', '가까운 행사', '나중 행사'])
  expect(groups[0]!.meetings.map(item => item.id)).toEqual(['future', 'recent', 'past'])
  expect(groups[0]!.nearest?.id).toBe('future')
})

test('검색은 제목·장소를 찾고 상태는 교집합으로 거른다', () => {
  const items = [
    meetingSample({ title: '총회', status: 'cancelled' }),
    meetingSample({ title: '부서 회의', place: '총회실' }),
  ]
  expect(meetingGroups(items, '총회', 'cancelled', '2026-10-29T12:00')[0]!.meetings).toHaveLength(1)
  expect(meetingGroups(items, '없는 말', null, '2026-10-29T12:00')).toEqual([])
})

test('회의 일시와 예상 시간을 한국 시각으로 표시한다', () => {
  expect(meetingTime('2026-10-29T14:00', '2026-10-29T15:30')).toMatch(
    /10월 29일 \(목\) 14:00~15:30/,
  )
  expect(meetingDuration('2026-10-29T14:00', '2026-10-29T15:30')).toBe('1시간 30분')
  expect(meetingDuration('2026-10-29T14:00', null)).toBe('미정')
})

test('내 회의는 할 일 차례(진행 중·회의록 정리·참석 예정) 다음 이른 순이고 할 일 문구에 진행 권한이 없다', () => {
  const rows = myMeetingRows([
    meetingSample({ id: 'later', status: 'scheduled', heldAt: '2026-11-05T10:00' }),
    meetingSample({ id: 'wrap', status: 'wrapping_up', heldAt: '2026-10-27T10:00' }),
    meetingSample({ id: 'soon', status: 'scheduled', heldAt: '2026-10-30T10:00' }),
    meetingSample({ id: 'now', status: 'in_progress', heldAt: '2026-10-29T11:00' }),
  ])
  expect(rows.map(row => [row.meeting.id, row.todo.label])).toEqual([
    ['now', '진행 중'],
    ['wrap', '회의록 정리 필요'],
    ['soon', '참석 예정'],
    ['later', '참석 예정'],
  ])
  expect(rows.every(row => !row.todo.label.includes('진행 권한'))).toBe(true)
})

test('행사 회의는 다가오는 순 다음 지난 최근 순이다', () => {
  const now = '2026-10-29T12:00'
  const items = [
    meetingSample({ id: 'past', heldAt: '2026-10-20T12:00', endsAt: '2026-10-20T13:00' }),
    meetingSample({ id: 'future', heldAt: '2026-10-30T12:00', endsAt: '2026-10-30T13:00' }),
  ]
  expect(sortedMeetings(items, now).map(item => item.id)).toEqual(['future', 'past'])
})
