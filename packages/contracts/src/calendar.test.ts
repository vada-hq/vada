import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  CALENDAR_KINDS,
  CALENDAR_KIND_LABELS,
  CALENDAR_SOURCES,
  CalendarQuerySchema,
  calendarTitleOf,
  type CalendarItem,
} from './index.js'

test('캘린더 쿼리는 실제 한국 날짜로 양 끝을 포함해 92일까지 받는다', () => {
  for (const query of [
    { from: '2026-10-28', to: '2026-10-28' },
    { from: '2026-10-01', to: '2026-12-31' },
    { from: '2028-02-29', to: '2028-03-01' },
    { from: '2999-12-31', to: '2999-12-31' },
  ])
    assert.ok(CalendarQuerySchema.safeParse(query).success, JSON.stringify(query))
  for (const query of [
    {},
    { from: '2026-10-28' },
    { to: '2026-10-28' },
    { from: '2026-10-29', to: '2026-10-28' },
    { from: '2026-10-01', to: '2027-01-01' },
    { from: '2026-02-29', to: '2026-03-01' },
    { from: '2026-13-01', to: '2026-13-01' },
    { from: '2026-1-01', to: '2026-01-02' },
    { from: '', to: '2026-10-28' },
    { from: ' ', to: '2026-10-28' },
    { from: '2026-10-28\u0000', to: '2026-10-28' },
    { from: '2026-10-28\uD800', to: '2026-10-28' },
    { from: '2026-10-28😀', to: '2026-10-28' },
    { from: '1999-12-31', to: '2000-01-01' },
    { from: '2026-10-28', to: '2026-10-28', extra: true },
  ])
    assert.equal(CalendarQuerySchema.safeParse(query).success, false, JSON.stringify(query))
})

test('여섯 종류·원본과 공통 이름을 정하고 신청 마감·구매 필요일에만 말을 붙인다', () => {
  assert.deepEqual(CALENDAR_KINDS, [
    'event',
    'meeting',
    'deadline',
    'academic',
    'external',
    'other',
  ])
  assert.deepEqual(CALENDAR_SOURCES, [
    'event',
    'task_due',
    'registration_close',
    'purchase_needed_by',
    'meeting',
    'schedule_item',
  ])
  assert.deepEqual(
    CALENDAR_KINDS.map(kind => CALENDAR_KIND_LABELS[kind]),
    ['행사', '회의', '마감', '시험·학사', '외부', '기타'],
  )
  const item: CalendarItem = {
    key: 'event:id',
    source: 'event',
    kind: 'event',
    title: '봄 축제',
    allDay: false,
    start: '2026-10-28T12:00',
    end: null,
    place: null,
    event: null,
    department: null,
    mine: false,
    overdue: false,
    target: { record: 'events', id: 'id', tab: 'overview' },
  }
  for (const source of CALENDAR_SOURCES) {
    const expected =
      source === 'registration_close'
        ? '봄 축제 신청 마감'
        : source === 'purchase_needed_by'
          ? '봄 축제 필요'
          : '봄 축제'
    assert.equal(calendarTitleOf({ ...item, source }), expected)
  }
})
