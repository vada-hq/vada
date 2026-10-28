import type { CalendarItem, ScheduleItemDetail } from '@vada/contracts'
import { calendarItem } from './calendar-fixtures'

export const SCHEDULE_ID = '0199d1a0-0000-7000-8000-000000000051'
export const DEPARTMENT_ID = '0199d1a0-0000-7000-8000-0000000000d1'
export const EVENT_ID = '0199d1a0-0000-7000-8000-0000000000e1'
export const scheduleDetail = (extra: Partial<ScheduleItemDetail> = {}): ScheduleItemDetail => ({
  id: SCHEDULE_ID,
  title: '학교 답사',
  type: 'other',
  allDay: true,
  start: '2026-10-28',
  end: null,
  place: '학생회관',
  memo: '출입구 확인',
  department: { id: DEPARTMENT_ID, name: '기획부' },
  visibility: 'council',
  event: { id: EVENT_ID, name: '가을 축제' },
  createdBy: { id: '0199d1a0-0000-7000-8000-000000000001', name: '김기획', current: true },
  createdAt: '2026-10-20T03:00:00Z',
  actions: ['schedule_item.update', 'schedule_item.cancel'],
  ...extra,
})

export const scheduleCalendarItem = (extra: Partial<CalendarItem> = {}) =>
  calendarItem({
    key: `schedule_item:${SCHEDULE_ID}`,
    source: 'schedule_item',
    kind: 'other',
    title: '학교 답사',
    target: { record: 'schedule', id: SCHEDULE_ID },
    ...extra,
  })
