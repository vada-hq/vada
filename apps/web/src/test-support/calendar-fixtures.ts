import type { CalendarItem } from '@vada/contracts'

const EVENT_ID = '0199d1a0-0000-7000-8000-0000000000e1'
const TASK_ID = '0199d1a0-0000-7000-8000-0000000000a1'
const PURCHASE_ID = '0199d1a0-0000-7000-8000-0000000000b1'

export const calendarItem = (extra: Partial<CalendarItem> = {}): CalendarItem => ({
  key: `task_due:${TASK_ID}`,
  source: 'task_due',
  kind: 'deadline',
  title: '현수막 주문',
  allDay: true,
  start: '2026-10-28',
  end: null,
  place: null,
  event: null,
  department: { id: '0199d1a0-0000-7000-8000-0000000000d1', name: '기획부' },
  mine: false,
  overdue: false,
  target: { record: 'tasks', id: TASK_ID },
  ...extra,
})

export const calendarItems: CalendarItem[] = [
  calendarItem(),
  calendarItem({
    key: `event:${EVENT_ID}`,
    source: 'event',
    kind: 'event',
    title: '가을 축제',
    allDay: false,
    start: '2026-10-28T14:00',
    end: '2026-10-30T18:00',
    department: null,
    target: { record: 'events', id: EVENT_ID, tab: 'overview' },
  }),
  calendarItem({
    key: 'registration_close:0199d1a0-0000-7000-8000-0000000000f1',
    source: 'registration_close',
    title: '공연 참가',
    allDay: false,
    start: '2026-10-28T18:00',
    department: null,
    event: { id: EVENT_ID, name: '가을 축제' },
    target: { record: 'events', id: EVENT_ID, tab: 'registrations' },
  }),
  calendarItem({
    key: `purchase_needed_by:${PURCHASE_ID}`,
    source: 'purchase_needed_by',
    title: '음향 장비',
    target: { record: 'purchases', id: PURCHASE_ID },
  }),
  calendarItem({
    key: 'task_due:0199d1a0-0000-7000-8000-0000000000a2',
    title: '지난 물품 확인',
    start: '2026-10-27',
    overdue: true,
    target: { record: 'tasks', id: '0199d1a0-0000-7000-8000-0000000000a2' },
  }),
  calendarItem({
    key: 'event:0199d1a0-0000-7000-8000-0000000000e2',
    source: 'event',
    kind: 'event',
    title: '지난달 행사',
    start: '2026-09-30',
    department: null,
    target: { record: 'events', id: '0199d1a0-0000-7000-8000-0000000000e2', tab: 'overview' },
  }),
]

const MEETING_ID = '0199d1a0-0000-7000-8000-0000000000c1'
export const calendarMeetingItem = calendarItem({
  key: `meeting:${MEETING_ID}`,
  source: 'meeting',
  kind: 'meeting',
  title: '운영 회의',
  allDay: false,
  start: '2026-10-29T19:00',
  end: '2026-10-29T20:00',
  place: '학생회실',
  mine: true,
  target: { record: 'meetings', id: MEETING_ID },
})
